import React, { useState, useEffect, useRef } from 'react';
import { 
  getUserList, 
  createUser, 
  updateUser, 
  deleteUser,
  importUsers,
  batchDeleteUsers,
  getDepartmentTree 
} from '../../../api/user'; // 🌟 引入刚刚写好的学员专属 API
import { cleanupInvalidDepartments } from '../../../api/department';

export default function Organization() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());

  // 搜索与分页
  const [searchName, setSearchName] = useState('');
  const [queryName, setQueryName] = useState('');
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  // 弹窗表单
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false); 
  const [submitting, setSubmitting] = useState(false);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  // 🌟 严格对齐 JSON 的学员结构（包含扩展字段和单一部门ID）
  const initialFormData = {
    id: null,
    name: '',
    account: '',
    password: '123456',
    jobNo: '',
    deptName: '',
    office: '',
    jobRole: '',
    departmentId: '' 
  };
  const [formData, setFormData] = useState(initialFormData);

  // 初始化拉取
  useEffect(() => {
    fetchUsers(pagination.current, pagination.size, queryName);
  }, [pagination.current, pagination.size, queryName]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  // 🌟 对应 GET /backend/user/list
  const fetchUsers = async (current, size, name) => {
    setLoading(true);
    try {
      const params = { current, size };
      if (name && name.trim() !== '') params.name = name.trim();
      
      const res = await getUserList(params);
      setUsers(res.records || []);
      setPagination(prev => ({ ...prev, total: res.total || 0, current }));
    } catch (error) {
      console.error('获取学员列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 对应 GET /department/tree
  const fetchDepartments = async () => {
    try {
      const res = await getDepartmentTree();
      setDepartments(res || []);
    } catch (error) { console.error('获取部门树失败:', error); }
  };

  const flattenDepartments = (nodes, level = 0) => {
    let result = [];
    if (!nodes || nodes.length === 0) return result;
    nodes.forEach(node => {
      result.push({ ...node, level });
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenDepartments(node.children, level + 1));
      }
    });
    return result;
  };
  const flatDepartments = flattenDepartments(departments);

  const normalizeOrgName = (value) => {
    const v = (value ?? '').toString().trim();
    if (!v || v === '/') return '';
    return v;
  };

  const buildDeptMaps = (nodes) => {
    const idMap = new Map();
    const walk = (arr) => {
      if (!arr) return;
      arr.forEach((n) => {
        if (!n || n.id == null) return;
        idMap.set(Number(n.id), { id: Number(n.id), parentId: Number(n.parentId || 0), name: n.name || '' });
        if (n.children && n.children.length > 0) walk(n.children);
      });
    };
    walk(nodes);
    return { idMap };
  };

  const { idMap: deptIdMap } = buildDeptMaps(departments);

  const getDeptChain = (deptId) => {
    const names = [];
    let cur = deptId ? deptIdMap.get(Number(deptId)) : null;
    let guard = 0;
    while (cur && guard < 20) {
      const name = normalizeOrgName(cur.name);
      if (name) names.unshift(name);
      if (!cur.parentId) break;
      cur = deptIdMap.get(Number(cur.parentId)) || null;
      guard += 1;
    }
    return names;
  };

  const getOrgFieldsByDepartmentId = (departmentId) => {
    const chain = getDeptChain(departmentId).filter(Boolean);
    if (chain.length === 0) {
      return { deptName: '', office: '' };
    }
    if (chain.length === 1) {
      return { deptName: chain[0], office: '' };
    }
    if (chain.length === 2) {
      return { deptName: chain.join('-'), office: '' };
    }
    return {
      deptName: chain.slice(0, 2).join('-'),
      office: chain[2] || ''
    };
  };

  const getUserOrgDisplay = (user) => {
    const chain = user?.departmentId ? getDeptChain(user.departmentId) : [];
    const dept1 = chain[0] || '';
    const dept2 = chain[1] || '';
    const deptDisplay = [dept1, dept2].filter(Boolean).join('-') || normalizeOrgName(user?.deptName);
    const officeFromChain = chain.length >= 3 ? chain[2] : '';
    const officeDisplay = officeFromChain || normalizeOrgName(user?.office);
    return { deptDisplay, officeDisplay };
  };

  const getDepartmentOptionLabel = (dept) => {
    if (!dept) return '(未分配部门)';
    return `${'  '.repeat(dept.level || 0)}${dept.level > 0 ? '├ ' : ''}${dept.name}`;
  };

  const selectedDepartment = flatDepartments.find((dept) => String(dept.id) === String(formData.departmentId));

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    setQueryName(searchName);
  };

  const handleAddClick = () => {
    setIsEdit(false);
    setFormData(initialFormData);
    setDeptDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleImportClick = () => {
    setImportFile(null);
    setImportResult(null);
    setImportModalOpen(true);
  };

  const handleEditClick = (user) => {
    setIsEdit(true);
    const syncOrgFields = user.departmentId ? getOrgFieldsByDepartmentId(user.departmentId) : null;
    setFormData({
      id: user.id,
      name: user.name || '',
      account: user.account || '',
      jobNo: user.jobNo || '',
      deptName: syncOrgFields?.deptName || user.deptName || '',
      office: syncOrgFields?.office || user.office || '',
      jobRole: user.jobRole || '',
      password: '', // 编辑时密码留空，后端判断为空则不修改
      departmentId: user.departmentId || '' 
    });
    setDeptDropdownOpen(false);
    setIsModalOpen(true);
  };

  // 对应 DELETE /backend/user/delete/{id}
  const handleDeleteClick = async (id, name) => {
    if (window.confirm(`确定要彻底删除学员【${name}】吗？`)) {
      try {
        await deleteUser(id);
        alert('删除成功！');
        setSelectedUserIds(prev => {
          const next = new Set(prev);
          next.delete(Number(id));
          return next;
        });
        fetchUsers(pagination.current, pagination.size, queryName);
      } catch (error) {
        alert('删除失败，请稍后重试');
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      if (name === 'departmentId') {
        const synced = getOrgFieldsByDepartmentId(value);
        return {
          ...prev,
          departmentId: value,
          deptName: synced.deptName,
          office: synced.office
        };
      }
      return { ...prev, [name]: value };
    });
  };

  useEffect(() => {
    if (!deptDropdownOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target)) {
        setDeptDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [deptDropdownOpen]);

  // 🌟 核心：对应 PUT /backend/user/update 和 POST /backend/user/create
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 严格格式化数据，防止后端反序列化报错
      const payload = { 
        ...formData,
        departmentId: formData.departmentId ? parseInt(formData.departmentId, 10) : 0
      };
      
      // 编辑时如果密码没填，就删掉该字段不传
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      
      if (isEdit) {
        await updateUser(payload);
        alert('学员信息更新成功！');
      } else {
        await createUser(payload);
        alert('新增学员成功！');
      }
      
      setIsModalOpen(false); 
      // 🌟 修改或新增完成后，立刻调用列表接口刷新页面数据
      fetchUsers(pagination.current, pagination.size, queryName); 
    } catch (error) {
      alert('保存失败，请检查网络或数据格式');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert('请先选择 Excel 文件');
      return;
    }
    setImporting(true);
    try {
      const res = await importUsers(importFile);
      setImportResult(res);
      const summary = [
        `总行数 ${res?.total ?? 0}`,
        `新增 ${res?.inserted ?? 0}`,
        `更新 ${res?.updated ?? 0}`,
        `新建部门 ${res?.departmentsCreated ?? 0}`,
        `绑定部门 ${res?.departmentLinked ?? 0}`,
        `新增岗位角色 ${res?.jobRolesCreated ?? 0}`
      ].join('，');
      alert(`导入完成：${summary}`);
      setImportModalOpen(false);
      fetchUsers(pagination.current, pagination.size, queryName);
      fetchDepartments();
    } catch (error) {
      alert(error?.message || '导入失败，请检查文件格式或网络');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectUser = (id) => {
    const uid = Number(id);
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleSelectAllUsersOnPage = () => {
    const pageIds = (users || []).map(u => Number(u.id)).filter(Boolean);
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      const allSelected = pageIds.length > 0 && pageIds.every(id => next.has(id));
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBatchDeleteUsers = async () => {
    const ids = Array.from(selectedUserIds);
    if (!ids.length) return;
    if (!window.confirm(`确定要批量删除已选中的 ${ids.length} 位学员吗？此操作不可恢复。`)) return;
    try {
      const res = await batchDeleteUsers(ids);
      alert(`批量删除完成：已删除 ${res?.deleted ?? 0} / ${res?.requested ?? ids.length}`);
      setSelectedUserIds(new Set());
      fetchUsers(pagination.current, pagination.size, queryName);
    } catch (error) {
      alert(error?.message || '批量删除失败，请稍后重试');
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部与搜索 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">group</span>
            前台学员管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">管理企业培训平台的所有学员信息与组织架构归属。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索学员姓名..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 w-64"
            />
          </div>
          <button onClick={handleSearch} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 border">查询</button>
          <button
            onClick={async () => {
              if (!window.confirm('确定要刷新全部学员的部门绑定吗？将自动把绑定在“/”等无效节点上的学员，上提绑定到上级部门。')) return;
              try {
                const res = await cleanupInvalidDepartments();
                const summary = [
                  `无效节点 ${res?.invalid ?? 0} 个`,
                  `上提子部门 ${res?.childrenMoved ?? 0} 个`,
                  `上提学员关联 ${res?.userRelationsMoved ?? 0} 条`,
                  `删除学员关联 ${res?.userRelationsDeleted ?? 0} 条`,
                  `删除节点 ${res?.deleted ?? 0} 个`
                ].join('，');
                alert(`刷新完成：${summary}`);
                fetchDepartments();
                fetchUsers(pagination.current, pagination.size, queryName);
              } catch (error) {
                alert(error?.message || '刷新失败，请稍后重试');
              }
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">sync</span> 刷新部门
          </button>
          {selectedUserIds.size > 0 && (
            <button
              onClick={handleBatchDeleteUsers}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">delete</span> 批量删除 ({selectedUserIds.size})
            </button>
          )}
          <button onClick={handleImportClick} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-sm">upload_file</span> 批量导入
          </button>
          <button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-sm">add</span> 添加学员
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={(users || []).length > 0 && (users || []).every(u => selectedUserIds.has(Number(u.id)))}
                    onChange={toggleSelectAllUsersOnPage}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">学员信息</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">工号</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">所属部门</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">科室</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">岗位角色</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
              {loading ? <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">正在获取数据...</td></tr> : users.length === 0 ? <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">暂无数据</td></tr> : users.map((user) => (
                  (() => {
                    const { deptDisplay, officeDisplay } = getUserOrgDisplay(user);
                    return (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(Number(user.id))}
                        onChange={() => toggleSelectUser(user.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-10 w-10 rounded-full object-cover bg-slate-100 border border-slate-200 dark:border-slate-700" src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.account}`} alt="" />
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name || '未命名'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{user.account}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{user.jobNo || '-'}</span>
                    </td>
                    
                    <td className="px-6 py-4">
                      {deptDisplay ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {deptDisplay}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">未填写部门</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{officeDisplay || '-'}</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                        {user.jobRole || '未填写岗位角色'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900 mr-4 transition-colors">编辑</button>
                      <button onClick={() => handleDeleteClick(user.id, user.name)} className="text-slate-500 hover:text-red-600 transition-colors">删除</button>
                    </td>
                  </tr>
                    );
                  })()
                ))
              }
            </tbody>
          </table>
        </div>
        
        {/* 分页 */}
        {!loading && pagination.total > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">共 {pagination.total} 位学员</span>
            <div className="flex gap-2">
               <button onClick={() => fetchUsers(Math.max(1, pagination.current - 1), pagination.size, queryName)} disabled={pagination.current === 1} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 dark:text-slate-300">上一页</button>
               <span className="px-3 py-1 text-sm text-slate-600 flex items-center dark:text-slate-400">{pagination.current} / {maxPage}</span>
               <button onClick={() => fetchUsers(Math.min(maxPage, pagination.current + 1), pagination.size, queryName)} disabled={pagination.current >= maxPage} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 dark:text-slate-300">下一页</button>
            </div>
          </div>
        )}
      </div>

      {/* 弹窗：编辑/新增学员 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">person_add</span>
                {isEdit ? '编辑学员信息' : '添加新学员'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* 所属部门 */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">组织部门</label>
                    <div className="relative" ref={deptDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setDeptDropdownOpen((prev) => !prev)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white flex items-center justify-between text-left"
                      >
                        <span className="truncate">{selectedDepartment ? getDepartmentOptionLabel(selectedDepartment) : '(未分配部门)'}</span>
                        <span className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
                      </button>
                      {deptDropdownOpen && (
                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => {
                              handleFormChange({ target: { name: 'departmentId', value: '' } });
                              setDeptDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            (未分配部门)
                          </button>
                          {flatDepartments.map((dept) => (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => {
                                handleFormChange({ target: { name: 'departmentId', value: String(dept.id) } });
                                setDeptDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${String(formData.departmentId) === String(dept.id) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : ''}`}
                            >
                              {getDepartmentOptionLabel(dept)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">姓名 <span className="text-red-500">*</span></label>
                    <input required name="name" value={formData.name || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入姓名" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">登录账号 <span className="text-red-500">*</span></label>
                    <input required name="account" value={formData.account || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入登录账号" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      登录密码 <span className="text-red-500">{!isEdit && '*'}</span> 
                      {isEdit
                        ? <span className="text-xs text-slate-400 font-normal ml-1">(不修改请留空)</span>
                        : <span className="text-xs text-slate-400 font-normal ml-1">(默认 123456)</span>}
                    </label>
                    <input required={!isEdit} name="password" value={formData.password || ''} onChange={handleFormChange} type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder={isEdit ? '••••••••' : '默认密码 123456'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">工号</label>
                    <input name="jobNo" value={formData.jobNo || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入工号 (选填)" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">所属部门</label>
                    <input name="deptName" value={formData.deptName || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入所属部门 (选填)" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">科室</label>
                    <input name="office" value={formData.office || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入科室 (选填)" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">岗位角色</label>
                    <input name="jobRole" value={formData.jobRole || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="例如: 前端开发工程师, 产品经理 (选填)" />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50">
                  {submitting ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">upload_file</span>
                批量导入学员
              </h3>
              <button disabled={importing} onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
            </div>

            <form onSubmit={handleImportSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                  <div className="font-bold mb-1">支持列名</div>
                  <div className="leading-relaxed">
                    姓名、工号、部门、部门2、科室、职位（或 岗位角色）。未提供登录账号时会自动用工号作为登录账号；部门会按“部门→部门2→科室”自动建树并绑定。
                  </div>
                  <div className="mt-1 leading-relaxed">
                    新导入学员默认登录密码统一为 123456，首次登录仍需修改密码。
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">选择 Excel 文件</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
                        setImportFile(file);
                        setImportResult(null);
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
                    />
                  </div>
                  {importFile && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      已选择：{importFile.name}
                    </div>
                  )}
                </div>

                {importResult && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300">
                    <div>总行数：{importResult.total}</div>
                    <div>新增：{importResult.inserted}，更新：{importResult.updated}</div>
                    <div>新建部门：{importResult.departmentsCreated}，绑定部门：{importResult.departmentLinked}</div>
                    <div>新增岗位角色：{importResult.jobRolesCreated}</div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <button type="button" disabled={importing} onClick={() => setImportModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 disabled:opacity-50">取消</button>
                <button type="submit" disabled={importing || !importFile} className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50">
                  {importing ? '导入中...' : '开始导入'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
