import request from './request';

// ==========================================
// 1. 后台 - 管理员管理 API
// ==========================================
export const getAdminUserList = (params) => request.get('/admin-user/list', { params });
export const createAdminUser = (data) => request.post('/admin-user/create', data);
export const updateAdminUser = (data) => request.put('/admin-user/update', data);
export const deleteAdminUser = (id) => request.delete(`/admin-user/delete/${id}`);

// ==========================================
// 2. 后台 - 角色管理 API
// ==========================================
export const getAdminRoleList = (params) => request.get('/admin-role/list', { params });
export const createAdminRole = (data) => request.post('/admin-role/create', data);
export const updateAdminRole = (data) => request.put('/admin-role/update', data);
export const deleteAdminRole = (id) => request.delete(`/admin-role/delete/${id}`);

// ==========================================
// 3. 后台 - 权限与菜单分配 API (已对齐最新路径)
// ==========================================
// 获取系统全部权限菜单树
export const getAdminMenuTree = () => request.get('/admin-menu/tree');

// 获取某角色已分配的权限 ID 集合
export const getRoleMenus = (roleId) => request.get(`/admin-role/${roleId}/menus`);

// 为角色分配/更新权限 (Body 传入 menuIds 数组)
export const assignRoleMenus = (roleId, menuIds) => request.put(`/admin-role/${roleId}/menus`, menuIds);