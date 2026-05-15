package com.pxwork.system.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.system.entity.AdminMenu;
import com.pxwork.system.mapper.AdminMenuMapper;
import com.pxwork.system.service.AdminMenuService;

@Service
public class AdminMenuServiceImpl extends ServiceImpl<AdminMenuMapper, AdminMenu> implements AdminMenuService {

    @Override
    public List<AdminMenu> getMenuTree() {
        List<AdminMenu> allMenus = this.list(new LambdaQueryWrapper<AdminMenu>()
                .orderByAsc(AdminMenu::getSort)
                .orderByAsc(AdminMenu::getId));
        if (allMenus == null || allMenus.isEmpty()) {
            seedDefaultMenusIfEmpty();
            allMenus = this.list(new LambdaQueryWrapper<AdminMenu>()
                    .orderByAsc(AdminMenu::getSort)
                    .orderByAsc(AdminMenu::getId));
        }
        return buildChildren(0L, allMenus);
    }

    private void seedDefaultMenusIfEmpty() {
        long existing = this.count();
        if (existing > 0) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        List<AdminMenu> seed = new ArrayList<>();

        seed.add(new AdminMenu().setId(1000L).setParentId(0L).setName("系统管理").setType(1).setSort(10).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1001L).setParentId(1000L).setName("查看权限树").setPerms("system:menu:list").setType(3).setSort(11).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1002L).setParentId(1000L).setName("角色列表").setPerms("system:role:list").setType(3).setSort(12).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1003L).setParentId(1000L).setName("新增角色").setPerms("system:role:add").setType(3).setSort(13).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1004L).setParentId(1000L).setName("修改角色").setPerms("system:role:update").setType(3).setSort(14).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1005L).setParentId(1000L).setName("删除角色").setPerms("system:role:delete").setType(3).setSort(15).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1006L).setParentId(1000L).setName("分配角色权限").setPerms("system:role:assign").setType(3).setSort(16).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1010L).setParentId(1000L).setName("管理员列表").setPerms("system:admin:list").setType(3).setSort(20).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1011L).setParentId(1000L).setName("新增管理员").setPerms("system:admin:add").setType(3).setSort(21).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1012L).setParentId(1000L).setName("修改管理员").setPerms("system:admin:update").setType(3).setSort(22).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(1013L).setParentId(1000L).setName("删除管理员").setPerms("system:admin:delete").setType(3).setSort(23).setCreatedAt(now).setUpdatedAt(now));

        seed.add(new AdminMenu().setId(2000L).setParentId(0L).setName("课程管理").setType(1).setSort(30).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(2001L).setParentId(2000L).setName("课程列表").setPerms("course:list").setType(3).setSort(31).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(2002L).setParentId(2000L).setName("新增课程").setPerms("course:add").setType(3).setSort(32).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(2003L).setParentId(2000L).setName("修改课程").setPerms("course:update").setType(3).setSort(33).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(2004L).setParentId(2000L).setName("删除课程").setPerms("course:delete").setType(3).setSort(34).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(2005L).setParentId(2000L).setName("查询课程").setPerms("course:query").setType(3).setSort(35).setCreatedAt(now).setUpdatedAt(now));

        seed.add(new AdminMenu().setId(3000L).setParentId(0L).setName("证书管理").setType(1).setSort(40).setCreatedAt(now).setUpdatedAt(now));
        seed.add(new AdminMenu().setId(3001L).setParentId(3000L).setName("证书更新").setPerms("certificate:update").setType(3).setSort(41).setCreatedAt(now).setUpdatedAt(now));

        this.saveBatch(seed);
    }

    private List<AdminMenu> buildChildren(Long parentId, List<AdminMenu> allMenus) {
        List<AdminMenu> children = new ArrayList<>();
        for (AdminMenu menu : allMenus) {
            Long menuParentId = menu.getParentId();
            if (!isSameParent(menuParentId, parentId)) {
                continue;
            }
            menu.setChildren(buildChildren(menu.getId(), allMenus));
            children.add(menu);
        }
        return children;
    }

    private boolean isSameParent(Long currentParentId, Long targetParentId) {
        if (currentParentId == null) {
            return targetParentId == null || targetParentId == 0L;
        }
        return currentParentId.equals(targetParentId);
    }
}
