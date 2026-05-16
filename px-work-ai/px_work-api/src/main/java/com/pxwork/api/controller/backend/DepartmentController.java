package com.pxwork.api.controller.backend;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.pxwork.common.entity.Department;
import com.pxwork.common.entity.UserDepartment;
import com.pxwork.common.service.DepartmentService;
import com.pxwork.common.service.UserDepartmentService;
import com.pxwork.common.utils.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * <p>
 * 部门管理 前端控制器
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Tag(name = "1.3 后台-部门组织管理")
@RestController
@RequestMapping("/department")
public class DepartmentController {

    @Autowired
    private DepartmentService departmentService;
    @Autowired
    private UserDepartmentService userDepartmentService;

    @Operation(summary = "部门树形列表", description = "获取部门树形结构")
    @GetMapping("/tree")
    public Result<List<Department>> tree() {
        return Result.success(departmentService.getTree());
    }

    @Operation(summary = "新增部门", description = "创建新部门")
    @PostMapping("/create")
    public Result<Boolean> create(@RequestBody Department department) {
        boolean success = departmentService.save(department);
        return success ? Result.success(true) : Result.fail("创建失败");
    }

    @Operation(summary = "修改部门", description = "更新部门信息")
    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody Department department) {
        boolean success = departmentService.updateById(department);
        return success ? Result.success(true) : Result.fail("更新失败");
    }

    @Operation(summary = "删除部门", description = "根据ID删除部门")
    @DeleteMapping("/delete/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        long children = departmentService.count(new LambdaQueryWrapper<Department>().eq(Department::getParentId, id));
        if (children > 0) {
            return Result.fail("请先删除子部门");
        }
        long userRefs = userDepartmentService.count(new LambdaQueryWrapper<UserDepartment>().eq(UserDepartment::getDepartmentId, id));
        if (userRefs > 0) {
            return Result.fail("该部门下仍有关联学员，无法删除");
        }
        boolean success = departmentService.removeById(id);
        return success ? Result.success(true) : Result.fail("删除失败");
    }

    @Operation(summary = "批量删除部门", description = "批量删除部门(仅允许删除无子部门且无学员关联的部门)")
    @PostMapping("/batch-delete")
    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> batchDelete(@RequestBody List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Result.fail("参数错误");
        }
        List<Long> uniqueIds = ids.stream().filter(item -> item != null && item > 0).distinct().collect(Collectors.toList());
        if (uniqueIds.isEmpty()) {
            return Result.fail("参数错误");
        }

        int deleted = 0;
        List<Map<String, Object>> failed = new ArrayList<>();
        for (Long id : uniqueIds) {
            long children = departmentService.count(new LambdaQueryWrapper<Department>().eq(Department::getParentId, id));
            if (children > 0) {
                failed.add(Map.of("id", id, "reason", "存在子部门"));
                continue;
            }
            long userRefs = userDepartmentService.count(new LambdaQueryWrapper<UserDepartment>().eq(UserDepartment::getDepartmentId, id));
            if (userRefs > 0) {
                failed.add(Map.of("id", id, "reason", "存在关联学员"));
                continue;
            }
            boolean removed = departmentService.removeById(id);
            if (removed) {
                deleted += 1;
            } else {
                failed.add(Map.of("id", id, "reason", "删除失败"));
            }
        }

        Map<String, Object> data = new HashMap<>();
        data.put("requested", uniqueIds.size());
        data.put("deleted", deleted);
        data.put("failed", failed);
        return Result.success(data);
    }

    @Operation(summary = "部门排序重排", description = "按同级节点重排 sort，使展示顺序稳定(从1开始递增)")
    @PostMapping("/reindex-sort")
    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> reindexSort() {
        List<Department> allDepts = departmentService.list();
        if (allDepts == null || allDepts.isEmpty()) {
            return Result.success(Map.of("updated", 0));
        }

        Map<Long, List<Department>> byParent = new HashMap<>();
        for (Department dept : allDepts) {
            if (dept == null || dept.getId() == null) {
                continue;
            }
            if (isInvalidName(dept.getName())) {
                continue;
            }
            Long parentId = dept.getParentId() == null ? 0L : dept.getParentId();
            byParent.computeIfAbsent(parentId, k -> new ArrayList<>()).add(dept);
        }

        List<Department> updates = new ArrayList<>();
        for (Map.Entry<Long, List<Department>> entry : byParent.entrySet()) {
            List<Department> siblings = entry.getValue();
            if (siblings == null || siblings.isEmpty()) {
                continue;
            }
            siblings.sort((a, b) -> {
                int sa = a.getSort() == null ? 0 : a.getSort();
                int sb = b.getSort() == null ? 0 : b.getSort();
                if (sa != sb) {
                    return Integer.compare(sa, sb);
                }
                return Long.compare(a.getId(), b.getId());
            });
            for (int i = 0; i < siblings.size(); i++) {
                Department dept = siblings.get(i);
                int desired = i + 1;
                int current = dept.getSort() == null ? 0 : dept.getSort();
                if (current != desired) {
                    Department u = new Department();
                    u.setId(dept.getId());
                    u.setSort(desired);
                    updates.add(u);
                }
            }
        }

        if (!updates.isEmpty()) {
            departmentService.updateBatchById(updates);
        }
        return Result.success(Map.of("updated", updates.size()));
    }

    @Operation(summary = "清理无效部门节点", description = "清理名称为空或为“/”的部门节点：子节点上提、学员关联上提/删除，然后删除无效节点")
    @PostMapping("/cleanup-invalid")
    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> cleanupInvalid() {
        List<Department> allDepts = departmentService.list();
        if (allDepts == null || allDepts.isEmpty()) {
            return Result.success(Map.of(
                    "invalid", 0,
                    "childrenMoved", 0,
                    "userRelationsMoved", 0,
                    "userRelationsDeleted", 0,
                    "deleted", 0));
        }

        List<Department> invalids = allDepts.stream()
                .filter(d -> d != null && d.getId() != null)
                .filter(d -> isInvalidName(d.getName()))
                .collect(Collectors.toList());

        if (invalids.isEmpty()) {
            return Result.success(Map.of(
                    "invalid", 0,
                    "childrenMoved", 0,
                    "userRelationsMoved", 0,
                    "userRelationsDeleted", 0,
                    "deleted", 0));
        }

        int childrenMoved = 0;
        int userRelationsMoved = 0;
        int userRelationsDeleted = 0;
        int deleted = 0;

        for (Department invalid : invalids) {
            Long invalidId = invalid.getId();
            Long parentId = invalid.getParentId() == null ? 0L : invalid.getParentId();

            List<Department> children = departmentService.list(new LambdaQueryWrapper<Department>()
                    .eq(Department::getParentId, invalidId));
            if (children != null && !children.isEmpty()) {
                childrenMoved += children.size();
                departmentService.update(new LambdaUpdateWrapper<Department>()
                        .set(Department::getParentId, parentId)
                        .eq(Department::getParentId, invalidId));
            }

            List<UserDepartment> refs = userDepartmentService.list(new LambdaQueryWrapper<UserDepartment>()
                    .eq(UserDepartment::getDepartmentId, invalidId));
            if (refs != null && !refs.isEmpty()) {
                List<Long> userIds = refs.stream()
                        .map(UserDepartment::getUserId)
                        .filter(id -> id != null)
                        .collect(Collectors.toList());

                if (parentId != null && parentId > 0 && !userIds.isEmpty()) {
                    userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>()
                            .eq(UserDepartment::getDepartmentId, parentId)
                            .in(UserDepartment::getUserId, userIds));
                    userDepartmentService.update(new LambdaUpdateWrapper<UserDepartment>()
                            .set(UserDepartment::getDepartmentId, parentId)
                            .eq(UserDepartment::getDepartmentId, invalidId));
                    userRelationsMoved += refs.size();
                } else {
                    userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>()
                            .eq(UserDepartment::getDepartmentId, invalidId));
                    userRelationsDeleted += refs.size();
                }
            }

            boolean removed = departmentService.removeById(invalidId);
            if (removed) {
                deleted += 1;
            }
        }

        return Result.success(Map.of(
                "invalid", invalids.size(),
                "childrenMoved", childrenMoved,
                "userRelationsMoved", userRelationsMoved,
                "userRelationsDeleted", userRelationsDeleted,
                "deleted", deleted));
    }

    private boolean isInvalidName(String name) {
        if (name == null) {
            return true;
        }
        String s = name.trim();
        return s.isEmpty() || "/".equals(s);
    }
}
