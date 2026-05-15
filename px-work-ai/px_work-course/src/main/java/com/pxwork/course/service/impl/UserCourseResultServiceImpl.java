package com.pxwork.course.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.ProcessEvaluation;
import com.pxwork.course.entity.PracticalEvaluation;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.entity.UserCourseResult;
import com.pxwork.course.entity.UserExam;
import com.pxwork.course.mapper.UserCourseResultMapper;
import com.pxwork.course.mapper.UserExamMapper;
import com.pxwork.course.service.CertificateService;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.ExamQuestionService;
import com.pxwork.course.service.PracticalEvaluationService;
import com.pxwork.course.service.ProcessEvaluationService;
import com.pxwork.course.service.UserCourseEnrollmentService;
import com.pxwork.course.service.UserCourseResultService;

@Service
public class UserCourseResultServiceImpl extends ServiceImpl<UserCourseResultMapper, UserCourseResult>
        implements UserCourseResultService {

    private static final BigDecimal DEFAULT_EXAMS_WEIGHT = new BigDecimal("0.40");
    private static final BigDecimal DEFAULT_PROCESS_WEIGHT = new BigDecimal("0.30");
    private static final BigDecimal DEFAULT_PRACTICAL_WEIGHT = new BigDecimal("0.30");
    private static final BigDecimal DEFAULT_PASS_SCORE = new BigDecimal("60");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    @Autowired
    private UserExamMapper userExamMapper;

    @Autowired
    private ProcessEvaluationService processEvaluationService;

    @Autowired
    private PracticalEvaluationService practicalEvaluationService;

    @Autowired
    private CourseService courseService;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Autowired
    private ExamQuestionService examQuestionService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserCourseResult calculateAggregateScore(Long userId, Long courseId) {
        if (userId == null || courseId == null) {
            throw new IllegalArgumentException("userId 和 courseId 不能为空");
        }

        Course course = courseService.getById(courseId);
        if (course == null) {
            throw new IllegalArgumentException("课程不存在");
        }

        List<UserExam> finishedExams = userExamMapper.selectList(new LambdaQueryWrapper<UserExam>()
                .eq(UserExam::getUserId, userId)
                .eq(UserExam::getCourseId, courseId)
                .eq(UserExam::getStatus, 2));
        BigDecimal examsAvgScore = calculateNormalizedExamsAvg(finishedExams);
        BigDecimal practicalScore = calculateNormalizedPracticalScore(userId, courseId);
        BigDecimal processScore = calculateNormalizedProcessScore(userId, courseId);

        BigDecimal weightExams = normalizeWeight(course.getWeightExams(), DEFAULT_EXAMS_WEIGHT);
        BigDecimal weightProcess = normalizeWeight(course.getWeightProcess(), DEFAULT_PROCESS_WEIGHT);
        BigDecimal weightPractical = normalizeWeight(course.getWeightPractical(), DEFAULT_PRACTICAL_WEIGHT);

        BigDecimal totalScore = examsAvgScore.multiply(weightExams)
                .add(processScore.multiply(weightProcess))
                .add(practicalScore.multiply(weightPractical))
                .setScale(2, RoundingMode.HALF_UP);
        boolean passed = totalScore.compareTo(DEFAULT_PASS_SCORE) >= 0;

        UserCourseResult result = getOne(new LambdaQueryWrapper<UserCourseResult>()
                .eq(UserCourseResult::getUserId, userId)
                .eq(UserCourseResult::getCourseId, courseId)
                .last("LIMIT 1"));
        if (result == null) {
            result = new UserCourseResult();
            result.setUserId(userId);
            result.setCourseId(courseId);
        }
        result.setExamsAvgScore(examsAvgScore);
        result.setProcessScore(processScore);
        result.setPracticalScore(practicalScore);
        result.setTotalScore(totalScore);
        result.setIsPassed(passed ? 1 : 0);
        result.setUpdatedAt(LocalDateTime.now());

        if (result.getId() == null) {
            save(result);
        } else {
            updateById(result);
        }

        syncCertificateAndEnrollment(userId, courseId, passed);
        return result;
    }

    private void syncCertificateAndEnrollment(Long userId, Long courseId, boolean passed) {
        if (passed) {
            long certCount = certificateService.count(new LambdaQueryWrapper<Certificate>()
                    .eq(Certificate::getUserId, userId)
                    .eq(Certificate::getCourseId, courseId));
            if (certCount == 0) {
                Certificate certificate = new Certificate();
                certificate.setUserId(userId);
                certificate.setCourseId(courseId);
                certificate.setCertNo(buildCertNo(userId, courseId));
                certificate.setIssueDate(LocalDate.now());
                certificate.setStatus(0);
                certificateService.save(certificate);
            }
            UserCourseEnrollment enrollment = userCourseEnrollmentService.getOne(new LambdaQueryWrapper<UserCourseEnrollment>()
                    .eq(UserCourseEnrollment::getUserId, userId)
                    .eq(UserCourseEnrollment::getCourseId, courseId)
                    .last("LIMIT 1"));
            if (enrollment != null && !Integer.valueOf(1).equals(enrollment.getStatus())) {
                enrollment.setStatus(1);
                userCourseEnrollmentService.updateById(enrollment);
            }
            return;
        }

        certificateService.remove(new LambdaQueryWrapper<Certificate>()
                .eq(Certificate::getUserId, userId)
                .eq(Certificate::getCourseId, courseId));
    }

    private BigDecimal calculateNormalizedExamsAvg(List<UserExam> finishedExams) {
        if (finishedExams == null || finishedExams.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (UserExam exam : finishedExams) {
            BigDecimal maxRawScore = examQuestionService.getTotalScoreByExamId(exam.getExamId());
            if (maxRawScore.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            BigDecimal actualScore = valueOrZero(exam.getFinalScore());
            BigDecimal normalizedExamScore = normalizeToHundred(actualScore, maxRawScore);
            sum = sum.add(normalizedExamScore);
            count++;
        }
        if (count == 0) {
            return BigDecimal.ZERO;
        }
        return sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateNormalizedProcessScore(Long userId, Long courseId) {
        ProcessEvaluation latestEvaluation = processEvaluationService.getOne(new LambdaQueryWrapper<ProcessEvaluation>()
                .eq(ProcessEvaluation::getUserId, userId)
                .eq(ProcessEvaluation::getCourseId, courseId)
                .orderByDesc(ProcessEvaluation::getId)
                .last("LIMIT 1"));
        return valueOrZero(latestEvaluation == null ? null : latestEvaluation.getTotalScore());
    }

    private BigDecimal calculateNormalizedPracticalScore(Long userId, Long courseId) {
        PracticalEvaluation latestEvaluation = practicalEvaluationService.getOne(new LambdaQueryWrapper<PracticalEvaluation>()
                .eq(PracticalEvaluation::getUserId, userId)
                .eq(PracticalEvaluation::getCourseId, courseId)
                .orderByDesc(PracticalEvaluation::getId)
                .last("LIMIT 1"));
        return valueOrZero(latestEvaluation == null ? null : latestEvaluation.getTotalScore());
    }

    private BigDecimal normalizeToHundred(BigDecimal rawScore, BigDecimal fullScore) {
        BigDecimal safeRaw = valueOrZero(rawScore);
        BigDecimal safeFull = valueOrZero(fullScore);
        if (safeFull.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return safeRaw.multiply(HUNDRED).divide(safeFull, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizeWeight(BigDecimal value, BigDecimal defaultValue) {
        BigDecimal result = valueOrZero(value);
        if (result.compareTo(BigDecimal.ZERO) < 0) {
            return defaultValue;
        }
        return result;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String buildCertNo(Long userId, Long courseId) {
        return "CERT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + "-" + userId + "-" + courseId;
    }
}
