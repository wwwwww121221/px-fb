package com.pxwork.api.controller.frontend;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.OfflineAttendance;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.OfflineAttendanceService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "4.5 前台-线下打卡")
@RestController
@RequestMapping("/frontend/attendance")
public class FrontendAttendanceController {

    @Autowired
    private CourseService courseService;

    @Autowired
    private OfflineAttendanceService offlineAttendanceService;

    @Operation(summary = "线下课程打卡")
    @PostMapping("/punch-in")
    public Result<Boolean> punchIn(@RequestBody @Validated PunchInRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        if (request.getPunchType() == null || (request.getPunchType() != 1 && request.getPunchType() != 2)) {
            return Result.fail("打卡类型仅支持1或2");
        }
        Course course = courseService.getById(request.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (course.getCourseMode() == null || course.getCourseMode() != 3) {
            return Result.fail("该课程不是线下集中授课");
        }
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        long exists = offlineAttendanceService.count(new LambdaQueryWrapper<OfflineAttendance>()
                .eq(OfflineAttendance::getUserId, userId)
                .eq(OfflineAttendance::getCourseId, request.getCourseId())
                .eq(OfflineAttendance::getPunchType, request.getPunchType())
                .ge(OfflineAttendance::getPunchTime, start)
                .lt(OfflineAttendance::getPunchTime, end));
        if (exists > 0) {
            return Result.fail("今日该类型已打卡，请勿重复提交");
        }
        OfflineAttendance attendance = new OfflineAttendance();
        attendance.setUserId(userId);
        attendance.setCourseId(request.getCourseId());
        attendance.setPunchType(request.getPunchType());
        attendance.setLocation(request.getLocation());
        attendance.setPunchTime(LocalDateTime.now());
        return Result.success(offlineAttendanceService.save(attendance));
    }

    @Data
    public static class PunchInRequest {
        @NotNull(message = "课程ID不能为空")
        private Long courseId;
        @NotNull(message = "打卡类型不能为空")
        private Integer punchType;
        private String location;
    }
}
