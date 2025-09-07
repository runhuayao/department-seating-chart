// RBAC权限控制类型定义

export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // 系统角色不可删除
}

export interface Permission {
  id: string;
  name: string;
  resource: string; // 资源类型：server, user, system等
  action: string; // 操作类型：read, write, delete, execute等
  description: string;
}

// 预定义权限
export const PERMISSIONS = {
  // 服务器监控权限
  SERVER_READ: 'server:read',
  SERVER_MONITOR: 'server:monitor',
  SERVER_CONTROL: 'server:control',
  SERVER_CONFIG: 'server:config',
  
  // 用户管理权限
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // 系统管理权限
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup',
  
  // 角色权限管理
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete'
} as const;

// 预定义角色
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type RoleKey = keyof typeof ROLES;

// 权限检查结果
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

// 登录会话
export interface UserSession {
  user: User;
  token: string;
  expiresAt: Date;
  permissions: string[];
}