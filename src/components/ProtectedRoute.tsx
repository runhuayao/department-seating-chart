import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'super_admin' | 'department_admin' | 'user';
  allowedRoles?: ('admin' | 'super_admin' | 'department_admin' | 'user')[];
  requireDepartmentAccess?: number; // 需要访问的部门ID
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  allowedRoles,
  requireDepartmentAccess
}) => {
  const { isAuthenticated, user, isLoading, hasRole, canAccessDepartment } = useAuth();
  const location = useLocation();

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 检查角色权限
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">权限不足</h2>
          <p className="text-gray-600 mb-4">
            您需要 {requiredRole} 权限才能访问此页面
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  // 检查允许的角色列表
  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">权限不足</h2>
          <p className="text-gray-600 mb-4">
            您的角色 ({user?.role}) 无权访问此页面
          </p>
          <p className="text-sm text-gray-500 mb-4">
            允许的角色: {allowedRoles.join(', ')}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  // 检查部门访问权限
  if (requireDepartmentAccess && !canAccessDepartment(requireDepartmentAccess)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">部门访问权限不足</h2>
          <p className="text-gray-600 mb-4">
            您无权访问此部门的数据
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// 超级管理员专用路由保护
export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute requiredRole="super_admin">
      {children}
    </ProtectedRoute>
  );
};

// 管理员专用路由保护（包括超级管理员和普通管理员）
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
      {children}
    </ProtectedRoute>
  );
};

// 部门管理员及以上权限路由保护
export const DepartmentAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'department_admin']}>
      {children}
    </ProtectedRoute>
  );
};

// 部门访问权限路由保护
export const DepartmentRoute: React.FC<{ 
  children: React.ReactNode; 
  departmentId: number; 
}> = ({ children, departmentId }) => {
  return (
    <ProtectedRoute requireDepartmentAccess={departmentId}>
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;