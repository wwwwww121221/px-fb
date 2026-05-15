import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAdminUserList, createAdminUser, updateAdminUser, deleteAdminUser,
  getAdminRoleList, createAdminRole, updateAdminRole, deleteAdminRole,
  getAdminMenuTree, getRoleMenus, assignRoleMenus 
} from '../../../api/system';
import { getAdminUserInfo } from '../../../api/admin';
import useAuthStore from '../../../store/useAuthStore';

export default function SystemManagement() {
  const { userInfo, updateUserInfo } = useAuthStore();
  const [activeTab, setActiveTab] = useState('users'); 

  // ==========================================
  // 模块 1：管理员账号管理状态
  // ==========================================
  const [adminUsers, setAdminUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userPagination, setUserPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxUserPage = Math.max(1, Math.ceil(userPagination.total / userPagination.size));
  
  const [userModal, setUserModal] = useState({ isOpen: false, isEdit: false });
  const [userFormData, setUserFormData] = useState({ id: null, name: '', email: '', password: '', isSuper: 0, roleIds: [] });
  const [allRoles, setAllRoles] = useState([]);
  const roleNameMap = useMemo(() => {
    const map = {};
    (allRoles || []).forEach(r => {
      const id = Number(r?.id);
      if (!Number.isNaN(id) && id > 0) map[id] = r?.name;
    });
    return map;
  }, [allRoles]);

  // ==========================================
  // 模块 2：角色与权限管理状态
  // ==========================================
  const [roles, setRoles] = useState([]);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [rolePagination, setRolePagination] = useState({ current: 1, size: 10, total: 0 });
  const maxRolePage = Math.max(1, Math.ceil(rolePagination.total / rolePagination.size));

  const [roleModal, setRoleModal] = useState({ isOpen: false, isEdit: false });
  const [roleFormData, setRoleFormData] = useState({ id: null, name: '' });

  const [permModalOpen, setPermModalOpen] = useState(false);
  const [currentPermRole, setCurrentPermRole] = useState(null);
  const [menuTree, setMenuTree] = useState([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState([]);
  const [fetchingPerms, setFetchingPerms] = useState(false);
  const [savingData, setSavingData] = useState(false);

  // ==========================================
  // 初始化拉取数据
  // ==========================================
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAdminUsers(userPagination.current, userPagination.size, userSearch);
      fetchAllRolesForSelection();
    } else {
      fetchRoles(rolePagination.current, rolePagination.size, roleSearch);
    }
  }, [activeTab, userPagination.current, rolePagination.current]);

  // 🌟 这里就是调用 GET /admin-user/list 获取分页列表的函数
  const fetchAdminUsers = async (current, size, name) => {
    setUserLoading(true);
    try {
      const params = { current, size };
      if (name && name.trim() !== '') params.name = name.trim();
      const res = await getAdminUserList(params);
      setAdminUsers(res.records || []);
      setUserPagination(p => ({ ...p, total: res.total || 0, current }));
    } catch (e) { console.error('获取管理员失败', e); } finally { setUserLoading(false); }
  };

  const fetchAllRolesForSelection = async () => {
    try {
      const res = await getAdminRoleList({ current: 1, size: 100 });
      setAllRoles(res.records || []);
    } catch (e) { console.error('获取全部角色失败', e); }
  };

  const fetchRoles = async (current, size, name) => {
    setRoleLoading(true);
    try {
      const res = await getAdminRoleList({ current, size, name: name?.trim() || undefined });
      setRoles(res.records || []);
      setRolePagination(p => ({ ...p, total: res.total || 0, current }));
    } catch (e) { console.error('获取角色失败', e); } finally { setRoleLoading(false); }
  };

  // ==========================================
  // 管理员交互逻辑
  // ==========================================
  const handleUserSearch = () => { fetchAdminUsers(1, userPagination.size, userSearch); };
  
  // 🌟 核心：处理管理员的新增与修改
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setSavingData(true);
    try {
      // 1. 严格格式化 Payload，确保 isSuper 和 roleIds 数据类型完美匹配后端 JSON 要求
      const payload = { 
        ...userFormData, 
        isSuper: parseInt(userFormData.isSuper, 10), 
        roleIds: (userFormData.roleIds || []).map(id => parseInt(id, 10)) 
      };
      
      // 2. 如果是修改（isEdit）且没有填密码，则剔除 password 字段，防止密码被清空
      if (userModal.isEdit && !payload.password) {
        delete payload.password;
      }
      
      // 3. 核心调用：根据 isEdit 状态决定是 PUT 还是 POST
      if (userModal.isEdit) {
        await updateAdminUser(payload); // 对应 PUT /admin-user/update
        const isCurrentAdmin =
          payload.id === userInfo?.id || payload.email === userInfo?.email;
        if (isCurrentAdmin) {
          const latestUserInfo = await getAdminUserInfo();
          updateUserInfo(latestUserInfo?.data || latestUserInfo);
        }
        alert('账号更新成功');
      } else {
        await createAdminUser(payload); // 对应 POST /admin-user/create
        alert('账号创建成功');
      }
      
      // 4. 关闭弹窗
      setUserModal({ isOpen: false, isEdit: false });
      
      // 5. 🌟 最关键的一步：立刻重新调用 fetchAdminUsers 去拉取最新的分页列表，实现页面刷新！
      fetchAdminUsers(userPagination.current, userPagination.size, userSearch);
      
    } catch (error) { 
      console.error(error);
      alert('保存失败，请检查填写内容或网络'); 
    } finally { 
      setSavingData(false); 
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (window.confirm(`确定要删除管理员【${name}】吗？`)) {
      try {
        await deleteAdminUser(id);
        alert('删除成功');
        fetchAdminUsers(userPagination.current, userPagination.size, userSearch);
      } catch (e) { alert('删除失败'); }
    }
  };

  // ==========================================
  // 角色与权限交互逻辑
  // ==========================================
  const handleRoleSearch = () => { fetchRoles(1, rolePagination.size, roleSearch); };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setSavingData(true);
    try {
      roleModal.isEdit ? await updateAdminRole(roleFormData) : await createAdminRole(roleFormData);
      alert(roleModal.isEdit ? '角色更新成功' : '角色创建成功');
      setRoleModal({ isOpen: false, isEdit: false });
      fetchRoles(rolePagination.current, rolePagination.size, roleSearch);
    } catch (e) { alert('保存角色失败'); } finally { setSavingData(false); }
  };

  const handleDeleteRole = async (id, name) => {
    if (window.confirm(`确定要删除角色【${name}】吗？绑定该角色的管理员将失去对应权限！`)) {
      try {
        await deleteAdminRole(id);
        alert('删除成功');
        fetchRoles(rolePagination.current, rolePagination.size, roleSearch);
      } catch (e) { alert('删除失败'); }
    }
  };

  const openPermModal = async (role) => {
    setCurrentPermRole(role);
    setPermModalOpen(true);
    setFetchingPerms(true);
    try {
      const [treeRes, checkedKeysRes] = await Promise.all([
        menuTree.length === 0 ? getAdminMenuTree() : Promise.resolve(menuTree),
        getRoleMenus(role.id).catch(() => []) 
      ]);
      if (menuTree.length === 0) setMenuTree(treeRes || []);
      setSelectedMenuIds(checkedKeysRes || []); 
    } catch (e) {
      alert('获取权限数据失败');
    } finally {
      setFetchingPerms(false);
    }
  };

  const savePermissions = async () => {
    setSavingData(true);
    try {
      await assignRoleMenus(currentPermRole.id, selectedMenuIds);
      alert('权限分配成功！');
      setPermModalOpen(false);
      fetchRoles(rolePagination.current, rolePagination.size, roleSearch); 
    } catch (e) { alert('权限分配失败'); } finally { setSavingData(false); }
  };

  const renderTree = (nodes, level = 0) => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.map(node => (
      <div key={node.id} style={{ paddingLeft: `${level * 20}px` }} className="py-1.5">
        <label className="flex items-center gap-2 cursor-pointer w-fit group">
          <input 
            type="checkbox" 
            checked={selectedMenuIds.includes(node.id)} 
            onChange={() => setSelectedMenuIds(p => p.includes(node.id) ? p.filter(id => id !== node.id) : [...p, node.id])} 
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer h-4 w-4" 
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">{node.name}</span>
          {node.type === 2 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded dark:bg-slate-800">按钮</span>}
        </label>
        {node.children && node.children.length > 0 && <div className="mt-1 border-l border-slate-100 dark:border-slate-800 ml-2">{renderTree(node.children, level + 1)}</div>}
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      
      {/* 头部与选项卡 Tabs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">admin_panel_settings</span>
            系统权限与账号管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">统一管理后台管理员账号，并配置系统角色及菜单访问权限。</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white shadow-sm text-blue-600 dark:bg-slate-900' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            管理员账号
          </button>
          <button 
            onClick={() => setActiveTab('roles')} 
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'roles' ? 'bg-white shadow-sm text-blue-600 dark:bg-slate-900' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            角色与权限
          </button>
        </div>
      </div>

      {/* ================================== */}
      {/* 内容区 1：管理员管理 Tab */}
      {/* ================================== */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 animate-in fade-in duration-300">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUserSearch()} placeholder="搜索管理员姓名..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 w-64" />
              </div>
              <button onClick={handleUserSearch} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">查询</button>
            </div>
            <button onClick={() => { setUserFormData({ id: null, name: '', email: '', password: '', isSuper: 0, roleIds: [] }); setUserModal({ isOpen: true, isEdit: false }); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">add</span> 添加管理员账号
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">账号信息</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">角色身份</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">创建时间</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
                {userLoading ? <tr><td colSpan="4" className="text-center py-10 text-slate-500">加载中...</td></tr> : adminUsers.length === 0 ? <tr><td colSpan="4" className="text-center py-10 text-slate-500">暂无管理员数据</td></tr> : adminUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg dark:bg-blue-900/50 dark:text-blue-400">{user.name?.charAt(0)}</div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {user.isSuper === 1 ? (
                        <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">👑 超级管理员</span>
                      ) : (
                        (() => {
                          const roleIds = (user.roleIds || []).map(id => Number(id)).filter(id => !Number.isNaN(id) && id > 0);
                          const roleNames = roleIds.map(id => roleNameMap[id]).filter(Boolean);
                          const display = roleNames.length > 0 ? roleNames.slice(0, 3) : [];
                          const more = roleNames.length - display.length;
                          const title = roleNames.length > 0 ? roleNames.join('、') : '';
                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              {roleNames.length > 0 ? (
                                <>
                                  {display.map((n) => (
                                    <span key={n} title={title} className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                      {n}
                                    </span>
                                  ))}
                                  {more > 0 ? (
                                    <span title={title} className="px-2.5 py-1 rounded bg-slate-50 text-slate-500 text-xs font-bold border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                      +{more}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                  暂无角色
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-3 text-right text-sm font-medium">
                      
                      {/* 🌟 编辑按钮：在此处打开编辑弹窗，带上原始的完整信息 */}
                      <button 
                        onClick={() => { 
                          setUserFormData({ 
                            ...user, 
                            password: '', // 密码留空
                            roleIds: user.roleIds || [] // 安全兜底防空
                          }); 
                          setUserModal({ isOpen: true, isEdit: true }); 
                        }} 
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        编辑
                      </button>

                      {user.isSuper !== 1 && <button onClick={() => handleDeleteUser(user.id, user.name)} className="text-slate-500 hover:text-red-600">删除</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 管理员分页 */}
          {!userLoading && userPagination.total > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-sm text-slate-500">
              <span>共 {userPagination.total} 条账号</span>
              <div className="flex gap-2">
                <button onClick={() => fetchAdminUsers(Math.max(1, userPagination.current - 1), userPagination.size, userSearch)} disabled={userPagination.current === 1} className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">上一页</button>
                <span className="px-3 py-1 flex items-center">{userPagination.current} / {maxUserPage}</span>
                <button onClick={() => fetchAdminUsers(Math.min(maxUserPage, userPagination.current + 1), userPagination.size, userSearch)} disabled={userPagination.current >= maxUserPage} className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================== */}
      {/* 内容区 2：角色与权限 Tab */}
      {/* ================================== */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 animate-in fade-in duration-300">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input type="text" value={roleSearch} onChange={e => setRoleSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRoleSearch()} placeholder="搜索角色名称..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 w-64" />
              </div>
              <button onClick={handleRoleSearch} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">查询</button>
            </div>
            <button onClick={() => { setRoleFormData({ id: null, name: '' }); setRoleModal({ isOpen: true, isEdit: false }); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">add</span> 添加新角色
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">角色名称</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">权限状态</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">创建时间</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
                {roleLoading ? <tr><td colSpan="4" className="text-center py-10 text-slate-500">加载中...</td></tr> : roles.length === 0 ? <tr><td colSpan="4" className="text-center py-10 text-slate-500">暂无角色数据</td></tr> : roles.map(role => (
                  <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-300">badge</span> {role.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50">
                        {role.permissionCount || 0} 项权限
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{role.createdAt ? new Date(role.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openPermModal(role)} className="text-emerald-600 hover:text-emerald-900 mr-4 flex items-center gap-1 inline-flex">
                        <span className="material-symbols-outlined text-[16px]">verified_user</span> 分配权限
                      </button>
                      <button onClick={() => { setRoleFormData({ id: role.id, name: role.name }); setRoleModal({ isOpen: true, isEdit: true }); }} className="text-blue-600 hover:text-blue-900 mr-4">编辑</button>
                      <button onClick={() => handleDeleteRole(role.id, role.name)} className="text-slate-500 hover:text-red-600">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 角色分页 */}
          {!roleLoading && rolePagination.total > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-sm text-slate-500">
              <span>共 {rolePagination.total} 个角色</span>
              <div className="flex gap-2">
                <button onClick={() => fetchRoles(Math.max(1, rolePagination.current - 1), rolePagination.size, roleSearch)} disabled={rolePagination.current === 1} className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">上一页</button>
                <span className="px-3 py-1 flex items-center">{rolePagination.current} / {maxRolePage}</span>
                <button onClick={() => fetchRoles(Math.min(maxRolePage, rolePagination.current + 1), rolePagination.size, roleSearch)} disabled={rolePagination.current >= maxRolePage} className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================== */}
      {/* 弹窗 1：创建/编辑 管理员账号 */}
      {/* ================================== */}
      {userModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">manage_accounts</span>
                {userModal.isEdit ? '编辑管理员账号' : '创建管理员账号'}
              </h3>
              <button onClick={() => setUserModal({ isOpen: false })} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            {/* 🌟 这里的表单触发了 handleUserSubmit */}
            <form onSubmit={handleUserSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium dark:text-slate-200">姓名 <span className="text-red-500">*</span></label>
                    <input required type="text" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="姓名" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium dark:text-slate-200">登录账号 <span className="text-red-500">*</span></label>
                    <input required type="text" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="请输入登录账号" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium dark:text-slate-200">登录密码 {!userModal.isEdit && <span className="text-red-500">*</span>}</label>
                    <input required={!userModal.isEdit} type="password" value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder={userModal.isEdit ? "留空则不修改" : "设置初始密码"} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium dark:text-slate-200">权限配置</label>
                    <select value={userFormData.isSuper} onChange={e => setUserFormData({...userFormData, isSuper: parseInt(e.target.value, 10)})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700">
                      <option value={0}>普通管理员 (需分配角色)</option>
                      <option value={1}>👑 超级管理员</option>
                    </select>
                  </div>
                </div>

                {userFormData.isSuper === 0 && (
                  <div className="space-y-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-sm font-medium dark:text-slate-200 block">分配角色 <span className="text-slate-400 font-normal text-xs">(多选)</span></label>
                    <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-h-48 overflow-y-auto flex flex-wrap gap-3">
                      {allRoles.length === 0 ? <p className="text-sm text-slate-400 w-full text-center">暂无角色</p> : allRoles.map(role => (
                        <label key={role.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${userFormData.roleIds.includes(role.id) ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                          <input type="checkbox" checked={userFormData.roleIds.includes(role.id)} onChange={() => setUserFormData(p => ({ ...p, roleIds: p.roleIds.includes(role.id) ? p.roleIds.filter(id => id !== role.id) : [...p.roleIds, role.id] }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer h-4 w-4" />
                          <span className="text-sm font-medium">{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setUserModal({ isOpen: false })} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300">取消</button>
                <button type="submit" disabled={savingData} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50">
                  {savingData ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* 弹窗 2：创建/编辑 角色 */}
      {/* ================================== */}
      {roleModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">badge</span>
                {roleModal.isEdit ? '编辑角色' : '创建角色'}
              </h3>
              <button onClick={() => setRoleModal({ isOpen: false })} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <form onSubmit={handleRoleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium dark:text-slate-200">角色名称 <span className="text-red-500">*</span></label>
                <input required autoFocus type="text" value={roleFormData.name} onChange={e => setRoleFormData({...roleFormData, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="例如: 财务主管" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setRoleModal({ isOpen: false })} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300">取消</button>
                <button type="submit" disabled={savingData} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50">
                  确定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* 弹窗 3：为角色分配权限菜单树 */}
      {/* ================================== */}
      {permModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">verified_user</span>
                分配权限 - {currentPermRole?.name}
              </h3>
              <button onClick={() => setPermModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              {fetchingPerms ? (
                <div className="text-center py-10 text-slate-500 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span> 读取权限中...
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                  {menuTree.length > 0 ? renderTree(menuTree) : <div className="text-center text-slate-400 text-sm py-4">暂无系统菜单数据</div>}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-white dark:bg-slate-900">
              <button onClick={() => setPermModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300">取消</button>
              <button onClick={savePermissions} disabled={savingData || fetchingPerms} className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50">
                {savingData ? '保存中...' : '确认分配'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
