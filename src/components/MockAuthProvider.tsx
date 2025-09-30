import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface MockAuthContextType {
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

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

export const useMockAuth = () => {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
};

interface MockAuthProviderProps {
  children: ReactNode;
}

// 模拟用户数据
const MOCK_USERS = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@company.com',
    role: 'admin' as const,
    departmentId: 1,
    employee_id: 1001,
    employee_name: '系统管理员',
    created_at: new Date().toISOString()
  },
  user: {
    id: 2,
    username: 'user',
    email: 'user@company.com',
    role: 'user' as const,
    departmentId: 2,
    employee_id: 2001,
    employee_name: '普通用户',
    created_at: new Date().toISOString()
  }
};

export const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 模拟登录功能
  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // 验证用户名和密码
      if (username === 'admin' && password === '123456') {
        const mockUser = MOCK_USERS.admin;
        const mockToken = `mock-token-${Date.now()}`;
        
        setUser(mockUser);
        setToken(mockToken);
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        
        console.log('模拟登录成功:', mockUser);
        return true;
      } else if (username === 'user' && password === '123456') {
        const mockUser = MOCK_USERS.user;
        const mockToken = `mock-token-${Date.now()}`;
        
        setUser(mockUser);
        setToken(mockToken);
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        
        console.log('模拟登录成功:', mockUser);
        return true;
      } else {
        console.log('登录失败: 用户名或密码错误');
        return false;
      }
    } catch (error) {
      console.error('登录过程中发生错误:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    console.log('用户已登出');
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

  const value: MockAuthContextType = {
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
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
};

export default MockAuthProvider;