package com.pxwork.course.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.pxwork.course.entity.Question;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface QuestionMapper extends BaseMapper<Question> {
}
