import request from './request';

// ==========================================
// 前台学员端 - 登录与认证 API
// ==========================================

export const studentLogin = (data) => {
  return request.post('/frontend/login', data);
};

export const studentLogout = () => {
  return request.delete('/frontend/logout');
};

export const getStudentInfo = () => {
  return request.get('/frontend/user/info');
};

export const updateStudentPassword = (data) => {
  return request.put('/frontend/user/update-password', data);
};

// ==========================================
// 前台学员端 - 数据大盘 & 课程 API
// ==========================================

// 🌟 新增：获取学员学习进度统计
export const getStudentProgressStats = () => {
  return request.get('/frontend/dashboard/progress-stats');
};

// 🌟 获取已发布的课程列表
export const getStudentCourseList = () => {
  return request.get('/frontend/course/list');
};

// 🌟 获取课程详细信息 (包含章节目录)
export const getStudentCourseDetail = (id) => {
  return request.get(`/frontend/course/detail/${id}`);
};

// 🌟 获取单课时详细信息 (包含视频资源URL)
export const getStudentHourDetail = (hourId) => {
  return request.get(`/frontend/course/hour/${hourId}`);
};

// 🌟 获取学员已选/在学的课程列表 (我的课程 - 无参数版)
export const getStudentMyCourses = () => {
  return request.get('/frontend/course/my-courses');
};

// 🌟 获取学员已选/在学的课程列表 (我的课程 - 支持分页传参，供考试大厅使用)
export const getMyCourses = (params) => {
  return request.get('/frontend/course/my-courses', { params });
};

// 🌟 学员选课 (加入学习)
export const enrollCourse = (courseId) => {
  return request.post(`/frontend/course/enroll/${courseId}`);
};

// 🌟 获取当前课程完成度
export const checkCourseCompletion = (courseId) => {
  return request.get(`/frontend/progress/check-completion/${courseId}`);
};

// 🌟 获取视频观看历史进度（用于断点续播）
export const getProgressRecord = (courseId, resourceId) => {
  return request.get(`/frontend/progress/record/${courseId}/${resourceId}`);
};

// 🌟 上报学习进度（用于伪造进度：点击下载时自动拉满）
export const reportProgress = (data) => {
  return request.put('/frontend/progress/report', data);
};

// ==========================================
// 前台学员端 - 证书与作业 API
// ==========================================

// 🌟 获取我的证书列表
export const getStudentCertificates = () => {
  return request.get('/frontend/certificates/my');
};

// 🌟 获取全平台证书公示名单
export const getPublicCertificates = () => {
  return request.get('/frontend/certificates/public');
};

// 🌟 申请纸质证书邮寄
export const requestPaperCertificate = (id, data) => {
  return request.post(`/frontend/certificates/${id}/requests`, data);
};

export const getCourseAssignments = (courseId) => {
  return request.get(`/frontend/assignment/list/${courseId}`);
};

// 🌟 提交课程作业
export const submitAssignment = (data) => {
  return request.put('/frontend/assignment/submit', data);
};

// ==========================================
// 前台学员端 - 在线考试 API
// ==========================================

// 🌟 0. 获取指定课程下的所有考试安排 (考试大厅点击左侧课程时触发)
export const getCourseExams = (courseId) => {
  return request.get(`/frontend/user-exams/course/${courseId}`);
};

// 🌟 0.5 查询学员对某场考试的答题状态（用于卡片状态展示）
export const getMyExamStatus = (examId) => {
  return request.get(`/frontend/user-exams/status/${examId}`);
};

// 🌟 0.6 查询学员某次考试的最终成绩结果
export const getExamResult = (userExamId) => {
  return request.get(`/frontend/user-exams/${userExamId}/result`);
};

// 🌟 1. 学员开始考试 (领卷)
export const startUserExam = (data) => {
  return request.post('/frontend/user-exams', data);
};

// 🌟 2. 获取试卷题目 (发卷)
export const getUserExamQuestions = (userExamId) => {
  return request.get(`/frontend/user-exams/${userExamId}/questions`);
};

// 🌟 3. 学员交卷
export const submitUserExam = (userExamId, answersData) => {
  return request.post(`/frontend/user-exams/${userExamId}/submit`, answersData);
};