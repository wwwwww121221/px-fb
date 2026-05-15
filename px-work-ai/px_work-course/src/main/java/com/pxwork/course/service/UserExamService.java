package com.pxwork.course.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.course.entity.UserExam;

import java.util.Map;

public interface UserExamService extends IService<UserExam> {
    Map<String, Object> calculateFinalResult(Long userExamId);
}
