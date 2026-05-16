package com.pxwork.api.controller.backend;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.entity.Department;
import com.pxwork.common.entity.User;
import com.pxwork.common.entity.UserDepartment;
import com.pxwork.common.service.DepartmentService;
import com.pxwork.common.service.UserDepartmentService;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
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
import com.pxwork.system.entity.AdminUser;
import com.pxwork.system.service.AdminUserService;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;

@Tag(name = "2.7 后台-线下签到管理")
@RestController
@RequestMapping("/backend/course")
public class BackendOfflineSignController {

    @Autowired
    private CourseService courseService;
    @Autowired
    private OfflineSignSessionService offlineSignSessionService;
    @Autowired
    private OfflineSignSessionDepartmentService offlineSignSessionDepartmentService;
    @Autowired
    private OfflineAttendanceService offlineAttendanceService;
    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;
    @Autowired
    private UserService userService;
    @Autowired
    private UserDepartmentService userDepartmentService;
    @Autowired
    private DepartmentService departmentService;
    @Autowired
    private AdminUserService adminUserService;

    @Operation(summary = "获取课程线下签到场次列表")
    @SaCheckPermission("course:query")
    @GetMapping("/{courseId}/offline-sign/sessions")
    public Result<List<OfflineSignSession>> listSessions(@PathVariable Long courseId) {
        try {
            requireCourseAccess(courseId);
            List<OfflineSignSession> sessions = offlineSignSessionService.list(new LambdaQueryWrapper<OfflineSignSession>()
                    .eq(OfflineSignSession::getCourseId, courseId)
                    .orderByDesc(OfflineSignSession::getSignInStartAt)
                    .orderByDesc(OfflineSignSession::getId));
            hydrateDepartmentIds(sessions);
            return Result.success(sessions);
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    @Operation(summary = "获取课程可选部门树", description = "仅返回该课程已选学员所在部门及其祖先节点")
    @SaCheckPermission("course:query")
    @GetMapping("/{courseId}/offline-sign/department-tree")
    public Result<List<Department>> eligibleDepartmentTree(@PathVariable Long courseId) {
        try {
            requireCourseAccess(courseId);
            return Result.success(buildEligibleDepartmentTree(courseId));
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    @Operation(summary = "创建签到场次")
    @SaCheckPermission("course:update")
    @PostMapping("/{courseId}/offline-sign/session")
    @Transactional(rollbackFor = Exception.class)
    public Result<Boolean> createSession(@PathVariable Long courseId, @RequestBody SessionForm form) {
        try {
            Course course = requireCourseAccess(courseId);
            validateForm(form);
            OfflineSignSession session = new OfflineSignSession();
            fillSession(session, courseId, form);
            session.setCreatedBy(StpUtil.getLoginIdAsLong());
            if (!offlineSignSessionService.save(session) || session.getId() == null) {
                return Result.fail("创建签到场次失败");
            }
            saveSessionDepartments(session.getId(), form.getDepartmentIds());
            ensureOfflineCourseMode(course);
            return Result.success(true);
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    @Operation(summary = "更新签到场次")
    @SaCheckPermission("course:update")
    @PutMapping("/{courseId}/offline-sign/session")
    @Transactional(rollbackFor = Exception.class)
    public Result<Boolean> updateSession(@PathVariable Long courseId, @RequestBody SessionForm form) {
        try {
            requireCourseAccess(courseId);
            if (form.getId() == null || form.getId() <= 0) {
                return Result.fail("场次ID不能为空");
            }
            validateForm(form);
            OfflineSignSession exists = offlineSignSessionService.getById(form.getId());
            if (exists == null || !courseId.equals(exists.getCourseId())) {
                return Result.fail("签到场次不存在");
            }
            fillSession(exists, courseId, form);
            if (!offlineSignSessionService.updateById(exists)) {
                return Result.fail("更新签到场次失败");
            }
            saveSessionDepartments(exists.getId(), form.getDepartmentIds());
            return Result.success(true);
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    @Operation(summary = "删除签到场次")
    @SaCheckPermission("course:delete")
    @DeleteMapping("/{courseId}/offline-sign/session/{sessionId}")
    @Transactional(rollbackFor = Exception.class)
    public Result<Boolean> deleteSession(@PathVariable Long courseId, @PathVariable Long sessionId) {
        try {
            requireCourseAccess(courseId);
            OfflineSignSession exists = offlineSignSessionService.getById(sessionId);
            if (exists == null || !courseId.equals(exists.getCourseId())) {
                return Result.fail("签到场次不存在");
            }
            offlineAttendanceService.remove(new LambdaQueryWrapper<OfflineAttendance>()
                    .eq(OfflineAttendance::getSessionId, sessionId));
            offlineSignSessionDepartmentService.remove(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                    .eq(OfflineSignSessionDepartment::getSessionId, sessionId));
            return Result.success(offlineSignSessionService.removeById(sessionId));
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    @Operation(summary = "获取签到场次记录")
    @SaCheckPermission("course:query")
    @GetMapping("/{courseId}/offline-sign/session/{sessionId}/records")
    public Result<Map<String, Object>> records(@PathVariable Long courseId, @PathVariable Long sessionId) {
        try {
            requireCourseAccess(courseId);
            OfflineSignSession session = offlineSignSessionService.getById(sessionId);
            if (session == null || !courseId.equals(session.getCourseId())) {
                return Result.fail("签到场次不存在");
            }

            List<Long> scopedDepartmentIds = getSessionDepartmentIds(sessionId);
            List<User> eligibleUsers = getEligibleUsers(courseId, scopedDepartmentIds);
            Map<Long, UserDepartment> userDeptMap = listUserDepartments(eligibleUsers.stream().map(User::getId).collect(Collectors.toList()))
                    .stream()
                    .collect(Collectors.toMap(UserDepartment::getUserId, item -> item, (a, b) -> a));
            Map<Long, Department> deptMap = listAllDepartments().stream()
                    .collect(Collectors.toMap(Department::getId, item -> item, (a, b) -> a));

            List<OfflineAttendance> punchRecords = offlineAttendanceService.list(new LambdaQueryWrapper<OfflineAttendance>()
                    .eq(OfflineAttendance::getSessionId, sessionId)
                    .orderByAsc(OfflineAttendance::getPunchTime));
            Map<String, OfflineAttendance> recordMap = new HashMap<>();
            for (OfflineAttendance record : punchRecords) {
                if (record.getUserId() == null || record.getPunchType() == null) {
                    continue;
                }
                recordMap.put(record.getUserId() + "_" + record.getPunchType(), record);
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            int signInCount = 0;
            int signOutCount = 0;
            for (User user : eligibleUsers) {
                UserDepartment userDept = userDeptMap.get(user.getId());
                Department dept = userDept == null ? null : deptMap.get(userDept.getDepartmentId());
                OfflineAttendance signIn = recordMap.get(user.getId() + "_1");
                OfflineAttendance signOut = recordMap.get(user.getId() + "_2");
                if (signIn != null) {
                    signInCount += 1;
                }
                if (signOut != null) {
                    signOutCount += 1;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", user.getId());
                row.put("name", user.getName());
                row.put("account", user.getAccount());
                row.put("jobNo", user.getJobNo());
                row.put("departmentPath", dept == null ? "-" : buildDepartmentPath(dept.getId(), deptMap));
                row.put("signInTime", signIn == null ? null : signIn.getPunchTime());
                row.put("signOutTime", signOut == null ? null : signOut.getPunchTime());
                row.put("signInMethod", signIn == null ? null : signIn.getSignMethod());
                row.put("signOutMethod", signOut == null ? null : signOut.getSignMethod());
                row.put("status", buildRecordStatus(session, signIn, signOut));
                rows.add(row);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("session", session.setDepartmentIds(scopedDepartmentIds));
            result.put("records", rows);
            result.put("eligibleCount", eligibleUsers.size());
            result.put("signInCount", signInCount);
            result.put("signOutCount", signOutCount);
            return Result.success(result);
        } catch (IllegalArgumentException ex) {
            return Result.fail(ex.getMessage());
        }
    }

    private String buildRecordStatus(OfflineSignSession session, OfflineAttendance signIn, OfflineAttendance signOut) {
        if (signIn == null) {
            return "未签到";
        }
        if (Integer.valueOf(1).equals(session.getNeedSignOut())) {
            return signOut == null ? "已签到待签退" : "已完成";
        }
        return "已完成";
    }

    private void fillSession(OfflineSignSession session, Long courseId, SessionForm form) {
        session.setCourseId(courseId);
        session.setTitle(form.getTitle().trim());
        session.setDescription(trimToNull(form.getDescription()));
        session.setSignMethod(form.getSignMethod());
        session.setNeedSignOut(Boolean.TRUE.equals(form.getNeedSignOut()) ? 1 : 0);
        session.setSignInStartAt(form.getSignInStartAt());
        session.setSignInEndAt(form.getSignInEndAt());
        session.setSignOutStartAt(Boolean.TRUE.equals(form.getNeedSignOut()) ? form.getSignOutStartAt() : null);
        session.setSignOutEndAt(Boolean.TRUE.equals(form.getNeedSignOut()) ? form.getSignOutEndAt() : null);
        session.setStatus(form.getStatus() == null ? 1 : form.getStatus());
        session.setRadiusMeters(form.getRadiusMeters() == null || form.getRadiusMeters() <= 0 ? 300 : form.getRadiusMeters());
        if (form.getSignMethod() != null && form.getSignMethod() == 1) {
            session.setQrCode(StringUtils.hasText(form.getQrCode()) ? form.getQrCode().trim() : randomCode("QR"));
            session.setPassCode(null);
            session.setLocationName(null);
            session.setLatitude(null);
            session.setLongitude(null);
        } else if (form.getSignMethod() != null && form.getSignMethod() == 2) {
            session.setQrCode(null);
            session.setPassCode(null);
            session.setLocationName(trimToNull(form.getLocationName()));
            session.setLatitude(form.getLatitude());
            session.setLongitude(form.getLongitude());
        } else {
            session.setQrCode(null);
            session.setPassCode(StringUtils.hasText(form.getPassCode()) ? form.getPassCode().trim() : randomCode("PW"));
            session.setLocationName(null);
            session.setLatitude(null);
            session.setLongitude(null);
        }
    }

    private void validateForm(SessionForm form) {
        if (form == null) {
            throw new IllegalArgumentException("参数不能为空");
        }
        if (!StringUtils.hasText(form.getTitle())) {
            throw new IllegalArgumentException("场次名称不能为空");
        }
        if (form.getSignMethod() == null || form.getSignMethod() < 1 || form.getSignMethod() > 3) {
            throw new IllegalArgumentException("签到方式不合法");
        }
        if (form.getSignInStartAt() == null || form.getSignInEndAt() == null) {
            throw new IllegalArgumentException("签到时间不能为空");
        }
        if (form.getSignInEndAt().isBefore(form.getSignInStartAt())) {
            throw new IllegalArgumentException("签到结束时间不能早于开始时间");
        }
        if (Boolean.TRUE.equals(form.getNeedSignOut())) {
            if (form.getSignOutStartAt() == null || form.getSignOutEndAt() == null) {
                throw new IllegalArgumentException("已启用签退时，签退时间不能为空");
            }
            if (form.getSignOutEndAt().isBefore(form.getSignOutStartAt())) {
                throw new IllegalArgumentException("签退结束时间不能早于开始时间");
            }
        }
        if (form.getSignMethod() == 2) {
            if (form.getLatitude() == null || form.getLongitude() == null) {
                throw new IllegalArgumentException("定位签到必须设置经纬度");
            }
        }
        if (form.getSignMethod() == 3 && !StringUtils.hasText(form.getPassCode())) {
            throw new IllegalArgumentException("口令签到必须设置签到口令");
        }
    }

    private void saveSessionDepartments(Long sessionId, List<Long> departmentIds) {
        offlineSignSessionDepartmentService.remove(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                .eq(OfflineSignSessionDepartment::getSessionId, sessionId));
        if (departmentIds == null || departmentIds.isEmpty()) {
            return;
        }
        List<OfflineSignSessionDepartment> rows = departmentIds.stream()
                .filter(item -> item != null && item > 0)
                .distinct()
                .map(item -> new OfflineSignSessionDepartment().setSessionId(sessionId).setDepartmentId(item))
                .collect(Collectors.toList());
        if (!rows.isEmpty()) {
            offlineSignSessionDepartmentService.saveBatch(rows);
        }
    }

    private void hydrateDepartmentIds(List<OfflineSignSession> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        List<Long> sessionIds = sessions.stream().map(OfflineSignSession::getId).collect(Collectors.toList());
        Map<Long, List<Long>> deptMap = offlineSignSessionDepartmentService.list(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                        .in(OfflineSignSessionDepartment::getSessionId, sessionIds))
                .stream()
                .collect(Collectors.groupingBy(OfflineSignSessionDepartment::getSessionId,
                        Collectors.mapping(OfflineSignSessionDepartment::getDepartmentId, Collectors.toList())));
        for (OfflineSignSession session : sessions) {
            session.setDepartmentIds(deptMap.getOrDefault(session.getId(), Collections.emptyList()));
        }
    }

    private List<Long> getSessionDepartmentIds(Long sessionId) {
        return offlineSignSessionDepartmentService.list(new LambdaQueryWrapper<OfflineSignSessionDepartment>()
                        .eq(OfflineSignSessionDepartment::getSessionId, sessionId))
                .stream()
                .map(OfflineSignSessionDepartment::getDepartmentId)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Department> buildEligibleDepartmentTree(Long courseId) {
        List<User> eligibleUsers = getEligibleUsers(courseId, Collections.emptyList());
        if (eligibleUsers.isEmpty()) {
            return new ArrayList<>();
        }
        List<UserDepartment> userDepartments = listUserDepartments(eligibleUsers.stream().map(User::getId).collect(Collectors.toList()));
        Set<Long> includedDeptIds = userDepartments.stream()
                .map(UserDepartment::getDepartmentId)
                .filter(item -> item != null && item > 0)
                .collect(Collectors.toSet());
        List<Department> allDepartments = listAllDepartments();
        Map<Long, Department> deptMap = allDepartments.stream()
                .collect(Collectors.toMap(Department::getId, item -> item, (a, b) -> a));
        Set<Long> finalIds = new HashSet<>(includedDeptIds);
        for (Long deptId : includedDeptIds) {
            Long current = deptId;
            int guard = 0;
            while (current != null && current > 0 && guard < 20) {
                Department dept = deptMap.get(current);
                if (dept == null || dept.getParentId() == null || dept.getParentId() <= 0) {
                    break;
                }
                finalIds.add(dept.getParentId());
                current = dept.getParentId();
                guard += 1;
            }
        }
        return buildDepartmentTree(allDepartments, finalIds);
    }

    private List<Department> buildDepartmentTree(List<Department> source, Set<Long> allowedIds) {
        Map<Long, Department> cloned = new LinkedHashMap<>();
        for (Department dept : source) {
            if (dept == null || dept.getId() == null || !allowedIds.contains(dept.getId())) {
                continue;
            }
            Department copy = new Department();
            copy.setId(dept.getId());
            copy.setParentId(dept.getParentId());
            copy.setName(dept.getName());
            copy.setSort(dept.getSort());
            copy.setCreatedAt(dept.getCreatedAt());
            copy.setUpdatedAt(dept.getUpdatedAt());
            copy.setChildren(new ArrayList<>());
            cloned.put(copy.getId(), copy);
        }
        List<Department> roots = new ArrayList<>();
        for (Department dept : cloned.values()) {
            if (dept.getParentId() != null && dept.getParentId() > 0 && cloned.containsKey(dept.getParentId())) {
                cloned.get(dept.getParentId()).getChildren().add(dept);
            } else {
                roots.add(dept);
            }
        }
        return roots;
    }

    private List<User> getEligibleUsers(Long courseId, List<Long> scopedDepartmentIds) {
        List<UserCourseEnrollment> enrollments = userCourseEnrollmentService.list(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getCourseId, courseId));
        if (enrollments.isEmpty()) {
            return new ArrayList<>();
        }
        List<Long> userIds = enrollments.stream().map(UserCourseEnrollment::getUserId).distinct().collect(Collectors.toList());
        List<User> users = userService.listByIds(userIds);
        if (scopedDepartmentIds == null || scopedDepartmentIds.isEmpty()) {
            return users;
        }
        Map<Long, Long> userDeptMap = listUserDepartments(userIds).stream()
                .collect(Collectors.toMap(UserDepartment::getUserId, UserDepartment::getDepartmentId, (a, b) -> a));
        Map<Long, Department> deptMap = listAllDepartments().stream()
                .collect(Collectors.toMap(Department::getId, item -> item, (a, b) -> a));
        return users.stream()
                .filter(user -> isDepartmentInScope(userDeptMap.get(user.getId()), scopedDepartmentIds, deptMap))
                .collect(Collectors.toList());
    }

    private boolean isDepartmentInScope(Long userDepartmentId, Collection<Long> scopedDepartmentIds, Map<Long, Department> deptMap) {
        if (userDepartmentId == null || userDepartmentId <= 0) {
            return false;
        }
        Set<Long> scope = scopedDepartmentIds instanceof Set ? (Set<Long>) scopedDepartmentIds : new HashSet<>(scopedDepartmentIds);
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

    private String buildDepartmentPath(Long departmentId, Map<Long, Department> deptMap) {
        if (departmentId == null || departmentId <= 0) {
            return "-";
        }
        List<String> parts = new ArrayList<>();
        Long current = departmentId;
        int guard = 0;
        while (current != null && current > 0 && guard < 20) {
            Department dept = deptMap.get(current);
            if (dept == null || !StringUtils.hasText(dept.getName())) {
                break;
            }
            parts.add(dept.getName());
            current = dept.getParentId();
            guard += 1;
        }
        Collections.reverse(parts);
        return parts.isEmpty() ? "-" : String.join("-", parts);
    }

    private List<UserDepartment> listUserDepartments(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return new ArrayList<>();
        }
        return userDepartmentService.list(new LambdaQueryWrapper<UserDepartment>()
                .in(UserDepartment::getUserId, userIds));
    }

    private List<Department> listAllDepartments() {
        return departmentService.list(new LambdaQueryWrapper<Department>().orderByAsc(Department::getSort).orderByAsc(Department::getId));
    }

    private Course requireCourseAccess(Long courseId) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course course = courseService.getById(courseId);
        if (course == null) {
            throw new IllegalArgumentException("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            throw new IllegalArgumentException("无权限操作该课程");
        }
        return course;
    }

    private boolean isSuperAdmin(Long adminUserId) {
        AdminUser adminUser = adminUserService.getById(adminUserId);
        return adminUser != null && Integer.valueOf(1).equals(adminUser.getIsSuper());
    }

    private void ensureOfflineCourseMode(Course course) {
        if (course == null || course.getId() == null) {
            return;
        }
        java.util.LinkedHashSet<String> modes = new java.util.LinkedHashSet<>();
        if (StringUtils.hasText(course.getCourseMode())) {
            for (String mode : course.getCourseMode().split(",")) {
                if (StringUtils.hasText(mode)) {
                    modes.add(mode.trim());
                }
            }
        }
        if (!modes.contains("3")) {
            modes.add("3");
            Course update = new Course();
            update.setId(course.getId());
            update.setCourseMode(String.join(",", modes));
            courseService.updateById(update);
        }
    }

    private String randomCode(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    @Data
    public static class SessionForm {
        private Long id;
        private String title;
        private String description;
        private Integer signMethod;
        private Boolean needSignOut;
        private LocalDateTime signInStartAt;
        private LocalDateTime signInEndAt;
        private LocalDateTime signOutStartAt;
        private LocalDateTime signOutEndAt;
        private String qrCode;
        private String passCode;
        private String locationName;
        private BigDecimal latitude;
        private BigDecimal longitude;
        private Integer radiusMeters;
        private Integer status;
        private List<Long> departmentIds;
    }
}
