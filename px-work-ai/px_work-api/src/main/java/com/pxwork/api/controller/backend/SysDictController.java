package com.pxwork.api.controller.backend;

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
import com.pxwork.system.entity.SysDict;
import com.pxwork.system.service.SysDictService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "1.4 后台-数据字典管理")
@RestController
@RequestMapping("/backend/dict")
public class SysDictController {

    @Autowired
    private SysDictService sysDictService;

    @Operation(summary = "字典列表", description = "根据dictType查询，按sort升序")
    @GetMapping("/list")
    public Result<List<SysDict>> list(@RequestParam(required = false) String dictType) {
        LambdaQueryWrapper<SysDict> queryWrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(dictType)) {
            queryWrapper.eq(SysDict::getDictType, dictType);
        }
        queryWrapper.orderByAsc(SysDict::getSort).orderByAsc(SysDict::getId);
        return Result.success(sysDictService.list(queryWrapper));
    }

    @Operation(summary = "新增字典项")
    @PostMapping("/create")
    public Result<Boolean> create(@RequestBody SysDict sysDict) {
        boolean success = sysDictService.save(sysDict);
        return success ? Result.success(true) : Result.fail("创建失败");
    }

    @Operation(summary = "修改字典项")
    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody SysDict sysDict) {
        boolean success = sysDictService.updateById(sysDict);
        return success ? Result.success(true) : Result.fail("更新失败");
    }

    @Operation(summary = "删除字典项")
    @DeleteMapping("/delete/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        boolean success = sysDictService.removeById(id);
        return success ? Result.success(true) : Result.fail("删除失败");
    }
}
