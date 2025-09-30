import { create } from 'zustand';

// 临时在此定义User接口以避免循环导入问题
interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium';
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthStore extends AuthState {
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialState,

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user 
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // TODO: 实现实际的登录逻辑
      // 这里暂时使用模拟数据
      const mockUser: User = {
        id: '1',
        email,
        name: email.split('@')[0],
        plan: 'free',
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        isLoading: false 
      });
      
      // 保存到localStorage
      localStorage.setItem('user', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      set({ isLoading: false });
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      // TODO: 实现实际的注册逻辑
      // 这里暂时使用模拟数据
      const mockUser: User = {
        id: Date.now().toString(),
        email,
        name,
        plan: 'free',
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      set({ 
        user: mockUser, 
        isAuthenticated: true, 
        isLoading: false 
      });
      
      // 保存到localStorage
      localStorage.setItem('user', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({ 
      user: null, 
      isAuthenticated: false, 
      isLoading: false 
    });
    localStorage.removeItem('user');
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        set({ 
          user, 
          isAuthenticated: true, 
          isLoading: false 
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ isLoading: false });
    }
  }
}));