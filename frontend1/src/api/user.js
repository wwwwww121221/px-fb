import request from './request';

// ==========================================
// 1. 后台 - 学员信息管理 API (对应 /backend/user)
// ==========================================

// 获取学员分页列表
export const getUserList = (params) => {
  return request.get('/backend/user/list', { params });
};

// 新增学员
export const createUser = (data) => {
  return request.post('/backend/user/create', data);
};

// 修改学员信息 (包含部门 departmentId)
export const updateUser = (data) => {
  return request.put('/backend/user/update', data);
};

// 删除学员
export const deleteUser = (id) => {
  return request.delete(`/backend/user/delete/${id}`);
};

// ==========================================
// 2. 后台 - 部门组织管理 API (保留原来的部门树接口)
// ==========================================
export const getDepartmentTree = () => {
  return request.get('/department/tree');
};