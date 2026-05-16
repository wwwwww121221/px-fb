package com.pxwork.api.controller.frontend;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.entity.Department;
import com.pxwork.common.entity.UserDepartment;
import com.pxwork.common.service.DepartmentService;
import com.pxwork.common.service.UserDepartmentService;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.OfflineAttendance;
import com.pxwork.course.entity.OfflineSignSession;
import com.pxwork.course.entity.OfflineSignSessionDepartment;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.OfflineAttendanceService;
import com.pxwork.course.service.OfflineSignSessionDepartmentService;
import com.pxwork.course.service.OfflineSignSessionService;
import com.pxwork.course.service.UserCourseEnrollmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "4.5 前台-线下签到")
@RestController
@RequestMapping("/frontend/attendance")
public class FrontendAttendanceController {

    @Autowired
    private CourseService courseService;
    @Autowired
    private OfflineAttendanceService offlineAttendanceService;
    @Autowired
    private OfflineSignSessionService offlineSignSessionService;
    @Autowired
    private OfflineSignSessionDepartmentService offlineSignSessionDepartmentService;
    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;
    @Autowired
    private UserDepartmentService userDepartmentService;
    @Autowired
    private DepartmentService departmentService;

    @Operation(summary = "获取当前课程可签到场次")
    @GetMapping("/course/{courseId}/sessions")
    public Result<List<Map<String, Object>>> listSessions(@PathVariable Long courseId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        Course course = courseService.getById(courseId);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isEnrolled(userId, courseId)) {
            return Result.fail("请先加入课程后再查看签到");
        }
        List<OfflineSignSession> sessions = offlineSignSessionService.list(new LambdaQueryWrapper<OfflineSignSession>()
                .eq(OfflineSignSession::getCourseId, courseId)
                .eq(OfflineSignSession::getStatus, 1)
                .orderByDesc(OfflineSignSession::getSignInStartAt)
                .orderByDesc(OfflineSignSession::getId));
        if (sessions.isEmpty()) {
            return Result.success(Collections.emptyList());
        }
        Map<Long, List<Long>> sessionDeptMap = offlineSignSessionDepartmentService.list(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                        .in(OfflineSignSessionDepartment::getSessionId, sessions.stream().map(OfflineSignSession::getId).collect(Collectors.toList())))
                .stream()
                .collect(Collectors.groupingBy(OfflineSignSessionDepartment::getSessionId,
                        Collectors.mapping(OfflineSignSessionDepartment::getDepartmentId, Collectors.toList())));
        Map<Long, Department> deptMap = departmentService.list().stream()
                .collect(Collectors.toMap(Department::getId, item -> item, (a, b) -> a));
        Long userDepartmentId = getUserDepartmentId(userId);
        List<Long> visibleSessionIds = new ArrayList<>();
        for (OfflineSignSession session : sessions) {
            List<Long> scoped = sessionDeptMap.getOrDefault(session.getId(), Collections.emptyList());
            if (scoped.isEmpty() || isDepartmentInScope(userDepartmentId, scoped, deptMap)) {
                visibleSessionIds.add(session.getId());
            }
        }
        if (visibleSessionIds.isEmpty()) {
            return Result.success(Collections.emptyList());
        }
        Map<String, OfflineAttendance> myRecords = offlineAttendanceService.list(new LambdaQueryWrapper<OfflineAttendance>()
                        .eq(OfflineAttendance::getUserId, userId)
                        .in(OfflineAttendance::getSessionId, visibleSessionIds))
                .stream()
                .collect(Collectors.toMap(item -> item.getSessionId() + "_" + item.getPunchType(), item -> item, (a, b) -> a));
        List<Map<String, Object>> result = new ArrayList<>();
        for (OfflineSignSession session : sessions) {
            if (!visibleSessionIds.contains(session.getId())) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", session.getId());
            item.put("title", session.getTitle());
            item.put("description", session.getDescription());
            item.put("signMethod", session.getSignMethod());
            item.put("needSignOut", session.getNeedSignOut());
            item.put("signInStartAt", session.getSignInStartAt());
            item.put("signInEndAt", session.getSignInEndAt());
            item.put("signOutStartAt", session.getSignOutStartAt());
            item.put("signOutEndAt", session.getSignOutEndAt());
            item.put("locationName", session.getLocationName());
            item.put("radiusMeters", session.getRadiusMeters());
            item.put("departmentIds", sessionDeptMap.getOrDefault(session.getId(), Collections.emptyList()));
            item.put("signInTime", myRecords.get(session.getId() + "_1") == null ? null : myRecords.get(session.getId() + "_1").getPunchTime());
            item.put("signOutTime", myRecords.get(session.getId() + "_2") == null ? null : myRecords.get(session.getId() + "_2").getPunchTime());
            item.put("status", buildStudentStatus(session, myRecords.get(session.getId() + "_1"), myRecords.get(session.getId() + "_2")));
            result.add(item);
        }
        return Result.success(result);
    }

    @Operation(summary = "签到")
    @PostMapping("/session/{sessionId}/sign-in")
    public Result<Boolean> signIn(@PathVariable Long sessionId, @RequestBody SignRequest request) {
        return handleSign(sessionId, request, 1);
    }

    @Operation(summary = "签退")
    @PostMapping("/session/{sessionId}/sign-out")
    public Result<Boolean> signOut(@PathVariable Long sessionId, @RequestBody SignRequest request) {
        return handleSign(sessionId, request, 2);
    }

    private Result<Boolean> handleSign(Long sessionId, SignRequest request, int punchType) {
        long userId = StpUserUtil.getLoginIdAsLong();
        OfflineSignSession session = offlineSignSessionService.getById(sessionId);
        if (session == null || !Integer.valueOf(1).equals(session.getStatus())) {
            return Result.fail("签到场次不存在或未启用");
        }
        if (!isEnrolled(userId, session.getCourseId())) {
            return Result.fail("请先加入课程后再签到");
        }
        Course course = courseService.getById(session.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        Long userDepartmentId = getUserDepartmentId(userId);
        Map<Long, Department> deptMap = departmentService.list().stream()
                .collect(Collectors.toMap(Department::getId, item -> item, (a, b) -> a));
        List<Long> scopedDepartmentIds = offlineSignSessionDepartmentService.list(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                        .eq(OfflineSignSessionDepartment::getSessionId, sessionId))
                .stream()
                .map(OfflineSignSessionDepartment::getDepartmentId)
                .distinct()
                .collect(Collectors.toList());
        if (!scopedDepartmentIds.isEmpty() && !isDepartmentInScope(userDepartmentId, scopedDepartmentIds, deptMap)) {
            return Result.fail("当前账号不在本场次允许签到的部门范围内");
        }
        if (punchType == 2 && !Integer.valueOf(1).equals(session.getNeedSignOut())) {
            return Result.fail("本场次未启用签退");
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = punchType == 1 ? session.getSignInStartAt() : session.getSignOutStartAt();
        LocalDateTime windowEnd = punchType == 1 ? session.getSignInEndAt() : session.getSignOutEndAt();
        if (windowStart == null || windowEnd == null || now.isBefore(windowStart) || now.isAfter(windowEnd)) {
            return Result.fail(punchType == 1 ? "当前不在签到时间范围内" : "当前不在签退时间范围内");
        }
        long exists = offlineAttendanceService.count(new LambdaQueryWrapper<OfflineAttendance>()
                .eq(OfflineAttendance::getUserId, userId)
                .eq(OfflineAttendance::getSessionId, sessionId)
                .eq(OfflineAttendance::getPunchType, punchType));
        if (exists > 0) {
            return Result.fail(punchType == 1 ? "本场次已签到，请勿重复提交" : "本场次已签退，请勿重复提交");
        }
        if (punchType == 2) {
            long signInExists = offlineAttendanceService.count(new LambdaQueryWrapper<OfflineAttendance>()
                    .eq(OfflineAttendance::getUserId, userId)
                    .eq(OfflineAttendance::getSessionId, sessionId)
                    .eq(OfflineAttendance::getPunchType, 1));
            if (signInExists == 0) {
                return Result.fail("请先完成签到再签退");
            }
        }
        String validateMsg = validateSignMethod(session, request);
        if (validateMsg != null) {
            return Result.fail(validateMsg);
        }
        OfflineAttendance attendance = new OfflineAttendance();
        attendance.setUserId(userId);
        attendance.setCourseId(session.getCourseId());
        attendance.setSessionId(sessionId);
        attendance.setPunchTime(now);
        attendance.setPunchType(punchType);
        attendance.setSignMethod(session.getSignMethod());
        attendance.setLocation(StringUtils.hasText(request.getLocation()) ? request.getLocation().trim() : session.getLocationName());
        attendance.setLatitude(request.getLatitude());
        attendance.setLongitude(request.getLongitude());
        return Result.success(offlineAttendanceService.save(attendance));
    }

    private String validateSignMethod(OfflineSignSession session, SignRequest request) {
        if (session.getSignMethod() == null) {
            return "签到方式未配置";
        }
        if (session.getSignMethod() == 1) {
            if (!StringUtils.hasText(request.getVerifyCode())) {
                return "请扫描或输入教师端课程码";
            }
            return session.getQrCode() != null && session.getQrCode().equalsIgnoreCase(request.getVerifyCode().trim()) ? null : "课程码不正确";
        }
        if (session.getSignMethod() == 2) {
            if (request.getLatitude() == null || request.getLongitude() == null) {
                return "定位签到必须提交当前位置";
            }
            if (session.getLatitude() == null || session.getLongitude() == null) {
                return "教师端尚未设置定位签到坐标";
            }
            double distance = distanceMeters(session.getLatitude(), session.getLongitude(), request.getLatitude(), request.getLongitude());
            int radius = session.getRadiusMeters() == null || session.getRadiusMeters() <= 0 ? 300 : session.getRadiusMeters();
            return distance <= radius ? null : "当前位置不在允许签到范围内";
        }
        if (!StringUtils.hasText(request.getVerifyCode())) {
            return "请输入签到口令";
        }
        return session.getPassCode() != null && session.getPassCode().equalsIgnoreCase(request.getVerifyCode().trim()) ? null : "签到口令不正确";
    }

    private String buildStudentStatus(OfflineSignSession session, OfflineAttendance signIn, OfflineAttendance signOut) {
        if (signIn == null) {
            return "待签到";
        }
        if (Integer.valueOf(1).equals(session.getNeedSignOut())) {
            return signOut == null ? "待签退" : "已完成";
        }
        return "已完成";
    }

    private boolean isEnrolled(long userId, Long courseId) {
        return userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getUserId, userId)
                .eq(UserCourseEnrollment::getCourseId, courseId)) > 0;
    }

    private Long getUserDepartmentId(long userId) {
        UserDepartment relation = userDepartmentService.getOne(new LambdaQueryWrapper<UserDepartment>()
                .eq(UserDepartment::getUserId, userId)
                .last("limit 1"));
        return relation == null ? null : relation.getDepartmentId();
    }

    private boolean isDepartmentInScope(Long userDepartmentId, List<Long> scopedDepartmentIds, Map<Long, Department> deptMap) {
        if (userDepartmentId == null || userDepartmentId <= 0) {
            return false;
        }
        Set<Long> scope = scopedDepartmentIds.stream().collect(Collectors.toSet());
        Long current = userDepartmentId;
        int guard = 0;
        while (current != null && current > 0 && guard < 20) {
            if (scope.contains(current)) {
                return true;
            }
            Department dept = deptMap.get(current);
            if (dept == null) {
                break;
            }
            current = dept.getParentId();
            guard += 1;
        }
        return false;
    }

    private double distanceMeters(BigDecimal lat1, BigDecimal lon1, BigDecimal lat2, BigDecimal lon2) {
        double earthRadius = 6378137d;
        double radLat1 = Math.toRadians(lat1.setScale(6, RoundingMode.HALF_UP).doubleValue());
        double radLat2 = Math.toRadians(lat2.setScale(6, RoundingMode.HALF_UP).doubleValue());
        double deltaLat = radLat1 - radLat2;
        double deltaLon = Math.toRadians(lon1.setScale(6, RoundingMode.HALF_UP).doubleValue() - lon2.setScale(6, RoundingMode.HALF_UP).doubleValue());
        double a = Math.pow(Math.sin(deltaLat / 2), 2)
                + Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(deltaLon / 2), 2);
        double c = 2 * Math.asin(Math.sqrt(a));
        return earthRadius * c;
    }

    @Data
    public static class SignRequest {
        @NotNull(message = "场次ID不能为空")
        private Long sessionId;
        private String verifyCode;
        private String location;
        private BigDecimal latitude;
        private BigDecimal longitude;
    }
}
