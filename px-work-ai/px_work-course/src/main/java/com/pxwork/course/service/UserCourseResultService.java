package com.pxwork.course.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.course.entity.UserCourseResult;

public interface UserCourseResultService extends IService<UserCourseResult> {

    UserCourseResult calculateAggregateScore(Long userId, Long courseId);
}
