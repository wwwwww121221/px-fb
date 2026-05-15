import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { studentLogout, getStudentInfo } from '../api/student'; 
import useAuthStore from '../store/useAuthStore';

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const clearAuth = useAuthStore((state) => state.clearAuth); 

  useEffect(() => {
    // 每次进入布局时，请求最新学员信息
    const fetchUserInfo = async () => {
      try {
        const res = await getStudentInfo();
        const userData = res?.data || res;
        setUser(userData);
        localStorage.setItem('student_user', JSON.stringify(userData));
      } catch (error) {
        console.error('获取学员信息失败，可能未登录', error);
      }
    };
    fetchUserInfo();
  }, []);

  // ==========================================
  // 合并后的退出逻辑：调用后端注销 + 清理前端缓存
  // ==========================================
  const handleLogout = async () => {
    if (!window.confirm('确定要退出当前学习账号吗？')) return;

    try {
      // 真实调用后端的注销接口，销毁服务器会话
      await studentLogout();
    } catch (error) {
      console.warn('后端注销接口异常', error);
    } finally {
      // 无论后端请求是否成功，彻底清理前端凭证并跳回登录页
      localStorage.clear();
      if (clearAuth) clearAuth(); 
      navigate('/login');
    }
  };

  const navMenus = [
    { path: '/student/dashboard', label: '我的课程' },
    { path: '/student/assignments', label: '作业中心' },
    { path: '/student/exams', label: '在线考试' },
    { path: '/student/certificates', label: '我的证书' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* 顶部导航栏 (Header) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">企</div>
                <span className="text-xl font-bold text-blue-700 tracking-wide">企培通学习中心</span>
              </div>

              <nav className="hidden md:flex space-x-6 h-full">
                {navMenus.map((menu) => {
                  const isActive = location.pathname.includes(menu.path);
                  return (
                    <Link
                      key={menu.path}
                      to={menu.path}
                      className={`inline-flex items-center px-1 border-b-2 text-sm font-bold transition-colors ${
                        isActive 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {menu.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* 右侧：用户信息与合并后的退出按钮 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.idCard || 'student'}`} alt="avatar" className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
                <span className="text-sm text-slate-600">
                  你好，<span className="font-bold text-slate-800">{user?.name || '学员'}</span>
                </span>
              </div>
              
              <div className="h-4 w-px bg-slate-300 mx-1"></div>
              
              {/* 🌟 只有这一个按钮了：同时处理前后端的退出逻辑 */}
              <button 
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 font-medium"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span> 退出
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* 主体内容区 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-400">
          &copy; 数字化培训管理平台. All rights reserved.
        </div>
      </footer>
    </div>
  );
}