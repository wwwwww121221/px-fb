import request from './request';

// ==========================================
// 1. 后台-课程建设管理 API
// ==========================================
export const getCourseList = (params) => request.get('/backend/course/list', { params });
export const getCourseDetail = (id) => request.get(`/backend/course/detail/${id}`);
export const createCourse = (data) => request.post('/backend/course/add', data);
export const updateCourse = (data) => request.put('/backend/course/update', data);
export const deleteCourse = (id) => request.delete(`/backend/course/delete/${id}`);
export const updateCourseStatus = (data) => request.put('/backend/course/update', data); // 暂用 update 替代 status

// ==========================================
// 2. 课程分类管理 API
// ==========================================
export const getCourseCategoryTree = () => request.get('/course/category/tree');
export const createCourseCategory = (data) => request.post('/course/category', data);
export const updateCourseCategory = (data) => request.put('/course/category', data);
export const deleteCourseCategory = (id) => request.delete(`/course/category/${id}`);

// ==========================================
// 3. 🌟 后台-课程章节管理 API (根据 api-docs.json 新增)
// ==========================================
export const getCourseChapterList = (courseId) => request.get('/course/chapter/list', { params: { courseId } });
export const createCourseChapter = (data) => request.post('/course/chapter', data);
export const updateCourseChapter = (data) => request.put('/course/chapter', data);
export const deleteCourseChapter = (id) => request.delete(`/course/chapter/${id}`);

// ==========================================
// 4. 🌟 后台-课程课时管理 API (根据 api-docs.json 新增)
// ==========================================
export const getCourseHourList = (chapterId) => request.get('/course/hour/list', { params: { chapterId } });
export const getCourseHourDetail = (id) => request.get(`/course/hour/${id}`);
export const createCourseHour = (data) => request.post('/course/hour', data);
export const updateCourseHour = (data) => request.put('/course/hour', data);
export const deleteCourseHour = (id) => request.delete(`/course/hour/${id}`);

// 🌟 为课程的特定课时绑定素材资源
export const bindCourseResources = (courseId, data) => {
  return request.post(`/backend/course/${courseId}/bind-resources`, data);
};

// 🌟 获取该课程绑定的所有素材资源列表
export const getCourseResources = (courseId) => {
  return request.get(`/backend/course/${courseId}/resources`);
};


// 🌟 解除课程/课时绑定的素材
export const unbindCourseResource = (courseId, resourceId) => {
  return request.delete(`/backend/course/${courseId}/resources/${resourceId}`);
};


// 🌟 发布课程作业 (全局作业)
export const publishAssignment = (data) => {
  return request.post('/backend/assignment/publish', data);
};

// 🌟 获取课程作业列表
export const getAssignmentList = (courseId) => {
  return request.get(`/backend/assignment/list/${courseId}`);
};

// 🌟 获取作业的学员提交列表
export const getAssignmentSubmissions = (assignmentId) => {
  return request.get(`/backend/assignment/${assignmentId}/submissions`);
};

// 🌟 批改学生提交的作业
export const gradeAssignmentSubmission = (data) => {
  return request.put('/backend/assignment/grade', data);
};

// 🌟 获取题库列表 (带分页和条件筛选)
export const getQuestionList = (params) => {
  return request.get('/backend/questions', { params });
};

// 🌟 编辑/修改题目 (注意：id 在 URL 路径中，具体数据在 body 中)
export const updateQuestion = (id, data) => {
  return request.put(`/backend/questions/${id}`, data);
};

// 🌟 删除题目
export const deleteQuestion = (id) => {
  return request.delete(`/backend/questions/${id}`);
};

// 🌟 创建新题目
export const createQuestion = (data) => {
  return request.post('/backend/questions', data);
};

// ==========================================
// 🌟 通用文件上传函数 (使用原生 XHR，支持进度回调和模块标识)
// ==========================================
export const uploadFile = (file, moduleName = 'course', onUploadProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token') || localStorage.getItem('satoken');
    const tokenName = localStorage.getItem('tokenName') || 'satoken';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload/${moduleName}`, true);

    if (token) {
      xhr.setRequestHeader(tokenName, token);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onUploadProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.code === 200 || res.code === 0) {
            resolve(res.data || res);
          } else {
            reject(new Error(res.msg || '上传失败'));
          }
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`上传失败 (状态码: ${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('网络断开或服务器无响应'));
    };

    xhr.send(formData);
  });
};

// 🌟 AI 一键出卷 (包含文件上传和 Query 参数)
export const aiGenerateExam = (courseId, title, jobRoleTag, questionConfig, file) => {
  const formData = new FormData();
  formData.append('file', file); // 放入文件实体
  
  return request.post('/backend/exams/ai-generate', formData, {
    params: { 
      courseId, 
      title, 
      jobRoleTag, 
      questionConfig 
    },
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};


// 🌟 1. 创建考试空壳
export const createExam = (data) => {
  return request.post('/backend/exams', data);
};

export const autoGenerateExam = (id, config) => {
  return request.post(`/backend/exams/${id}/auto-generate`, config);
};

// 🌟 3. 手动绑定试卷题目
export const bindExamQuestions = (id, questionIds) => {
  return request.post(`/backend/exams/${id}/bind-questions`, questionIds);
};

// 🌟 获取考试列表 (用于通过 courseId 过滤出真实的考试 ID)
export const getExamList = (params) => {
  return request.get('/backend/exams', { params });
};

// 🌟 获取考试详情 (传入真实的 examId)
export const getExamDetail = (id) => {
  return request.get(`/backend/exams/${id}`);
};

// 🌟 修改考试配置
export const updateExam = (id, data) => {
  return request.put(`/backend/exams/${id}`, data);
};

// 🌟 删除考试
export const deleteExam = (id) => {
  return request.delete(`/backend/exams/${id}`);
};

// 🌟 获取指定考试下的所有题目 (预览试卷)
export const getExamQuestions = (examId) => {
  return request.get(`/backend/questions/exam/${examId}`);
};

// ==========================================
// 🌟 5. 课程成绩管理 API
// ==========================================

export const getCourseScoreList = (courseId) => {
  return request.get(`/backend/course/${courseId}/student-results`);
};

export const updateCourseWeights = (data) => {
  return request.put('/backend/course/update', data);
};

export const submitProcessScore = (data) => {
  return request.put('/backend/evaluation/score', data);
};

export const submitPracticalScore = (data) => {
  return request.put('/backend/practical-evaluation/score', data);
};

// 🌟 获取某场考试的所有学员成绩列表
export const getExamStudentResults = (examId) => {
  return request.get(`/backend/exams/${examId}/student-results`);
};