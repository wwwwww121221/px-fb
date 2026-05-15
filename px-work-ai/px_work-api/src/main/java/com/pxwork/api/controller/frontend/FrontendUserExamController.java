package com.pxwork.api.controller.frontend;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.api.service.AsyncAiGradingService;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.ExamQuestion;
import com.pxwork.course.entity.Question;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.entity.UserExam;
import com.pxwork.course.entity.UserExamAnswer;
import com.pxwork.course.service.ExamQuestionService;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.QuestionService;
import com.pxwork.course.service.UserCourseEnrollmentService;
import com.pxwork.course.service.UserExamAnswerService;
import com.pxwork.course.service.UserExamService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "4.6 前台-考试作答")
@RestController
@RequestMapping("/frontend/user-exams")
public class FrontendUserExamController {

    @Autowired
    private ExamService examService;

    @Autowired
    private UserExamService userExamService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Autowired
    private ExamQuestionService examQuestionService;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private UserExamAnswerService userExamAnswerService;

    @Autowired
    private AsyncAiGradingService asyncAiGradingService;

    @Operation(summary = "开始考试")
    @PostMapping
    @Transactional(rollbackFor = Exception.class)
    public synchronized Result<Map<String, Object>> start(@RequestBody @Validated StartExamRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        Exam exam = examService.getOne(new LambdaQueryWrapper<Exam>()
                .eq(Exam::getId, request.getExamId())
                .last("FOR UPDATE"));
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        long enrolled = userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getUserId, userId)
                .eq(UserCourseEnrollment::getCourseId, exam.getCourseId()));
        if (enrolled == 0) {
            return Result.fail("无考试权限，请先选课");
        }
        List<UserExam> historyExams = userExamService.list(new LambdaQueryWrapper<UserExam>()
                .eq(UserExam::getUserId, userId)
                .eq(UserExam::getExamId, request.getExamId())
                .orderByDesc(UserExam::getId));

        BigDecimal passLine = resolvePassLine(exam);
        for (UserExam history : historyExams) {
            BigDecimal historyFinal = history.getFinalScore() == null ? BigDecimal.ZERO : history.getFinalScore();
            boolean passedByLegacyScore = Integer.valueOf(2).equals(history.getStatus()) && historyFinal.compareTo(passLine) >= 0;
            if (Integer.valueOf(1).equals(history.getIsPassed()) || passedByLegacyScore) {
                Map<String, Object> data = new HashMap<>();
                data.put("userExamId", history.getId());
                data.put("examId", history.getExamId());
                data.put("status", history.getStatus());
                data.put("passed", true);
                data.put("showResult", true);
                return Result.success("您已通过该考试，正在返回考试成绩", data);
            }
        }

        for (UserExam history : historyExams) {
            if (Integer.valueOf(0).equals(history.getStatus())) {
                Map<String, Object> data = new HashMap<>();
                data.put("userExamId", history.getId());
                return Result.success(data);
            }
        }

        for (UserExam history : historyExams) {
            if (Integer.valueOf(1).equals(history.getStatus())) {
                return Result.fail("您有试卷正在等待老师批改，请在成绩公布后再尝试。");
            }
        }

        int failedCount = 0;
        for (UserExam history : historyExams) {
            Integer status = history.getStatus();
            if (!Integer.valueOf(2).equals(status)) {
                continue;
            }
            BigDecimal historyFinal = history.getFinalScore() == null ? BigDecimal.ZERO : history.getFinalScore();
            boolean passed = Integer.valueOf(1).equals(history.getIsPassed())
                    || historyFinal.compareTo(passLine) >= 0;
            if (!passed) {
                failedCount++;
            }
        }
        if (failedCount >= 2) {
            return Result.fail("您的免费补考次数已用完，无法再次参加考试");
        }
        UserExam userExam = new UserExam();
        userExam.setUserId(userId);
        userExam.setCourseId(exam.getCourseId());
        userExam.setExamId(request.getExamId());
        userExam.setStatus(0);
        userExam.setStartTime(LocalDateTime.now());
        userExam.setObjectiveScore(BigDecimal.ZERO);
        userExam.setSubjectiveScore(BigDecimal.ZERO);
        userExam.setFinalScore(BigDecimal.ZERO);
        userExam.setIsPassed(0);
        userExam.setMakeUpCount(failedCount);
        userExamService.save(userExam);
        Map<String, Object> result = new HashMap<>();
        result.put("userExamId", userExam.getId());
        result.put("examId", userExam.getExamId());
        return Result.success(result);
    }

    private BigDecimal resolvePassLine(Exam exam) {
        BigDecimal configured = exam.getPassTotalScore();
        if (configured == null || configured.compareTo(BigDecimal.ZERO) <= 0) {
            return new BigDecimal("60.00");
        }
        return configured;
    }

    @Operation(summary = "获取试卷题目")
    @GetMapping("/{id}/questions")
    public Result<List<UserExamQuestionVO>> questions(@PathVariable Long id) {
        long userId = StpUserUtil.getLoginIdAsLong();
        UserExam userExam = userExamService.getById(id);
        if (userExam == null || !userExam.getUserId().equals(userId)) {
            return Result.fail("考试记录不存在");
        }
        List<ExamQuestion> examQuestions = examQuestionService.list(new LambdaQueryWrapper<ExamQuestion>()
                .eq(ExamQuestion::getExamId, userExam.getExamId())
                .orderByAsc(ExamQuestion::getSort));
        if (examQuestions.isEmpty()) {
            return Result.success(List.of());
        }
        Set<Long> questionIds = examQuestions.stream().map(ExamQuestion::getQuestionId).collect(Collectors.toSet());
        List<Question> questionList = questionService.list(new LambdaQueryWrapper<Question>().in(Question::getId, questionIds));
        Map<Long, Question> questionMap = questionList.stream().collect(Collectors.toMap(Question::getId, q -> q));
        List<UserExamQuestionVO> result = new ArrayList<>();
        for (ExamQuestion examQuestion : examQuestions) {
            Question question = questionMap.get(examQuestion.getQuestionId());
            if (question == null) {
                continue;
            }
            UserExamQuestionVO vo = new UserExamQuestionVO();
            vo.setQuestionId(question.getId());
            vo.setQuestionType(question.getQuestionType());
            vo.setContent(question.getContent());
            vo.setOptions(question.getOptions());
            vo.setAnalysis(question.getAnalysis());
            vo.setScore(examQuestion.getScore());
            vo.setSort(examQuestion.getSort());
            result.add(vo);
        }
        return Result.success(result);
    }

    @Operation(summary = "获取单个考试状态")
    @GetMapping("/status/{examId}")
    public Result<Map<String, Object>> status(@PathVariable Long examId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        Exam exam = examService.getById(examId);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        long enrolled = userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getUserId, userId)
                .eq(UserCourseEnrollment::getCourseId, exam.getCourseId()));
        if (enrolled == 0) {
            return Result.fail("无考试权限，请先选课");
        }

        List<UserExam> historyExams = userExamService.list(new LambdaQueryWrapper<UserExam>()
                .eq(UserExam::getUserId, userId)
                .eq(UserExam::getExamId, examId)
                .orderByDesc(UserExam::getId));
        BigDecimal passLine = resolvePassLine(exam);

        UserExam passedExam = null;
        UserExam inProgressExam = null;
        UserExam waitingExam = null;
        int failedCount = 0;
        for (UserExam history : historyExams) {
            BigDecimal historyFinal = history.getFinalScore() == null ? BigDecimal.ZERO : history.getFinalScore();
            boolean passed = Integer.valueOf(1).equals(history.getIsPassed())
                    || (Integer.valueOf(2).equals(history.getStatus()) && historyFinal.compareTo(passLine) >= 0);
            if (passed && passedExam == null) {
                passedExam = history;
            }
            if (Integer.valueOf(0).equals(history.getStatus()) && inProgressExam == null) {
                inProgressExam = history;
            }
            if (Integer.valueOf(1).equals(history.getStatus()) && waitingExam == null) {
                waitingExam = history;
            }
            if (Integer.valueOf(2).equals(history.getStatus()) && !passed) {
                failedCount++;
            }
        }

        Map<String, Object> data = new HashMap<>();
        data.put("examId", examId);
        data.put("failedCount", failedCount);
        data.put("remainingRetakeCount", Math.max(0, 2 - failedCount));

        if (passedExam != null) {
            data.put("status", "PASSED");
            data.put("userExamId", passedExam.getId());
            data.put("canStart", false);
            data.put("showResult", true);
            data.put("message", "已通过考试");
            return Result.success(data);
        }
        if (inProgressExam != null) {
            data.put("status", "IN_PROGRESS");
            data.put("userExamId", inProgressExam.getId());
            data.put("canStart", true);
            data.put("showResult", false);
            data.put("message", "考试进行中，可继续作答");
            return Result.success(data);
        }
        if (waitingExam != null) {
            data.put("status", "WAITING_GRADING");
            data.put("userExamId", waitingExam.getId());
            data.put("canStart", false);
            data.put("showResult", false);
            data.put("message", "试卷待批改");
            return Result.success(data);
        }
        if (failedCount >= 2) {
            UserExam latestExam = historyExams.isEmpty() ? null : historyExams.get(0);
            data.put("status", "NO_RETAKE");
            data.put("canStart", false);
            data.put("remainingRetakeCount", 0);
            if (latestExam != null) {
                data.put("userExamId", latestExam.getId());
            }
            data.put("showResult", false);
            data.put("message", "补考次数已用完");
            return Result.success(data);
        }

        data.put("status", "NOT_STARTED");
        data.put("canStart", true);
        data.put("showResult", false);
        data.put("message", "可开始考试");
        return Result.success(data);
    }

    @Operation(summary = "获取考试成绩详情")
    @GetMapping("/{id}/result")
    public Result<Map<String, Object>> result(@PathVariable Long id) {
        long userId = StpUserUtil.getLoginIdAsLong();
        UserExam userExam = userExamService.getById(id);
        if (userExam == null || !userExam.getUserId().equals(userId)) {
            return Result.fail("考试记录不存在");
        }
        Exam exam = examService.getById(userExam.getExamId());
        if (exam == null) {
            return Result.fail("考试不存在");
        }

        Map<String, Object> data = new HashMap<>();
        data.put("userExamId", userExam.getId());
        data.put("examId", userExam.getExamId());
        data.put("examTitle", exam.getTitle());
        data.put("status", userExam.getStatus());
        data.put("objectiveScore", userExam.getObjectiveScore());
        data.put("subjectiveScore", userExam.getSubjectiveScore());
        data.put("finalScore", userExam.getFinalScore());
        data.put("isPassed", Integer.valueOf(1).equals(userExam.getIsPassed()));
        data.put("passScore", resolvePassLine(exam));
        data.put("submitTime", userExam.getSubmitTime());
        return Result.success(data);
    }

    @Operation(summary = "交卷")
    @PostMapping("/{id}/submit")
    public Result<Map<String, Object>> submit(@PathVariable Long id, @RequestBody @Validated SubmitExamRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        UserExam userExam = userExamService.getById(id);
        if (userExam == null || !userExam.getUserId().equals(userId)) {
            return Result.fail("考试记录不存在");
        }
        if (userExam.getStatus() != null && userExam.getStatus() != 0) {
            return Result.fail("当前考试状态不可交卷");
        }
        Exam exam = examService.getById(userExam.getExamId());
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (userExam.getStartTime() != null && exam.getDuration() != null) {
            long elapsedMinutes = Duration.between(userExam.getStartTime(), LocalDateTime.now()).toMinutes();
            if (elapsedMinutes > exam.getDuration() + 2L) {
                userExam.setObjectiveScore(BigDecimal.ZERO);
                userExam.setSubjectiveScore(BigDecimal.ZERO);
                userExam.setFinalScore(BigDecimal.ZERO);
                userExam.setStatus(2);
                userExam.setIsPassed(0);
                userExam.setSubmitTime(LocalDateTime.now());
                userExamService.updateById(userExam);
                return Result.fail("考试已严重超时，系统强制交卷，本次记为0分");
            }
        }
        List<ExamQuestion> examQuestions = examQuestionService.list(new LambdaQueryWrapper<ExamQuestion>()
                .eq(ExamQuestion::getExamId, userExam.getExamId()));
        if (examQuestions.isEmpty()) {
            return Result.fail("试卷未配置题目");
        }
        Map<Long, ExamQuestion> examQuestionMap = examQuestions.stream()
                .collect(Collectors.toMap(ExamQuestion::getQuestionId, item -> item, (a, b) -> a));
        Set<Long> answerQuestionIds = request.getAnswers().stream().map(AnswerItem::getQuestionId).collect(Collectors.toSet());
        List<Question> questions = questionService.list(new LambdaQueryWrapper<Question>().in(Question::getId, answerQuestionIds));
        Map<Long, Question> questionMap = questions.stream().collect(Collectors.toMap(Question::getId, q -> q));

        List<UserExamAnswer> answerDetails = new ArrayList<>();
        BigDecimal objectiveScore = BigDecimal.ZERO;
        int subjectiveCount = 0;
        for (AnswerItem answer : request.getAnswers()) {
            ExamQuestion examQuestion = examQuestionMap.get(answer.getQuestionId());
            Question question = questionMap.get(answer.getQuestionId());
            if (examQuestion == null || question == null) {
                continue;
            }
            BigDecimal questionScore = examQuestion.getScore() == null ? BigDecimal.ZERO : examQuestion.getScore();
            String studentAnswer = answer.getUserAnswer() == null ? "" : answer.getUserAnswer().trim();
            UserExamAnswer answerDetail = new UserExamAnswer();
            answerDetail.setUserExamId(userExam.getId());
            answerDetail.setQuestionId(answer.getQuestionId());
            answerDetail.setUserAnswer(answer.getUserAnswer());
            if (isObjectiveQuestion(question)) {
                String standard = question.getStandardAnswer() == null ? "" : question.getStandardAnswer().trim();
                boolean correct = isObjectiveAnswerCorrect(question, standard, studentAnswer);
                if (correct) {
                    objectiveScore = objectiveScore.add(questionScore);
                }
                answerDetail.setIsCorrect(correct ? 1 : 0);
                answerDetail.setScore(correct ? questionScore : BigDecimal.ZERO);
            } else {
                answerDetail.setIsCorrect(null);
                answerDetail.setScore(BigDecimal.ZERO);
                subjectiveCount++;
            }
            answerDetails.add(answerDetail);
        }
        userExamAnswerService.remove(new LambdaQueryWrapper<UserExamAnswer>().eq(UserExamAnswer::getUserExamId, userExam.getId()));
        if (!answerDetails.isEmpty()) {
            userExamAnswerService.saveBatch(answerDetails);
        }
        userExam.setObjectiveScore(objectiveScore);
        userExam.setStatus(1);
        userExam.setSubmitTime(LocalDateTime.now());
        userExamService.updateById(userExam);
        if (subjectiveCount > 0) {
            asyncAiGradingService.gradeSubjectiveAnswers(userExam.getId());
        } else {
            userExamService.calculateFinalResult(userExam.getId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("userExamId", userExam.getId());
        result.put("objectiveScore", objectiveScore);
        result.put("subjectiveCount", subjectiveCount);
        return Result.success(result);
    }

    private boolean isObjectiveQuestion(Question question) {
        String type = question.getQuestionType();
        if (StringUtils.hasText(type)) {
            String normalized = type.trim().toLowerCase();
            if ("single_choice".equals(normalized)
                    || "multiple_choice".equals(normalized)
                    || "true_false".equals(normalized)
                    || "judge".equals(normalized)
                    || "单选".equals(type.trim())
                    || "单选题".equals(type.trim())
                    || "多选".equals(type.trim())
                    || "多选题".equals(type.trim())
                    || "判断".equals(type.trim())
                    || "判断题".equals(type.trim())) {
                return true;
            }
            if ("short_answer".equals(normalized)
                    || "case_analysis".equals(normalized)
                    || "practical_application".equals(normalized)
                    || "subjective".equals(normalized)
                    || "简答".equals(type.trim())
                    || "简答题".equals(type.trim())
                    || "主观题".equals(type.trim())
                    || "案例分析".equals(type.trim())
                    || "案例分析题".equals(type.trim())
                    || "实操".equals(type.trim())
                    || "实操题".equals(type.trim())) {
                return false;
            }
        }

        String options = question.getOptions();
        if (!StringUtils.hasText(options)) {
            return false;
        }
        String normalizedOptions = options.trim();
        // 兼容 AI 生成题里 options = "[]" / "{}" / "null" 的场景，避免主观题被误判为客观题
        if ("[]".equals(normalizedOptions)
                || "{}".equals(normalizedOptions)
                || "null".equalsIgnoreCase(normalizedOptions)) {
            return false;
        }
        return true;
    }

    private boolean isObjectiveAnswerCorrect(Question question, String standard, String studentAnswer) {
        String type = question.getQuestionType() == null ? "" : question.getQuestionType().trim().toLowerCase();
        // 多选题按“选项集合”比对：忽略顺序、空格、大小写和中英文分隔符差异
        if ("multiple_choice".equals(type) || "多选".equals(question.getQuestionType()) || "多选题".equals(question.getQuestionType())) {
            return normalizeChoiceSet(standard).equals(normalizeChoiceSet(studentAnswer));
        }
        return normalizePlainObjectiveAnswer(standard).equalsIgnoreCase(normalizePlainObjectiveAnswer(studentAnswer));
    }

    private Set<String> normalizeChoiceSet(String raw) {
        if (!StringUtils.hasText(raw)) {
            return new LinkedHashSet<>();
        }
        String upper = raw.toUpperCase()
                .replace('，', ',')
                .replace('、', ',')
                .replace('；', ',')
                .replace(';', ',')
                .replace('|', ',')
                .replace('/', ',')
                .replaceAll("\\s+", "");

        String[] parts;
        if (upper.contains(",")) {
            parts = upper.split(",");
        } else if (upper.matches("^[A-Z]+$")) {
            parts = upper.split("");
        } else {
            parts = new String[] {upper};
        }

        return Arrays.stream(parts)
                .map(item -> item == null ? "" : item.replaceAll("[^A-Z0-9]", ""))
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizePlainObjectiveAnswer(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        return raw.trim()
                .replaceAll("[\\s，、,；;|/]", "")
                .toLowerCase();
    }

    // 🔴 下面是为你刚刚加的新接口！
    @Operation(summary = "获取指定课程下的所有考试列表")
    @GetMapping("/course/{courseId}")
    public Result<List<Exam>> getExamsByCourse(@PathVariable Long courseId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        
        // 1. 验证学生是否报名了这门课
        long enrolled = userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getUserId, userId)
                .eq(UserCourseEnrollment::getCourseId, courseId));
        if (enrolled == 0) {
            return Result.fail("您尚未报名该课程，无法查看考试");
        }

        // 2. 查询该课程下所有关联的考试
        List<Exam> exams = examService.list(new LambdaQueryWrapper<Exam>()
                .eq(Exam::getCourseId, courseId)
                .orderByDesc(Exam::getCreatedAt));
        
        return Result.success(exams);
    }

    @Data
    public static class StartExamRequest {
        @NotNull(message = "考试ID不能为空")
        private Long examId;
    }

    @Data
    public static class SubmitExamRequest {
        @NotEmpty(message = "答案列表不能为空")
        private List<AnswerItem> answers;
    }

    @Data
    public static class AnswerItem {
        @NotNull(message = "题目ID不能为空")
        private Long questionId;
        private String userAnswer;
    }

    @Data
    public static class UserExamQuestionVO {
        private Long questionId;
        private String questionType;
        private String content;
        private String options;
        private String analysis;
        private BigDecimal score;
        private Integer sort;
    }
}
