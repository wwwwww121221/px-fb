package com.pxwork.course.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.UserCourseResult;
import com.pxwork.course.entity.UserExam;
import com.pxwork.course.mapper.UserExamMapper;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.UserCourseResultService;
import com.pxwork.course.service.UserExamService;

@Service
public class UserExamServiceImpl extends ServiceImpl<UserExamMapper, UserExam> implements UserExamService {

    @Autowired
    private ExamService examService;

    @Autowired
    private UserCourseResultService userCourseResultService;

    @Override
    public Map<String, Object> calculateFinalResult(Long userExamId) {
        UserExam userExam = getById(userExamId);
        if (userExam == null) {
            throw new IllegalArgumentException("学员考试记录不存在");
        }
        Exam exam = examService.getById(userExam.getExamId());
        if (exam == null) {
            throw new IllegalArgumentException("考试配置不存在");
        }

        BigDecimal objectiveScore = valueOrZero(userExam.getObjectiveScore());
        BigDecimal subjectiveScore = valueOrZero(userExam.getSubjectiveScore());
        BigDecimal endScore = objectiveScore.add(subjectiveScore);
        BigDecimal finalScore = endScore.setScale(2, RoundingMode.HALF_UP);
        BigDecimal passLine = resolvePassLine(exam);
        boolean examPassed = finalScore.compareTo(passLine) >= 0;

        userExam.setFinalScore(finalScore);
        userExam.setStatus(2);
        userExam.setIsPassed(examPassed ? 1 : 0);
        updateById(userExam);
        UserCourseResult aggregateResult = userCourseResultService.calculateAggregateScore(userExam.getUserId(), userExam.getCourseId());

        Map<String, Object> result = new HashMap<>();
        result.put("userExamId", userExamId);
        result.put("endScore", endScore);
        result.put("finalScore", finalScore);
        result.put("examPassed", examPassed);
        result.put("aggregateTotalScore", aggregateResult.getTotalScore());
        result.put("aggregatePassed", Integer.valueOf(1).equals(aggregateResult.getIsPassed()));
        return result;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal resolvePassLine(Exam exam) {
        BigDecimal configured = exam.getPassTotalScore();
        if (configured == null || configured.compareTo(BigDecimal.ZERO) <= 0) {
            return new BigDecimal("60.00");
        }
        return configured.setScale(2, RoundingMode.HALF_UP);
    }
}
