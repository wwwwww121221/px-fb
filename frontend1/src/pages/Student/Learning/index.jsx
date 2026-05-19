import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import QrScanner from 'qr-scanner';
import {
  checkCourseCompletion,
  getAttendanceSessions,
  getCourseResult,
  getProgressRecord,
  getStudentCourseDetail,
  getStudentHourDetail,
  reportProgress,
  signInAttendanceSession,
  signOutAttendanceSession
} from '../../../api/student';
import StudentLiveRoom from './StudentLiveRoom';
import FilePreviewModal from '../../../components/common/FilePreviewModal';
import { buildPreviewTarget, triggerDownload } from '../../../utils/filePreview';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const hasCourseMode = (value, target) => {
  if (value === null || value === undefined || value === '') return false;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(String(target));
};

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 16);
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getScannerUnavailableReason = () => {
  if (typeof window === 'undefined') return '当前环境不支持扫码';
  if (!window.isSecureContext) return '当前页面不是安全环境，浏览器不会开放摄像头。请使用 HTTPS 或 localhost 访问。';
  if (!navigator.mediaDevices?.getUserMedia) return '当前浏览器不支持摄像头调用，请更换为最新版 Chrome/Edge。';
  return '';
};

export default function StudentLearning() {
  const navigate = useNavigate();
  const { id } = useParams(); 

  const [activeTab, setActiveTab] = useState('intro');
  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [courseData, setCourseData] = useState(null);
  const [courseResult, setCourseResult] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [resourceUrl, setResourceUrl] = useState('');
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null });
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [docTotalPages, setDocTotalPages] = useState(0);
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const [docLoading, setDocLoading] = useState(false);
  const [docLoadError, setDocLoadError] = useState('');
  const [signModal, setSignModal] = useState({ open: false, session: null, action: 'signIn', verifyCode: '' });
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const scanVideoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const docReportedProgressRef = useRef('');
  const docViewerRef = useRef(null);
  const docPageRefs = useRef({});

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

  const syncCourseProgress = async (courseId) => {
    const res = await checkCourseCompletion(courseId).catch(() => null);
    const progressData = res?.data ?? res;
    if (progressData && typeof progressData === 'object' && progressData.totalHours) {
      const progressVal = Math.min(100, Math.round((progressData.finishedHours / progressData.totalHours) * 100));
      setCourseData((prev) => (prev ? { ...prev, progress: progressVal } : prev));
    }
    return progressData;
  };

  const reportDocumentProgress = async (page, totalPages, force = false) => {
    if (!id || !activeLesson?.id) return;
    const total = Math.max(1, Number(totalPages) || 1);
    const current = Math.min(Math.max(1, Number(page) || 1), total);
    const key = `${id}-${activeLesson.id}-${current}-${total}`;
    if (!force && docReportedProgressRef.current === key) {
      return;
    }
    await reportProgress({
      courseId: parseInt(id, 10),
      hourId: activeLesson.id,
      resourceId: activeLesson.resourceId || activeLesson.id,
      totalDuration: total,
      currentTime: current
    });
    docReportedProgressRef.current = key;
    if (current >= total) {
      await syncCourseProgress(id);
    }
  };

  const changeDocumentPage = (nextPage) => {
    const total = Math.max(1, docTotalPages || 1);
    const target = Math.min(Math.max(1, nextPage), total);
    setDocCurrentPage(target);
    docPageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    reportDocumentProgress(target, total).catch((error) => {
      console.warn('保存文档页码进度失败:', error);
    });
  };

  const handleDocumentLoadSuccess = async ({ numPages }) => {
    const total = Math.max(1, numPages || 1);
    setDocLoadError('');
    setDocLoading(false);
    setDocTotalPages(total);
    let restoredPage = 1;
    try {
      const res = await getProgressRecord(id, activeLesson.id);
      const record = res?.record || res;
      const savedPage = Number(record?.finishedDuration || 0);
      if (savedPage > 0) {
        restoredPage = Math.min(Math.max(1, savedPage), total);
      }
    } catch (error) {
      console.warn('恢复文档阅读进度失败:', error);
    }
    setDocCurrentPage(restoredPage);
    reportDocumentProgress(restoredPage, total, true).catch((error) => {
      console.warn('初始化文档进度失败:', error);
    });
    setTimeout(() => {
      docPageRefs.current[restoredPage]?.scrollIntoView({ block: 'start' });
    }, 80);
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
    setDocTotalPages(0);
    setDocCurrentPage(1);
    setDocLoadError('');
    setDocLoading(Boolean(resourceUrl));
    docReportedProgressRef.current = '';
    docPageRefs.current = {};
  }, [activeLesson?.id, resourceUrl]);

  useEffect(() => {
    if (!resourceUrl || docTotalPages <= 0 || !docViewerRef.current) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) {
          return;
        }
        const page = Number(visible[0].target.getAttribute('data-page-number'));
        if (!page) {
          return;
        }
        setDocCurrentPage(page);
        reportDocumentProgress(page, docTotalPages).catch((error) => {
          console.warn('保存文档滚动进度失败:', error);
        });
      },
      {
        root: docViewerRef.current,
        threshold: 0.6
      }
    );
    Object.values(docPageRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [resourceUrl, docTotalPages, activeLesson?.id]);
  
  useEffect(() => {
    const fetchDetailAndProgress = async () => {
      setLoading(true);
      try {
        const [detailRes, progressRes, attendanceRes, resultRes] = await Promise.all([
          getStudentCourseDetail(id).catch(() => null),
          checkCourseCompletion(id).catch(() => null),
          getAttendanceSessions(id).catch(() => null),
          getCourseResult(id).catch(() => null)
        ]);

        if (resultRes) {
          const resultData = resultRes?.data || resultRes;
          setCourseResult(resultData);
        }

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
             progressVal = Math.min(100, Math.round((pData.finishedHours / pData.totalHours) * 100));
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
          courseMode: data.courseMode ?? data.course?.courseMode,
          offlineLocation: data.offlineLocation || data.course?.offlineLocation || '',
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
        setAttendanceSessions(attendanceRes || []);

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

  useEffect(() => {
    const canOpenModalScanner = signModal.open && signModal.session?.signMethod === 1;
    if (!canOpenModalScanner) return undefined;

    const unavailableReason = getScannerUnavailableReason();
    if (unavailableReason) {
      setScanStatus(unavailableReason);
      return undefined;
    }

    const canScan = navigator.mediaDevices?.getUserMedia && scanVideoRef.current;
    if (!canScan) return undefined;

    let disposed = false;
    const startScan = async () => {
      try {
        setScanStatus('正在打开摄像头，请允许浏览器访问...');
        const scanner = new QrScanner(
          scanVideoRef.current,
          (result) => {
            const rawValue = typeof result === 'string' ? result : result?.data;
            if (!rawValue) return;
            setSignModal((prev) => ({ ...prev, verifyCode: rawValue }));
            setScanStatus('已识别课程码');
            stopScanner();
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
            onDecodeError: () => {},
          }
        );
        qrScannerRef.current = scanner;
        await scanner.start();
        setScanStatus('请将教师端课程码对准摄像头');
        if (disposed) {
          stopScanner();
        }
      } catch (error) {
        console.warn('打开摄像头失败，改用手动输入', error);
        setScanStatus(error?.name === 'NotAllowedError' ? '你已拒绝摄像头权限，请在浏览器地址栏中允许摄像头访问后重试。' : '打开摄像头失败，请检查浏览器权限或手动输入课程码。');
      }
    };

    startScan();
    return () => {
      disposed = true;
      stopScanner();
    };
  }, [signModal.open, signModal.session?.signMethod]);

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

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
  };

  const closeSignModal = () => {
    stopScanner();
    setScanStatus('');
    setSignModal({ open: false, session: null, action: 'signIn', verifyCode: '' });
  };

  const refreshAttendanceSessions = async () => {
    if (!id) return;
    setAttendanceLoading(true);
    try {
      const res = await getAttendanceSessions(id);
      setAttendanceSessions(res || []);
    } catch (error) {
      console.warn('刷新签到场次失败', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const openSignModal = (session, action) => {
    setSignModal({ open: true, session, action, verifyCode: '' });
  };

  const submitAttendance = async (session, action, payload = {}) => {
    setSignSubmitting(true);
    try {
      if (action === 'signOut') {
        await signOutAttendanceSession(session.id, payload);
        alert('签退成功');
      } else {
        await signInAttendanceSession(session.id, payload);
        alert('签到成功');
      }
      closeSignModal();
      await refreshAttendanceSessions();
    } catch (error) {
      alert(error?.message || (action === 'signOut' ? '签退失败' : '签到失败'));
    } finally {
      setSignSubmitting(false);
    }
  };

  const handleAttendanceAction = async (session, action) => {
    if (session.signMethod === 2) {
      if (!navigator.geolocation) {
        alert('当前浏览器不支持定位签到');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await submitAttendance(session, action, {
            latitude: Number(pos.coords.latitude).toFixed(6),
            longitude: Number(pos.coords.longitude).toFixed(6),
            location: session.locationName || ''
          });
        },
        () => alert('获取定位失败，请检查定位权限')
      );
      return;
    }
    openSignModal(session, action);
  };

  const renderAttendanceMethod = (method) => {
    if (method === 1) return '扫码签到';
    if (method === 2) return '定位签到';
    if (method === 3) return '口令签到';
    return '未设置';
  };

  const isAttendanceTab = activeTab === 'attendance' && hasCourseMode(courseData?.courseMode, 3);

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

        {!isAttendanceTab && (
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
                      return syncCourseProgress(id);
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
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="text-sm text-slate-600">
                      {docTotalPages > 0 ? `阅读进度：第 ${docCurrentPage} / ${docTotalPages} 页` : '正在加载文档预览...'}
                    </div>
                    <div className="flex items-center gap-2">
                      {docTotalPages > 0 && (
                        <>
                          <button
                            type="button"
                            disabled={docCurrentPage <= 1}
                            onClick={() => changeDocumentPage(docCurrentPage - 1)}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm disabled:opacity-50"
                          >
                            上一页
                          </button>
                          <button
                            type="button"
                            disabled={docCurrentPage >= docTotalPages}
                            onClick={() => changeDocumentPage(docCurrentPage + 1)}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm disabled:opacity-50"
                          >
                            下一页
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openPreview({ name: activeLesson?.name, url: resourceUrl })}
                        className="px-4 py-2 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                        新窗口预览
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end mb-3">
                    <button 
                      onClick={() => {
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
                        onLoad={() => {
                          setDocTotalPages(1);
                          setDocCurrentPage(1);
                          reportDocumentProgress(1, 1, true).catch(() => {});
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
                    <div className="w-full h-full flex flex-col items-center">
                      {docLoadError ? (
                        <div className="flex flex-col items-center justify-center min-h-[420px] text-center text-slate-500 px-6">
                          <span className="material-symbols-outlined text-5xl mb-3 text-amber-500">error</span>
                          <div className="font-bold text-slate-700 mb-2">文档预览失败</div>
                          <div className="text-sm">{docLoadError}</div>
                        </div>
                      ) : (
                        <>
                          {docLoading && (
                            <div className="py-10 text-sm text-slate-500">正在加载文档页数...</div>
                          )}
                          <div ref={docViewerRef} className="overflow-y-auto w-full max-h-[calc(100vh-240px)] pr-2">
                            <Document
                              file={docPreviewTarget.url}
                              loading=""
                              onLoadSuccess={handleDocumentLoadSuccess}
                              onLoadError={(error) => {
                                setDocLoading(false);
                                setDocLoadError(error?.message || '无法打开当前文档');
                              }}
                              onSourceError={(error) => {
                                setDocLoading(false);
                                setDocLoadError(error?.message || '文档源地址不可用');
                              }}
                            >
                              <div className="flex flex-col items-center gap-4">
                                {Array.from({ length: docTotalPages || 0 }, (_, index) => {
                                  const pageNumber = index + 1;
                                  return (
                                    <div
                                      key={pageNumber}
                                      ref={(node) => {
                                        if (node) {
                                          docPageRefs.current[pageNumber] = node;
                                        } else {
                                          delete docPageRefs.current[pageNumber];
                                        }
                                      }}
                                      data-page-number={pageNumber}
                                      className="w-full flex justify-center"
                                    >
                                      <Page
                                        pageNumber={pageNumber}
                                        width={Math.max(320, Math.min(window.innerWidth - (catalogCollapsed ? 120 : 440), 980))}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </Document>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="material-symbols-outlined text-6xl mb-4 text-blue-400">description</span>
                      <p className="text-lg font-bold mb-2">{activeLesson.name}</p>
                      <p className="text-sm text-slate-500 mb-4">{docPreviewTarget?.note || '当前文件暂不支持网页预览'}</p>
                      <button
                        onClick={() => {
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
        )}

        <div className="flex-1 flex flex-col bg-white overflow-hidden border-t border-slate-200">
          <div className="flex px-6 border-b border-slate-200 shrink-0">
            <button onClick={() => setActiveTab('intro')} className={`px-4 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'intro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>课程简介</button>
            <button onClick={() => setActiveTab('materials')} className={`px-4 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'materials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>课件资料</button>
            {hasCourseMode(courseData.courseMode, 3) && (
              <button onClick={() => setActiveTab('attendance')} className={`px-4 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>线下签到</button>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'intro' && (
              <div className="animate-in fade-in duration-300">
                {courseResult && courseResult.totalScore !== null && courseResult.totalScore !== undefined && (
                  <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">school</span>
                        课程成绩
                      </h3>
                      <div className="flex items-center gap-2">
                        {courseResult.isPassed ? (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            已通过
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            未通过
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <div className={`text-2xl font-black ${courseResult.examsAvgScore >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {courseResult.examsAvgScore ? courseResult.examsAvgScore.toFixed(1) : '0.0'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">考试平均分</div>
                        {courseResult.weightExams && (
                          <div className="text-xs text-slate-400 mt-0.5">权重 {(courseResult.weightExams * 100).toFixed(0)}%</div>
                        )}
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <div className={`text-2xl font-black ${courseResult.processScore >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {courseResult.processScore ? courseResult.processScore.toFixed(1) : '0.0'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">过程评价</div>
                        {courseResult.weightProcess && (
                          <div className="text-xs text-slate-400 mt-0.5">权重 {(courseResult.weightProcess * 100).toFixed(0)}%</div>
                        )}
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                        <div className={`text-2xl font-black ${courseResult.practicalScore >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {courseResult.practicalScore ? courseResult.practicalScore.toFixed(1) : '0.0'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">实操评价</div>
                        {courseResult.weightPractical && (
                          <div className="text-xs text-slate-400 mt-0.5">权重 {(courseResult.weightPractical * 100).toFixed(0)}%</div>
                        )}
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow-sm border-2 border-blue-200">
                        <div className={`text-3xl font-black ${courseResult.totalScore >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {courseResult.totalScore ? courseResult.totalScore.toFixed(1) : '0.0'}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 font-bold">综合成绩</div>
                      </div>
                    </div>
                    {courseResult.updatedAt && (
                      <div className="text-xs text-slate-400 mt-3 text-right">
                        更新时间：{formatTime(courseResult.updatedAt)}
                      </div>
                    )}
                  </div>
                )}
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
            {activeTab === 'attendance' && hasCourseMode(courseData.courseMode, 3) && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={refreshAttendanceSessions} className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">
                    刷新
                  </button>
                </div>
                {courseData.offlineLocation ? (
                  <div className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm border border-blue-100">
                    <span className="material-symbols-outlined text-[18px]">place</span>
                    默认授课地点：{courseData.offlineLocation}
                  </div>
                ) : null}
                {attendanceLoading ? (
                  <div className="py-12 text-center text-slate-400">正在刷新签到场次...</div>
                ) : attendanceSessions.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-2 opacity-40">event_busy</span>
                    <p className="text-sm">老师暂未发布签到场次</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceSessions.map((session) => (
                      <div key={session.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/60">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800">{session.title}</h4>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                session.status === '已完成'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : session.status === '待签退'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}>
                                {session.status}
                              </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-2 space-y-1">
                              <div>签到方式：{renderAttendanceMethod(session.signMethod)}</div>
                              <div>签到时间：{formatTime(session.signInStartAt)} - {formatTime(session.signInEndAt)}</div>
                              <div>签退时间：{session.needSignOut === 1 ? `${formatTime(session.signOutStartAt)} - ${formatTime(session.signOutEndAt)}` : '本场次无需签退'}</div>
                              {session.locationName ? <div>签到地点：{session.locationName}</div> : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-start md:items-end gap-2">
                            {session.signInTime ? (
                              <div className="text-xs text-slate-500">已签到：{formatTime(session.signInTime)}</div>
                            ) : null}
                            {session.signOutTime ? (
                              <div className="text-xs text-slate-500">已签退：{formatTime(session.signOutTime)}</div>
                            ) : null}
                            {session.status === '待签到' && (
                              <button onClick={() => handleAttendanceAction(session, 'signIn')} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">
                                立即签到
                              </button>
                            )}
                            {session.status === '待签退' && (
                              <button onClick={() => handleAttendanceAction(session, 'signOut')} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                                立即签退
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= 右侧：课程目录与进度 ================= */}
      <div className={`${catalogCollapsed ? 'w-[56px]' : 'w-[380px]'} relative bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 shadow-[-4px_0_15px_rgb(0,0,0,0.03)] z-20 transition-all duration-300`}>
        <button
          type="button"
          onClick={() => setCatalogCollapsed((prev) => !prev)}
          className="absolute left-0 top-5 -translate-x-1/2 z-30 h-10 w-10 rounded-full border border-slate-200 bg-white text-blue-600 shadow-md hover:bg-blue-50 flex items-center justify-center"
          title={catalogCollapsed ? '展开课程目录' : '收起课程目录'}
        >
          <span className={`material-symbols-outlined text-[20px] transition-transform ${catalogCollapsed ? 'rotate-180' : ''}`}>
            chevron_right
          </span>
        </button>
        
        {catalogCollapsed ? (
          <div className="flex-1 flex flex-col items-center py-5 gap-4 bg-slate-50/60">
            <div className={`text-xs font-bold ${courseData.progress === 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
              {courseData.progress}%
            </div>
            <div className="w-2 flex-1 max-h-40 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`w-full rounded-full transition-all duration-1000 ${courseData.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ height: `${courseData.progress}%` }}
              ></div>
            </div>
            <div className="writing-mode-vertical text-[12px] font-bold text-slate-500 tracking-[0.2em]" style={{ writingMode: 'vertical-rl' }}>
              课程目录
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      <FilePreviewModal
        isOpen={previewModal.isOpen}
        file={previewModal.file}
        onClose={() => setPreviewModal({ isOpen: false, file: null })}
      />

      {signModal.open && signModal.session && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{signModal.action === 'signOut' ? '线下签退' : '线下签到'}</h3>
                <p className="text-sm text-slate-500 mt-1">{signModal.session.title}</p>
              </div>
              <button onClick={closeSignModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {signModal.session.signMethod === 1 && (
                <>
                  <div className="text-sm text-slate-600">
                    请扫描教师端展示的课程码；如果当前设备不支持扫码，也可以手动输入课程码完成签到。
                  </div>
                  {window.isSecureContext && navigator.mediaDevices?.getUserMedia ? (
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                      <video ref={scanVideoRef} muted playsInline className="w-full h-64 object-cover" />
                    </div>
                  ) : null}
                  {scanStatus ? (
                    <div className={`rounded-xl px-4 py-3 text-sm border ${scanStatus.includes('已识别') || scanStatus.includes('对准') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {scanStatus}
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">课程码</label>
                    <input
                      value={signModal.verifyCode}
                      onChange={(e) => setSignModal((prev) => ({ ...prev, verifyCode: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入或扫码识别课程码"
                    />
                  </div>
                </>
              )}
              {signModal.session.signMethod === 3 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">签到口令</label>
                  <input
                    value={signModal.verifyCode}
                    onChange={(e) => setSignModal((prev) => ({ ...prev, verifyCode: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入老师发布的签到口令"
                  />
                </div>
              )}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 space-y-1">
                <div>方式：{renderAttendanceMethod(signModal.session.signMethod)}</div>
                <div>签到时间：{formatTime(signModal.session.signInStartAt)} - {formatTime(signModal.session.signInEndAt)}</div>
                {signModal.session.needSignOut === 1 ? (
                  <div>签退时间：{formatTime(signModal.session.signOutStartAt)} - {formatTime(signModal.session.signOutEndAt)}</div>
                ) : null}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button onClick={closeSignModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-white">
                取消
              </button>
              <button
                onClick={() => submitAttendance(signModal.session, signModal.action, { verifyCode: signModal.verifyCode })}
                disabled={signSubmitting}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {signSubmitting ? '提交中...' : (signModal.action === 'signOut' ? '确认签退' : '确认签到')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
