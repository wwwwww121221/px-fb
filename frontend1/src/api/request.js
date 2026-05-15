import axios from 'axios';

const request = axios.create({
  baseURL: '/api', // 你的真实后端地址
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 🌟 核心修复 1：如果是上传文件 (FormData)，必须删掉全局的 application/json！
    // 让浏览器自己接管，自动生成带 boundary 的 multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // 绝不读内存，直接从浏览器的物理缓存中同步抓取，根除时间差！
    const token = localStorage.getItem('token') || localStorage.getItem('satoken');
    const tokenName = localStorage.getItem('tokenName') || 'satoken';
    
    if (token) {
      config.headers[tokenName] = token; 
      config.headers['Authorization'] = `Bearer ${token}`; // 双重保险防误拦
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data;
    // 成功状态
    if (res.code === 200 || res.code === 0) {
      return res.data; // 🌟 注意这里：成功时直接返回了内层的 data 对象
    } 
    
    // 应对 Sa-Token 的软拦截 (HTTP 状态码是 200，但业务 Code 是 401)
    if (res.code === 401) {
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(new Error(res.msg || '凭证失效，请重新登录'));
    }

    console.error('业务报错:', res.msg);
    return Promise.reject(new Error(res.msg || '操作失败'));
  },
  (error) => {
    // 应对标准的 HTTP 401 拦截
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default request;