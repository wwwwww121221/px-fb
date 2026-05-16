import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStudentInfo, 
  getStudentMyCourses, 
  getStudentCourseList,
  enrollCourse, 
  checkCourseCompletion 
} from '../../../api/student'; 

export default function StudentDashboard() {
  const navigate = useNavigate();

  const isCourseCompleted = (course) => {
    return Boolean(course?.hasFinalExam && course?.passedFinalExam && course?.hasCertificate);
  };
  
  // 状态栏管理：'explore' 选课大厅 | 'my' 我的课程 | 'learning' 学习中 | 'completed' 已学完
  const [activeTab, setActiveTab] = useState('explore'); 
  
  const [userInfo, setUserInfo] = useState(null); 
  const [stats, setStats] = useState({ total: 0, learning: 0, completed: 0 });
  
  const [myCourses, setMyCourses] = useState([]); 
  const [exploreCourses, setExploreCourses] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false); 

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [infoRes, myRes, allRes] = await Promise.all([
        getStudentInfo().catch(() => null),
        getStudentMyCourses().catch(() => null),
        getStudentCourseList().catch(() => null)
      ]);

      if (infoRes) setUserInfo(infoRes?.data || infoRes);

      let enrolledIds = []; 
      
      // 1. 处理"我的课程"数据
      if (myRes) {
        // 兼容带分页或不带分页的数据结构
        const list = Array.isArray(myRes) ? myRes : (myRes?.data?.records || myRes?.records || myRes?.data || []);
        
        // 🌟 对每个课程获取真实进度
        const formattedMyProgress = await Promise.all(list.map(async (c) => {
          let progress = c.learningStatus || 0;
          // 尝试获取真实进度（拦截器已解包data，直接用progressRes）
          try {
            const pData = await checkCourseCompletion(c.courseId || c.id);
            console.log(`📊 课程 "${c.name}" 进度数据:`, pData);
            if (pData && typeof pData === 'object') {
              if (pData.totalHours && pData.finishedHours !== undefined) {
                progress = Math.round((pData.finishedHours / pData.totalHours) * 100);
                console.log(`📊 课程 "${c.name}" 计算进度:`, progress);
              }
            }
          } catch (e) {
            console.warn('获取课程进度失败:', c.name || c.title, e);
          }
          
          return {
            id: c.courseId || c.id,
            name: c.name || c.title || '未命名课程',
            title: c.name || c.title || '未命名课程',
            isRequired: c.isRequired,
            category: c.isRequired === 1 ? '必修课' : '选修课',
            cover: c.thumb || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800',
            progress: progress,
            totalLessons: c.creditHours || 0,
            hasFinalExam: Boolean(c.hasFinalExam),
            passedFinalExam: Boolean(c.passedFinalExam),
            hasCertificate: Boolean(c.hasCertificate)
          };
        })).then((courses) => courses.map((course) => ({
          ...course,
          status: isCourseCompleted(course) ? 'completed' : 'learning'
        })));
        
        console.log('📚 我的课程（含进度）:', formattedMyProgress);
        setMyCourses(formattedMyProgress);
        enrolledIds = formattedMyProgress.map(c => c.id);
        
        // 🌟 根据课程列表计算统计数据
        const total = formattedMyProgress.length;
        const completed = formattedMyProgress.filter((c) => c.status === 'completed').length;
        const learning = total - completed;
        setStats({ total, learning, completed });
      }

      // 2. 处理“选课大厅”数据
      if (allRes) {
        const list = Array.isArray(allRes) ? allRes : (allRes?.data?.records || allRes?.records || allRes?.data || []);
        const formattedAll = list.map(c => ({
          // 🌟 核心修复 2：同样做兼容处理
          id: c.id || c.courseId, 
          title: c.title || c.name || '未命名课程',
          isRequired: c.isRequired, 
          category: c.isRequired === 1 ? '必修课' : '选修课', 
          cover: c.thumb || 'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
          totalLessons: c.creditHours || 0,
        }));
        
        setExploreCourses(formattedAll.filter(c => !enrolledIds.includes(c.id)));
      }
    } catch (error) {
      console.error('获取学员大厅数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleEnroll = async (courseId) => {
    setEnrolling(true);
    try {
      await enrollCourse(courseId);
      alert('🎉 选课成功！已加入您的【我的课程】列表。');
      await fetchDashboardData(); 
      setActiveTab('my'); 
    } catch (error) {
      alert('选课失败：' + (error.message || '未知错误'));
    } finally {
      setEnrolling(false);
    }
  };

  let displayCourses = [];
  if (activeTab === 'explore') displayCourses = exploreCourses;
  else if (activeTab === 'my') displayCourses = myCourses;
  else if (activeTab === 'learning') displayCourses = myCourses.filter(c => c.status === 'learning');
  else if (activeTab === 'completed') displayCourses = myCourses.filter(c => c.status === 'completed');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 头部信息与数据看板 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-100 border-4 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userInfo?.account || 'student'}`} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              {userInfo ? `${userInfo.name} 的学习大厅` : '我的学习大厅'}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              {userInfo?.deptName ? (
                <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-100">
                  {userInfo.deptName}
                </span>
              ) : null}
              {userInfo?.jobRole && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">work</span>
                  {userInfo.jobRole}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-8 relative z-10 bg-slate-50 px-6 py-4 rounded-xl border border-slate-100">
          <div className="text-center">
            <div className="text-2xl font-black text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">总课程数</div>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div className="text-center">
            <div className="text-2xl font-black text-blue-600">{stats.learning}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">学习中</div>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-500">{stats.completed}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">已完成</div>
          </div>
        </div>
      </div>

      {/* Tab 选项卡 */}
      <div className="flex border-b border-slate-200 gap-2">
        <button onClick={() => setActiveTab('explore')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'explore' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">travel_explore</span> 选课大厅</span>
        </button>
        <button onClick={() => setActiveTab('my')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'my' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          我的课程 ({myCourses.length})
        </button>
        <button onClick={() => setActiveTab('learning')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'learning' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          学习中
        </button>
        <button onClick={() => setActiveTab('completed')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'completed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          已学完
        </button>
      </div>

      {/* 课程列表区 */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">正在加载课程数据...</div>
      ) : displayCourses.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined text-4xl text-slate-300">menu_book</span></div>
          <h3 className="text-slate-600 font-bold text-lg">暂无相关课程</h3>
          <p className="text-slate-400 text-sm mt-1">
            {activeTab === 'explore' ? '管理员暂未发布新课程，或您已将所有课程加入学习。' : '当前列表空空如也，快去【选课大厅】挑几门课吧！'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayCourses.map(course => (
            <div key={course.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-100">
                <img src={course.cover} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                
                {course.status === 'completed' && (
                  <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> 已完成
                  </div>
                )}
                
                <div className={`absolute bottom-2 left-2 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded ${course.isRequired === 1 ? 'bg-red-500/80 shadow-sm' : 'bg-black/60'}`}>
                  {course.category}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2 mb-4 group-hover:text-blue-600 transition-colors">{course.name || course.title || '未命名课程'}</h3>
                
                {activeTab !== 'explore' && (
                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs font-medium text-slate-500">学习进度</span>
                      <span className={`text-xs font-bold ${course.progress === 100 ? 'text-emerald-500' : 'text-blue-600'}`}>{course.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${course.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${course.progress}%` }}></div>
                    </div>
                  </div>
                )}

                <div className={`flex justify-between text-xs text-slate-400 ${activeTab === 'explore' ? 'mt-auto' : ''}`}>
                  <span>学时: {course.totalLessons}</span>
                  {activeTab !== 'explore' && course.lastLearned ? <span>上次学习: {course.lastLearned}</span> : null}
                </div>
              </div>

              <div className="p-4 border-t border-slate-50">
                {activeTab === 'explore' ? (
                  <button 
                    onClick={() => handleEnroll(course.id)} 
                    disabled={enrolling}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    {enrolling ? '处理中...' : '加入学习'}
                  </button>
                ) : (
                  // 🌟 这里点击之后，终于可以带着正确的 courseId 跳过去啦！
                  <button 
                    onClick={() => navigate(`/student/learning/${course.id}`)} 
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${course.status === 'completed' ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{course.status === 'completed' ? 'replay' : 'play_circle'}</span>
                    {course.status === 'completed' ? '重新学习' : (course.progress > 0 ? '继续学习' : '开始学习')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
