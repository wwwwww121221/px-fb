package com.pxwork.api.controller.course;

import java.util.List;

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
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.service.CourseHourService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "2.4 后台-课程课时管理")
@RestController
@RequestMapping("/course/hour")
public class CourseHourController {

    @Autowired
    private CourseHourService courseHourService;

    @Operation(summary = "获取章节课时列表")
    @GetMapping("/list")
    public Result<List<CourseHour>> list(@RequestParam Long chapterId) {
        LambdaQueryWrapper<CourseHour> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(CourseHour::getChapterId, chapterId);
        queryWrapper.orderByAsc(CourseHour::getSort);
        return Result.success(courseHourService.list(queryWrapper));
    }

    @Operation(summary = "创建课时")
    @PostMapping
    public Result<Boolean> create(@RequestBody CourseHour hour) {
        Result<Boolean> validation = validateAndNormalizeHour(hour);
        if (validation != null) {
            return validation;
        }
        return Result.success(courseHourService.save(hour));
    }

    @Operation(summary = "更新课时")
    @PutMapping
    public Result<Boolean> update(@RequestBody CourseHour hour) {
        Result<Boolean> validation = validateAndNormalizeHour(hour);
        if (validation != null) {
            return validation;
        }
        return Result.success(courseHourService.updateById(hour));
    }

    @Operation(summary = "删除课时")
    @DeleteMapping("/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        return Result.success(courseHourService.removeById(id));
    }

    @Operation(summary = "获取课时详情")
    @GetMapping("/{id}")
    public Result<CourseHour> get(@PathVariable Long id) {
        return Result.success(courseHourService.getById(id));
    }

    private Result<Boolean> validateAndNormalizeHour(CourseHour hour) {
        if (hour == null) {
            return Result.fail("课时数据不能为空");
        }

        String liveUrl = hour.getLiveUrl();
        if (liveUrl != null) {
            liveUrl = liveUrl.trim();
            hour.setLiveUrl(liveUrl);
        }

        boolean liveHour = isLiveHour(hour);
        if (liveHour) {
            if (!StringUtils.hasText(hour.getLiveUrl())) {
                return Result.fail("直播课时必须填写 liveUrl");
            }
        } else {
            hour.setLiveUrl(null);
        }
        return null;
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
}
