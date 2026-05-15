package com.pxwork.course.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.pxwork.course.entity.ExamQuestion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ExamQuestionMapper extends BaseMapper<ExamQuestion> {

    @Select("SELECT COALESCE(SUM(score), 0) FROM exam_questions WHERE exam_id = #{examId}")
    java.math.BigDecimal selectTotalScoreByExamId(@Param("examId") Long examId);
}
