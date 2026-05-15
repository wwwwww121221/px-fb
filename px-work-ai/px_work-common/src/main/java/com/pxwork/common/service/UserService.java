package com.pxwork.common.service;

import java.util.Map;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.common.entity.User;
import com.pxwork.common.request.FrontendLoginRequest;

/**
 * <p>
 * 学员用户表 服务类
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
public interface UserService extends IService<User> {

    boolean createUser(User user);

    boolean updateUser(User user);
    
    Page<User> pageWithDepts(Page<User> page, String name);

    Map<String, Object> login(FrontendLoginRequest request);
}
