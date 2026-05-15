package com.pxwork.api.controller.frontend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.UserCourseResult;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.UserCourseResultService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "4.1 前台-学习看板")
@RestController
@RequestMapping("/frontend/dashboard")
public class FrontendDashboardController {

    @Autowired
    private UserService userService;

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserCourseResultService userCourseResultService;

    @Operation(summary = "学习进度统计")
    @GetMapping("/progress-stats")
    public Result<Map<String, Object>> progressStats() {
        long userId = StpUserUtil.getLoginIdAsLong();
        User user = userService.getById(userId);
        if (user == null) {
            return Result.fail("用户不存在");
        }
        List<UserCourseResult> courseResults = userCourseResultService.list(new LambdaQueryWrapper<UserCourseResult>()
                .eq(UserCourseResult::getUserId, userId)
                .orderByDesc(UserCourseResult::getUpdatedAt));
        Set<Long> courseIds = courseResults.stream().map(UserCourseResult::getCourseId).collect(Collectors.toSet());
        Map<Long, String> courseNameMap = new HashMap<>();
        if (!courseIds.isEmpty()) {
            List<Course> courses = courseService.list(new LambdaQueryWrapper<Course>().in(Course::getId, courseIds));
            for (Course course : courses) {
                courseNameMap.put(course.getId(), course.getName());
            }
        }

        List<Map<String, Object>> aggregates = courseResults.stream().map(item -> {
            Map<String, Object> row = new HashMap<>();
            row.put("courseId", item.getCourseId());
            row.put("courseName", courseNameMap.getOrDefault(item.getCourseId(), ""));
            row.put("examsAvgScore", item.getExamsAvgScore());
            row.put("processScore", item.getProcessScore());
            row.put("practicalScore", item.getPracticalScore());
            row.put("totalScore", item.getTotalScore());
            row.put("isPassed", Integer.valueOf(1).equals(item.getIsPassed()));
            row.put("updatedAt", item.getUpdatedAt());
            return row;
        }).collect(Collectors.toList());

        long passedCount = courseResults.stream().filter(item -> Integer.valueOf(1).equals(item.getIsPassed())).count();
        Map<String, Object> result = new HashMap<>();
        result.put("totalCourses", courseResults.size());
        result.put("passedCourses", passedCount);
        result.put("aggregates", aggregates);
        return Result.success(result);
    }
}
