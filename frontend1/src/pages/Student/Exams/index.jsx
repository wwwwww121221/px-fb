import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCourses, getCourseExams, getMyExamStatus, getExamResult } from '../../../api/student';

export default function StudentExamsIndex() {
  const navigate = useNavigate();

  // 状态管理
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [exams, setExams] = useState([]);
  
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [startingExamId, setStartingExamId] = useState(null);
  const [examStatusMap, setExamStatusMap] = useState({});
  const [scoreModal, setScoreModal] = useState({ open: false, examId: null, examTitle: '', loading: false, data: null });

  // 1. 页面初始化：拉取“我的课程”
  useEffect(() => {
    fetchMyCourses();
  }, []);

  const fetchMyCourses = async () => {
    setLoadingCourses(true);
    try {
      const res = await getMyCourses({ current: 1, size: 100 });
      
      // 🌟 终极解析模式：无论后端返回纯数组、还是包在 data、还是包在 records 里，统统拿下！
      let courseList = [];
      if (Array.isArray(res)) {
        courseList = res;
      } else if (Array.isArray(res?.data)) {
        courseList = res.data;
      } else if (Array.isArray(res?.records)) {
        courseList = res.records;
      } else if (Array.isArray(res?.data?.records)) {
        courseList = res.data.records;
      }

      setCourses(courseList);
      
      // 如果学员有课程，默认选中第一门课，这会自动触发第二步的 useEffect
      if (courseList.length > 0) {
        // 兼容有的后端叫 id，有的叫 courseId
        const firstCourseId = courseList[0].courseId || courseList[0].id;
        setSelectedCourseId(firstCourseId);
      }
    } catch (error) {
      console.error('获取我的课程列表失败', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  // 2. 监听 courseId 变化，动态拉取该课程名下的考试
  useEffect(() => {
    if (selectedCourseId) {
      fetchExamsByCourse(selectedCourseId);
    }
  }, [selectedCourseId]);

  const fetchExamsByCourse = async (courseId) => {
    setLoadingExams(true);
    setExamStatusMap({});
    try {
      const res = await getCourseExams(courseId);
      let examList = [];
      if (Array.isArray(res)) examList = res;
      else if (Array.isArray(res?.data)) examList = res.data;
      else if (Array.isArray(res?.records)) examList = res.records;
      else if (Array.isArray(res?.data?.records)) examList = res.data.records;

      setExams(examList);

      if (examList.length > 0) {
        try {
          const statusPromises = examList.map(exam => {
            const eid = exam.id || exam.examId;
            return getMyExamStatus(eid)
              .then(async res => {
                console.log(`📊 考试 ${eid} 状态原始返回:`, res);
                let raw = res;
                if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) raw = raw.data;
                
                const strStatus = String(raw?.status ?? 'NOT_STARTED').toUpperCase();
                
                return { 
                  eid, 
                  rawStatus: strStatus, 
                  canStart: raw?.canStart === true, 
                  message: raw?.message || '', 
                  userExamId: raw?.userExamId || raw?.id || raw?.recordId || raw?.examRecordId || null,
                  remainingRetakeCount: raw?.remainingRetakeCount ?? 2
                };
              })
              .catch(err => {
                console.warn(`⚠️ 查询考试 ${eid} 状态失败:`, err.message);
                return { eid, status: -1 };
              });
          });
          const results = await Promise.all(statusPromises);
          const map = {};
          results.forEach(r => { map[r.eid] = r; });
          console.log('📊 最终 examStatusMap:', map);
          setExamStatusMap(map);
        } catch (e) {
          console.warn('获取考试状态批量失败（不影响使用）', e.message);
        }
      }
    } catch (error) {
      console.error('获取考试列表失败', error);
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  // 3. 点击去考试，跳转到答题页面
  const handleStartExam = (examId) => {
    if (startingExamId !== null) return;
    setStartingExamId(examId);
    navigate(`/student/exams/take/${examId}`);
  };

  const handleViewScore = async (exam, userInfo) => {
    const eid = exam.id || exam.examId;
    setScoreModal({ open: true, examId: eid, examTitle: exam.title || exam.examName || '未命名考试', loading: true, data: null });
    const recordId = userInfo?.userExamId;
    try {
      let res;
      if (recordId) {
        res = await getExamResult(recordId);
      } else {
        res = await getExamResult(eid);
      }
      let raw = res;
      if (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) raw = raw.data;
      if (raw && !Array.isArray(raw)) {
        setScoreModal(prev => ({ ...prev, loading: false, data: raw }));
      } else if (Array.isArray(raw) && raw.length > 0) {
        setScoreModal(prev => ({ ...prev, loading: false, data: raw[0] }));
      } else {
        setScoreModal(prev => ({ ...prev, loading: false, data: null }));
      }
    } catch (e) {
      console.error('获取考试成绩失败:', e);
      setScoreModal(prev => ({ ...prev, loading: false, data: null }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative pb-10">
      
      {/* 大厅头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-sm border border-blue-500 flex items-center justify-between">
        <div className="flex items-center gap-5 text-white">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
            <span className="material-symbols-outlined text-3xl text-white">edit_document</span>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-wide">我的考试大厅</h2>
            <p className="text-blue-100 text-sm mt-1">请先在左侧选择课程，即可查看并参与名下测验。</p>
          </div>
        </div>
      </div>

      {/* 左右分栏布局 */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* 左侧：我的课程列表 */}
        <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">library_books</span>
                已报课程 ({courses.length})
              </h2>
            </div>
            
            <div className="p-3 max-h-[600px] overflow-y-auto space-y-2">
              {loadingCourses ? (
                <div className="py-10 text-center text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
                  <p className="text-sm">加载课程中...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl opacity-30 mb-2">inbox</span>
                  <p className="text-sm">您暂未报名任何课程</p>
                </div>
              ) : (
                courses.map(course => (
                  <div 
                    key={course.courseId || course.id}
                    onClick={() => setSelectedCourseId(course.courseId || course.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedCourseId === (course.courseId || course.id) 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                      {course.thumb ? (
                        <img src={course.thumb} alt="cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                          <span className="material-symbols-outlined">image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className={`text-sm font-bold truncate ${selectedCourseId === (course.courseId || course.id) ? 'text-blue-700' : 'text-slate-800'}`}>
                        {course.title || course.name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate mt-1">学时: {course.creditHours || 0}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：考试卡片列表 */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">assignment</span>
              待办测验任务
            </h3>

            {loadingExams ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-4xl mb-4 text-blue-300">sync</span>
                <p>正在获取考试列表...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <span className="material-symbols-outlined text-6xl mb-4 opacity-20">assignment_turned_in</span>
                <p className="text-lg font-medium text-slate-600">当前课程暂无考试</p>
                <p className="text-sm mt-1">您可以先前往【我的课程】继续学习视频</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {exams.map(exam => {
                  const eid = exam.id || exam.examId;
                  const ui = examStatusMap[eid];
                  const rs = ui?.rawStatus || 'NOT_STARTED';
                  const canStart = ui?.canStart === true;

                  const cfg = {
                    NOT_STARTED:   { label: '待考',       tagCls: 'bg-blue-100 text-blue-700 border-blue-200',    bar: 'bg-blue-500',     cardBg: 'border-slate-200 bg-white hover:shadow-md hover:border-blue-300', titleClr: 'text-slate-800 group-hover:text-blue-600', btnText: '进入考场',        btnCls: 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white', info: null },
                    IN_PROGRESS:   { label: '进行中',     tagCls: 'bg-indigo-100 text-indigo-700 border-indigo-200', bar: 'bg-indigo-500',   cardBg: 'border-indigo-200 bg-indigo-50/30',               titleClr: 'text-slate-800 group-hover:text-indigo-600', btnText: '继续答题',        btnCls: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white', info: '可继续作答' },
                    WAITING_GRADING:{ label: '待批改',    tagCls: 'bg-amber-100 text-amber-700 border-amber-200',      bar: 'bg-amber-500',    cardBg: 'border-amber-200 bg-amber-50/30',                 titleClr: 'text-slate-500',                                        btnText: 'AI 阅卷中',       btnCls: 'bg-slate-100 text-slate-400 cursor-not-allowed',         info: '试卷待批改，请耐心等待' },
                    PASSED:        { label: '已通过',     tagCls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500',  cardBg: 'border-emerald-200 bg-emerald-50/30',               titleClr: 'text-slate-500',                                        btnText: '查看成绩',        btnCls: 'bg-emerald-50 text-emerald-600 cursor-default',           info: ui?.message || '已通过考试' },
                    NO_RETAKE:     { label: '补考用尽',   tagCls: 'bg-red-100 text-red-700 border-red-200',          bar: 'bg-red-500',      cardBg: 'border-red-200 bg-red-50/30',                     titleClr: 'text-slate-500',                                        btnText: '查看成绩',        btnCls: 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer',           info: `补考次数已用完（剩余 ${ui?.remainingRetakeCount ?? 0} 次）` }
                  };
                  const c = cfg[rs] || cfg.NOT_STARTED;
                  const isFinished = rs === 'PASSED' || rs === 'NO_RETAKE';

                  return (
                  <div key={eid} className={`rounded-2xl p-6 shadow-sm border transition-all flex flex-col group relative overflow-hidden ${c.cardBg}`}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${c.bar}`}></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${c.tagCls}`}>
                        {c.label}
                      </span>
                      <span className="text-slate-400 text-xs font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {exam.duration || 120} 分钟
                      </span>
                    </div>
                    
                    <h3 className={`text-lg font-bold mb-2 line-clamp-2 flex-1 transition-colors ${c.titleClr}`}>
                      {exam.title || exam.examName || '未命名考试'}
                    </h3>

                    <div className="text-xs text-slate-500 mb-5 flex items-center gap-4 flex-wrap">
                      <span>及格线: <strong className="text-slate-700">{exam.passTotalScore || 60} 分</strong></span>
                      {c.info && (
                        <span className={`font-bold flex items-center gap-0.5 ${
                          rs === 'PASSED' ? 'text-emerald-600' : rs === 'NO_RETAKE' ? 'text-red-600' : rs === 'WAITING_GRADING' ? 'text-amber-600' : 'text-indigo-600'
                        }`}>
                          {rs === 'PASSED' && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                          {rs === 'NO_RETAKE' && <span className="material-symbols-outlined text-[14px]">block</span>}
                          {rs === 'WAITING_GRADING' && <span className="material-symbols-outlined text-[14px]">hourglass_top</span>}
                          {rs === 'IN_PROGRESS' && <span className="material-symbols-outlined text-[14px]">edit</span>}
                          {c.info}
                        </span>
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">考试ID: {eid}</span>
                      <button 
                        onClick={() => {
                          if (isFinished) { handleViewScore(exam, ui); return; }
                          if (!canStart) return;
                          handleStartExam(eid);
                        }}
                        disabled={startingExamId !== null || (!canStart && !isFinished)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center gap-1 ${
                          startingExamId === eid
                            ? 'bg-blue-500 text-white cursor-wait'
                            : startingExamId !== null
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : c.btnCls
                        }`}
                      >
                        {startingExamId === eid ? (
                          <><span className="material-symbols-outlined animate-spin text-[16px]">sync</span> 进入中...</>
                        ) : (
                          <>{c.btnText} {(canStart || isFinished) && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}</>
                        )}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {scoreModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={(e) => e.target === e.currentTarget && setScoreModal({ open: false, examId: null, examTitle: '', loading: false, data: null })}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-2xl">emoji_events</span>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{scoreModal.examTitle}</h3>
                <p className="text-xs text-slate-500">考试成绩详情</p>
              </div>
              <button onClick={() => setScoreModal({ open: false, examId: null, examTitle: '', loading: false, data: null })} className="ml-auto text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6">
              {scoreModal.loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-4xl mb-3 text-emerald-400">sync</span>
                  <p className="text-sm font-medium">正在加载成绩...</p>
                </div>
              ) : scoreModal.data ? (
                <div className="space-y-5">
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-500 mb-2">最终得分</p>
                    <p className={`text-5xl font-black ${(scoreModal.data.finalScore ?? 0) >= 60 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {scoreModal.data.finalScore ?? '--'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">满分 {scoreModal.data.totalScore || 100} 分 / 及格线 {scoreModal.data.passTotalScore || 60} 分</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">客观题得分</span>
                      <span className="font-bold text-slate-800">{scoreModal.data.objectiveScore ?? 0} 分</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">主观题得分</span>
                      <span className="font-bold text-slate-800">{scoreModal.data.subjectiveScore ?? 0} 分</span>
                    </div>
                    {(scoreModal.data.submitTime || scoreModal.data.endTime) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">交卷时间</span>
                        <span className="font-medium text-slate-600">{new Date(scoreModal.data.submitTime || scoreModal.data.endTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-3 opacity-30">error</span>
                  <p className="text-sm font-medium">暂无成绩数据</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setScoreModal({ open: false, examId: null, examTitle: '', loading: false, data: null })} className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-[0.98]">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}