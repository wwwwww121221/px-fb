package com.pxwork.api.controller.backend;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.CourseResource;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.entity.UserCourseResult;
import com.pxwork.course.service.CourseChapterService;
import com.pxwork.course.service.CourseHourService;
import com.pxwork.course.service.CourseResourceService;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.UserCourseEnrollmentService;
import com.pxwork.course.service.UserCourseResultService;
import com.pxwork.resource.entity.Resource;
import com.pxwork.resource.service.ResourceService;
import com.pxwork.system.entity.AdminUser;
import com.pxwork.system.service.AdminUserService;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * <p>
 * 后台课程管理 前端控制器
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Tag(name = "2.1 后台-课程建设管理")
@RestController
@RequestMapping({"/backend/course"})
public class BackendCourseController {

    @Autowired
    private CourseService courseService;

    @Autowired
    private CourseChapterService courseChapterService;

    @Autowired
    private CourseHourService courseHourService;

    @Autowired
    private CourseResourceService courseResourceService;

    @Autowired
    private ResourceService resourceService;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Autowired
    private UserService userService;

    @Autowired
    private UserCourseResultService userCourseResultService;

    @Operation(summary = "课程分页列表", description = "获取所有课程，可根据名称或分类筛选")
    @SaCheckPermission("course:list")
    @GetMapping("/list")
    public Result<Page<Course>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String targetRole) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);

        Page<Course> page = new Page<>(current, size);
        LambdaQueryWrapper<Course> queryWrapper = new LambdaQueryWrapper<>();

        if (categoryId != null && categoryId > 0) {
            queryWrapper.eq(Course::getCategoryId, categoryId);
        }
        if (StringUtils.hasText(name)) {
            queryWrapper.like(Course::getName, name);
        }
        if (status != null) {
            queryWrapper.eq(Course::getStatus, status);
        }
        if (StringUtils.hasText(targetRole)) {
            queryWrapper.like(Course::getTargetRoles, targetRole);
        }
        if (!isSuperAdmin) {
            queryWrapper.eq(Course::getTeacherId, currentUserId);
        }
        queryWrapper.orderByDesc(Course::getCreatedAt);

        return Result.success(courseService.page(page, queryWrapper));
    }

    @Operation(summary = "创建课程")
    @SaCheckPermission("course:add")
    @PostMapping("/add")
    public Result<Boolean> create(@RequestBody Course course) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        course.setTeacherId(currentUserId);
        applyWeightDefaults(course);
        return Result.success(courseService.save(course));
    }

    @Operation(summary = "更新课程")
    @SaCheckPermission("course:update")
    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody Course course) {
        if (course.getId() == null) {
            return Result.fail("课程ID不能为空");
        }
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course exists = courseService.getById(course.getId());
        if (exists == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(exists.getTeacherId())) {
            return Result.fail("无权限修改该课程");
        }
        if (!isSuperAdmin) {
            course.setTeacherId(currentUserId);
        } else if (course.getTeacherId() == null) {
            course.setTeacherId(exists.getTeacherId());
        }
        if (course.getWeightExams() == null) {
            course.setWeightExams(exists.getWeightExams());
        }
        if (course.getWeightProcess() == null) {
            course.setWeightProcess(exists.getWeightProcess());
        }
        if (course.getWeightPractical() == null) {
            course.setWeightPractical(exists.getWeightPractical());
        }
        applyWeightDefaults(course);
        return Result.success(courseService.updateById(course));
    }

    @Operation(summary = "删除课程", description = "级联删除章节和课时")
    @SaCheckPermission("course:delete")
    @DeleteMapping("/delete/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course exists = courseService.getById(id);
        if (exists == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(exists.getTeacherId())) {
            return Result.fail("无权限删除该课程");
        }
        return Result.success(courseService.removeCourseWithRelations(id));
    }

    @Operation(summary = "获取课程详情")
    @SaCheckPermission("course:query")
    @GetMapping("/detail/{id}")
    public Result<Course> detail(@PathVariable Long id) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course course = courseService.getCourseDetails(id);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            return Result.fail("无权限查看该课程");
        }
        return Result.success(course);
    }

    @Operation(summary = "绑定课程资料")
    @PostMapping("/{id}/bind-resources")
    public Result<Map<String, Object>> bindResources(@PathVariable Long id, @RequestBody List<Long> resourceIds) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course course = courseService.getById(id);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            return Result.fail("无权限操作该课程");
        }
        try {
            return Result.success(courseResourceService.bindResources(id, resourceIds));
        } catch (IllegalArgumentException e) {
            return Result.fail(e.getMessage());
        }
    }

    @Operation(summary = "获取课程资料列表")
    @GetMapping("/{id}/resources")
    public Result<List<Resource>> resources(@PathVariable Long id) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course course = courseService.getById(id);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            return Result.fail("无权限查看该课程");
        }
        java.util.LinkedHashSet<Long> resourceIds = new java.util.LinkedHashSet<>(courseResourceService.listResourceIdsByCourse(id));
        List<Long> chapterIds = courseChapterService.list(new LambdaQueryWrapper<com.pxwork.course.entity.CourseChapter>()
                .eq(com.pxwork.course.entity.CourseChapter::getCourseId, id))
                .stream()
                .map(com.pxwork.course.entity.CourseChapter::getId)
                .collect(Collectors.toList());
        if (!chapterIds.isEmpty()) {
            courseHourService.list(new LambdaQueryWrapper<CourseHour>()
                    .in(CourseHour::getChapterId, chapterIds))
                    .stream()
                    .map(CourseHour::getResourceId)
                    .filter(resourceId -> resourceId != null && resourceId > 0)
                    .forEach(resourceIds::add);
        }
        if (resourceIds.isEmpty()) {
            return Result.success(List.of());
        }
        List<Resource> resources = resourceService.list(new LambdaQueryWrapper<Resource>().in(Resource::getId, resourceIds));
        Map<Long, Resource> resourceMap = new HashMap<>();
        for (Resource resource : resources) {
            resourceMap.put(resource.getId(), resource);
        }
        List<Resource> ordered = new ArrayList<>();
        Set<Long> seenIds = new java.util.HashSet<>();
        for (Long resourceId : resourceIds) {
            if (!seenIds.add(resourceId)) {
                continue;
            }
            Resource resource = resourceMap.get(resourceId);
            if (resource != null) {
                ordered.add(resource);
            }
        }
        return Result.success(ordered);
    }

    @Operation(summary = "解绑课程资料")
    @DeleteMapping("/{id}/resources/{resourceId}")
    public Result<Boolean> unbindResource(@PathVariable Long id, @PathVariable Long resourceId) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);
        Course course = courseService.getById(id);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            return Result.fail("无权限操作该课程");
        }
        boolean removed = courseResourceService.unbindResource(id, resourceId);
        if (!removed) {
            return Result.fail("课程未绑定该资料");
        }
        return Result.success(true);
    }

    private boolean isSuperAdmin(Long adminUserId) {
        AdminUser adminUser = adminUserService.getById(adminUserId);
        return adminUser != null && Integer.valueOf(1).equals(adminUser.getIsSuper());
    }

    @Operation(summary = "获取指定课程下的所有学员及其成绩明细")
    @GetMapping("/{courseId}/student-results")
    public Result<List<Map<String, Object>>> getCourseStudentResults(@PathVariable Long courseId) {
        Long currentUserId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentUserId);

        Course course = courseService.getById(courseId);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentUserId.equals(course.getTeacherId())) {
            return Result.fail("无权限查看该课程成绩");
        }

        List<UserCourseEnrollment> enrollments = userCourseEnrollmentService.list(
                new LambdaQueryWrapper<UserCourseEnrollment>().eq(UserCourseEnrollment::getCourseId, courseId));
        if (enrollments.isEmpty()) {
            return Result.success(new ArrayList<>());
        }

        Set<Long> userIds = enrollments.stream().map(UserCourseEnrollment::getUserId).collect(Collectors.toSet());

        List<User> users = userService.listByIds(userIds);
        Map<Long, User> userMap = users.stream().collect(Collectors.toMap(User::getId, u -> u));

        List<UserCourseResult> results = userCourseResultService.list(
                new LambdaQueryWrapper<UserCourseResult>()
                        .eq(UserCourseResult::getCourseId, courseId)
                        .in(UserCourseResult::getUserId, userIds));
        Map<Long, UserCourseResult> resultMap = results.stream()
                .collect(Collectors.toMap(UserCourseResult::getUserId, r -> r));

        List<Map<String, Object>> list = new ArrayList<>();
        for (Long userId : userIds) {
            User user = userMap.get(userId);
            UserCourseResult result = resultMap.get(userId);

            Map<String, Object> map = new HashMap<>();
            map.put("userId", userId);
            map.put("userName", user != null ? user.getName() : "未知学员");

            if (result != null) {
                map.put("examsAvgScore", result.getExamsAvgScore());
                map.put("processScore", result.getProcessScore());
                map.put("practicalScore", result.getPracticalScore());
                map.put("totalScore", result.getTotalScore());
                map.put("isPassed", Integer.valueOf(1).equals(result.getIsPassed()));
            } else {
                map.put("examsAvgScore", 0.00);
                map.put("processScore", 0.00);
                map.put("practicalScore", 0.00);
                map.put("totalScore", 0.00);
                map.put("isPassed", false);
            }
            list.add(map);
        }

        return Result.success(list);
    }

    private void applyWeightDefaults(Course course) {
        if (course.getWeightExams() == null) {
            course.setWeightExams(new BigDecimal("0.40"));
        }
        if (course.getWeightProcess() == null) {
            course.setWeightProcess(new BigDecimal("0.30"));
        }
        if (course.getWeightPractical() == null) {
            course.setWeightPractical(new BigDecimal("0.30"));
        }
    }
}
