import request from './request';

// 前台学员登录
export const frontendLogin = (data) => {
  return request.post('/frontend/login', data);
};

// 后台管理员登录
export const backendLogin = (data) => {
  return request.post('/backend/login', data);
};

// 后台管理员注销
export const backendLogout = () => {
  return request.post('/backend/logout');
};

// 前台学员注销
export const frontendLogout = () => {
  return request.post('/frontend/logout');
};