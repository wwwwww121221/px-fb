package com.pxwork.course.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.course.entity.Course;

import java.io.Serializable;
import java.util.List;

public interface CourseService extends IService<Course> {
    Course getCourseDetails(Long courseId);
    boolean removeCourseWithRelations(Long courseId);
    List<Course> getPublishedCourses();
}
