import React, { useState, useEffect } from 'react';
import { 
  getDepartmentTree, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment 
} from '../../../api/department';

export default function DepartmentManagement() {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);

  // === 弹窗状态 ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单初始状态 (parentId 默认为 0，代表顶级部门)
  const initialFormData = { id: null, parentId: 0, name: '', sort: 0 };
  const [formData, setFormData] = useState(initialFormData);

  // 初始化加载
  useEffect(() => {
    fetchDepartmentTree();
  }, []);

  const fetchDepartmentTree = async () => {
    setLoading(true);
    try {
      const res = await getDepartmentTree();
      setTreeData(res || []);
    } catch (error) {
      console.error('获取部门树失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 核心功能：把树状结构拍平，方便在普通表格里带层级渲染
  // ==========================================
  const flattenTree = (nodes, level = 0) => {
    let result = [];
    if (!nodes || nodes.length === 0) return result;
    
    nodes.forEach(node => {
      // 把当前节点推入数组，并记录它的层级(level)
      result.push({ ...node, level });
      // 如果有子节点，递归处理，层级 +1
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenTree(node.children, level + 1));
      }
    });
    return result;
  };

  // 渲染用的扁平化部门列表
  const flatDepartments = flattenTree(treeData);

  // ==========================================
  // 操作交互逻辑
  // ==========================================
  const handleAddClick = (parentId = 0) => {
    setIsEdit(false);
    // 如果点击的是某一行表格里的“新增子部门”，就直接把 parentId 设为该行的 id
    setFormData({ ...initialFormData, parentId });
    setIsModalOpen(true);
  };

  const handleEditClick = (dept) => {
    setIsEdit(true);
    setFormData({
      id: dept.id,
      parentId: dept.parentId || 0,
      name: dept.name,
      sort: dept.sort || 0
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm('确定要删除该部门吗？如果该部门下有子部门或员工，可能会导致删除失败！')) {
      try {
        await deleteDepartment(id);
        alert('删除成功！');
        fetchDepartmentTree(); // 刷新树
      } catch (error) {
        console.error('删除部门失败:', error);
        alert('删除失败，请检查是否有关联数据限制');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('部门名称不能为空');
      return;
    }

    // 防止把自己的上级设为自己（死循环）
    if (isEdit && formData.id === parseInt(formData.parentId)) {
      alert('不能将上级部门设置为自己！');
      return;
    }

    setSubmitting(true);
    try {
      // 组装发给后端的 payload
      const payload = {
        parentId: parseInt(formData.parentId),
        name: formData.name,
        sort: parseInt(formData.sort)
      };

      if (isEdit) {
        payload.id = formData.id;
        await updateDepartment(payload);
        alert('修改成功！');
      } else {
        await createDepartment(payload);
        alert('新增成功！');
      }
      
      setIsModalOpen(false);
      fetchDepartmentTree(); // 刷新页面数据
    } catch (error) {
      console.error('保存部门失败:', error);
      alert('保存失败，请检查网络或联系管理员');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* 头部区 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">组织架构管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理企业的部门层级与组织架构树。</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => handleAddClick(0)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">domain_add</span> 
            新增顶级部门
          </button>
        </div>
      </div>

      {/* 树状表格展示区 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">部门名称</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">排序</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">正在获取组织架构...</td></tr>
              ) : flatDepartments.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">暂无部门数据</td></tr>
              ) : (
                flatDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    {/* 第一列：通过层级动态计算左侧缩进，画出树状视觉效果 */}
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div 
                        className="flex items-center text-sm font-medium text-slate-900 dark:text-white"
                        style={{ paddingLeft: `${dept.level * 24}px` }} 
                      >
                        {/* 如果有子节点，显示文件夹图标；如果没有，显示细小分支图标 */}
                        {dept.children && dept.children.length > 0 ? (
                          <span className="material-symbols-outlined text-slate-400 mr-2 text-[18px]">folder_open</span>
                        ) : (
                          <span className="material-symbols-outlined text-slate-300 mr-2 text-[18px]">subdirectory_arrow_right</span>
                        )}
                        {dept.name}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs dark:bg-slate-800 dark:text-slate-400">
                        {dept.sort || 0}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                      {dept.createdAt ? new Date(dept.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* 快捷操作：直接在这个部门下新增子部门 */}
                      <button 
                        onClick={() => handleAddClick(dept.id)}
                        className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 mr-3 transition-colors"
                        title="新增子部门"
                      >
                        新增下级
                      </button>
                      <button 
                        onClick={() => handleEditClick(dept)}
                        className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-3 transition-colors"
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(dept.id)}
                        className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 弹窗：新增/编辑部门 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">account_tree</span>
                {isEdit ? '编辑部门' : '新增部门'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">上级部门</label>
                {/* 🌟 这里的下拉框也能完美展示树状缩进 */}
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value={0}>顶级部门 (无上级)</option>
                  {flatDepartments.map(dept => (
                    <option 
                      key={dept.id} 
                      value={dept.id}
                      // 如果是正在编辑的部门，不能把自己选为自己的父级
                      disabled={isEdit && dept.id === formData.id}
                    >
                      {/* 用全角空格模拟出漂亮的下拉层级缩进 */}
                      {'　'.repeat(dept.level)} {dept.level > 0 ? '├ ' : ''} {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">部门名称 <span className="text-red-500">*</span></label>
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="例如: 研发中心" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">显示排序</label>
                <input 
                  type="number" 
                  value={formData.sort} 
                  onChange={(e) => setFormData({ ...formData, sort: e.target.value })} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="数字越小越靠前" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-6 pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors dark:bg-slate-800 dark:text-slate-300">取消</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
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