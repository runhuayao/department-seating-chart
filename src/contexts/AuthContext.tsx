import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../utils/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'super_admin' | 'department_admin' | 'user';
  departmentId: number;
  employee_id?: number;
  employee_name?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDepartmentAdmin: boolean;
  isLoading: boolean;
  hasRole: (roles: string[]) => boolean;
  canAccessDepartment: (departmentId: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从localStorage恢复认证状态
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        // 验证token是否仍然有效
        verifyToken(savedToken);
      } catch (error) {
        console.error('Failed to parse saved user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  // 监听认证过期事件
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await authAPI.verifyToken();
      if (response.success && response.data && response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      logout();
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login({ username, password });
      
      // 检查API响应格式
      if (response.success && response.data) {
        const { accessToken, user } = response.data;
        
        if (accessToken && user) {
          setUser(user);
          setToken(accessToken);
          localStorage.setItem('auth_token', accessToken);
          localStorage.setItem('auth_user', JSON.stringify(user));
          return true;
        } else {
          console.error('Login failed: Missing token or user in response data');
          return false;
        }
      } else {
        console.error('Login failed: Invalid response format', response);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const isAuthenticated = !!user && !!token;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isDepartmentAdmin = user?.role === 'department_admin' || isAdmin;

  // 权限检查函数
  const hasRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const canAccessDepartment = (departmentId: number): boolean => {
    if (!user) return false;
    if (isAdmin) return true; // 管理员可以访问所有部门
    return user.departmentId === departmentId;
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isDepartmentAdmin,
    isLoading,
    hasRole,
    canAccessDepartment,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};