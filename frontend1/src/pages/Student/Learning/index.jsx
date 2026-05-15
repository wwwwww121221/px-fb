import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStudentCourseDetail, checkCourseCompletion, getStudentHourDetail, reportProgress, getProgressRecord } from '../../../api/student';
import StudentLiveRoom from './StudentLiveRoom';
import FilePreviewModal from '../../../components/common/FilePreviewModal';
import { buildPreviewTarget, triggerDownload } from '../../../utils/filePreview';

export default function StudentLearning() {
  const navigate = useNavigate();
  const { id } = useParams(); 

  const [activeTab, setActiveTab] = useState('intro');
  const [loading, setLoading] = useState(true);
  
  const [courseData, setCourseData] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [resourceUrl, setResourceUrl] = useState('');
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });

  const openPreview = (resource) => {
    setPreviewModal({
      isOpen: true,
      file: { name: resource?.name, url: resource?.url, mimeType: resource?.type },
    });
  };
  
  // 🌟 断点续播相关
  const videoRef = useRef(null);
  
  // 🌟 获取历史进度并跳转
  const restoreProgress = async (videoElement, courseId, lessonId) => {
    if (!videoElement || !courseId || !lessonId) return;
    try {
      const res = await getProgressRecord(courseId, lessonId);
      const record = res?.record || res;
      if (record?.finishedDuration > 0) {
        videoElement.currentTime = record.finishedDuration;
        console.log(`⏪ 已跳转至上次观看位置: ${record.finishedDuration}秒`);
      }
    } catch (e) {
      console.warn('获取历史进度失败:', e);
    }
  };
  
  // 🌟 定时保存进度（节流版本，使用原生 throttle）
  let lastSaveTime = 0;
  const saveProgressThrottled = (courseId, lessonId, currentTime, duration) => {
    const now = Date.now();
    if (now - lastSaveTime >= 5000) {
      lastSaveTime = now;
      reportProgress({
        courseId: parseInt(courseId, 10),
        hourId: lessonId,
        resourceId: null,
        totalDuration: Math.round(duration),
        currentTime: Math.round(currentTime)
      }).then(() => {
        console.log(`💾 进度已保存: ${Math.round(currentTime)}/${Math.round(duration)}秒`);
      }).catch(e => {
        console.warn('保存进度失败:', e);
      });
    }
  };
  
  // 🌟 组件卸载时保存进度
  useEffect(() => {
    return () => {
      // 组件卸载时，如果视频正在播放，保存当前进度
      if (videoRef.current) {
        const video = videoRef.current;
        if (video.duration) {
          reportProgress({
            courseId: parseInt(id, 10),
            hourId: activeLesson?.id,
            resourceId: activeLesson?.resourceId || null,
            totalDuration: Math.round(video.duration),
            currentTime: Math.round(video.currentTime)
          }).catch(() => {});
        }
      }
    };
  }, [id, activeLesson]);
  
  useEffect(() => {
    const fetchDetailAndProgress = async () => {
      setLoading(true);
      try {
        const [detailRes, progressRes] = await Promise.all([
          getStudentCourseDetail(id).catch(() => null),
          checkCourseCompletion(id).catch(() => null)
        ]);

        if (!detailRes) {
          setCourseData(null);
          console.error('❌ 获取课程详情失败');
          return;
        }

        const data = detailRes?.data || detailRes;
        
        // 调试信息：查看后端返回的原始课程数据
        console.log('📦 后端返回的课程数据:', data);
        console.log('📦 课程数据 keys:', data ? Object.keys(data) : 'null');
        console.log('📦 chapters:', data?.chapters);
        console.log('📦 lessons:', data?.lessons);
        console.log('📦 hours:', data?.hours); // 新增：顶层课时数组
        console.log('📦 data 类型:', typeof data);
        console.log('📦 data keys:', Object.keys(data || {}));
        console.log('📦 data.course:', data?.course);
        console.log('📦 data.title:', data?.title);
        console.log('📦 data.course?.title:', data?.course?.title);
        console.log('📦 data.isRequired:', data?.isRequired);
        console.log('📦 data.course?.isRequired:', data?.course?.isRequired);
        
        // 进度兼容处理 - 计算百分比
        const pData = progressRes?.data ?? progressRes;
        let progressVal = 0;
        if (typeof pData === 'number') {
           progressVal = pData;
        } else if (pData && typeof pData === 'object') {
           // 后端返回 { totalHours, finishedHours } 格式，计算百分比
           if (pData.totalHours && pData.finishedHours !== undefined) {
             progressVal = Math.round((pData.finishedHours / pData.totalHours) * 100);
           } else {
             progressVal = pData.progress ?? pData.completionRate ?? pData.percent ?? 0;
           }
        }
        
        // 🌟 核心修复：无敌兼容后端的章节/课时结构
        let finalChapters = [];
        if (data.hours && data.hours.length > 0) {
          // 结构 A: 课时在顶层的 hours 数组中（需要按章节分组）
          const hoursByChapter = {};
          data.hours.forEach(hour => {
            const chapterId = hour.chapterId || 'default';
            if (!hoursByChapter[chapterId]) {
              hoursByChapter[chapterId] = [];
            }
            hoursByChapter[chapterId].push(hour);
          });
          
          // 如果已经有章节数据，合并课时
          if (data.chapters && data.chapters.length > 0) {
            finalChapters = data.chapters.map(c => ({
              ...c,
              lessons: hoursByChapter[c.id] || []
            }));
          } else {
            // 没有章节，只有课时
            finalChapters = Object.keys(hoursByChapter).map(chapterId => ({
              id: chapterId,
              name: chapterId === 'default' ? '课时列表' : `章节 ${chapterId}`,
              lessons: hoursByChapter[chapterId]
            }));
          }
        } else if (data.chapters && data.chapters.length > 0) {
          // 结构 B: 章节里有 lessons 或 hours
          finalChapters = data.chapters.map(c => ({
            ...c,
            lessons: c.lessons || c.hours || []
          }));
        } else if (data.course?.chapters && data.course.chapters.length > 0) {
          // 结构 C: 章节在 course 对象中
          finalChapters = data.course.chapters.map(c => ({
            ...c,
            lessons: c.lessons || c.hours || []
          }));
        } else if (data.lessons && data.lessons.length > 0) {
          // 结构 D: 没有章节划分，直接丢过来一堆 lessons
          finalChapters = [{ id: 'default-chapter', name: '课程目录', lessons: data.lessons }];
        } else if (Array.isArray(data)) {
          // 结构 E: 整个返回值就是一个课时数组
          finalChapters = [{ id: 'default-chapter', name: '课程目录', lessons: data }];
        }
        
        const formattedData = {
          id: data.id || id,
          // 🌟 兼容后端返回结构：直接返回课程对象或嵌套在 course 字段中
          title: data.title || data.name || data.course?.title || data.course?.name || '未命名课程',
          isRequired: data.isRequired ?? data.course?.isRequired,
          progress: progressVal,
          intro: data.shortDesc || data.intro || data.content || data.course?.shortDesc || data.course?.intro || data.course?.content || '该课程暂无详细简介。',
          chapters: finalChapters,
          resources: data.resources || []
        };
        
        // 调试信息：查看格式化后的课程数据
        console.log('📚 格式化后的课程数据:', formattedData);
        console.log('📚 章节数量:', finalChapters.length);
        console.log('📚 课程资料数量:', formattedData.resources.length);
        if (finalChapters.length > 0) {
          console.log('📚 第一个章节:', finalChapters[0]);
          console.log('📚 第一个章节的课时数量:', finalChapters[0].lessons?.length || 0);
          if (finalChapters[0].lessons?.length > 0) {
            console.log('📚 第一个课时:', finalChapters[0].lessons[0]);
          }
        }
        
        setCourseData(formattedData);

        // 默认选中第一节课自动准备播放
        if (formattedData.chapters.length > 0 && formattedData.chapters[0].lessons.length > 0) {
          const firstLesson = formattedData.chapters[0].lessons[0];
          setActiveLesson(firstLesson);
          
          // 如果是视频或图文类型，立即获取资源URL
          if (firstLesson.type === 0 || firstLesson.type === 1) {
            try {
              const res = await getStudentHourDetail(firstLesson.id);
              console.log('📡 初始化API完整响应:', JSON.stringify(res, null, 2));
              if (res?.resource?.url) {
                console.log(firstLesson.type === 0 ? '📹' : '📄', '初始化获取到资源URL:', res.resource.url);
                setResourceUrl(res.resource.url);
              } else {
                console.error('❌ 初始化未获取到资源URL，resource为null或url为空');
              }
            } catch (error) {
              console.error('❌ 初始化获取资源URL失败:', error);
            }
          }
        }

      } catch (error) {
        console.error('获取课程详情或进度失败', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) fetchDetailAndProgress();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-4">sync</span>
        <span>正在努力加载课程内容...</span>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-5xl mb-4 opacity-50">error</span>
        <span>课程不存在或已被下架</span>
        <button onClick={() => navigate('/student/dashboard')} className="mt-6 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">返回学习大厅</button>
      </div>
    );
  }

  // 判断课时类型：0=视频录播, 1=图文文档, 2=直播
  const isVideo = activeLesson?.type === 0;
  const isDocument = activeLesson?.type === 1;
  const isLive = activeLesson?.type === 2;
  const docPreviewTarget = resourceUrl ? buildPreviewTarget({ name: activeLesson?.name, url: resourceUrl }) : null;

  // 处理课时选择：如果是视频或图文类型，获取资源URL
  const handleLessonSelect = async (lesson) => {
    setActiveLesson(lesson);
    setResourceUrl(''); // 先清空
    
    // 如果是视频类型（type === 0）或图文类型（type === 1），调用API获取资源URL
    if (lesson.type === 0 || lesson.type === 1) {
      try {
        const res = await getStudentHourDetail(lesson.id);
        console.log('📡 API完整响应:', JSON.stringify(res, null, 2));
        console.log('📡 res.resource:', res?.resource);
        console.log('📡 res.resource.url:', res?.resource?.url);
        
        if (res?.resource?.url) {
          const url = res.resource.url;
          console.log(lesson.type === 0 ? '📹' : '📄', '获取到资源URL:', url);
          setResourceUrl(url);
        } else {
          console.error('❌ 未获取到资源URL，resource为null或url为空');
        }
      } catch (error) {
        console.error('❌ 获取课时详情失败:', error);
      }
    }
  };

  // 调试信息：查看当前选中课时的完整数据
  console.log('📚 当前选中课时数据:', {
    activeLesson,
    type: activeLesson?.type,
    isVideo,
    isLive,
    playbackUrl: activeLesson?.playbackUrl,
    resourceUrl
  });

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* ================= 左侧：主学习区 ================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
        
        <div className="h-14 bg-slate-900 text-slate-300 flex items-center justify-between px-4 shrink-0 shadow-md z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios</span>
              <span className="text-sm font-medium">返回上一页</span>
            </button>
            <div className="w-px h-4 bg-slate-700"></div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${courseData.isRequired === 1 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                {courseData.isRequired === 1 ? '必修课' : '选修课'}
              </span>
              <h1 className="text-white font-bold truncate max-w-lg" title={courseData.title}>
                {courseData.title}
              </h1>
            </div>
          </div>
        </div>

        {/* 🌟 真实的视频播放器区域 */}
        <div className="w-full bg-black flex-shrink-0 flex items-center justify-center relative shadow-inner group" style={{ aspectRatio: '21/9', maxHeight: '60vh' }}>
          {courseData.chapters.length === 0 ? (
             <div className="text-slate-400 flex flex-col items-center">
               <span className="material-symbols-outlined text-6xl mb-2 opacity-50">videocam_off</span>
               <p className="text-lg font-medium">该课程尚未添加任何课时</p>
             </div>
          ) : activeLesson ? (
            isLive ? (
              // 直播类型：使用 StudentLiveRoom 组件
              <StudentLiveRoom hourData={activeLesson} />
            ) : isVideo ? (
              resourceUrl ? (
                <video 
                  ref={videoRef}
                  src={resourceUrl} 
                  controls 
                  controlsList="nodownload"
                  autoPlay 
                  className="w-full h-full object-contain bg-black"
                  onLoadedMetadata={async (e) => {
                    // 🌟 断点续播：视频元数据加载完成后，获取历史进度并跳转
                    await restoreProgress(e.target, id, activeLesson.id);
                  }}
                  onTimeUpdate={(e) => {
                    // 🌟 定时同步进度（使用 lodash throttle 防抖）
                    saveProgressThrottled(id, activeLesson.id, e.target.currentTime, e.target.duration);
                  }}
                  onEnded={(e) => {
                    // 🌟 视频播放完毕，上报满分
                    const duration = Math.round(e.target.duration || 100);
                    reportProgress({
                      courseId: parseInt(id, 10),
                      hourId: activeLesson.id,
                      resourceId: activeLesson.resourceId || null,
                      totalDuration: duration,
                      currentTime: duration
                    }).then(() => {
                      return checkCourseCompletion(id);
                    }).then(res => {
                      if (res) {
                        console.log('✅ 视频播放完毕，进度已保存');
                      }
                    }).catch(err => {
                      console.error('❌ 视频播放完毕上报失败:', err);
                    });
                  }}
                  onPause={(e) => {
                    // 🌟 离开页面保存：视频暂停时立即保存进度
                    const current = e.target.currentTime;
                    const total = e.target.duration || 100;
                    saveProgressThrottled.flush?.(); // 刷新 throttle 队列，立即保存
                    // 立即保存当前进度
                    reportProgress({
                      courseId: parseInt(id, 10),
                      hourId: activeLesson.id,
                      resourceId: activeLesson.resourceId || null,
                      totalDuration: Math.round(total),
                      currentTime: Math.round(current)
                    }).catch(err => console.error('❌ 暂停保存进度失败:', err));
                  }}
                >
                  您的浏览器不支持播放该视频。
                </video>
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl mb-2 opacity-50 animate-pulse">sync</span>
                  <p>正在加载视频...</p>
                </div>
              )
            ) : isDocument ? (
              // 图文资料类型
              resourceUrl ? (
                <div className="w-full h-full overflow-auto bg-slate-100 p-4">
                  <div className="flex justify-end mb-2">
                    <button 
                      onClick={async () => {
                        // 伪造进度：点击下载时自动拉满
                        try {
                          await reportProgress({
                            courseId: parseInt(id, 10),
                            hourId: activeLesson.id,
                            resourceId: activeLesson.resourceId || null,
                            totalDuration: 100,
                            currentTime: 100
                          });
                          console.log('✅ 文档进度已上报');
                          // 上报成功后检查整体进度
                          await checkCourseCompletion(id);
                          console.log('✅ 课程整体进度已检查');
                        } catch (error) {
                          console.error('❌ 进度上报失败:', error);
                        }
                        // 触发浏览器下载
                        const ext = resourceUrl.split('.').pop() || 'docx';
                        triggerDownload({ name: `${activeLesson.name}.${ext}`, url: resourceUrl });
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      下载资料
                    </button>
                  </div>
                  {docPreviewTarget?.kind === 'image' ? (
                    <div className="flex justify-center">
                      <img
                        src={docPreviewTarget.url}
                        alt={activeLesson.name}
                        className="max-w-full h-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxHeight: 'calc(100vh - 200px)' }}
                        onClick={() => {
                          reportProgress({
                            courseId: parseInt(id, 10),
                            hourId: activeLesson.id,
                            resourceId: activeLesson.resourceId || null,
                            totalDuration: 100,
                            currentTime: 100
                          }).then(() => checkCourseCompletion(id)).catch(() => {});
                        }}
                      />
                    </div>
                  ) : docPreviewTarget?.kind === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
                      <video src={docPreviewTarget.url} controls className="w-full h-full object-contain" />
                    </div>
                  ) : docPreviewTarget?.kind === 'audio' ? (
                    <div className="w-full h-full flex items-center justify-center p-6">
                      <audio src={docPreviewTarget.url} controls className="w-full" />
                    </div>
                  ) : docPreviewTarget?.kind === 'iframe' ? (
                    <div className="w-full h-full flex flex-col">
                      <iframe
                        src={docPreviewTarget.url}
                        className="flex-1 rounded-lg"
                        style={{ minHeight: 'calc(100vh - 200px)' }}
                        referrerPolicy="no-referrer"
                        onLoad={() => {
                          reportProgress({
                            courseId: parseInt(id, 10),
                            hourId: activeLesson.id,
                            resourceId: activeLesson.resourceId || null,
                            totalDuration: 100,
                            currentTime: 100
                          }).then(() => checkCourseCompletion(id)).catch(() => {});
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="material-symbols-outlined text-6xl mb-4 text-blue-400">description</span>
                      <p className="text-lg font-bold mb-2">{activeLesson.name}</p>
                      <p className="text-sm text-slate-500 mb-4">{docPreviewTarget?.note || '当前文件暂不支持网页预览'}</p>
                      <button
                        onClick={async () => {
                          try {
                            await reportProgress({
                              courseId: parseInt(id, 10),
                              hourId: activeLesson.id,
                              resourceId: activeLesson.resourceId || null,
                              totalDuration: 100,
                              currentTime: 100
                            });
                            await checkCourseCompletion(id);
                          } catch (error) {}
                          const ext = resourceUrl.split('.').pop() || 'docx';
                          triggerDownload({ name: `${activeLesson.name || '文档'}.${ext}`, url: resourceUrl });
                        }}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[20px]">download</span>
                        点击下载
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl mb-2 opacity-50 animate-pulse">sync</span>
                  <p>正在加载资料...</p>
                </div>
              )
            ) : (
              <div className="text-slate-300 flex flex-col items-center justify-center p-8 bg-slate-800 w-full h-full">
                 <span className="material-symbols-outlined text-6xl mb-4 text-blue-400">description</span>
                 <p className="text-xl font-bold mb-2">暂无资料内容</p>
              </div>
            )
          ) : null}

          {/* 视频右上角悬浮课时名称 */}
          {activeLesson && isVideo && resourceUrl && (
             <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 pointer-events-none">
               <span className="material-symbols-outlined text-[16px]">play_circle</span> {activeLesson.name}
             </div>
          )}
        </div>

        <div className="flex-1 flex flex-col bg-white overflow-hidden border-t border-slate-200">
          <div className="flex px-6 border-b border-slate-200 shrink-0">
            <button onClick={() => setActiveTab('intro')} className={`px-4 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'intro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>课程简介</button>
            <button onClick={() => setActiveTab('materials')} className={`px-4 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'materials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>课件资料</button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'intro' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="font-bold text-slate-800 mb-4 text-lg">关于本课</h3>
                <div 
                  className="text-slate-600 leading-relaxed text-sm prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: courseData.intro }}
                />
              </div>
            )}
            {activeTab === 'materials' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="font-bold text-slate-800 mb-4 text-lg">课件资料</h3>
                {courseData.resources && courseData.resources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courseData.resources.map((resource, index) => {
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
                  <div className="py-10 flex flex-col items-center text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-2 opacity-30">folder_open</span>
                    <p className="text-sm">暂无附加下载资料</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= 右侧：课程目录与进度 ================= */}
      <div className="w-[380px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 shadow-[-4px_0_15px_rgb(0,0,0,0.03)] z-20">
        
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex justify-between items-end mb-2">
            <h2 className="font-bold text-lg text-slate-800">课程目录</h2>
            <span className={`text-sm font-bold ${courseData.progress === 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
              已学 {courseData.progress}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${courseData.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
              style={{ width: `${courseData.progress}%` }}
            ></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {courseData.chapters.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_open</span>
              <p>该课程暂无课时大纲</p>
            </div>
          ) : (
            courseData.chapters.map((chapter, index) => (
              <div key={chapter.id || index} className="border-b border-slate-100">
                
                <div className="bg-slate-50/80 px-5 py-3 text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">章节</span>
                  {chapter.name}
                </div>
                
                <div className="flex flex-col">
                  {/* 🌟 修复：遍历 lessons 而不是 hours */}
                  {(chapter.lessons || []).map((lesson, lIdx) => {
                    const isPlaying = activeLesson?.id === lesson.id;
                    const isVideoType = lesson.type === 0 || !!lesson.playbackUrl;
                    const isLiveType = lesson.type === 2;
                    
                    return (
                      <div 
                        key={lesson.id || lIdx}
                        onClick={() => handleLessonSelect(lesson)}
                        className={`flex flex-col px-5 py-3 transition-colors cursor-pointer border-l-4 ${isPlaying ? 'bg-blue-50/50 border-blue-600' : 'border-transparent hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {isLiveType ? (
                              // 直播类型图标
                              isPlaying 
                                ? <span className="material-symbols-outlined text-[18px] text-red-600 animate-pulse">live_tv</span>
                                : <span className="material-symbols-outlined text-[18px] text-red-400">live_tv</span>
                            ) : isPlaying 
                              ? <span className={`material-symbols-outlined text-[18px] text-blue-600 ${isVideoType ? 'animate-pulse' : ''}`}>{isVideoType ? 'play_circle' : 'description'}</span> 
                              : <span className="material-symbols-outlined text-[18px] text-slate-400">{isVideoType ? 'play_circle' : 'article'}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${isPlaying ? 'font-bold text-blue-700' : 'font-medium text-slate-700'}`} title={lesson.name}>
                              {lesson.name}
                            </div>
                            {lesson.duration > 0 && (
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">schedule</span> {lesson.duration} 分钟
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!chapter.lessons || chapter.lessons.length === 0) && (
                    <div className="px-8 py-3 text-xs text-slate-400 italic">暂无课时内容</div>
                  )}
                </div>

              </div>
            ))
          )}
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
