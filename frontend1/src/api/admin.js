// src/api/admin.js
import request from './request';

// 获取后台管理员当前信息
export const getAdminUserInfo = () => {
  return request.get('/backend/user/info');
};


// 🌟 管理员注销登录
export const adminLogout = () => {
  return request.delete('/backend/logout');
};
// 获取后台课程列表 (用于 Dashboard 表格)
export const getAdminCourseList = (params) => {
  return request.get('/backend/course/list', { params });
};

// 🌟 新增：获取学员/用户列表
export const getAdminUserList = (params) => {
  // 假设这是一个 GET 请求，参数通过 url 传递 (如 ?current=1&size=10)
  return request.get('/backend/user/list', { params });
};  

// 🌟 新增：更新学员信息
export const updateAdminUser = (data) => {
  return request.put('/backend/user/update', data);
};

// 🌟 新增：创建学员信息
export const createAdminUser = (data) => {
  return request.post('/backend/user/create', data);
};

// 🌟 新增：删除学员信息 (通过 URL 路径传递 ID)
export const deleteAdminUser = (id) => {
  return request.delete(`/backend/user/delete/${id}`);
};

// 🌟 新增：获取部门树状图
export const getDepartmentTree = () => {
  return request.get('/backend/department/tree');
};

// 🌟 新增：获取控制台概览数据
export const getDashboardOverview = () => {
  return request.get('/backend/dashboard/overview');
};

