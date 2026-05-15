package com.pxwork.api.controller.backend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.AssignmentSubmission;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.CourseAssignment;
import com.pxwork.course.service.AssignmentSubmissionService;
import com.pxwork.course.service.CourseAssignmentService;
import com.pxwork.course.service.CourseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "3.1 后台-作业管理")
@RestController
@RequestMapping("/backend/assignment")
public class BackendAssignmentController {

    @Autowired
    private CourseService courseService;

    @Autowired
    private CourseAssignmentService courseAssignmentService;

    @Autowired
    private AssignmentSubmissionService assignmentSubmissionService;

    @Autowired
    private UserService userService;

    @Operation(summary = "发布作业")
    @PostMapping("/publish")
    public Result<Boolean> publish(@RequestBody @Validated PublishAssignmentRequest request) {
        Course course = courseService.getById(request.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        CourseAssignment assignment = new CourseAssignment();
        assignment.setCourseId(request.getCourseId());
        assignment.setTitle(request.getTitle());
        assignment.setContent(request.getContent());
        assignment.setAttachmentUrl(request.getAttachmentUrl());
        assignment.setDeadline(request.getDeadline());
        return Result.success(courseAssignmentService.save(assignment));
    }

    @Operation(summary = "批改作业")
    @PutMapping("/grade")
    public Result<Boolean> grade(@RequestBody @Validated GradeAssignmentRequest request) {
        AssignmentSubmission submission = assignmentSubmissionService.getById(request.getSubmissionId());
        if (submission == null) {
            return Result.fail("提交记录不存在");
        }
        submission.setScore(request.getScore());
        submission.setComment(request.getComment());
        submission.setStatus(1);
        return Result.success(assignmentSubmissionService.updateById(submission));
    }

    @Operation(summary = "获取指定课程的作业列表")
    @GetMapping("/list/{courseId}")
    public Result<List<CourseAssignment>> listAssignments(@PathVariable Long courseId) {
        List<CourseAssignment> assignments = courseAssignmentService.list(
                new LambdaQueryWrapper<CourseAssignment>()
                        .eq(CourseAssignment::getCourseId, courseId)
                        .orderByDesc(CourseAssignment::getCreatedAt)
        );
        return Result.success(assignments);
    }

    @Operation(summary = "获取某次作业的学员提交记录")
    @GetMapping("/{assignmentId}/submissions")
    public Result<List<Map<String, Object>>> listSubmissions(@PathVariable Long assignmentId) {
        // 1. 查出所有提交记录
        List<AssignmentSubmission> submissions = assignmentSubmissionService.list(
                new LambdaQueryWrapper<AssignmentSubmission>()
                        .eq(AssignmentSubmission::getAssignmentId, assignmentId)
                        .orderByDesc(AssignmentSubmission::getCreatedAt)
        );

        if (submissions.isEmpty()) {
            return Result.success(List.of());
        }

        // 2. 提取所有 userId 去查学员信息（姓名、学号等）
        Set<Long> userIds = submissions.stream().map(AssignmentSubmission::getUserId).collect(Collectors.toSet());
        List<User> users = userService.listByIds(userIds);
        Map<Long, User> userMap = users.stream().collect(Collectors.toMap(User::getId, u -> u));

        // 3. 组装返回给前端的数据
        List<Map<String, Object>> result = submissions.stream().map(sub -> {
            Map<String, Object> map = new HashMap<>();
            map.put("submissionId", sub.getId());
            map.put("userId", sub.getUserId());
            map.put("content", sub.getContent());
            map.put("attachmentUrl", sub.getAttachmentUrl());
            map.put("score", sub.getScore());
            map.put("comment", sub.getComment());
            map.put("status", sub.getStatus()); // 0-待批改, 1-已批改
            map.put("submitTime", sub.getCreatedAt());

            // 填入学员信息
            User user = userMap.get(sub.getUserId());
            if (user != null) {
                map.put("userName", user.getName());
                map.put("jobNo", user.getJobNo());
            }
            return map;
        }).collect(Collectors.toList());

        return Result.success(result);
    }

    @Data
    public static class PublishAssignmentRequest {
        @NotNull(message = "课程ID不能为空")
        private Long courseId;
        @NotNull(message = "作业标题不能为空")
        private String title;
        private String content;
        private String attachmentUrl;
        private java.time.LocalDateTime deadline;
    }

    @Data
    public static class GradeAssignmentRequest {
        @NotNull(message = "提交ID不能为空")
        private Long submissionId;
        @NotNull(message = "分数不能为空")
        private java.math.BigDecimal score;
        private String comment;
    }
}
