import React, { useState, useEffect } from 'react';
import { 
  getUserList, 
  createUser, 
  updateUser, 
  deleteUser,
  getDepartmentTree 
} from '../../../api/user'; // 🌟 引入刚刚写好的学员专属 API

export default function Organization() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  // 搜索与分页
  const [searchName, setSearchName] = useState('');
  const [queryName, setQueryName] = useState('');
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  // 弹窗表单
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false); 
  const [submitting, setSubmitting] = useState(false);
  
  // 🌟 严格对齐 JSON 的学员结构（包含扩展字段和单一部门ID）
  const initialFormData = {
    id: null,
    name: '',
    email: '',
    password: '',
    idCard: '',
    enterprise: '',
    industry: '',
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

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    setQueryName(searchName);
  };

  const handleAddClick = () => {
    setIsEdit(false);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleEditClick = (user) => {
    setIsEdit(true);
    setFormData({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      idCard: user.idCard || '',
      enterprise: user.enterprise || '',
      industry: user.industry || '',
      jobRole: user.jobRole || '',
      password: '', // 编辑时密码留空，后端判断为空则不修改
      departmentId: user.departmentId || '' 
    });
    setIsModalOpen(true);
  };

  // 对应 DELETE /backend/user/delete/{id}
  const handleDeleteClick = async (id, name) => {
    if (window.confirm(`确定要彻底删除学员【${name}】吗？`)) {
      try {
        await deleteUser(id);
        alert('删除成功！');
        fetchUsers(pagination.current, pagination.size, queryName);
      } catch (error) {
        alert('删除失败，请稍后重试');
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">学员信息</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">所属部门</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">企业 / 行业</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">岗位</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
              {loading ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">正在获取数据...</td></tr> : users.length === 0 ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">暂无数据</td></tr> : users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-10 w-10 rounded-full object-cover bg-slate-100 border border-slate-200 dark:border-slate-700" src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="" />
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name || '未命名'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {user.department ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {user.department.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">未分配部门</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.enterprise || '-'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{user.industry || '未填写行业'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                        {user.jobRole || '未填写岗位'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900 mr-4 transition-colors">编辑</button>
                      <button onClick={() => handleDeleteClick(user.id, user.name)} className="text-slate-500 hover:text-red-600 transition-colors">删除</button>
                    </td>
                  </tr>
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
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">所属部门</label>
                    <select name="departmentId" value={formData.departmentId} onChange={handleFormChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                      <option value="">(未分配部门)</option>
                      {flatDepartments.map(dept => (
                        <option key={dept.id} value={dept.id}>{'　'.repeat(dept.level)} {dept.level > 0 ? '├ ' : ''} {dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">姓名 <span className="text-red-500">*</span></label>
                    <input required name="name" value={formData.name || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="请输入姓名" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">登录邮箱 <span className="text-red-500">*</span></label>
                    <input required name="email" value={formData.email || ''} onChange={handleFormChange} type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="student@example.com" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      登录密码 <span className="text-red-500">{!isEdit && '*'}</span> 
                      {isEdit && <span className="text-xs text-slate-400 font-normal ml-1">(不修改请留空)</span>}
                    </label>
                    <input required={!isEdit} name="password" value={formData.password || ''} onChange={handleFormChange} type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="••••••••" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">身份证号</label>
                    <input name="idCard" value={formData.idCard || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="18位身份证号 (选填)" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">所属企业</label>
                    <input name="enterprise" value={formData.enterprise || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="企业名称 (选填)" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">行业</label>
                    <input name="industry" value={formData.industry || ''} onChange={handleFormChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" placeholder="例如: 互联网, 制造 (选填)" />
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
    </div>
  );
}