package com.pxwork.common.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.common.entity.Department;
import com.pxwork.common.mapper.DepartmentMapper;
import com.pxwork.common.service.DepartmentService;

/**
 * <p>
 * 部门表 服务实现类
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Service
public class DepartmentServiceImpl extends ServiceImpl<DepartmentMapper, Department> implements DepartmentService {

    @Override
    public List<Department> getTree() {
        // 1. 获取所有部门
        List<Department> allDepts = this.list(new LambdaQueryWrapper<Department>()
                .orderByAsc(Department::getSort));

        if (allDepts == null || allDepts.isEmpty()) {
            return new ArrayList<>();
        }

        List<Department> validDepts = new ArrayList<>();
        java.util.Map<Long, Long> invalidParentMap = new java.util.HashMap<>();
        for (Department dept : allDepts) {
            if (dept == null || dept.getId() == null) {
                continue;
            }
            if (isInvalidName(dept.getName())) {
                invalidParentMap.put(dept.getId(), dept.getParentId() == null ? Long.valueOf(0L) : dept.getParentId());
                continue;
            }
            dept.setChildren(null);
            validDepts.add(dept);
        }

        if (!invalidParentMap.isEmpty()) {
            for (Department dept : validDepts) {
                Long parentId = dept.getParentId() == null ? Long.valueOf(0L) : dept.getParentId();
                int guard = 0;
                while (invalidParentMap.containsKey(parentId) && guard < 20) {
                    parentId = invalidParentMap.get(parentId);
                    guard += 1;
                }
                dept.setParentId(parentId);
            }
        }

        // 2. 组装树形结构
        // 先找到所有顶级节点 (parentId = 0)
        List<Department> roots = validDepts.stream()
                .filter(dept -> Long.valueOf(0L).equals(dept.getParentId()))
                .collect(Collectors.toList());

        // 递归查找子节点
        for (Department root : roots) {
            buildChildren(root, validDepts);
        }

        return roots;
    }

    private void buildChildren(Department parent, List<Department> allDepts) {
        List<Department> children = allDepts.stream()
                .filter(dept -> dept.getParentId() != null && parent.getId() != null && dept.getParentId().equals(parent.getId()))
                .collect(Collectors.toList());
        
        if (!children.isEmpty()) {
            parent.setChildren(children);
            for (Department child : children) {
                buildChildren(child, allDepts);
            }
        }
    }

    private boolean isInvalidName(String name) {
        if (name == null) {
            return true;
        }
        String s = name.trim();
        return s.isEmpty() || "/".equals(s);
    }
}
