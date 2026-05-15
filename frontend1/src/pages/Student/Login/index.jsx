import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  studentLogin, 
  getStudentInfo, 
  updateStudentPassword 
} from '../../../api/student';

export default function StudentLogin() {
  const navigate = useNavigate();

  // === 登录表单状态 ===
  const [idCard, setIdCard] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // === 首次登录改密状态 ===
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // ==========================================
  // 1. 处理学员正常登录
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!idCard.trim() || !password.trim()) {
      return alert('请输入身份证号和密码！');
    }

    setLoading(true);
    try {
      // 1. 登录并缓存 Token
      const loginRes = await studentLogin({ idCard, password });
      
      // 提取 token 并全量存入 localStorage 防御拦截器读取差异
      const token = loginRes?.token || loginRes?.satoken || loginRes?.data?.token || loginRes; 
      if (token && typeof token === 'string') {
        localStorage.setItem('satoken', token); 
        localStorage.setItem('token', token);
        localStorage.setItem('student_token', token);
      }

      // 2. 拉取当前学员信息
      const userInfoRes = await getStudentInfo();
      const userInfo = userInfoRes?.data || userInfoRes;
      localStorage.setItem('student_user', JSON.stringify(userInfo));

      // 3. 判断是否是首次登录
      if (userInfo.isFirstLogin === 1) {
        setOldPassword(password); 
        setIsFirstLogin(true);
      } else {
        navigate('/student/dashboard'); 
      }
    } catch (error) {
      console.error('登录失败:', error);
      // 兼容 request.js 抛出纯字符串的情况
      const errorMsg = typeof error === 'string' ? error : (error?.response?.data?.msg || error?.msg || '登录失败，请检查账号密码！');
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. 处理首次登录强制修改密码
  // ==========================================
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return alert('两次输入的新密码不一致，请重新输入！');
    }
    if (newPassword === oldPassword) {
      return alert('新密码不能与原密码相同！');
    }

    setUpdateLoading(true);
    try {
      await updateStudentPassword({ 
        oldPassword: oldPassword, 
        newPassword: newPassword 
      });
      
      alert('密码修改成功！请使用新密码重新登录。');
      
      // 改密成功后，清空状态强制重新登录
      localStorage.clear();
      setIsFirstLogin(false);
      setPassword(''); 
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      console.error('修改密码报错详情:', error);
      // 🌟 核心修复：兼容 request.js 拦截器直接 reject 出纯中文字符串的情况
      let errorMsg = '密码修改失败，请重试！';
      if (typeof error === 'string') {
        errorMsg = error; // 抓取 "新密码需为8-16位..."
      } else if (error?.response?.data?.msg) {
        errorMsg = error.response.data.msg;
      } else if (error?.msg) {
        errorMsg = error.msg;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      alert(errorMsg);
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 装饰性背景 */}
      <div className="absolute top-0 left-0 w-full h-64 bg-blue-600 rounded-b-[50%] scale-150 -translate-y-24 z-0"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center text-white mb-6">
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-blue-600 text-4xl">school</span>
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white">
          企培通 学员学习中心
        </h2>
        <p className="mt-2 text-center text-sm text-blue-100">
          请输入您的身份证号与密码登录系统
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-blue-900/10 sm:rounded-2xl sm:px-10 border border-white">
          
          {/* ================================== */}
          {/* 常规登录表单 */}
          {/* ================================== */}
          {!isFirstLogin ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  学员账号 (身份证号)
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">badge</span>
                  </div>
                  <input
                    type="text" required value={idCard} onChange={(e) => setIdCard(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                    placeholder="请输入18位身份证号"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  登录密码
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">lock</span>
                  </div>
                  <input
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                    placeholder="初始密码一般为123456"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer" />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900 cursor-pointer">记住账号</label>
                </div>
                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">忘记密码?</a>
                </div>
              </div>

              <div>
                <button
                  type="submit" disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? '正在登录中...' : '立 即 登 录'}
                </button>
              </div>
            </form>
          ) : (
            
            /* ================================== */
            /* 首次登录强制改密表单 */
            /* ================================== */
            <form className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300" onSubmit={handleUpdatePassword}>
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                  <span className="material-symbols-outlined text-amber-600">security_update_warning</span>
                </div>
                <h3 className="text-lg leading-6 font-bold text-slate-900">首次登录安全设置</h3>
                <p className="text-sm text-slate-500 mt-1">为了您的账号安全，首次登录系统必须修改初始密码。</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">原密码</label>
                <input
                  type="password" required disabled value={oldPassword}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 sm:text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">设置新密码 <span className="text-red-500">*</span></label>
                <input
                  type="password" required autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 sm:text-sm outline-none"
                  placeholder="8-16位,含字母/数字/特殊符号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">确认新密码 <span className="text-red-500">*</span></label>
                <input
                  type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 sm:text-sm outline-none"
                  placeholder="请再次输入新密码"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.clear();
                    setIsFirstLogin(false);
                  }}
                  className="w-1/3 flex justify-center py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors outline-none"
                >
                  取消
                </button>
                <button
                  type="submit" disabled={updateLoading}
                  className="w-2/3 flex justify-center py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors outline-none"
                >
                  {updateLoading ? '提交中...' : '确认修改并重新登录'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}