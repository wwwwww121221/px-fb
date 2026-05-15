import request from './request';

// ==========================================
// 1. 素材分类管理 API
// ==========================================
export const getResourceCategoryTree = () => request.get('/resource-category/tree');
export const createResourceCategory = (data) => request.post('/resource-category/create', data);
export const updateResourceCategory = (data) => request.put('/resource-category/update', data);
export const deleteResourceCategory = (id) => request.delete(`/resource-category/delete/${id}`);

// ==========================================
// 2. 素材资源管理 API
// ==========================================
export const getResourceList = (params) => request.get('/resource/list', { params });
export const renameResource = (data) => request.put('/resource/rename', data);
export const deleteResource = (id) => request.delete(`/resource/delete/${id}`);
export const moveResource = (data) => request.put('/resource/move', data);

// ==========================================
// 3. 文件上传 API (🌟 终极原生 XHR 重构版)
// ==========================================
export const uploadResource = (file, onUploadProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file); // 确保字段名为 'file'，与后端一致
    
    // 抓取本地 Token
    const token = localStorage.getItem('token') || localStorage.getItem('satoken');
    const tokenName = localStorage.getItem('tokenName') || 'satoken';
    
    // 🌟 启用原生 XMLHttpRequest，彻底抛弃 Axios 的请求头干扰
    const xhr = new XMLHttpRequest();
    // 拼接 /api 前缀，让 vite proxy 继续正常拦截转发
    // 素材上传使用 /upload/course 路径
    xhr.open('POST', '/api/upload/course', true);
    
    // 手动附带鉴权信息
    if (token) {
      xhr.setRequestHeader(tokenName, token);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    // ⚠️ 绝不手动设置 Content-Type，浏览器引擎会自动识别 FormData 并附带正确的 boundary！

    // 监听上传实时进度
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onUploadProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onUploadProgress(percent);
      }
    };

    // 监听后端响应
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          // 模拟 Axios 的响应拦截器逻辑
          if (res.code === 200 || res.code === 0) {
            resolve(res.data || res); 
          } else {
            reject(new Error(res.msg || '上传失败'));
          }
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        console.error('上传被后端拒绝，状态码:', xhr.status, '响应信息:', xhr.responseText);
        reject(new Error(`上传请求被拒绝 (状态码: ${xhr.status})`));
      }
    };

    // 监听网络中断错误
    xhr.onerror = () => {
      reject(new Error('网络断开或服务器无响应，上传失败'));
    };

    // 执行发送
    xhr.send(formData);
  });
};