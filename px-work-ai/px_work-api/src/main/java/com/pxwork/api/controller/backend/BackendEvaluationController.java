package com.pxwork.api.controller.backend;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.ProcessEvaluation;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.ProcessEvaluationService;
import com.pxwork.course.service.UserCourseResultService;
import com.pxwork.system.entity.AdminUser;
import com.pxwork.system.service.AdminUserService;

import cn.dev33.satoken.stp.StpUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.util.CollectionUtils;

@Tag(name = "3.2 后台-综合评价与成绩汇总")
@RestController
@RequestMapping("/backend/evaluation")
public class BackendEvaluationController {

    @Autowired
    private ProcessEvaluationService processEvaluationService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CourseService courseService;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private UserCourseResultService userCourseResultService;

    @Operation(summary = "过程评价打分（自动触发综合成绩汇总）")
    @PutMapping("/score")
    public Result<Map<String, Object>> score(@RequestBody @Validated ScoreRequest request) {
        Long currentAdminId = StpUtil.getLoginIdAsLong();
        boolean isSuperAdmin = isSuperAdmin(currentAdminId);
        Course course = courseService.getById(request.getCourseId());
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (!isSuperAdmin && !currentAdminId.equals(course.getTeacherId())) {
            return Result.fail("无权限对该课程评分");
        }

        List<EvaluationItem> evaluationItems = request.resolveEvaluationItems();
        if (CollectionUtils.isEmpty(evaluationItems)) {
            return Result.fail("评价明细不能为空");
        }
        BigDecimal totalScore = BigDecimal.ZERO;
        for (EvaluationItem item : evaluationItems) {
            if (item.getScore() == null) {
                return Result.fail("评价项分数不能为空");
            }
            if (!org.springframework.util.StringUtils.hasText(item.getDimension())) {
                return Result.fail("评价维度不能为空");
            }
            if (item.getScore().compareTo(BigDecimal.ZERO) < 0) {
                return Result.fail("评价项分数不能为负数");
            }
            totalScore = totalScore.add(item.getScore());
        }
        String evaluationDetails;
        try {
            evaluationDetails = objectMapper.writeValueAsString(evaluationItems);
        } catch (JsonProcessingException e) {
            return Result.fail("评价明细序列化失败");
        }

        List<ProcessEvaluation> evaluationList = processEvaluationService.list(new LambdaQueryWrapper<ProcessEvaluation>()
                .eq(ProcessEvaluation::getUserId, request.getUserId())
                .eq(ProcessEvaluation::getCourseId, request.getCourseId())
                .orderByDesc(ProcessEvaluation::getId));
        ProcessEvaluation evaluation = evaluationList.isEmpty() ? null : evaluationList.get(0);
        boolean isNew = evaluation == null;
        if (isNew) {
            evaluation = new ProcessEvaluation();
            evaluation.setUserId(request.getUserId());
            evaluation.setCourseId(request.getCourseId());
        }
        evaluation.setEvaluationDetails(evaluationDetails);
        evaluation.setTotalScore(totalScore);

        boolean success = isNew ? processEvaluationService.save(evaluation) : processEvaluationService.updateById(evaluation);
        if (!success) {
            return Result.fail("评分保存失败");
        }
        userCourseResultService.calculateAggregateScore(request.getUserId(), request.getCourseId());
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("totalScore", totalScore);
        result.put("recordId", evaluation.getId());
        result.put("updated", !isNew);
        return Result.success(result);
    }

    private boolean isSuperAdmin(Long adminUserId) {
        AdminUser adminUser = adminUserService.getById(adminUserId);
        return adminUser != null && Integer.valueOf(1).equals(adminUser.getIsSuper());
    }

    @Data
    public static class ScoreRequest {
        @NotNull(message = "学员ID不能为空")
        private Long userId;
        @NotNull(message = "课程ID不能为空")
        private Long courseId;
        @NotEmpty(message = "评价明细不能为空")
        @Valid
        @JsonAlias("items")
        private List<EvaluationItem> evaluationItems;

        public List<EvaluationItem> resolveEvaluationItems() {
            return evaluationItems;
        }
    }

    @Data
    public static class EvaluationItem {
        @NotBlank(message = "评价维度不能为空")
        @JsonAlias("name")
        private String dimension;
        @NotNull(message = "评价分数不能为空")
        private BigDecimal score;
    }
}
