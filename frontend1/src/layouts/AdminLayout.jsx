import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { adminLogout } from '../api/admin'; // 🌟 1. 引入名字修改为 adminLogout
import request from '../api/request';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { userInfo, logout, updateUserInfo } = useAuthStore();

  useEffect(() => {
    const syncAdminInfo = async () => {
      try {
        const latestUserInfo = await request.get('/backend/user/info');
        if (latestUserInfo) {
          updateUserInfo(latestUserInfo?.data || latestUserInfo);
        }
      } catch (error) {
        console.warn('获取最新管理员信息失败，继续使用本地缓存', error);
      }
    };

    syncAdminInfo();
  }, [updateUserInfo]);

  const handleLogout = async () => {
    // 增加安全确认弹窗，防止误触
    if (!window.confirm('【安全提示】确定要退出企业管理后台吗？')) return;

    try {
      // 🌟 2. 调用修改后的新接口
      await adminLogout();
    } catch (error) {
      console.warn('后端注销接口异常，可能 Token 已失效', error);
    } finally {
      // 无论后端是否成功，彻底清理前端所有凭证，双重保险
      localStorage.clear(); 
      logout(); // 清理 Zustand 状态
      navigate('/login'); 
    }
  };

  const navItems = [
    { path: '/admin/dashboard', icon: 'dashboard', label: '控制台' },
    { path: '/admin/courses', icon: 'book_4', label: '课程列表' },
    { path: '/admin/organization', icon: 'group', label: '学员管理' },
    { path: '/admin/department', icon: 'account_tree', label: '组织架构' },
    { path: '/admin/resources', icon: 'folder_special', label: '素材中心' },
    { path: '/admin/system', icon: 'admin_panel_settings', label: '角色管理' },
    { path: '/admin/certificates', icon: 'workspace_premium', label: '证书系统' },
  ];

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50 dark:bg-[#121520] font-display text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed h-full z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-700 rounded-lg p-1.5 text-white">
            <span className="material-symbols-outlined text-2xl">school</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">企培通</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">企业管理端</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-700/10 text-blue-700 dark:text-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-semibold">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <button className="flex items-center justify-center p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:border-slate-700 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold leading-none">{userInfo?.name || '管理员'}</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
              <div
                className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 dark:border-slate-700 bg-cover bg-center"
                style={{ backgroundImage: `url(${userInfo?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'})` }}
              ></div>
            </div>
          </div>
        </header>

        {/* 核心页面渲染区域 */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
