package com.pxwork.course.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.dto.QuestionBindItem;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.ExamQuestion;
import com.pxwork.course.entity.Question;
import com.pxwork.course.mapper.ExamQuestionMapper;
import com.pxwork.course.service.ExamQuestionService;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.QuestionService;

@Service
public class ExamQuestionServiceImpl extends ServiceImpl<ExamQuestionMapper, ExamQuestion> implements ExamQuestionService {

    @Autowired
    private ExamService examService;

    @Autowired
    private QuestionService questionService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> bindQuestions(Long examId, List<QuestionBindItem> questionItems) {
        Exam exam = examService.getById(examId);
        if (exam == null) {
            throw new IllegalArgumentException("考试不存在");
        }
        if (questionItems == null || questionItems.isEmpty()) {
            throw new IllegalArgumentException("请选择要绑定的题目");
        }

        Map<Long, BigDecimal> questionScoreMap = new HashMap<>();
        for (QuestionBindItem item : questionItems) {
            if (item == null || item.getQuestionId() == null || item.getQuestionId() <= 0) {
                continue;
            }
            BigDecimal score = item.getScore() == null ? BigDecimal.ZERO : item.getScore();
            if (score.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("手动选题的题目分值必须大于0");
            }
            questionScoreMap.putIfAbsent(item.getQuestionId(), score);
        }

        List<Long> distinctRequestedIds = new ArrayList<>(questionScoreMap.keySet());
        if (distinctRequestedIds.isEmpty()) {
            throw new IllegalArgumentException("请选择要绑定的题目");
        }

        List<Question> existingQuestions = questionService.list(new LambdaQueryWrapper<Question>()
                .eq(Question::getCourseId, exam.getCourseId())
                .in(Question::getId, distinctRequestedIds));
        if (existingQuestions.isEmpty()) {
            throw new IllegalArgumentException("所选题目不存在，或不属于当前课程题库");
        }
        Set<Long> validQuestionIds = existingQuestions.stream()
                .map(Question::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (validQuestionIds.size() != distinctRequestedIds.size()) {
            throw new IllegalArgumentException("所选题目中存在无效题目，或包含其他课程题目，请重新选择");
        }

        BigDecimal totalScore = validQuestionIds.stream()
                .map(id -> questionScoreMap.getOrDefault(id, BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalScore.compareTo(new BigDecimal("100")) != 0) {
            throw new IllegalArgumentException("手动选题总分必须正好为100分，当前为" + totalScore.stripTrailingZeros().toPlainString() + "分");
        }

        List<ExamQuestion> toSave = new ArrayList<>();
        int nextSort = 1;
        for (Long questionId : validQuestionIds) {
            ExamQuestion relation = new ExamQuestion();
            relation.setExamId(examId);
            relation.setQuestionId(questionId);
            relation.setScore(questionScoreMap.get(questionId));
            relation.setSort(nextSort++);
            toSave.add(relation);
        }

        this.remove(new LambdaQueryWrapper<ExamQuestion>().eq(ExamQuestion::getExamId, examId));
        this.saveBatch(toSave);

        Map<String, Object> result = new HashMap<>();
        result.put("examId", examId);
        result.put("requestedCount", distinctRequestedIds.size());
        result.put("validCount", validQuestionIds.size());
        result.put("replacedCount", toSave.size());
        result.put("totalScore", totalScore);
        result.put("boundQuestionIds", new ArrayList<>(validQuestionIds));
        return result;
    }

    @Override
    public BigDecimal getTotalScoreByExamId(Long examId) {
        if (examId == null || examId <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal totalScore = baseMapper.selectTotalScoreByExamId(examId);
        return totalScore == null ? BigDecimal.ZERO : totalScore;
    }

    @Override
    public BigDecimal selectTotalScoreByExamId(Long examId) {
        return getTotalScoreByExamId(examId);
    }
}
