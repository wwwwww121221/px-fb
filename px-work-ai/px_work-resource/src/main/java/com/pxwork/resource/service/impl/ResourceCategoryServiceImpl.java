package com.pxwork.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.resource.entity.ResourceCategory;
import com.pxwork.resource.mapper.ResourceCategoryMapper;
import com.pxwork.resource.service.ResourceCategoryService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * <p>
 * 资源分类表 服务实现类
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Service
public class ResourceCategoryServiceImpl extends ServiceImpl<ResourceCategoryMapper, ResourceCategory> implements ResourceCategoryService {

    @Override
    public List<ResourceCategory> listTree() {
        // 1. 查询所有分类
        List<ResourceCategory> allCategories = this.list(new LambdaQueryWrapper<ResourceCategory>()
                .orderByAsc(ResourceCategory::getSort)
                .orderByDesc(ResourceCategory::getCreatedAt));

        // 2. 构建树形结构
        return buildTree(allCategories, 0L);
    }

    private List<ResourceCategory> buildTree(List<ResourceCategory> allList, Long parentId) {
        List<ResourceCategory> tree = new ArrayList<>();
        for (ResourceCategory category : allList) {
            if (category.getParentId().equals(parentId)) {
                category.setChildren(buildTree(allList, category.getId()));
                tree.add(category);
            }
        }
        return tree;
    }
}
