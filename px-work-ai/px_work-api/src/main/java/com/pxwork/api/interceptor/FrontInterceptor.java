package com.pxwork.api.interceptor;

import com.pxwork.common.utils.StpUserUtil;
import org.springframework.web.servlet.HandlerInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 前台学员拦截器
 * 负责校验前台学员是否登录
 */
public class FrontInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 校验前台学员是否登录 (如果未登录，会抛出 NotLoginException)
        StpUserUtil.checkLogin();
        return true;
    }
}
