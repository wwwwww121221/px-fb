package com.pxwork.api.controller.backend;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.service.ai.DifyApiService;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.ExamQuestion;
import com.pxwork.course.entity.Question;
import com.pxwork.course.entity.UserExam;
import com.pxwork.course.entity.UserExamAnswer;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.ExamQuestionService;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.QuestionService;
import com.pxwork.course.service.UserExamAnswerService;
import com.pxwork.course.service.UserExamService;
import com.pxwork.course.service.ai.AiQuestionParseUtil;
import com.pxwork.system.entity.AdminUser;
import com.pxwork.system.service.AdminUserService;

import cn.dev33.satoken.stp.StpUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "3.4 后台-试卷与考试管理")
@RestController
@RequestMapping("/backend")
public class BackendExamController {

    @Autowired
    private ExamService examService;

    @Autowired
    private ExamQuestionService examQuestionService;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserExamService userExamService;

    @Autowired
    private UserExamAnswerService userExamAnswerService;

    @Autowired
    private DifyApiService difyApiService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private AiQuestionParseUtil aiQuestionParseUtil;

    @Autowired
    private UserService userService;

    @Operation(summary = "考试分页列表")
    @GetMapping("/exams")
    public Result<Page<Exam>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) String title) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);

        Page<Exam> page = new Page<>(current, size);
        LambdaQueryWrapper<Exam> queryWrapper = new LambdaQueryWrapper<>();

        if (!isSuperAdmin) {
            if (courseId != null && courseId > 0 && !isCourseOwnedByTeacher(courseId, currentAdminId)) {
                return Result.fail("无权限查看该课程考试");
            }
            List<Long> ownCourseIds = courseService.list(new LambdaQueryWrapper<Course>()
                            .eq(Course::getTeacherId, currentAdminId))
                    .stream()
                    .map(Course::getId)
                    .collect(Collectors.toList());
            if (ownCourseIds.isEmpty()) {
                return Result.success(new Page<>(current, size));
            }
            queryWrapper.in(Exam::getCourseId, ownCourseIds);
        }

        if (courseId != null && courseId > 0) {
            queryWrapper.eq(Exam::getCourseId, courseId);
        }
        if (StringUtils.hasText(title)) {
            queryWrapper.like(Exam::getTitle, title);
        }
        queryWrapper.orderByDesc(Exam::getCreatedAt);
        return Result.success(examService.page(page, queryWrapper));
    }

    @Operation(summary = "考试详情")
    @GetMapping("/exams/{id}")
    public Result<Exam> detail(@PathVariable Long id) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Exam exam = examService.getById(id);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限查看该考试");
        }
        return Result.success(exam);
    }

    @Operation(summary = "创建考试")
    @PostMapping("/exams")
    public Result<Boolean> create(@RequestBody @Validated ExamRequest request) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Course course = courseService.getById(request.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentAdminId.equals(course.getTeacherId())) {
            return Result.fail("无权限在该课程下创建考试");
        }
        Exam exam = toExam(request);
        return Result.success(examService.save(exam));
    }

    @Operation(summary = "更新考试")
    @PutMapping("/exams/{id}")
    public Result<Boolean> update(@PathVariable Long id, @RequestBody @Validated ExamRequest request) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Exam exists = examService.getById(id);
        if (exists == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exists.getCourseId(), currentAdminId)) {
            return Result.fail("无权限修改该考试");
        }
        Course course = courseService.getById(request.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentAdminId.equals(course.getTeacherId())) {
            return Result.fail("无权限将考试关联到该课程");
        }
        Exam exam = toExam(request);
        exam.setId(id);
        return Result.success(examService.updateById(exam));
    }

    @Operation(summary = "删除考试")
    @DeleteMapping("/exams/{id}")
    @Transactional(rollbackFor = Exception.class)
    public Result<Boolean> delete(@PathVariable Long id) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Exam exam = examService.getById(id);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限删除该考试");
        }

        examQuestionService.remove(new LambdaQueryWrapper<ExamQuestion>().eq(ExamQuestion::getExamId, id));
        List<UserExam> userExams = userExamService.list(new LambdaQueryWrapper<UserExam>().eq(UserExam::getExamId, id));
        if (!userExams.isEmpty()) {
            List<Long> userExamIds = userExams.stream().map(UserExam::getId).collect(Collectors.toList());
            userExamAnswerService.remove(new LambdaQueryWrapper<UserExamAnswer>().in(UserExamAnswer::getUserExamId, userExamIds));
            userExamService.removeByIds(userExamIds);
        }

        return Result.success(examService.removeById(id));
    }

    @Operation(summary = "手动绑定试卷题目")
    @PostMapping("/exams/{id}/bind-questions")
    public Result<Map<String, Object>> bindQuestions(@PathVariable Long id, @RequestBody List<Long> questionIds) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Exam exam = examService.getById(id);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限操作该考试");
        }
        try {
            Map<String, Object> result = examQuestionService.bindQuestions(id, questionIds);
            return Result.success(result);
        } catch (IllegalArgumentException e) {
            return Result.fail(e.getMessage());
        }
    }

    @Operation(summary = "传统自动组卷")
    @PostMapping("/exams/{id}/auto-generate")
    public Result<Map<String, Object>> autoGenerate(@PathVariable Long id, @RequestBody Map<String, QuestionTypeConfig> questionConfigMap) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Exam exam = examService.getById(id);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限操作该考试");
        }
        if (questionConfigMap == null || questionConfigMap.isEmpty()) {
            return Result.fail("题型抽取配置不能为空");
        }
        Course course = courseService.getById(exam.getCourseId());

        List<ExamQuestion> generated = new ArrayList<>();
        int sort = 1;
        for (Map.Entry<String, QuestionTypeConfig> entry : questionConfigMap.entrySet()) {
            String questionType = entry.getKey();
            QuestionTypeConfig config = entry.getValue();
            Integer count = config == null ? null : config.getCount();
            BigDecimal score = config == null || config.getScore() == null ? BigDecimal.ONE : config.getScore();
            if (!StringUtils.hasText(questionType) || count == null || count <= 0) {
                continue;
            }
            LambdaQueryWrapper<Question> queryWrapper = new LambdaQueryWrapper<Question>()
                    .eq(Question::getQuestionType, questionType);
            if (course != null && StringUtils.hasText(course.getTargetRoles())) {
                String[] roles = course.getTargetRoles().split(",");
                queryWrapper.and(wrapper -> {
                    boolean added = false;
                    for (String role : roles) {
                        if (StringUtils.hasText(role)) {
                            if (added) {
                                wrapper.or();
                            }
                            wrapper.apply("FIND_IN_SET({0}, job_role_tag)", role.trim());
                            added = true;
                        }
                    }
                });
            }
            List<Question> candidates = questionService.list(queryWrapper);
            if (candidates.size() < count) {
                return Result.fail("题型[" + questionType + "]可用题量不足");
            }
            Collections.shuffle(candidates);
            for (int i = 0; i < count; i++) {
                Question question = candidates.get(i);
                ExamQuestion examQuestion = new ExamQuestion();
                examQuestion.setExamId(id);
                examQuestion.setQuestionId(question.getId());
                examQuestion.setScore(score);
                examQuestion.setSort(sort++);
                generated.add(examQuestion);
            }
        }
        examQuestionService.remove(new LambdaQueryWrapper<ExamQuestion>().eq(ExamQuestion::getExamId, id));
        if (!generated.isEmpty()) {
            examQuestionService.saveBatch(generated);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("examId", id);
        result.put("questionCount", generated.size());
        return Result.success(result);
    }

    @Operation(summary = "AI一键出卷")
    @PostMapping(value = "/exams/ai-generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional(rollbackFor = Exception.class)
    public Result<Long> aiGenerate(@RequestParam("file") MultipartFile file,
            @RequestParam("courseId") Long courseId,
            @RequestParam("title") String title,
            @RequestParam("jobRoleTag") String jobRoleTag,
            @RequestParam(value = "questionConfig", defaultValue = "{\"单选\":{\"count\":5,\"score\":2}}") String questionConfigJson) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        if (file == null || file.isEmpty()) {
            return Result.fail("课件文档不能为空");
        }
        if (courseId == null || courseId <= 0) {
            return Result.fail("课程ID不能为空");
        }
        if (!StringUtils.hasText(title)) {
            return Result.fail("试卷名称不能为空");
        }
        if (!StringUtils.hasText(jobRoleTag)) {
            return Result.fail("岗位要求不能为空");
        }
        Course course = courseService.getById(courseId);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentAdminId.equals(course.getTeacherId())) {
            return Result.fail("无权限在该课程下AI出卷");
        }
        try {
            Map<String, QuestionTypeConfig> configMap = objectMapper.readValue(questionConfigJson, new TypeReference<Map<String, QuestionTypeConfig>>() {
            });
            if (configMap == null || configMap.isEmpty()) {
                return Result.fail("题型数量配置不能为空");
            }
            StringBuilder requirementsBuilder = new StringBuilder();
            int totalExpected = 0;
            Map<String, BigDecimal> typeScoreMap = new HashMap<>();
            for (Map.Entry<String, QuestionTypeConfig> entry : configMap.entrySet()) {
                QuestionTypeConfig config = entry.getValue();
                Integer count = config == null ? null : config.getCount();
                if (count != null && count > 0) {
                    requirementsBuilder.append("【").append(entry.getKey()).append("】").append(count).append("道，");
                    totalExpected += count;
                    String normalizedType = aiQuestionParseUtil.normalizeQuestionType(entry.getKey());
                    BigDecimal score = config.getScore() == null ? BigDecimal.ONE : config.getScore();
                    typeScoreMap.put(normalizedType, score);
                }
            }
            if (totalExpected == 0) {
                return Result.fail("题目总数不能为0");
            }
            String questionRequirements = requirementsBuilder.toString();

            String fileId = difyApiService.uploadFile(file);
            Map<String, Object> inputs = new HashMap<>();
            inputs.put("job_roles", jobRoleTag);
            inputs.put("question_requirements", questionRequirements);
            String aiRawJson = difyApiService.runGenerateWorkflow(inputs, fileId);
            System.out.println("====== AI 原始返回数据 ======");
            System.out.println(aiRawJson);
            System.out.println("===========================");
            List<Question> questions = aiQuestionParseUtil.parseQuestions(aiRawJson, jobRoleTag, courseId);
            if (questions.isEmpty()) {
                return Result.fail("AI未生成有效题目");
            }

            boolean questionSaved = questionService.saveBatch(questions);
            if (!questionSaved) {
                return Result.fail("题库入库失败");
            }

            Exam exam = new Exam();
            exam.setCourseId(courseId);
            exam.setTitle(title);
            exam.setDuration(90);
            exam.setPassTotalScore(new BigDecimal("60"));
            boolean examSaved = examService.save(exam);
            if (!examSaved || exam.getId() == null) {
                return Result.fail("试卷创建失败");
            }

            List<ExamQuestion> examQuestions = new ArrayList<>();
            int sort = 1;
            for (Question question : questions) {
                if (question.getId() == null) {
                    return Result.fail("题目入库后缺少ID，无法组装试卷");
                }
                ExamQuestion examQuestion = new ExamQuestion();
                examQuestion.setExamId(exam.getId());
                examQuestion.setQuestionId(question.getId());
                examQuestion.setScore(typeScoreMap.getOrDefault(question.getQuestionType(), BigDecimal.ONE));
                examQuestion.setSort(sort++);
                examQuestions.add(examQuestion);
            }
            if (!examQuestions.isEmpty()) {
                boolean relationSaved = examQuestionService.saveBatch(examQuestions);
                if (!relationSaved) {
                    return Result.fail("试卷题目关联保存失败");
                }
            }
            return Result.success("AI出卷成功，请在列表审阅微调", exam.getId());
        } catch (Exception e) {
            return Result.fail("AI出卷失败: " + e.getMessage());
        }
    }

    @Operation(summary = "待批改试卷详情")
    @GetMapping("/user-exams/{id}/grading-detail")
    public Result<Map<String, Object>> gradingDetail(@PathVariable Long id) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        UserExam userExam = userExamService.getById(id);
        if (userExam == null) {
            return Result.fail("学员考试记录不存在");
        }
        Exam exam = examService.getById(userExam.getExamId());
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限查看该学员试卷");
        }
        List<UserExamAnswer> answerList = userExamAnswerService.list(new LambdaQueryWrapper<UserExamAnswer>()
                .eq(UserExamAnswer::getUserExamId, id));
        List<UserExamAnswer> subjectiveAnswers = answerList.stream()
                .filter(item -> item.getIsCorrect() == null)
                .collect(Collectors.toList());

        List<GradingQuestionDetailVO> details = new ArrayList<>();
        if (!subjectiveAnswers.isEmpty()) {
            Set<Long> questionIds = subjectiveAnswers.stream()
                    .map(UserExamAnswer::getQuestionId)
                    .collect(Collectors.toSet());
            List<Question> questionList = questionService.list(new LambdaQueryWrapper<Question>().in(Question::getId, questionIds));
            Map<Long, Question> questionMap = questionList.stream().collect(Collectors.toMap(Question::getId, item -> item));

            for (UserExamAnswer answer : subjectiveAnswers) {
                Question question = questionMap.get(answer.getQuestionId());
                if (question == null) {
                    continue;
                }
                GradingQuestionDetailVO vo = new GradingQuestionDetailVO();
                vo.setQuestionId(answer.getQuestionId());
                vo.setQuestion(question.getContent());
                vo.setStudentAnswer(answer.getUserAnswer());
                vo.setStandardAnswer(question.getStandardAnswer());
                vo.setAiScore(answer.getScore());
                vo.setAiComment(answer.getAiComment());
                vo.setTeacherComment(answer.getTeacherComment());
                details.add(vo);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("userExamId", userExam.getId());
        result.put("examId", userExam.getExamId());
        result.put("subjectiveQuestions", details);
        return Result.success(result);
    }

    @Operation(
            summary = "提交主观题最终批改结果（自动触发综合成绩汇总）",
            tags = {"3.2 后台-综合评价与成绩汇总"})
    @PutMapping("/user-exams/{id}/subjective-grade")
    public Result<Map<String, Object>> subjectiveGrade(@PathVariable Long id, @RequestBody @Validated SubjectiveGradeRequest request) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        if (request.getUserExamId() == null || !id.equals(request.getUserExamId())) {
            return Result.fail("路径参数与请求中的考试记录ID不一致");
        }
        UserExam userExam = userExamService.getById(id);
        if (userExam == null) {
            return Result.fail("学员考试记录不存在");
        }
        Exam exam = examService.getById(userExam.getExamId());
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限批改该学员试卷");
        }

        Set<Long> questionIds = request.getItems().stream().map(SubjectiveGradeItem::getQuestionId).collect(Collectors.toSet());
        List<UserExamAnswer> storedAnswers = userExamAnswerService.list(new LambdaQueryWrapper<UserExamAnswer>()
                .eq(UserExamAnswer::getUserExamId, id)
                .in(UserExamAnswer::getQuestionId, questionIds));
        Map<Long, UserExamAnswer> answerMap = storedAnswers.stream()
                .collect(Collectors.toMap(UserExamAnswer::getQuestionId, item -> item, (a, b) -> a));

        List<UserExamAnswer> toUpdate = new ArrayList<>();
        BigDecimal subjectiveScore = BigDecimal.ZERO;
        for (SubjectiveGradeItem item : request.getItems()) {
            UserExamAnswer answer = answerMap.get(item.getQuestionId());
            if (answer == null) {
                return Result.fail("题目[" + item.getQuestionId() + "]答题记录不存在");
            }
            if (answer.getIsCorrect() != null) {
                return Result.fail("题目[" + item.getQuestionId() + "]不是主观题，无法人工批改");
            }
            answer.setScore(item.getScore());
            answer.setTeacherComment(item.getTeacherComment());
            toUpdate.add(answer);
            subjectiveScore = subjectiveScore.add(item.getScore());
        }

        if (!toUpdate.isEmpty()) {
            userExamAnswerService.updateBatchById(toUpdate);
        }

        userExam.setSubjectiveScore(subjectiveScore);
        boolean updated = userExamService.updateById(userExam);
        if (!updated) {
            return Result.fail("更新主观题成绩失败");
        }

        Map<String, Object> finalResult = userExamService.calculateFinalResult(id);
        finalResult.put("finalized", true);
        return Result.success(finalResult);
    }

    @Operation(summary = "获取某场考试的所有学员成绩列表")
    @GetMapping("/exams/{examId}/student-results")
    public Result<List<Map<String, Object>>> getExamStudentResults(@PathVariable Long examId) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);

        Exam exam = examService.getById(examId);
        if (exam == null) {
            return Result.fail("考试不存在");
        }
        if (!isSuperAdmin && !isCourseOwnedByTeacher(exam.getCourseId(), currentAdminId)) {
            return Result.fail("无权限查看该考试成绩");
        }

        List<UserExam> userExams = userExamService.list(new LambdaQueryWrapper<UserExam>()
                .eq(UserExam::getExamId, examId)
                .orderByDesc(UserExam::getSubmitTime));

        if (userExams.isEmpty()) {
            return Result.success(new ArrayList<>());
        }

        Set<Long> userIds = userExams.stream().map(UserExam::getUserId).collect(Collectors.toSet());
        List<User> users = userService.listByIds(userIds);
        Map<Long, User> userMap = users.stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<Map<String, Object>> result = new ArrayList<>();
        for (UserExam ue : userExams) {
            Map<String, Object> map = new HashMap<>();
            map.put("userExamId", ue.getId());
            map.put("userId", ue.getUserId());

            User user = userMap.get(ue.getUserId());
            map.put("userName", user != null ? user.getName() : "未知学员");
            map.put("idCard", user != null ? user.getIdCard() : "");

            map.put("status", ue.getStatus());
            map.put("objectiveScore", ue.getObjectiveScore());
            map.put("subjectiveScore", ue.getSubjectiveScore());
            map.put("finalScore", ue.getFinalScore());
            map.put("submitTime", ue.getSubmitTime());
            result.add(map);
        }

        return Result.success(result);
    }

    private boolean isSuperAdmin(Long adminUserId) {
        AdminUser adminUser = adminUserService.getById(adminUserId);
        return adminUser != null && Integer.valueOf(1).equals(adminUser.getIsSuper());
    }

    private boolean isCourseOwnedByTeacher(Long courseId, Long teacherId) {
        if (courseId == null || teacherId == null) {
            return false;
        }
        Course course = courseService.getById(courseId);
        return course != null && teacherId.equals(course.getTeacherId());
    }

    private Exam toExam(ExamRequest request) {
        Exam exam = new Exam();
        exam.setCourseId(request.getCourseId());
        exam.setTitle(request.getTitle());
        exam.setDuration(request.getDuration());
        exam.setPassTotalScore(request.getPassTotalScore());
        return exam;
    }

    @Data
    public static class ExamRequest {
        @NotNull(message = "课程ID不能为空")
        private Long courseId;
        @NotBlank(message = "考试标题不能为空")
        private String title;
        @NotNull(message = "考试时长不能为空")
        private Integer duration;
        @NotNull(message = "综合合格总分不能为空")
        private BigDecimal passTotalScore;
    }

    @Data
    public static class QuestionTypeConfig {
        private Integer count;
        private BigDecimal score;
    }

    @Data
    public static class SubjectiveGradeRequest {
        @NotNull(message = "考试记录ID不能为空")
        private Long userExamId;
        @NotEmpty(message = "批改明细不能为空")
        @Valid
        private List<SubjectiveGradeItem> items;
    }

    @Data
    public static class SubjectiveGradeItem {
        @NotNull(message = "题目ID不能为空")
        private Long questionId;
        @NotNull(message = "分数不能为空")
        private BigDecimal score;
        private String teacherComment;
    }

    @Data
    public static class GradingQuestionDetailVO {
        private Long questionId;
        private String question;
        private String studentAnswer;
        private String standardAnswer;
        private BigDecimal aiScore;
        private String aiComment;
        private String teacherComment;
    }

}
