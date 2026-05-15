package com.pxwork.common.utils;

import cn.dev33.satoken.stp.StpLogic;
import cn.dev33.satoken.stp.StpUtil;

/**
 * Sa-Token 权限认证工具类 (学员端专用)
 */
public class StpUserUtil {

    /**
     * 账号类型标识
     */
    public static final String TYPE = "user";

    /**
     * 底层的 StpLogic 对象
     */
    public static StpLogic stpLogic = new StpLogic(TYPE);

    /**
     * 获取当前 StpLogic 对象
     * 
     * @return StpLogic 对象
     */
    public static StpLogic getStpLogic() {
        return stpLogic;
    }

    /**
     * 获取当前会话是否已经登录
     * 
     * @return true=已登录，false=未登录
     */
    public static boolean isLogin() {
        return stpLogic.isLogin();
    }

    /**
     * 检验当前会话是否已经登录，如未登录，则抛出异常
     */
    public static void checkLogin() {
        stpLogic.checkLogin();
    }

    /**
     * 在当前会话登录
     * 
     * @param id 账号id
     */
    public static void login(Object id) {
        stpLogic.login(id);
    }

    /**
     * 当前会话注销登录
     */
    public static void logout() {
        stpLogic.logout();
    }

    /**
     * 获取当前会话账号id, 如果未登录，则抛出异常
     * 
     * @return 账号id
     */
    public static long getLoginIdAsLong() {
        return stpLogic.getLoginIdAsLong();
    }

    /**
     * 获取当前会话账号id, 如果未登录，则返回默认值
     * 
     * @param defaultValue 默认值
     * @return 账号id
     */
    public static long getLoginIdAsLong(long defaultValue) {
        return stpLogic.isLogin() ? stpLogic.getLoginIdAsLong() : defaultValue;
    }
    
    /**
     * 获取当前 Token Value
     * 
     * @return Token Value
     */
    public static String getTokenValue() {
        return stpLogic.getTokenValue();
    }
}
