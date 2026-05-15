package com.pxwork.course.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.QuestionCategory;
import com.pxwork.course.mapper.QuestionCategoryMapper;
import com.pxwork.course.service.QuestionCategoryService;
import org.springframework.stereotype.Service;

@Service
public class QuestionCategoryServiceImpl extends ServiceImpl<QuestionCategoryMapper, QuestionCategory> implements QuestionCategoryService {
}
