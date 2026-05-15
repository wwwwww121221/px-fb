// 部门管理 (增删改查、树形列表)接口
// src/api/department.js
import request from './request';

/**
 * 获取部门树状列表
 */
export const getDepartmentTree = () => {
  return request.get('/department/tree'); 
};

/**
 * 新增部门
 * @param {Object} data - { parentId: 0, name: "开发部", sort: 1 }
 */
export const createDepartment = (data) => {
  return request.post('/department/create', data);
};

/**
 * 修改部门
 * @param {Object} data - { id: 1, parentId: 0, name: "开发部", sort: 1 }
 */
export const updateDepartment = (data) => {
  return request.put('/department/update', data);
};

/**
 * 删除部门
 * @param {Number|String} id - 部门 ID
 */
export const deleteDepartment = (id) => {
  return request.delete(`/department/delete/${id}`);
};