package com.pxwork.resource.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.resource.entity.ResourceCategory;

import java.util.List;

/**
 * <p>
 * 资源分类表 服务类
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
public interface ResourceCategoryService extends IService<ResourceCategory> {

    /**
     * 获取分类树形结构
     * @return 分类树
     */
    List<ResourceCategory> listTree();
}
