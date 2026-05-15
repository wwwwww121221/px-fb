package com.pxwork.api.controller.backend;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.UserCourseEnrollmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "1.1 后台-控制台概览")
@RestController
@RequestMapping("/backend/dashboard")
public class BackendDashboardController {

    @Autowired
    private UserService userService;

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Operation(summary = "控制台概览数据")
    @GetMapping("/overview")
    public Result<Map<String, Object>> overview() {
        long totalStudents = userService.count();
        long activeCourses = courseService.count(new LambdaQueryWrapper<Course>()
                .eq(Course::getStatus, 1));

        long totalEnrollments = userCourseEnrollmentService.count();
        long completedEnrollments = userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getStatus, 1));

        BigDecimal avgCompletionRate = BigDecimal.ZERO;
        if (totalEnrollments > 0) {
            avgCompletionRate = BigDecimal.valueOf(completedEnrollments)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(totalEnrollments), 2, RoundingMode.HALF_UP);
        }

        Page<Course> recentCoursePage = courseService.page(new Page<>(1, 5),
                new LambdaQueryWrapper<Course>().orderByDesc(Course::getCreatedAt));

        Map<String, Object> result = new HashMap<>();
        result.put("totalStudents", totalStudents);
        result.put("activeCourses", activeCourses);
        result.put("avgCompletionRate", avgCompletionRate);
        result.put("recentCourses", recentCoursePage.getRecords());
        return Result.success(result);
    }
}
