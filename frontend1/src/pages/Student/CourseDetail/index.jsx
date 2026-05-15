// 课程详情与购买/报名页
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentCourseDetail } from '../../../api/student';
import FilePreviewModal from '../../../components/common/FilePreviewModal';
import { buildPreviewTarget, triggerDownload } from '../../../utils/filePreview';

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  
  // 当前正在播放/学习的课时
  const [activeLesson, setActiveLesson] = useState(null);
  // 底部 Tab 切换状态
  const [activeTab, setActiveTab] = useState('intro'); // 'intro' | 'materials'
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });

  const openPreview = (resource) => {
    setPreviewModal({
      isOpen: true,
      file: { name: resource?.name, url: resource?.url, mimeType: resource?.type },
    });
  };

  useEffect(() => {
    if (id) {
      fetchCourseDetail();
    }
  }, [id]);

  const fetchCourseDetail = async () => {
    setLoading(true);
    try {
      const res = await getStudentCourseDetail(id);
      const courseData = res?.data || res;
      setCourse(courseData);

      // 默认选中第一个章节的第一个课时
      if (courseData?.chapters && courseData.chapters.length > 0) {
        const firstChapter = courseData.chapters.find(c => c.lessons && c.lessons.length > 0);
        if (firstChapter) {
          setActiveLesson(firstChapter.lessons[0]);
        }
      } else if (courseData?.lessons && courseData.lessons.length > 0) {
        // 兼容没有章节，直接返回课时列表的扁平结构
        setActiveLesson(courseData.lessons[0]);
      }
    } catch (error) {
      console.error('获取课程详情失败', error);
      alert('获取课程详情失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  // 渲染课时类型图标 (type 1: 视频, type 0: 图文/文档)
  const renderLessonIcon = (type) => {
    if (type === 1) return <span className="material-symbols-outlined text-[18px]">play_circle</span>;
    if (type === 0) return <span className="material-symbols-outlined text-[18px]">description</span>;
    return <span className="material-symbols-outlined text-[18px]">article</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-5xl text-blue-500 mb-4">sync</span>
        <p className="text-slate-500 font-medium">正在为您加载课程内容...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">sentiment_dissatisfied</span>
        <p className="text-slate-500 font-medium">抱歉，未找到该课程信息</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">返回上一页</button>
      </div>
    );
  }

  const courseInfo = course?.course || course;
  const courseMaterials = course?.resources || courseInfo?.resources || [];

  return (
    <div className="min-h-screen bg-slate-100 pb-20 animate-in fade-in duration-300">
      
      {/* 🌟 顶部面包屑导航 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span onClick={() => navigate('/student/learning')} className="hover:text-blue-600 cursor-pointer flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span> 我的课程
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold">{courseInfo.title || courseInfo.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* 🌟 核心布局：左右分栏 (左侧占 8 份，右侧占 4 份) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ================= 左侧：视频播放区 + 底部 Tab ================= */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* 1. 播放器容器 */}
            <div className="bg-black rounded-2xl overflow-hidden shadow-lg aspect-video relative flex flex-col group">
              {activeLesson ? (
                activeLesson.type === 1 ? (
                  // 视频课时
                  activeLesson.playbackUrl ? (
                    <video 
                      src={activeLesson.playbackUrl} 
                      controls 
                      controlsList="nodownload"
                      autoPlay 
                      className="w-full h-full object-contain bg-black"
                    >
                      您的浏览器不支持播放该视频。
                    </video>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-6xl mb-4 opacity-50">videocam_off</span>
                      <p>该课时暂无视频资源</p>
                    </div>
                  )
                ) : (
                  // 图文/文档课时
                  <div className="flex-1 bg-slate-800 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                    <span className="material-symbols-outlined text-6xl mb-4 text-blue-400">description</span>
                    <h3 className="text-xl font-bold text-white mb-2">{activeLesson.name}</h3>
                    <p className="text-sm opacity-80">这是一个图文/文档课时，请在下方课程资料中查看或下载相关附件。</p>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <p>请在右侧选择要学习的课时</p>
                </div>
              )}

              {/* 播放器顶部信息条 (悬浮显示) */}
              {activeLesson && (
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
                  <span className="text-white font-bold text-lg drop-shadow-md">{activeLesson.name}</span>
                  {activeLesson.duration > 0 && (
                    <span className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                      {activeLesson.duration} 分钟
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. 底部详情区 (课程介绍 / 课程资料 Tab) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px]">
              <div className="flex border-b border-slate-200 px-2">
                <button 
                  onClick={() => setActiveTab('intro')}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'intro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  课程介绍
                </button>
                <button 
                  onClick={() => setActiveTab('materials')}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'materials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  课程资料
                </button>
              </div>
              
              <div className="p-6 text-slate-700 leading-relaxed text-sm">
                {activeTab === 'intro' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-xl font-black text-slate-800 mb-4">{courseInfo.title || courseInfo.name}</h3>
                    {courseInfo.shortDesc && (
                      <p className="text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {courseInfo.shortDesc}
                      </p>
                    )}
                    {/* 这里如果有富文本详情可以渲染 HTML */}
                    <div className="prose max-w-none prose-blue" dangerouslySetInnerHTML={{ __html: courseInfo.content || '<p>暂无详细介绍...</p>' }}></div>
                  </div>
                )}
                
                {activeTab === 'materials' && (
                  <div className="animate-in fade-in duration-300">
                    {courseMaterials && courseMaterials.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {courseMaterials.map((resource, index) => {
                          const preview = buildPreviewTarget({ name: resource.name, url: resource.url, mimeType: resource.type });
                          const canPreview = preview?.kind && preview.kind !== 'unsupported';
                          return (
                            <div key={resource.id || index} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <span className="material-symbols-outlined text-2xl text-slate-500">
                                    {preview?.kind === 'image'
                                      ? 'image'
                                      : preview?.kind === 'video'
                                        ? 'movie'
                                        : preview?.kind === 'audio'
                                          ? 'headphones'
                                          : preview?.kind === 'iframe'
                                            ? 'description'
                                            : 'draft'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-800 truncate text-sm" title={resource.name}>
                                    {resource.name}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {resource.size ? `${(resource.size / 1024).toFixed(1)} KB` : ''}
                                  </p>
                                  <div className="mt-2 flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => openPreview(resource)}
                                      disabled={!canPreview}
                                      className={`inline-flex items-center gap-1 text-xs font-bold ${canPreview ? 'text-blue-600 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'}`}
                                    >
                                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                                      预览
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => triggerDownload({ name: resource.name, url: resource.url })}
                                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">download</span>
                                      下载
                                    </button>
                                  </div>
                                  {preview?.note ? <div className="text-xs text-slate-400 mt-2">{preview.note}</div> : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-30">folder_open</span>
                        <p>当前课程暂无附加下载资料</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ================= 右侧：课程目录区 ================= */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-24">
              
              {/* 目录头部 */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">format_list_bulleted</span>
                  课程目录
                </h3>
                <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                  共 {course.chapters?.reduce((acc, c) => acc + (c.lessons?.length || 0), 0) || course.lessons?.length || 0} 节
                </span>
              </div>

              {/* 目录列表区 (可滚动) */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                
                {/* 场景 A：有章节嵌套 */}
                {course.chapters && course.chapters.length > 0 ? (
                  course.chapters.map((chapter, cIdx) => (
                    <div key={chapter.id || cIdx} className="mb-4">
                      <div className="px-3 py-2 text-sm font-bold text-slate-800 bg-slate-100/50 rounded-lg mb-2">
                        第 {cIdx + 1} 章：{chapter.name}
                      </div>
                      <div className="space-y-1">
                        {chapter.lessons && chapter.lessons.map((lesson, lIdx) => {
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <div 
                              key={lesson.id}
                              onClick={() => setActiveLesson(lesson)}
                              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                                isActive 
                                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                  : 'bg-white border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                                  {renderLessonIcon(lesson.type)}
                                </div>
                                <span className={`text-sm truncate ${isActive ? 'font-bold text-blue-700' : 'text-slate-600 font-medium'}`}>
                                  {cIdx + 1}-{lIdx + 1} {lesson.name}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                {isActive && <span className="material-symbols-outlined text-[16px] text-blue-600 animate-pulse">graphic_eq</span>}
                                {lesson.duration > 0 && (
                                  <span className="text-xs text-slate-400">{lesson.duration} 分钟</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : 
                
                /* 场景 B：只有课时，没有章节嵌套 (平铺) */
                course.lessons && course.lessons.length > 0 ? (
                  <div className="space-y-1">
                    {course.lessons.map((lesson, lIdx) => {
                      const isActive = activeLesson?.id === lesson.id;
                      return (
                        <div 
                          key={lesson.id}
                          onClick={() => setActiveLesson(lesson)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                            isActive 
                              ? 'bg-blue-50 border-blue-200 shadow-sm' 
                              : 'bg-white border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                              {renderLessonIcon(lesson.type)}
                            </div>
                            <span className={`text-sm truncate ${isActive ? 'font-bold text-blue-700' : 'text-slate-600 font-medium'}`}>
                              课时 {lIdx + 1}：{lesson.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                            {isActive && <span className="material-symbols-outlined text-[16px] text-blue-600 animate-pulse">graphic_eq</span>}
                            {lesson.duration > 0 && (
                              <span className="text-xs text-slate-400">{lesson.duration} 分钟</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    该课程尚未上传任何课时内容
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        file={previewModal.file}
        onClose={() => setPreviewModal({ isOpen: false, file: null })}
      />
    </div>
  );
}
