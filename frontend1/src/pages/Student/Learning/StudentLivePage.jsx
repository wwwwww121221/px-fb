// src/pages/Student/Learning/StudentLivePage.jsx
// 学员直播全屏观看页面
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentCourseDetail } from '../../../api/student';
import StudentLiveRoom from './StudentLiveRoom';

export default function StudentLivePage() {
  const { hourId } = useParams();
  const navigate = useNavigate();
  
  const [hourData, setHourData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHourData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 由于我们不知道这个 hourId 属于哪个课程，需要先获取课程详情
        // 这里假设前端可以通过某种方式获取课程信息
        // 更好的方案是后端提供一个直接根据 hourId 获取课时信息的接口
        
        // 暂时：尝试从 localStorage 或 URL 参数获取 courseId
        const courseId = localStorage.getItem('currentCourseId');
        
        if (!courseId) {
          throw new Error('无法确定课程ID，请从课程页面进入直播');
        }

        const courseData = await getStudentCourseDetail(courseId);
        
        // 在课程章节中查找对应的课时
        let targetHour = null;
        const chapters = courseData?.chapters || [];
        
        for (const chapter of chapters) {
          const lessons = chapter.lessons || chapter.hours || [];
          targetHour = lessons.find(lesson => 
            String(lesson.id) === String(hourId) || 
            lesson.id === Number(hourId)
          );
          if (targetHour) break;
        }

        if (!targetHour) {
          throw new Error('未找到对应的课时信息');
        }

        setHourData(targetHour);
        setLoading(false);

      } catch (err) {
        console.error('❌ 获取课时信息失败:', err);
        setError(err.message || '获取课时信息失败');
        setLoading(false);
      }
    };

    if (hourId) {
      fetchHourData();
    }
  }, [hourId]);

  // 加载中
  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-4">sync</span>
        <span className="text-slate-400">正在加载直播...</span>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error</span>
        <p className="text-red-400 mb-6">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回上一页
        </button>
      </div>
    );
  }

  // 正常渲染直播/回放组件
  return (
    <div className="h-screen w-screen overflow-hidden">
      <StudentLiveRoom hourData={hourData} />
    </div>
  );
}
