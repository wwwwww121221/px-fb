package com.pxwork.api.controller.backend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
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
import com.pxwork.common.utils.Result;
import com.pxwork.system.entity.AdminUser;
import com.pxwork.system.entity.AdminUserRole;
import com.pxwork.system.service.AdminUserRoleService;
import com.pxwork.system.service.AdminUserService;

import cn.dev33.satoken.annotation.SaCheckPermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * <p>
 * 后台管理员 前端控制器
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-12
 */
@Tag(name = "1.1 后台-管理员管理")
@RestController
@RequestMapping("/admin-user")
public class AdminUserController {

    @Autowired
    private AdminUserService adminUserService;
    @Autowired
    private AdminUserRoleService adminUserRoleService;

    @Operation(summary = "管理员分页列表", description = "获取管理员分页列表")
    @SaCheckPermission("system:admin:list")
    @GetMapping("/list")
    public Result<Page<AdminUser>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String name) {
        
        Page<AdminUser> page = new Page<>(current, size);
        LambdaQueryWrapper<AdminUser> queryWrapper = new LambdaQueryWrapper<>();
        if (StringUtils.isNotBlank(name)) {
            queryWrapper.like(AdminUser::getName, name);
        }
        queryWrapper.orderByDesc(AdminUser::getCreatedAt);
        
        Page<AdminUser> result = adminUserService.page(page, queryWrapper);
        List<AdminUser> records = result.getRecords();
        if (records != null && !records.isEmpty()) {
            List<Long> adminIds = records.stream()
                    .map(AdminUser::getId)
                    .filter(id -> id != null && id > 0)
                    .collect(Collectors.toList());
            if (!adminIds.isEmpty()) {
                List<AdminUserRole> userRoles = adminUserRoleService.list(new LambdaQueryWrapper<AdminUserRole>()
                        .in(AdminUserRole::getAdminUserId, adminIds));
                Map<Long, List<Long>> roleMap = new HashMap<>();
                for (AdminUserRole ur : userRoles) {
                    if (ur.getAdminUserId() == null || ur.getRoleId() == null) {
                        continue;
                    }
                    roleMap.computeIfAbsent(ur.getAdminUserId(), k -> new java.util.ArrayList<>()).add(ur.getRoleId());
                }
                for (AdminUser u : records) {
                    u.setRoleIds(roleMap.getOrDefault(u.getId(), List.of()));
                }
            }
        }
        return Result.success(result);
    }

    @Operation(summary = "新增管理员", description = "创建新管理员(支持分配角色)")
    @SaCheckPermission("system:admin:add")
    @PostMapping("/create")
    public Result<Boolean> create(@RequestBody AdminUser adminUser) {
        boolean success = adminUserService.createAdminUser(adminUser);
        return success ? Result.success(true) : Result.fail("创建失败");
    }

    @Operation(summary = "修改管理员", description = "更新管理员信息(支持分配角色)")
    @SaCheckPermission("system:admin:update")
    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody AdminUser adminUser) {
        boolean success = adminUserService.updateAdminUser(adminUser);
        return success ? Result.success(true) : Result.fail("更新失败");
    }

    @Operation(summary = "删除管理员", description = "根据ID删除管理员")
    @SaCheckPermission("system:admin:delete")
    @DeleteMapping("/delete/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        boolean success = adminUserService.removeById(id);
        return success ? Result.success(true) : Result.fail("删除失败");
    }
}
