package com.pxwork.course.dto;

import java.math.BigDecimal;

public class QuestionBindItem {
    private Long questionId;
    private BigDecimal score;

    public Long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Long questionId) {
        this.questionId = questionId;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }
}
