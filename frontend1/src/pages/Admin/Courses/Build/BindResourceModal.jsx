import React, { useState, useEffect } from 'react';
import { getResourceList, getResourceCategoryTree } from '../../../../api/resource'; 

export default function BindResourceModal({ 
  isOpen, 
  onClose, 
  onSuccess // 选中素材后的回调函数
}) {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  
  const [pagination, setPagination] = useState({ current: 1, size: 8, total: 0 });
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [selectedResourceName, setSelectedResourceName] = useState('');

  // 弹窗打开时，初始化树形分类和素材列表
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchResources(1, '', null);
      setSelectedResourceId(null); 
      setSelectedResourceName('');
      setSearchName('');
    }
  }, [isOpen]);

  // 点击左侧分类时，刷新右侧列表
  useEffect(() => {
    if (isOpen) fetchResources(1, searchName, selectedCategoryId);
  }, [selectedCategoryId]);

  const fetchCategories = async () => {
    try {
      const res = await getResourceCategoryTree();
      setCategories(res || []);
    } catch (error) { console.error('获取素材分类失败', error); }
  };

  const fetchResources = async (current = 1, name = '', catId = null) => {
    setLoading(true);
    try {
      const params = { current, size: pagination.size };
      if (name) params.name = name;
      if (catId !== null) params.categoryId = catId;

      const res = await getResourceList(params);
      setResources(res.records || res.data || []);
      setPagination(p => ({ ...p, current, total: res.total || 0 }));
    } catch (error) {
      console.error('获取素材失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchResources(1, searchName, selectedCategoryId);

  // 🌟 核心：纯粹的 UI 交互，将选中的 ID 和名字传回给父组件的表单
  const handleConfirm = () => {
    if (!selectedResourceId) return alert('请先在右侧列表中选择一个素材！');
    onSuccess(selectedResourceId, selectedResourceName); 
    onClose();   
  };

  const renderCategories = (nodes, level = 0) => {
    if (!nodes) return null;
    return nodes.map(node => (
      <div key={node.id}>
        <div 
          onClick={() => setSelectedCategoryId(node.id === selectedCategoryId ? null : node.id)}
          className={`py-2 px-3 text-sm cursor-pointer rounded-lg flex items-center gap-1.5 transition-colors ${selectedCategoryId === node.id ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          <span className="material-symbols-outlined text-[16px]">{node.children?.length > 0 ? 'folder' : 'description'}</span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.children && node.children.length > 0 && renderCategories(node.children, level + 1)}
      </div>
    ));
  };

  const getFileIcon = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('video') || t.includes('mp4')) return <span className="material-symbols-outlined text-blue-500">movie</span>;
    if (t.includes('pdf')) return <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>;
    return <span className="material-symbols-outlined text-slate-400">insert_drive_file</span>;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <span className="material-symbols-outlined text-blue-600">travel_explore</span>
            从素材中心选择
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex h-[60vh] overflow-hidden bg-slate-50/50">
          
          {/* 左侧：分类树 */}
          <div className="w-64 bg-white border-r border-slate-100 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-100 font-bold text-sm text-slate-700 flex items-center gap-1.5 bg-slate-50">
              <span className="material-symbols-outlined text-[18px]">category</span> 素材分类
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <div 
                onClick={() => setSelectedCategoryId(null)}
                className={`py-2 px-3 text-sm cursor-pointer rounded-lg flex items-center gap-1.5 transition-colors ${selectedCategoryId === null ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="material-symbols-outlined text-[16px]">apps</span> 全部分类
              </div>
              {renderCategories(categories)}
            </div>
          </div>

          {/* 右侧：素材列表 */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex gap-2 shrink-0 mb-4">
              <input 
                type="text" value={searchName} onChange={e => setSearchName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索当前分类下的素材..." 
                className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button onClick={handleSearch} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">查询</button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl relative bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left w-12 text-xs font-bold text-slate-500">选择</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">素材名称</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">类型</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="3" className="text-center py-16 text-slate-400"><span className="material-symbols-outlined animate-spin text-3xl">sync</span></td></tr>
                  ) : resources.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-16 text-slate-400">该分类下暂无素材</td></tr>
                  ) : (
                    resources.map(res => (
                      <tr 
                        key={res.id} 
                        onClick={() => { setSelectedResourceId(res.id); setSelectedResourceName(res.name); }}
                        className={`cursor-pointer transition-colors ${selectedResourceId === res.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-3">
                          <input type="radio" checked={selectedResourceId === res.id} readOnly className="w-4 h-4 text-blue-600" />
                        </td>
                        <td className="px-4 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center shrink-0">
                            {getFileIcon(res.type)}
                          </div>
                          <span className="text-sm font-medium text-slate-800 line-clamp-1">{res.name}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 uppercase">{res.type || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {!loading && pagination.total > 0 && (
              <div className="flex justify-between items-center text-xs text-slate-500 mt-3 shrink-0">
                <span>共 {pagination.total} 个素材</span>
                <div className="flex gap-2">
                  <button onClick={() => fetchResources(Math.max(1, pagination.current - 1), searchName, selectedCategoryId)} disabled={pagination.current === 1} className="px-3 py-1 bg-slate-200 rounded disabled:opacity-50 hover:bg-slate-300">上一页</button>
                  <button onClick={() => fetchResources(pagination.current + 1, searchName, selectedCategoryId)} disabled={pagination.current * pagination.size >= pagination.total} className="px-3 py-1 bg-slate-200 rounded disabled:opacity-50 hover:bg-slate-300">下一页</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {selectedResourceId ? <>已选素材: <strong className="text-blue-600">{selectedResourceName}</strong></> : '请在上方选择要绑定的素材'}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
            <button 
              onClick={handleConfirm} disabled={!selectedResourceId} 
              className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all shadow-sm"
            >
              确认选中
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}