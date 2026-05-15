package com.pxwork.api.controller.frontend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.AssignmentSubmission;
import com.pxwork.course.entity.CourseAssignment;
import com.pxwork.course.service.AssignmentSubmissionService;
import com.pxwork.course.service.CourseAssignmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "4.4 前台-作业中心")
@RestController
@RequestMapping("/frontend/assignment")
public class FrontendAssignmentController {

    @Autowired
    private CourseAssignmentService courseAssignmentService;

    @Autowired
    private AssignmentSubmissionService assignmentSubmissionService;

    @Operation(summary = "课程作业列表")
    @GetMapping("/list/{courseId}")
    public Result<List<AssignmentListVO>> list(@PathVariable Long courseId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        List<CourseAssignment> assignments = courseAssignmentService.list(new LambdaQueryWrapper<CourseAssignment>()
                .eq(CourseAssignment::getCourseId, courseId)
                .orderByDesc(CourseAssignment::getCreatedAt));
        if (assignments.isEmpty()) {
            return Result.success(List.of());
        }
        Set<Long> assignmentIds = assignments.stream().map(CourseAssignment::getId).collect(Collectors.toSet());
        List<AssignmentSubmission> mySubmissions = assignmentSubmissionService.list(
                new LambdaQueryWrapper<AssignmentSubmission>()
                        .eq(AssignmentSubmission::getUserId, userId)
                        .in(AssignmentSubmission::getAssignmentId, assignmentIds));
        Map<Long, AssignmentSubmission> submissionMap = new HashMap<>();
        for (AssignmentSubmission submission : mySubmissions) {
            submissionMap.put(submission.getAssignmentId(), submission);
        }
        List<AssignmentListVO> result = assignments.stream().map(assignment -> {
            AssignmentSubmission submission = submissionMap.get(assignment.getId());
            AssignmentListVO vo = new AssignmentListVO();
            vo.setAssignmentId(assignment.getId());
            vo.setCourseId(assignment.getCourseId());
            vo.setTitle(assignment.getTitle());
            vo.setContent(assignment.getContent());
            vo.setAttachmentUrl(assignment.getAttachmentUrl());
            vo.setDeadline(assignment.getDeadline());
            vo.setSubmissionStatus(submission == null ? 0 : submission.getStatus());
            vo.setSubmitted(submission != null);
            if (submission != null) {
                vo.setSubmissionId(submission.getId());
                vo.setSubmittedContent(submission.getContent());
                vo.setSubmittedAttachmentUrl(submission.getAttachmentUrl());
                vo.setScore(submission.getScore());
                vo.setComment(submission.getComment());
            }
            return vo;
        }).collect(Collectors.toList());
        return Result.success(result);
    }

    @Operation(summary = "提交作业")
    @PutMapping("/submit")
    public Result<Boolean> submit(@RequestBody @Validated SubmitAssignmentRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        CourseAssignment assignment = courseAssignmentService.getById(request.getAssignmentId());
        if (assignment == null) {
            return Result.fail("作业不存在");
        }
        AssignmentSubmission submission = assignmentSubmissionService.getOne(new LambdaQueryWrapper<AssignmentSubmission>()
                .eq(AssignmentSubmission::getAssignmentId, request.getAssignmentId())
                .eq(AssignmentSubmission::getUserId, userId));
        if (submission == null) {
            submission = new AssignmentSubmission();
            submission.setAssignmentId(request.getAssignmentId());
            submission.setUserId(userId);
            submission.setContent(request.getContent());
            submission.setAttachmentUrl(request.getAttachmentUrl());
            submission.setStatus(0);
            return Result.success(assignmentSubmissionService.save(submission));
        }
        submission.setContent(request.getContent());
        submission.setAttachmentUrl(request.getAttachmentUrl());
        submission.setStatus(0);
        return Result.success(assignmentSubmissionService.updateById(submission));
    }

    @Data
    public static class SubmitAssignmentRequest {
        @NotNull(message = "作业ID不能为空")
        private Long assignmentId;
        private String content;
        private String attachmentUrl;
    }

    @Data
    public static class AssignmentListVO {
        private Long assignmentId;
        private Long courseId;
        private String title;
        private String content;
        private String attachmentUrl;
        private java.time.LocalDateTime deadline;
        private Boolean submitted;
        private Integer submissionStatus;
        private Long submissionId;
        private String submittedContent;
        private String submittedAttachmentUrl;
        private java.math.BigDecimal score;
        private String comment;
    }
}
