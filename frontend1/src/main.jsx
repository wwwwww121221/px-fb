import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 引入全局样式 (确保你的 Tailwind 基础指令 @tailwind base; 等写在这个文件里)
import './assets/styles/global.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);