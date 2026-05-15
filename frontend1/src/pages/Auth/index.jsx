import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import request from '../../api/request'; 

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [role, setRole] = useState('student'); 
  const [account, setAccount] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!account.trim() || !password.trim()) {
      setErrorMsg(role === 'student' ? '请输入身份证号和密码' : '请输入邮箱和密码');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      let token, tokenName, userInfo;
      
      if (role === 'student') {
        const loginRes = await request.post('/frontend/login', { idCard: account, password });
        
        token = loginRes?.tokenValue || loginRes?.token || loginRes?.data?.token || loginRes;
        tokenName = loginRes?.tokenName || 'satoken';

        if (!token) throw new Error('登录失败：后端未返回授权令牌');

        // 🌟 核心：拿到 Token 的第一毫秒，全部死死钉进 localStorage
        localStorage.setItem('tokenName', tokenName);
        localStorage.setItem(tokenName, token);
        localStorage.setItem('token', token);
        localStorage.setItem('student_token', token);

        const userInfoRes = await request.get('/frontend/user/info');
        userInfo = userInfoRes?.data || userInfoRes;

        if (userInfo?.isFirstLogin === 1) {
          setIsFirstLogin(true);
          setLoading(false);
          return; 
        }

      } else {
        const loginRes = await request.post('/backend/login', { email: account, password });
        
        token = loginRes?.tokenValue || loginRes?.token || loginRes?.data?.token || loginRes;
        tokenName = loginRes?.tokenName || 'satoken';

        if (!token) throw new Error('登录失败：后端未返回授权令牌');

        localStorage.setItem('tokenName', tokenName);
        localStorage.setItem(tokenName, token);
        localStorage.setItem('token', token);
        localStorage.setItem('admin_token', token);

        const userInfoRes = await request.get('/backend/user/info');
        userInfo = userInfoRes?.data || userInfoRes;
      }

      setAuth(token, tokenName, userInfo, role);
      
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }

    } catch (error) {
      const msg = typeof error === 'string' ? error : (error?.response?.data?.msg || error?.msg || error?.message || '账号或密码错误，请重试');
      setErrorMsg(msg);
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setErrorMsg('两次输入的新密码不一致，请重新输入');
    }
    if (newPassword === password) {
      return setErrorMsg('新密码不能与原密码相同');
    }

    try {
      setUpdateLoading(true);
      setErrorMsg('');
      
      await request.put('/frontend/user/update-password', { 
        oldPassword: password, 
        newPassword: newPassword 
      });
      
      alert('密码修改成功！请使用新密码重新登录。');
      
      localStorage.clear();
      setIsFirstLogin(false);
      setPassword(''); 
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      const msg = typeof error === 'string' ? error : (error?.response?.data?.msg || error?.msg || '密码修改失败，请符合安全规则');
      setErrorMsg(msg);
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <div className="hidden lg:flex lg:w-1/2 bg-blue-700 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-90"></div>
        <div className="relative z-10 p-12 text-white max-w-lg animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-blue-700 text-3xl font-bold mb-8 shadow-lg">企</div>
          <h1 className="text-4xl font-bold mb-6 leading-tight">B2B 企培通<br/>数字化培训管理平台</h1>
          <p className="text-blue-100 text-lg leading-relaxed">支持千万级企业学时数据统计，智能化课件资源管理与 AI 辅助出卷系统，全方位提升企业培训效率。</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          
          {!isFirstLogin ? (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">欢迎登录</h2>
                <p className="text-slate-500">请选择您的身份并登录系统</p>
              </div>

              <div className="flex p-1 mb-8 space-x-1 bg-slate-100 rounded-lg">
                <button type="button" onClick={() => { setRole('student'); setAccount(''); setPassword(''); setErrorMsg(''); }} className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${role === 'student' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}>学员登录</button>
                <button type="button" onClick={() => { setRole('admin'); setAccount(''); setPassword(''); setErrorMsg(''); }} className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${role === 'admin' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}>管理员登录</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-in fade-in zoom-in-95"><span className="font-semibold">提示：</span>{errorMsg}</div>}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{role === 'admin' ? '管理员账号 (邮箱)' : '学员账号 (身份证号)'}</label>
                  <input type={role === 'admin' ? 'email' : 'text'} value={account} onChange={(e) => setAccount(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" placeholder={role === 'admin' ? "admin@example.com" : "请输入18位身份证号"} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} className={`w-full py-3 px-4 rounded-lg text-white font-bold transition-all active:scale-[0.98] ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}>
                  {loading ? '正在验证...' : (role === 'admin' ? '进入管理后台' : '进入学习大厅')}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-8 duration-300">
              <div className="mb-6 text-center lg:text-left">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100 mb-4"><span className="material-symbols-outlined text-amber-600 text-2xl">security_update_warning</span></div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">首次登录安全设置</h2>
                <p className="text-slate-500 text-sm">系统检测到您使用的是初始密码，为了账号安全，请先设置一个新密码。</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-in fade-in zoom-in-95">{errorMsg}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">设置新密码 <span className="text-red-500">*</span></label>
                  <input type="password" required autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" placeholder="8-16位,含字母/数字/特殊符号" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">确认新密码 <span className="text-red-500">*</span></label>
                  <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" placeholder="请再次输入新密码" />
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => { localStorage.clear(); setIsFirstLogin(false); setErrorMsg(''); }} className="w-1/3 py-3 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">取消</button>
                  <button type="submit" disabled={updateLoading} className={`w-2/3 py-3 rounded-lg text-white text-sm font-bold transition-all active:scale-[0.98] ${updateLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}>
                    {updateLoading ? '处理中...' : '确认并重新登录'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}