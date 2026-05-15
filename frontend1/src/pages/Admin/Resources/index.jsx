import React, { useState, useEffect, useRef } from 'react';
import { 
  getResourceCategoryTree, 
  createResourceCategory, 
  updateResourceCategory, 
  deleteResourceCategory,
  getResourceList, 
  deleteResource, 
  uploadResource,
  moveResource,
  renameResource
} from '../../../api/resource';
import FilePreviewModal from '../../../components/common/FilePreviewModal';
import { triggerDownload } from '../../../utils/filePreview';

export default function ResourceManagement() {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null); 

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [queryName, setQueryName] = useState('');
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  const [selectedResourceIds, setSelectedResourceIds] = useState([]);

  const [catModal, setCatModal] = useState({ isOpen: false, isEdit: false });
  const [catFormData, setCatFormData] = useState({ id: null, parentId: 0, name: '', sort: 0 });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ file: null, categoryId: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // 进度条相关状态
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0); 
  
  const fileInputRef = useRef(null);
  
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveData, setMoveData] = useState({ ids: [], targetCategoryId: 0, resourceName: '' });

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameData, setRenameData] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });

  const openPreview = (res) => {
    setPreviewModal({
      isOpen: true,
      file: { name: res?.name, url: res?.url, mimeType: res?.type },
    });
  };

  useEffect(() => { 
    fetchCategories(); 
  }, []);

  // ========== 文件类型格式化函数 ==========
  const formatFileType = (mimeType) => {
    if (!mimeType) return '未知';
    const type = mimeType.toLowerCase();
    
    if (type.includes('wordprocessingml.document') || type.includes('msword')) return 'Word文档';
    if (type.includes('spreadsheetml.sheet') || type.includes('excel') || type.includes('csv')) return 'Excel表格';
    if (type.includes('presentationml.presentation') || type.includes('powerpoint')) return 'PPT幻灯片';
    if (type.includes('pdf')) return 'PDF文档';
    if (type.includes('image/')) return '图片';
    if (type.includes('text/plain')) return 'TXT文本';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '压缩包';
    if (type.includes('video/') || type.includes('mp4') || type.includes('avi') || type.includes('mov')) return '视频';
    if (type.includes('audio/') || type.includes('mp3') || type.includes('wav')) return '音频';
    
    // 如果都不匹配，尝试返回文件扩展名
    const ext = type.split('/')[1] || type;
    return ext.toUpperCase() || '未知';
  };

  useEffect(() => {
    fetchResources(pagination.current, pagination.size, queryName, selectedCategoryId);
    setSelectedResourceIds([]);
  }, [pagination.current, pagination.size, queryName, selectedCategoryId]);

  const fetchCategories = async () => {
    try {
      const res = await getResourceCategoryTree();
      setCategories(res || []);
    } catch (error) { console.error('获取素材分类树失败', error); }
  };

  const fetchResources = async (current, size, name, categoryId) => {
    setLoading(true);
    try {
      const params = { current, size };
      if (name && name.trim() !== '') params.name = name.trim();
      if (categoryId !== null && categoryId !== undefined) {
        params.categoryId = categoryId; 
      }
      const res = await getResourceList(params);
      setResources(res.records || res.data || []);
      setPagination(p => ({ ...p, total: res.total || 0, current }));
    } catch (error) { 
      console.error('获取素材失败', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const flattenCategories = (nodes, level = 0) => {
    let result = [];
    if (!nodes || nodes.length === 0) return result;
    nodes.forEach(node => {
      result.push({ ...node, level });
      if (node.children && node.children.length > 0) result = result.concat(flattenCategories(node.children, level + 1));
    });
    return result;
  };
  const flatCategories = flattenCategories(categories);

  const getCategoryName = (categoryId) => {
    if (!categoryId || categoryId === 0) return '未分类 (根目录)';
    const category = flatCategories.find(c => c.id === categoryId);
    return category ? category.name : `分类ID: ${categoryId}`;
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catFormData.name.trim()) return alert('分类名称不能为空');
    if (catModal.isEdit && catFormData.id === parseInt(catFormData.parentId)) return alert('不能将自己设为父分类');

    setSubmitting(true);
    try {
      const payload = { ...catFormData, parentId: parseInt(catFormData.parentId, 10), sort: parseInt(catFormData.sort, 10) };
      catModal.isEdit ? await updateResourceCategory(payload) : await createResourceCategory(payload);
      alert(catModal.isEdit ? '分类更新成功' : '分类创建成功');
      setCatModal({ isOpen: false, isEdit: false });
      fetchCategories();
    } catch (error) { alert('保存分类失败'); } finally { setSubmitting(false); }
  };

  const handleDeleteCat = async (id, name, e) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除分类【${name}】吗？请确保其下没有素材。`)) {
      try {
        await deleteResourceCategory(id);
        alert('删除成功');
        if (selectedCategoryId === id) setSelectedCategoryId(null);
        fetchCategories();
      } catch (error) {
        const errorMsg = error?.msg || error?.message || String(error);
        alert('删除失败！\n\n可能原因：该分类下还有素材或子分类\n\n详细错误：' + errorMsg);
        console.error('删除分类错误:', error);
      }
    }
  };

  const handleSearch = () => {
    setPagination(p => ({ ...p, current: 1 }));
    setQueryName(searchName);
  };

  // ==========================================
  // 🌟 核心：处理文件上传与精准 ID 提取
  // ==========================================
  const handleConfirmUpload = async () => {
    if (!uploadData.file) return alert('请先选择文件！');

    setUploading(true);
    setUploadPercent(0); 
    
    try {
      // 1. 发起带进度条的上传请求
      const res = await uploadResource(uploadData.file, (percent) => {
        setUploadPercent(percent); 
      });
      
      // 2. 判断用户是否在弹窗里选了“所属分类”
      const targetCatId = parseInt(uploadData.categoryId, 10);
      if (targetCatId !== 0) {
        // 🌟 重点匹配你的接口：从 { code: 200, data: { id: 8 } } 中精准挖出 id
        let newResId = null;
        if (res && res.data && res.data.id) {
           newResId = res.data.id;  // 对应原始 axios 返回格式
        } else if (res && res.id) {
           newResId = res.id;       // 对应某些被拦截器剥离了 data 的格式
        }

        // 如果挖到了 ID，就静默调用 move 接口帮用户移动到对应分类
        if (newResId) {
          await moveResource({ ids: [newResId], targetCategoryId: targetCatId });
        }
      }

      alert('🎉 素材上传成功！');
      setUploadModalOpen(false);
      setUploadData({ file: null, categoryId: 0 });
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      
      // 刷新列表（自动回到第一页，看刚传的文件）
      fetchResources(1, pagination.size, queryName, selectedCategoryId);
      setPagination(p => ({...p, current: 1}));

    } catch (error) {
      // 根据错误类型提供更详细的提示
      const errorMessage = error.message || error.msg || String(error);
      let hint = '';
      
      if (errorMessage.includes('413') || errorMessage.includes('文件大小') || errorMessage.includes('size')) {
        hint = '\n\n可能原因：文件超过了服务器允许的大小限制（通常为1MB）';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        hint = '\n\n可能原因：没有上传权限或Token已过期';
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        hint = '\n\n可能原因：上传接口不存在，请检查后端路由配置';
      } else if (errorMessage.includes('网络断开') || errorMessage.includes('Network')) {
        hint = '\n\n可能原因：网络连接不稳定，请检查网络';
      }
      
      alert('文件上传失败！' + hint + '\n\n详细错误：' + errorMessage);
      console.error('上传错误信息:', error);
    } finally {
      setUploading(false);
      setUploadPercent(0); 
    }
  };

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await moveResource({
        ids: moveData.ids,
        targetCategoryId: parseInt(moveData.targetCategoryId, 10)
      });
      alert('✅ 素材批量移动成功！');
      setMoveModalOpen(false);
      setSelectedResourceIds([]); 
      fetchResources(pagination.current, pagination.size, queryName, selectedCategoryId);
    } catch (error) {
      alert('移动失败：' + (error.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameData?.name?.trim()) return alert('素材名称不能为空！');
    
    setSubmitting(true);
    try {
      await renameResource(renameData);
      alert('✅ 重命名成功！');
      setRenameModalOpen(false);
      fetchResources(pagination.current, pagination.size, queryName, selectedCategoryId);
    } catch (error) {
      alert('重命名失败：' + (error.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async (id, name) => {
    if (window.confirm(`确定要彻底删除素材【${name}】吗？如果该素材被课程引用，可能会导致课程无法播放！`)) {
      try {
        await deleteResource(id);
        alert('删除成功');
        fetchResources(pagination.current, pagination.size, queryName, selectedCategoryId);
      } catch (error) {
        const errorMsg = error?.msg || error?.message || String(error);
        alert('删除失败！\n\n错误信息：' + errorMsg);
        console.error('删除资源错误:', error);
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedResourceIds(resources.map(r => r.id));
    } else {
      setSelectedResourceIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedResourceIds(prev => [...prev, id]);
    } else {
      setSelectedResourceIds(prev => prev.filter(item => item !== id));
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type, url) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('image') || t.includes('png') || t.includes('jpg')) {
      return url ? <img src={url} alt="thumb" className="w-10 h-10 object-cover rounded shadow-sm" /> : <span className="material-symbols-outlined text-emerald-500 text-3xl">image</span>;
    }
    if (t.includes('video') || t.includes('mp4')) return <span className="material-symbols-outlined text-blue-500 text-3xl">movie</span>;
    if (t.includes('pdf')) return <span className="material-symbols-outlined text-red-500 text-3xl">picture_as_pdf</span>;
    if (t.includes('doc') || t.includes('word')) return <span className="material-symbols-outlined text-blue-600 text-3xl">description</span>;
    return <span className="material-symbols-outlined text-slate-400 text-3xl">insert_drive_file</span>;
  };

  const renderCategoryNode = (node) => {
    const isSelected = selectedCategoryId === node.id;
    return (
      <div key={node.id} className="w-full">
        <div 
          onClick={() => { 
            setSelectedCategoryId(node.id === selectedCategoryId ? null : node.id); 
            setPagination(p => ({...p, current: 1})); 
          }} 
          className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
        >
          <span className="material-symbols-outlined text-[18px] opacity-70">{node.children?.length > 0 ? 'folder' : 'folder_open'}</span>
          <span className="text-sm truncate flex-1">{node.name}</span>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); setCatFormData({ id: node.id, parentId: node.parentId || 0, name: node.name, sort: node.sort || 0 }); setCatModal({ isOpen: true, isEdit: true }); }} className="text-slate-400 hover:text-blue-600 p-0.5"><span className="material-symbols-outlined text-[16px]">edit</span></button>
            <button onClick={(e) => handleDeleteCat(node.id, node.name, e)} className="text-slate-400 hover:text-red-500 p-0.5"><span className="material-symbols-outlined text-[16px]">delete</span></button>
          </div>
        </div>
        {node.children?.length > 0 && <div className="pl-6 mt-1 border-l border-slate-100 ml-3">{node.children.map(renderCategoryNode)}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-8rem)]">
      
      {/* 左侧：分类树 */}
      <div className="w-full md:w-64 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-blue-500">folder_copy</span>素材分类</h3>
          <button onClick={() => { setCatFormData({ id: null, parentId: 0, name: '', sort: 0 }); setCatModal({ isOpen: true, isEdit: false }); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors" title="添加顶级分类">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div 
            onClick={() => { setSelectedCategoryId(null); setPagination(p => ({...p, current: 1})); }} 
            className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors mb-2 ${selectedCategoryId === null ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
          >
            <span className="material-symbols-outlined text-[18px]">apps</span><span className="text-sm">全部分类</span>
          </div>
          <div className="space-y-1">
            {categories.length > 0 ? categories.map(renderCategoryNode) : <p className="text-sm text-slate-400 text-center py-4">暂无分类数据</p>}
          </div>
        </div>
      </div>

      {/* 右侧：素材资源列表 */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center gap-4">
          <div className="flex gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="搜索素材名称..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" />
            </div>
            <button onClick={handleSearch} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">查询</button>
          </div>
          
          <div className="flex gap-3">
            {selectedResourceIds.length > 0 && (
              <button 
                onClick={() => {
                  setMoveData({ ids: selectedResourceIds, targetCategoryId: selectedCategoryId || 0, resourceName: `已选中 ${selectedResourceIds.length} 个素材` }); 
                  setMoveModalOpen(true); 
                }} 
                className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors animate-in fade-in zoom-in-95"
              >
                <span className="material-symbols-outlined text-[18px]">drive_file_move</span> 批量移动 ({selectedResourceIds.length})
              </button>
            )}
            
            <button 
              onClick={() => {
                if(uploading) return;
                setUploadData({ file: null, categoryId: selectedCategoryId || 0 });
                setUploadModalOpen(true);
              }} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span> 上传新素材
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-left w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    checked={resources.length > 0 && selectedResourceIds.length === resources.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">素材预览 & 名称</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">所属分类</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">文件格式 / 大小</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">上传时间</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">加载素材中...</td></tr> : resources.length === 0 ? <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">当前分类下暂无素材文件</td></tr> : resources.map((res) => (
                  <tr key={res.id} className={`hover:bg-slate-50 transition-colors ${selectedResourceIds.includes(res.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4 w-12">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        checked={selectedResourceIds.includes(res.id)}
                        onChange={(e) => handleSelectOne(e, res.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex-shrink-0 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                          {getFileIcon(res.type, res.url)}
                        </div>
                        <div>
                          <div
                            className="text-sm font-bold text-slate-900 mb-1 line-clamp-1 max-w-[200px] hover:text-blue-600 cursor-pointer"
                            title={res.name}
                            onClick={() => openPreview(res)}
                          >
                            {res.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">link</span> 
                            <a href={res.url} target="_blank" rel="noreferrer" className="hover:underline">查看源文件</a>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-slate-100 px-2.5 py-1 rounded text-xs text-slate-600 font-medium">
                        {getCategoryName(res.categoryId)}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-1">
                         <span className="text-xs font-semibold uppercase text-slate-700">{formatFileType(res.type)}</span>
                         <span className="text-xs text-slate-500">{formatBytes(res.size)}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {res.createdAt ? new Date(res.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      
                      <button
                        onClick={() => openPreview(res)}
                        className="text-emerald-600 hover:text-emerald-800 mr-4 transition-colors font-bold"
                      >
                        预览
                      </button>

                      <button
                        onClick={() => triggerDownload({ name: res.name, url: res.url })}
                        className="text-slate-600 hover:text-slate-900 mr-4 transition-colors font-bold"
                      >
                        下载
                      </button>

                      <button 
                        onClick={() => { 
                          setRenameData({ ...res }); 
                          setRenameModalOpen(true); 
                        }} 
                        className="text-blue-600 hover:text-blue-900 mr-4 transition-colors font-bold"
                      >
                        重命名
                      </button>

                      <button onClick={() => handleDeleteResource(res.id, res.name)} className="text-slate-500 hover:text-red-600 transition-colors">删除</button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {!loading && pagination.total > 0 && (
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
             <span className="text-sm text-slate-500">共 {pagination.total} 个素材</span>
             <div className="flex gap-2">
               <button onClick={() => fetchResources(Math.max(1, pagination.current - 1), pagination.size, queryName, selectedCategoryId)} disabled={pagination.current === 1} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm disabled:opacity-50">上一页</button>
               <span className="px-3 py-1 text-sm text-slate-600 flex items-center">{pagination.current} / {maxPage}</span>
               <button onClick={() => fetchResources(Math.min(maxPage, pagination.current + 1), pagination.size, queryName, selectedCategoryId)} disabled={pagination.current >= maxPage} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm disabled:opacity-50">下一页</button>
             </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 重命名素材弹窗 */}
      {/* ============================================================== */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="material-symbols-outlined text-blue-500">edit_note</span>
                重命名素材
              </h3>
              <button onClick={() => setRenameModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="p-6 space-y-4">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">新名称 <span className="text-red-500">*</span></label>
                <input 
                  autoFocus
                  required
                  type="text"
                  value={renameData?.name || ''} 
                  onChange={e => setRenameData({...renameData, name: e.target.value})} 
                  placeholder="请输入新名称，建议保留扩展名"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setRenameModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm">
                  {submitting ? '保存中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 批量移动素材弹窗 */}
      {/* ============================================================== */}
      {moveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="material-symbols-outlined text-blue-500">drive_file_move</span>
                移动素材
              </h3>
              <button onClick={() => setMoveModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
                <span className="text-slate-500">正在移动：</span>
                <span className="font-bold text-blue-700 truncate block mt-1" title={moveData.resourceName}>{moveData.resourceName}</span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">移动到目标分类 <span className="text-red-500">*</span></label>
                <select 
                  value={moveData.targetCategoryId} 
                  onChange={e => setMoveData({...moveData, targetCategoryId: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 cursor-pointer"
                >
                  <option value={0}>根目录 (未分类)</option>
                  {flatCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {'　'.repeat(cat.level)} {cat.level > 0 ? '├ ' : ''} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setMoveModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm">
                  {submitting ? '保存中...' : '确认移动'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 🌟 核心升级：带真实进度条的上传弹窗 */}
      {/* ============================================================== */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                </div>
                上传素材资源
              </h3>
              <button 
                // 上传中禁止强行关闭弹窗
                onClick={() => { if(!uploading) { setUploadModalOpen(false); setUploadData({ file: null, categoryId: 0 }); } }} 
                className={`p-1.5 rounded-lg transition-colors ${uploading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 space-y-6 relative">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">所属分类 (选填)</label>
                <select 
                  value={uploadData.categoryId} 
                  onChange={e => setUploadData({...uploadData, categoryId: e.target.value})} 
                  disabled={uploading}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value={0}>(可选) 不选则默认放至根目录</option>
                  {flatCategories.map(cat => <option key={cat.id} value={cat.id}>{'　'.repeat(cat.level)} {cat.level > 0 ? '├ ' : ''} {cat.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1">上传文件 <span className="text-red-500">*</span></label>
                <input type="file" ref={fileInputRef} className="hidden" disabled={uploading} onChange={e => { if(e.target.files[0]) setUploadData({...uploadData, file: e.target.files[0]}) }} />
                
                <div 
                  onDragOver={e => { if(!uploading) { e.preventDefault(); setIsDragging(true); } }}
                  onDragLeave={() => { if(!uploading) setIsDragging(false); }}
                  onDrop={e => { if(!uploading) { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) setUploadData({...uploadData, file: e.dataTransfer.files[0]}); } }}
                  onClick={() => !uploadData.file && !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${uploadData.file ? 'border-blue-300 bg-blue-50/50' : isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-blue-400 bg-slate-50 cursor-pointer'} ${uploading ? 'opacity-80 pointer-events-none' : ''}`}
                >
                  {uploadData.file ? (
                    <div className="flex flex-col items-center animate-in fade-in duration-300 w-full">
                      <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600"><span className="material-symbols-outlined text-4xl">description</span></div>
                      <p className="text-slate-800 font-bold truncate w-full max-w-[280px]" title={uploadData.file.name}>{uploadData.file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-500 text-sm">{formatFileType(uploadData.file.type)}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 text-sm">{formatBytes(uploadData.file.size)}</span>
                      </div>
                      
                      {/* 🌟 上传过程中的精美进度条 */}
                      {uploading ? (
                        <div className="w-full max-w-[280px] mt-6">
                          <div className="flex justify-between text-xs font-bold text-blue-600 mb-1">
                            <span>正在上传文件...</span>
                            <span>{uploadPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadPercent}%` }}></div>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setUploadData({...uploadData, file: null}); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="mt-6 px-4 py-2 bg-white border border-slate-200 text-red-500 text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-xl transition-colors flex items-center gap-1 shadow-sm"><span className="material-symbols-outlined text-[16px]">delete</span> 重新选择</button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4"><span className="material-symbols-outlined text-4xl text-blue-500">cloud_upload</span></div>
                      <p className="text-slate-700 font-bold text-base">点击 或 将文件拖拽到这里上传</p>
                      <p className="text-slate-400 text-xs mt-3 leading-relaxed">支持 视频、图片、文档 等常用格式<br/>请确保您的网络环境稳定</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                disabled={uploading} 
                onClick={() => { setUploadModalOpen(false); setUploadData({ file: null, categoryId: 0 }); }} 
                className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button 
                type="button" 
                onClick={handleConfirmUpload} 
                disabled={!uploadData.file || uploading} 
                className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center gap-2 shadow-md shadow-blue-600/20"
              >
                {uploading ? (
                  <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> 上传中 {uploadPercent}%</>
                ) : '确认上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分类管理弹窗 */}
      {catModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-blue-500">folder</span>{catModal.isEdit ? '编辑分类' : '创建素材分类'}</h3>
              <button onClick={() => setCatModal({ isOpen: false })} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">上级分类</label>
                <select value={catFormData.parentId} onChange={e => setCatFormData({...catFormData, parentId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                  <option value={0}>顶级分类 (无上级)</option>
                  {flatCategories.map(cat => <option key={cat.id} value={cat.id} disabled={catModal.isEdit && cat.id === catFormData.id}>{'　'.repeat(cat.level)} {cat.level > 0 ? '├ ' : ''} {cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">分类名称 <span className="text-red-500">*</span></label>
                <input required autoFocus type="text" value={catFormData.name} onChange={e => setCatFormData({...catFormData, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: 讲师视频、公共图标" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">排序 (越小越前)</label>
                <input type="number" value={catFormData.sort} onChange={e => setCatFormData({...catFormData, sort: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setCatModal({ isOpen: false })} className="px-5 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FilePreviewModal
        isOpen={previewModal.isOpen}
        file={previewModal.file}
        onClose={() => setPreviewModal({ isOpen: false, file: null })}
      />
    </div>
  );
}
