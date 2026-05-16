import React, { useState, useEffect } from 'react';
import BindResourceModal from './BindResourceModal';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getCourseDetail, 
  getCourseChapterList, 
  createCourseChapter, 
  updateCourseChapter, 
  deleteCourseChapter,
  createCourseHour,
  updateCourseHour,
  deleteCourseHour,
  getCourseHourList,
  getCourseHourDetail
} from '../../../../api/course';
import { getResourceList } from '../../../../api/resource'; 
import FilePreviewModal from '../../../../components/common/FilePreviewModal';
import { triggerDownload } from '../../../../utils/filePreview';

export default function CourseBuild() {
  const { id: courseId } = useParams(); 
  const navigate = useNavigate();

  const [courseDetail, setCourseDetail] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);

  const [resourceCache, setResourceCache] = useState({});
  const [allResourcesMap, setAllResourcesMap] = useState({});
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });

  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'chapter', 
    isEdit: false,
    data: {}
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [bindModalOpen, setBindModalOpen] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourseDetail();
      fetchChapters();
      fetchAllResourcesMap(); 
    }
  }, [courseId]);

  const fetchAllResourcesMap = async () => {
    try {
      const res = await getResourceList({ current: 1, size: 2000 });
      const list = res.records || res.data || [];
      const map = {};
      list.forEach(item => {
        map[Number(item.id)] = item;
      });
      setAllResourcesMap(map);
    } catch (e) {
      console.error('获取全局素材字典失败', e);
    }
  };

  const fetchCourseDetail = async () => {
    try {
      const res = await getCourseDetail(courseId);
      setCourseDetail(res || {});
    } catch (e) { console.error('获取课程详情失败'); }
  };

  const fetchChapters = async () => {
    setLoading(true);
    try {
      const chapterRes = await getCourseChapterList(courseId);
      const chaptersData = chapterRes || [];

      const chaptersWithHours = await Promise.all(
        chaptersData.map(async (chapter) => {
          try {
            const hoursRes = await getCourseHourList(chapter.id);
            return { ...chapter, hours: hoursRes || [] };
          } catch (err) {
            return { ...chapter, hours: [] };
          }
        })
      );
      setChapters(chaptersWithHours);
    } catch (e) { 
      console.error('获取大纲数据失败', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const getResourceNameDisplay = (hourData) => {
    if (!hourData || !hourData.resourceId) return '';
    const rId = Number(hourData.resourceId);
    
    if (resourceCache[rId]) return resourceCache[rId];
    if (allResourcesMap[rId]?.name) return allResourcesMap[rId].name;
    if (hourData.resourceName) return hourData.resourceName;
    return '已绑素材';
  };

  const getResourceById = (resourceId) => {
    const rId = Number(resourceId);
    if (!rId) return null;
    const fromAll = allResourcesMap[rId];
    if (fromAll) return fromAll;
    return null;
  };

  const openPreview = (resource) => {
    setPreviewModal({
      isOpen: true,
      file: { name: resource?.name, url: resource?.url, mimeType: resource?.type },
    });
  };

  const handleOpenChapterModal = (chapter = null) => {
    setModalState({
      isOpen: true,
      type: 'chapter',
      isEdit: !!chapter,
      data: chapter ? { ...chapter } : { courseId: parseInt(courseId), name: '', sort: chapters.length }
    });
  };

  const handleDeleteChapter = async (id, name) => {
    if (window.confirm(`确定要删除章节《${name}》吗？此操作不可恢复！`)) {
      try {
        await deleteCourseChapter(id);
        alert('章节删除成功');
        fetchChapters();
      } catch (e) { alert('删除失败'); }
    }
  };

  const handleOpenHourModal = async (chapterId, hour = null, currentHourCount = 0) => {
    if (hour) {
      try {
        const detailRes = await getCourseHourDetail(hour.id);
        const finalData = { ...hour, ...(detailRes || {}) };
        if (!finalData.resourceId && hour.resourceId) {
          finalData.resourceId = hour.resourceId;
        }
        
        setModalState({
          isOpen: true, type: 'hour', isEdit: true,
          data: finalData
        });
      } catch (e) {
        setModalState({ isOpen: true, type: 'hour', isEdit: true, data: { ...hour } });
      }
    } else {
      setModalState({
        isOpen: true, type: 'hour', isEdit: false,
        data: { chapterId, name: '', type: 0, resourceId: 0, duration: 0, sort: currentHourCount, content: '', liveUrl: null, playbackUrl: null }
      });
    }
  };

  const handleDeleteHour = async (id, name) => {
    if (window.confirm(`确定要删除课时《${name}》吗？`)) {
      try {
        await deleteCourseHour(id);
        alert('课时删除成功');
        fetchChapters();
      } catch (e) { alert('删除失败'); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { type, isEdit, data } = modalState;

    try {
      if (type === 'chapter') {
        const payload = { courseId: parseInt(courseId, 10), name: data.name, sort: parseInt(data.sort || 0, 10) };
        if (isEdit) payload.id = data.id;
        isEdit ? await updateCourseChapter(payload) : await createCourseChapter(payload);
        alert(isEdit ? '章节更新成功' : '章节创建成功');
      } else {
        // 🌟 根据后端要求：liveUrl 必须传真实地址，null 表示非直播
        const isLiveHour = data.type === 2;
        const payload = {
          chapterId: parseInt(data.chapterId, 10), 
          name: data.name || '', 
          type: parseInt(data.type || 0, 10),
          resourceId: parseInt(data.resourceId || 0, 10), 
          duration: parseInt(data.duration || 0, 10), 
          sort: parseInt(data.sort || 0, 10), 
          content: data.content || '', 
          // 🌟 直播课时必须传真实 liveUrl，非直播课时传 null
          liveUrl: isLiveHour ? (data.liveUrl || '') : null, 
          playbackUrl: isLiveHour ? (data.playbackUrl || null) : null
        };
        if (isEdit) payload.id = data.id;
        
        isEdit ? await updateCourseHour(payload) : await createCourseHour(payload);
        alert(isEdit ? '课时修改及素材保存成功' : '课时创建及素材绑定成功');
      }
      
      setModalState({ ...modalState, isOpen: false });
      fetchChapters(); 
    } catch (error) {
      alert('保存失败，请检查网络');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/courses')} className="p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              课程大纲排课 <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">ID: {courseId}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">当前正在为《<span className="font-semibold text-blue-600">{courseDetail?.name || '加载中...'}</span>》搭建内容大纲</p>
          </div>
        </div>
        <button onClick={() => handleOpenChapterModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add_box</span> 新增章节
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 dark:bg-slate-900 dark:border-slate-800 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-500 gap-2"><span className="material-symbols-outlined animate-spin">progress_activity</span> 获取大纲中...</div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
             <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">account_tree</span>
             <p className="text-slate-500">暂无任何章节内容，请点击右上角新增章节</p>
          </div>
        ) : (
          <div className="space-y-6">
            {chapters.map((chapter, cIndex) => (
              <div key={chapter.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                
                <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold">第 {cIndex + 1} 章</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{chapter.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleOpenHourModal(chapter.id, null, chapter.hours?.length || 0)} className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1 mr-4">
                      <span className="material-symbols-outlined text-[16px]">add_circle</span> 加课时
                    </button>
                    <button type="button" onClick={() => handleOpenChapterModal(chapter)} className="text-slate-500 hover:text-blue-600 p-1"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                    <button type="button" onClick={() => handleDeleteChapter(chapter.id, chapter.name)} className="text-slate-500 hover:text-red-500 p-1"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900">
                  {(!chapter.hours || chapter.hours.length === 0) ? (
                    <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded border border-dashed border-slate-200 dark:border-slate-700">该章节下暂无课时，请添加</div>
                  ) : (
                    <div className="space-y-2">
                      {chapter.hours.map((hour, hIndex) => (
                        <div key={hour.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-sm transition-all group bg-slate-50/50 dark:bg-slate-800/20">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-mono text-slate-400 w-6">{cIndex + 1}-{hIndex + 1}</span>
                            <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                              <span className="material-symbols-outlined text-[16px]">
                                {hour.type === 0 ? 'play_circle' : hour.type === 1 ? 'description' : 'sensors'}
                              </span>
                            </div>
                            <div className="flex flex-col max-w-[500px]">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="truncate">{hour.name}</span>
                                
                                {hour.resourceId ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[10px] font-bold flex items-center gap-1 max-w-[200px] shrink-0" title={getResourceNameDisplay(hour)}>
                                    <span className="material-symbols-outlined text-[12px]">attachment</span>
                                    <span className="truncate">{getResourceNameDisplay(hour)}</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                    <span className="material-symbols-outlined text-[12px]">warning</span> 未绑素材
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {hour.type === 0 ? '视频录播' : hour.type === 1 ? '图文文档' : '直播'} • 预计时长: {hour.duration || 0} 分钟
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {hour.type === 2 && (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/live/${hour.id}`)}
                                className="text-slate-400 hover:text-red-600 flex items-center gap-1 text-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">live_tv</span>
                                <span>开始直播</span>
                              </button>
                            )}
                            <button type="button" onClick={() => handleOpenHourModal(chapter.id, hour)} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            <button type="button" onClick={() => handleDeleteHour(hour.id, hour.name)} className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-xs"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">{modalState.type === 'chapter' ? 'folder' : 'play_circle'}</span>
                {modalState.isEdit ? '编辑' : '新增'} {modalState.type === 'chapter' ? '章节' : '课时'}
              </h3>
              <button type="button" onClick={() => setModalState({ ...modalState, isOpen: false })} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              <div className="space-y-1">
                <label className="text-sm font-medium">{modalState.type === 'chapter' ? '章节名称' : '课时名称'} <span className="text-red-500">*</span></label>
                <input required autoFocus type="text" value={modalState.data.name || ''} onChange={(e) => setModalState({...modalState, data: {...modalState.data, name: e.target.value}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="请输入名称" />
              </div>

              {modalState.type === 'hour' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">课时类型</label>
                      <select value={modalState.data.type || 0} onChange={(e) => setModalState({...modalState, data: {...modalState.data, type: parseInt(e.target.value, 10)}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700">
                        <option value={0}>视频录播</option>
                        <option value={1}>图文/文档</option>
                        <option value={2}>在线直播</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">时长 (分钟)</label>
                      <input type="number" min="0" value={modalState.data.duration || 0} onChange={(e) => setModalState({...modalState, data: {...modalState.data, duration: parseInt(e.target.value, 10)}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" />
                    </div>
                  </div>
                  
                  {modalState.data.type === 0 && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">视频回放链接 (playbackUrl)</label>
                      <input type="text" value={modalState.data.playbackUrl || ''} onChange={(e) => setModalState({...modalState, data: {...modalState.data, playbackUrl: e.target.value}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="例如: http://..." />
                    </div>
                  )}

                  {modalState.data.type === 1 && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">图文内容 (content)</label>
                      <textarea rows="3" value={modalState.data.content || ''} onChange={(e) => setModalState({...modalState, data: {...modalState.data, content: e.target.value}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="请输入正文或文档链接..." />
                    </div>
                  )}

                  {modalState.data.type === 2 && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">推流/直播链接 (liveUrl)</label>
                      <input type="text" value={modalState.data.liveUrl || ''} onChange={(e) => setModalState({...modalState, data: {...modalState.data, liveUrl: e.target.value}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" placeholder="例如: rtmp://..." />
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">绑定核心素材资源</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 min-w-0 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2 overflow-hidden">
                           <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0">attachment</span>
                           <span className={`truncate ${modalState.data.resourceId ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                             {modalState.data.resourceId 
                               ? getResourceNameDisplay(modalState.data) 
                               : '暂未分配任何素材'}
                           </span>
                         </div>
                         
                         {modalState.data.resourceId ? (
                           <button 
                             type="button" 
                             onClick={() => setModalState(prev => ({...prev, data: {...prev.data, resourceId: 0, resourceName: ''}}))}
                             className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors shrink-0 flex items-center"
                             title="移除素材"
                           >
                             <span className="material-symbols-outlined text-[16px]">close</span>
                           </button>
                         ) : null}
                      </div>

                      <button 
                        type="button" 
                        onClick={() => setBindModalOpen(true)}
                        className="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors shrink-0 flex items-center gap-1 dark:bg-blue-900/50 dark:text-blue-400"
                      >
                        <span className="material-symbols-outlined text-[16px]">category</span>
                        去素材库选择
                      </button>
                    </div>

                    {modalState.data.resourceId ? (
                      (() => {
                        const bound = getResourceById(modalState.data.resourceId);
                        if (!bound?.url) return null;
                        return (
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => openPreview(bound)}
                              className="px-3 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              预览
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerDownload({ name: bound.name, url: bound.url })}
                              className="px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">download</span>
                              下载
                            </button>
                          </div>
                        );
                      })()
                    ) : null}
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">显示排序 (数字越小越靠前)</label>
                <input type="number" value={modalState.data.sort || 0} onChange={(e) => setModalState({...modalState, data: {...modalState.data, sort: parseInt(e.target.value, 10)}})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" />
              </div>

              <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                <button type="button" onClick={() => setModalState({ ...modalState, isOpen: false })} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50">
                  {submitting ? '提交中...' : '确定保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BindResourceModal 
        isOpen={bindModalOpen}
        onClose={() => setBindModalOpen(false)}
        onSuccess={(selectedResId, selectedResName) => {
          setResourceCache(prev => ({ ...prev, [Number(selectedResId)]: selectedResName }));
          setModalState({
            ...modalState,
            data: { ...modalState.data, resourceId: selectedResId, resourceName: selectedResName }
          });
        }}
      />

      <FilePreviewModal
        isOpen={previewModal.isOpen}
        file={previewModal.file}
        onClose={() => setPreviewModal({ isOpen: false, file: null })}
      />
    </div>
  );
}
