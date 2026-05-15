import React, { useState, useEffect } from 'react';
import { 
  getAdminUserList, 
  createAdminUser, 
  updateAdminUser, 
  deleteAdminUser,
  getAdminRoleList 
} from '../../../api/system';
import { getAdminUserInfo } from '../../../api/admin';
import useAuthStore from '../../../store/useAuthStore';

export default function AdminUserManagement() {
  const { userInfo, updateUserInfo } = useAuthStore();
  const [adminUsers, setAdminUsers] = useState([]);
  const [roles, setRoles] = useState([]); 
  const [loading, setLoading] = useState(false);

  // === 分页与搜索状态 ===
  const [searchName, setSearchName] = useState('');
  const [queryName, setQueryName] = useState('');
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  // === 弹窗状态 ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 🌟 严格对齐你提供的 JSON 结构
  const initialFormData = { 
    id: null, 
    name: '', 
    email: '', 
    password: '', 
    isSuper: 0, 
    roleIds: [] 
  };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchAdminUsers(pagination.current, pagination.size, queryName);
  }, [pagination.current, pagination.size, queryName]);

  // 页面加载时拉取角色列表
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchAdminUsers = async (current, size, name) => {
    setLoading(true);
    try {
      const params = { current, size };
      if (name && name.trim() !== '') params.name = name.trim();
      
      const res = await getAdminUserList(params);
      setAdminUsers(res.records || []);
      setPagination(prev => ({ ...prev, total: res.total || 0, current: res.current || current }));
    } catch (error) {
      console.error('获取管理员失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await getAdminRoleList({ current: 1, size: 100 });
      setRoles(res.records || []);
    } catch (error) {
      console.error('获取角色列表失败', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    setQueryName(searchName);
  };

  // === 增删改交互 ===
  const handleAddClick = () => {
    setIsEdit(false);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleEditClick = (user) => {
    setIsEdit(true);
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '', // 编辑时密码留空
      isSuper: user.isSuper || 0,
      roleIds: user.roleIds || [] // 确保回显角色数组
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id, name) => {
    if (window.confirm(`确定要删除管理员【${name}】吗？此操作不可恢复！`)) {
      try {
        await deleteAdminUser(id);
        alert('删除成功');
        fetchAdminUsers(pagination.current, pagination.size, queryName);
      } catch (error) {
        alert('删除失败，可能没有权限或网络异常');
      }
    }
  };

  // 处理角色复选框点击
  const handleRoleToggle = (roleId) => {
    setFormData(prev => {
      const isSelected = prev.roleIds.includes(roleId);
      return {
        ...prev,
        roleIds: isSelected 
          ? prev.roleIds.filter(id => id !== roleId) 
          : [...prev.roleIds, roleId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert('请填写姓名和登录邮箱！'); return;
    }
    
    setSubmitting(true);
    try {
      // 🌟 核心：强制转换数据类型，完美匹配你的后端 JSON
      const payload = { 
        ...formData, 
        isSuper: parseInt(formData.isSuper, 10),
        roleIds: formData.roleIds.map(id => parseInt(id, 10)) // 确保每个 roleId 都是整数
      };
      
      // 编辑时如果没填密码，则移除 password 字段，防止密码被清空
      if (isEdit && !payload.password) {
        delete payload.password;
      }

      if (isEdit) {
        await updateAdminUser(payload);
        const isCurrentAdmin =
          payload.id === userInfo?.id || payload.email === userInfo?.email;
        if (isCurrentAdmin) {
          const latestUserInfo = await getAdminUserInfo();
          updateUserInfo(latestUserInfo?.data || latestUserInfo);
        }
        alert('管理员信息更新成功！');
      } else {
        await createAdminUser(payload);
        alert('新管理员创建成功！');
      }
      setIsModalOpen(false);
      fetchAdminUsers(pagination.current, pagination.size, queryName);
    } catch (error) {
      alert('保存失败，请检查填写格式');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部与搜索 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">manage_accounts</span>
            系统管理员管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">管理可登录企业后台的运营人员，并为其分配角色权限。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索管理员姓名..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 w-64"
            />
          </div>
          <button onClick={handleSearch} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">查询</button>
          <button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span> 添加管理员
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">管理员信息</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">账号/邮箱</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">角色身份</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
              {loading ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">正在加载数据...</td></tr> : adminUsers.length === 0 ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">暂无管理员数据</td></tr> : adminUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold dark:bg-blue-900/50 dark:text-blue-400">
                          {user.name?.charAt(0) || 'A'}
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isSuper === 1 ? (
                        <span className="px-2.5 py-1 inline-flex text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                          👑 超级管理员
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 inline-flex text-xs font-medium rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {user.roleIds?.length > 0 ? `已分配 ${user.roleIds.length} 个角色` : '暂无角色'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900 mr-4">编辑</button>
                      {/* 如果是超级管理员，建议不要让用户在界面上轻易删除 */}
                      {user.isSuper !== 1 && (
                        <button onClick={() => handleDeleteClick(user.id, user.name)} className="text-slate-500 hover:text-red-600">删除</button>
                      )}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 底部分页 */}
        {!loading && pagination.total > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
             <span className="text-sm text-slate-500">共 {pagination.total} 条记录</span>
             <div className="flex gap-2">
               <button onClick={() => setPagination(p => ({...p, current: Math.max(1, p.current - 1)}))} disabled={pagination.current === 1} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">上一页</button>
               <span className="px-3 py-1 text-sm text-slate-600">{pagination.current} / {maxPage}</span>
               <button onClick={() => setPagination(p => ({...p, current: Math.min(maxPage, p.current + 1)}))} disabled={pagination.current >= maxPage} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">下一页</button>
             </div>
          </div>
        )}
      </div>

      {/* ================================== */}
      {/* 弹窗：创建/编辑 管理员 */}
      {/* ================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">shield_person</span>
                {isEdit ? '编辑管理员信息' : '创建后台管理员'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">管理员姓名 <span className="text-red-500">*</span></label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="例如: 张三" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">登录邮箱/账号 <span className="text-red-500">*</span></label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="admin@company.com" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      登录密码 <span className="text-red-500">{!isEdit && '*'}</span>
                      {isEdit && <span className="text-xs text-slate-400 font-normal ml-1">(不修改请留空)</span>}
                    </label>
                    <input required={!isEdit} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="••••••••" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">系统身份</label>
                    <select value={formData.isSuper} onChange={e => setFormData({...formData, isSuper: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 font-medium">
                      <option value={0}>普通管理员 (需分配角色)</option>
                      <option value={1}>👑 超级管理员 (拥有一切权限)</option>
                    </select>
                  </div>
                </div>

                {/* 🌟 角色分配区：仅在选择“普通管理员”时出现 */}
                {parseInt(formData.isSuper) === 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-medium block">为该管理员分配角色 <span className="text-slate-400 font-normal text-xs">(可多选)</span></label>
                    <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-h-48 overflow-y-auto flex flex-wrap gap-3">
                      {roles.length === 0 ? (
                        <p className="text-sm text-slate-400 w-full text-center">暂无角色数据，请先前往角色管理中创建</p>
                      ) : (
                        roles.map(role => (
                          <label key={role.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${formData.roleIds.includes(role.id) ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                            <input 
                              type="checkbox" 
                              checked={formData.roleIds.includes(role.id)} 
                              onChange={() => handleRoleToggle(role.id)} 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer h-4 w-4"
                            />
                            <span className="text-sm font-medium">{role.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50">
                  {submitting ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
