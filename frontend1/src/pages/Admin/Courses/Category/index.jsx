import React, { useState, useEffect } from 'react';
import { 
  getCourseCategoryTree, 
  createCourseCategory, 
  updateCourseCategory, 
  deleteCourseCategory 
} from '../../../../api/course';

export default function CourseCategory() {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initialFormData = { id: null, parentId: 0, name: '', sort: 0 };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchCategoryTree();
  }, []);

  const fetchCategoryTree = async () => {
    setLoading(true);
    try {
      const res = await getCourseCategoryTree();
      setTreeData(res || []);
    } catch (error) {
      console.error('获取课程分类树失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 把树状结构拍平，用于在普通表格里带层级缩进渲染
  const flattenTree = (nodes, level = 0) => {
    let result = [];
    if (!nodes || nodes.length === 0) return result;
    
    nodes.forEach(node => {
      result.push({ ...node, level });
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenTree(node.children, level + 1));
      }
    });
    return result;
  };

  const flatCategories = flattenTree(treeData);

  // === 交互操作 ===
  const handleAddClick = (parentId = 0) => {
    setIsEdit(false);
    setFormData({ ...initialFormData, parentId });
    setIsModalOpen(true);
  };

  const handleEditClick = (category) => {
    setIsEdit(true);
    setFormData({
      id: category.id,
      parentId: category.parentId || 0,
      name: category.name,
      sort: category.sort || 0
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm('确定要删除该分类吗？如果该分类下有子分类或关联了课程，可能无法删除！')) {
      try {
        await deleteCourseCategory(id);
        alert('删除成功！');
        fetchCategoryTree(); 
      } catch (error) {
        alert('删除失败，请确保该分类下没有关联的子分类或课程数据');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('分类名称不能为空');
      return;
    }
    if (isEdit && formData.id === parseInt(formData.parentId)) {
      alert('不能将上级分类设置为自己！');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        parentId: parseInt(formData.parentId),
        name: formData.name,
        sort: parseInt(formData.sort || 0)
      };

      if (isEdit) {
        payload.id = formData.id;
        await updateCourseCategory(payload);
        alert('分类修改成功！');
      } else {
        await createCourseCategory(payload);
        alert('新增分类成功！');
      }
      
      setIsModalOpen(false);
      fetchCategoryTree(); 
    } catch (error) {
      alert('保存失败，请检查网络');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* 头部区 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">category</span>
            课程分类管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">建立课程的层级目录，方便学员在选课大厅进行筛选。</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => handleAddClick(0)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_box</span> 
            新增顶级分类
          </button>
        </div>
      </div>

      {/* 树状表格展示区 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">分类名称</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">排序优先级</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-900 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">正在获取分类树...</td></tr>
              ) : flatCategories.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">暂无分类数据</td></tr>
              ) : (
                flatCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div 
                        className="flex items-center text-sm font-medium text-slate-900 dark:text-white"
                        style={{ paddingLeft: `${category.level * 24}px` }} 
                      >
                        {category.children && category.children.length > 0 ? (
                          <span className="material-symbols-outlined text-blue-400 mr-2 text-[18px]">folder_open</span>
                        ) : (
                          <span className="material-symbols-outlined text-slate-300 mr-2 text-[18px]">subdirectory_arrow_right</span>
                        )}
                        {category.name}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {category.sort || 0}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">
                      {category.createdAt ? new Date(category.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAddClick(category.id)}
                        className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 mr-3 transition-colors"
                      >
                        新增下级
                      </button>
                      <button 
                        onClick={() => handleEditClick(category)}
                        className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-3 transition-colors"
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(category.id)}
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

      {/* 弹窗：新增/编辑分类 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">category</span>
                {isEdit ? '编辑分类' : '新增课程分类'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">上级分类</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value={0}>作为顶级分类 (无上级)</option>
                  {flatCategories.map(cat => (
                    <option 
                      key={cat.id} 
                      value={cat.id}
                      disabled={isEdit && cat.id === formData.id}
                    >
                      {'　'.repeat(cat.level)} {cat.level > 0 ? '├ ' : ''} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">分类名称 <span className="text-red-500">*</span></label>
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="例如: 编程开发、安全生产" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">显示排序</label>
                <input 
                  type="number" 
                  value={formData.sort} 
                  onChange={(e) => setFormData({ ...formData, sort: e.target.value })} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800 dark:border-slate-700" 
                  placeholder="数字越小越靠前，默认0" 
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