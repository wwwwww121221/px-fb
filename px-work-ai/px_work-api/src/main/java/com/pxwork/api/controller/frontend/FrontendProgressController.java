package com.pxwork.api.controller.frontend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
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
import com.pxwork.course.entity.CourseChapter;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.CourseHourRecord;
import com.pxwork.course.service.CourseChapterService;
import com.pxwork.course.service.CourseHourRecordService;
import com.pxwork.course.service.CourseHourService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Tag(name = "4.3 前台-学习进度与校验")
@RestController
@RequestMapping("/frontend/progress")
public class FrontendProgressController {

    @Autowired
    private CourseHourRecordService courseHourRecordService;
    @Autowired
    private CourseChapterService courseChapterService;
    @Autowired
    private CourseHourService courseHourService;

    @Operation(summary = "上报学习进度")
    @PutMapping("/report")
    public Result<Map<String, Object>> report(@RequestBody @Validated ProgressReportRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        CourseHour hour = courseHourService.getById(request.getHourId());
        if (hour == null) {
            return Result.fail("课时不存在");
        }
        if (isLiveHour(hour)) {
            return Result.success();
        }
        long resourceId = request.getResourceId() == null ? request.getHourId() : request.getResourceId();
        if (resourceId <= 0) {
            return Result.fail("资源ID无效");
        }
        int totalDuration = request.getTotalDuration().intValue();
        int currentTime = request.getCurrentTime().intValue();

        CourseHourRecord record = courseHourRecordService.getOne(new LambdaQueryWrapper<CourseHourRecord>()
                .eq(CourseHourRecord::getUserId, userId)
                .eq(CourseHourRecord::getCourseId, request.getCourseId())
                .eq(CourseHourRecord::getResourceId, resourceId));

        int finishedDuration;
        if (record == null) {
            record = new CourseHourRecord();
            record.setUserId(userId);
            record.setCourseId(request.getCourseId());
            record.setResourceId(resourceId);
            record.setTotalDuration(totalDuration);
            finishedDuration = Math.max(0, currentTime);
            record.setFinishedDuration(finishedDuration);
        } else {
            record.setTotalDuration(Math.max(record.getTotalDuration() == null ? 0 : record.getTotalDuration(), totalDuration));
            finishedDuration = Math.max(record.getFinishedDuration() == null ? 0 : record.getFinishedDuration(), currentTime);
            record.setFinishedDuration(finishedDuration);
        }
        int recordTotal = record.getTotalDuration() == null ? totalDuration : record.getTotalDuration();
        boolean isFinished = false;
        if (recordTotal <= 0) {
            isFinished = true;
        } else {
            isFinished = finishedDuration * 100L >= recordTotal * 95L;
        }
        record.setIsFinished(isFinished ? 1 : 0);

        if (record.getId() == null) {
            courseHourRecordService.save(record);
        } else {
            courseHourRecordService.updateById(record);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("finishedDuration", record.getFinishedDuration());
        result.put("isFinished", record.getIsFinished() == 1);
        return Result.success(result);
    }

    @Operation(summary = "获取单课时学习记录")
    @GetMapping("/record/{courseId}/{resourceId}")
    public Result<Map<String, Object>> getRecord(@PathVariable Long courseId, @PathVariable Long resourceId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        CourseHourRecord record = courseHourRecordService.getOne(new LambdaQueryWrapper<CourseHourRecord>()
                .eq(CourseHourRecord::getUserId, userId)
                .eq(CourseHourRecord::getCourseId, courseId)
                .eq(CourseHourRecord::getResourceId, resourceId));

        Map<String, Object> result = new HashMap<>();
        result.put("record", record);
        result.put("finishedDuration", record == null || record.getFinishedDuration() == null ? 0 : record.getFinishedDuration());
        return Result.success(result);
    }

    @Operation(summary = "校验课程完成度")
    @GetMapping("/check-completion/{courseId}")
    public Result<Map<String, Object>> checkCompletion(@PathVariable Long courseId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        List<Long> chapterIds = courseChapterService.list(new LambdaQueryWrapper<CourseChapter>()
                        .eq(CourseChapter::getCourseId, courseId))
                .stream()
                .map(CourseChapter::getId)
                .collect(Collectors.toList());

        long totalHours = 0;
        if (!chapterIds.isEmpty()) {
            totalHours = courseHourService.list(new LambdaQueryWrapper<CourseHour>()
                            .in(CourseHour::getChapterId, chapterIds))
                    .stream()
                    .filter(hour -> !isLiveHour(hour))
                    .count();
        }
        long finishedHours = courseHourRecordService.count(new LambdaQueryWrapper<CourseHourRecord>()
                .eq(CourseHourRecord::getUserId, userId)
                .eq(CourseHourRecord::getCourseId, courseId)
                .eq(CourseHourRecord::getIsFinished, 1));

        Map<String, Object> result = new HashMap<>();
        result.put("isCompleted", totalHours > 0 && finishedHours == totalHours);
        result.put("totalHours", totalHours);
        result.put("finishedHours", finishedHours);
        return Result.success(result);
    }

    private boolean isLiveHour(CourseHour hour) {
        if (hour == null) {
            return false;
        }
        if (StringUtils.hasText(hour.getLiveUrl())) {
            return true;
        }
        return StringUtils.hasText(hour.getName()) && hour.getName().contains("直播");
    }

    @Data
    public static class ProgressReportRequest {
        @NotNull(message = "课程ID不能为空")
        private Long courseId;
        @NotNull(message = "课时ID不能为空")
        private Long hourId;
        @NotNull(message = "资源ID不能为空")
        private Long resourceId;
        @NotNull(message = "总时长不能为空")
        private Double totalDuration;
        @NotNull(message = "当前进度不能为空")
        @Min(value = 0, message = "当前进度不能小于0")
        private Double currentTime;
    }
}
