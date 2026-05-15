import { createBrowserRouter, Navigate } from 'react-router-dom';

// --- 认证与登录 ---
import Login from '../pages/Auth/index.jsx'; 
import StudentLogin from '../pages/Student/Login/index.jsx'; 

// --- 学员端页面 ---
import StudentDashboard from '../pages/Student/Dashboard/index.jsx';
import StudentLearning from '../pages/Student/Learning/index.jsx';
import Assignments from '../pages/Student/Assignments/index.jsx';
import Certificates from '../pages/Student/Certificates/index.jsx';
// 🌟 引入学生端的考试大厅和沉浸式考场
import StudentExamsIndex from '../pages/Student/Exams/index.jsx';
import TakeExam from '../pages/Student/Exams/Take.jsx';

// --- 全局布局 Layouts ---
import AdminLayout from '../layouts/AdminLayout.jsx';
import StudentLayout from '../layouts/StudentLayout.jsx'; 

// --- 后台管理页面 ---
import Organization from '../pages/Admin/Organization/index.jsx'; 
import Dashboard from '../pages/Admin/Dashboard/index.jsx';
import CourseList from '../pages/Admin/Courses/List/index.jsx';
import QuestionBank from '../pages/Admin/Courses/List/Questions.jsx'; 
// 🌟 引入管理员端的考试管理
import ExamsManagement from '../pages/Admin/Courses/List/Exams.jsx';
import Resources from '../pages/Admin/Resources/index.jsx';
import SystemManagement from '../pages/Admin/System/index.jsx'; 
import Department from '../pages/Admin/System/Department.jsx';
import CourseCategory from '../pages/Admin/Courses/Category/index.jsx';
import CourseBuild from '../pages/Admin/Courses/Build/index.jsx';
import CourseScoreCenter from '../pages/Admin/Courses/ScoreCenter/index.jsx';
import CertificateSystem from '../pages/Admin/Certificates/System.jsx';

// 🌟 引入直播页面
import AdminLiveRoom from '../pages/Admin/LiveRoom/AdminLiveRoom.jsx';
import StudentLivePage from '../pages/Student/Learning/StudentLivePage.jsx';

// 🌟 引入学员评价页面（暂用兜底组件）

// 临时兜底组件
const FallbackPage = ({ title }) => (
  <div className="bg-white p-12 rounded-xl shadow-sm flex flex-col items-center justify-center min-h-[400px]">
    <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">construction</span>
    <h1 className="text-2xl text-slate-400 font-bold">{title}页面开发中...</h1>
  </div>
);

const router = createBrowserRouter([
  // 1. 默认访问根目录时，跳到统一登录页
  {
    path: '/',
    element: <Navigate to="/login" replace />, 
  },
  
  // 2. 统一登录路由
  {
    path: '/login',
    element: <Login />, 
  },

  // 3. 学员专属全屏登录页
  {
    path: '/student/login',
    element: <StudentLogin />
  },
  
  // ==========================================
  // 🌟 全屏/沉浸式 学员页面（不带侧边栏和顶栏）
  // ==========================================
  { 
    path: '/student/learning/:id', 
    element: <StudentLearning />
  },
  { 
    path: '/student/exams/take/:examId', 
    element: <TakeExam /> 
  },
  // 🌟 学员直播观看页面
  {
    path: '/student/live/:hourId',
    element: <StudentLivePage />
  },
  
  // 🌟 讲师直播页面（管理员全屏直播）
  {
    path: '/admin/live/:hourId',
    element: <AdminLiveRoom />
  },
  
  // ==========================================
  // 4. 学员端内部路由 (带 StudentLayout 侧边栏布局)
  // ==========================================
  {
    path: '/student',
    element: <StudentLayout />, 
    children: [
      { index: true, element: <Navigate to="/student/dashboard" replace /> },
      { path: 'dashboard', element: <StudentDashboard /> },
      { path: 'assignments', element: <Assignments /> },
      // ✅ 修复报错：使用 StudentExamsIndex 替换掉原来未定义的 Exams
      { path: 'exams', element: <StudentExamsIndex /> },
      { path: 'certificates', element: <Certificates /> },
    ]
  },

  // ==========================================
  // 5. 管理员后台路由组 (带 AdminLayout 侧边栏布局)
  // ==========================================
  {
    path: '/admin',
    element: <AdminLayout />, 
    children: [
      { index: true, element: <Navigate to="/admin/organization" replace /> },
      { path: 'dashboard', element: <Dashboard /> }, 
      { path: 'organization', element: <Organization /> }, 
      { path: 'department', element: <Department /> }, 
      
      // 课程列表与管理
      { path: 'courses', element: <CourseList /> },
      { path: 'courses/questions/:courseId', element: <QuestionBank /> },
      { path: 'courses/exams/:courseId', element: <ExamsManagement /> },
      { path: 'course-category', element: <CourseCategory /> },
      { path: 'courses/build/:id', element: <CourseBuild /> },
      { path: 'courses/score/:courseId', element: <CourseScoreCenter /> },
      { path: 'certificates', element: <CertificateSystem /> },
      
      { path: 'resources', element: <Resources /> },
      { path: 'system', element: <SystemManagement /> }, 
      { path: 'exams', element: <FallbackPage title="全局考试大厅" /> }, 
      { path: 'statistics', element: <FallbackPage title="数据统计" /> }, 
      { path: 'evaluation', element: <FallbackPage title="学员评价" /> }
    ]
  }
]);

export default router;