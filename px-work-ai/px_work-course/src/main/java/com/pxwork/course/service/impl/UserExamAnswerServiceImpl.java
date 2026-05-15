package com.pxwork.course.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.UserExamAnswer;
import com.pxwork.course.mapper.UserExamAnswerMapper;
import com.pxwork.course.service.UserExamAnswerService;
import org.springframework.stereotype.Service;

@Service
public class UserExamAnswerServiceImpl extends ServiceImpl<UserExamAnswerMapper, UserExamAnswer> implements UserExamAnswerService {
}
