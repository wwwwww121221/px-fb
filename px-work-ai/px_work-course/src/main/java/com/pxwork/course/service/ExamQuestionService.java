package com.pxwork.course.service;

import java.util.List;
import java.util.Map;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.course.dto.QuestionBindItem;
import com.pxwork.course.entity.ExamQuestion;

public interface ExamQuestionService extends IService<ExamQuestion> {
    Map<String, Object> bindQuestions(Long examId, List<QuestionBindItem> questionItems);

    java.math.BigDecimal getTotalScoreByExamId(Long examId);

    java.math.BigDecimal selectTotalScoreByExamId(Long examId);

    default java.math.BigDecimal getExamTotalScore(Long examId) {
        return getTotalScoreByExamId(examId);
    }
}
