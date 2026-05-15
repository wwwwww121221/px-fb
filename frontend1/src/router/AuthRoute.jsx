// 路由守卫 (校验前台学员或后台管理员 token)
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

export default function AuthRoute({ children, allowedRoles }) {
  const { token, role } = useAuthStore();
  const location = useLocation();

  // 如果没有 token，说明未登录
  if (!token) {
    // 根据用户想访问的路径，智能重定向到对应的登录页
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/auth/backend-login" replace />;
    }
    return <Navigate to="/auth/frontend-login" replace />;
  }

  // 如果定义了允许的角色，并且当前用户的角色不在其中，则拦截
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        <h2>403 - 无权限访问该页面</h2>
      </div>
    );
  }

  // 验证通过，渲染子组件
  return children;
}