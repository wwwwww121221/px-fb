import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 当我们在前端请求以 /api 开头的地址时，Vite 会拦截并代理
      '/api': {
        target: 'http://192.168.60.155:8082',
        changeOrigin: true, // 开启跨域
        rewrite: (path) => path.replace(/^\/api/, ''), // 转发给后端时，去掉前缀 /api
        
        // 🌟 核心修复 2：彻底放开代理层面的超时限制 (30分钟 = 1800000ms)
        // 专门为大视频文件续命，防止传到一半被 Vite 掐断！
        timeout: 1800000,
        proxyTimeout: 1800000,
      }
    }
  }
})