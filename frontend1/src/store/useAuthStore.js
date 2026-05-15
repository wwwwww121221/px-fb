import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      tokenName: 'satoken', // 新增：保存 Sa-Token 的 header name
      userInfo: null,
      role: null,

      // 增加 tokenName 参数
      setAuth: (token, tokenName, userInfo, role) => set({ token, tokenName, userInfo, role }),
      
      logout: () => set({ token: null, tokenName: 'satoken', userInfo: null, role: null }),
      
      updateUserInfo: (info) => set((state) => ({ userInfo: { ...state.userInfo, ...info } })),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;  