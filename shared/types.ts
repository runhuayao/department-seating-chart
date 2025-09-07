// 共享类型定义文件
// 用于前后端数据结构统一

// 工作站信息接口
export interface Workstation {
  id: string;
  name: string;
  ipAddress: string;
  macAddress?: string;
  location: {
    floor: number;
    room: string;
    position: {
      x: number;
      y: number;
    };
  };
  department: string;
  status: 'online' | 'offline' | 'maintenance';
  specifications: {
    cpu: string;
    memory: string;
    storage: string;
    os: string;
  };
  assignedUser?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// 员工信息接口
export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  workstationId?: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'on_leave';
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 部门信息接口
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  parentDepartmentId?: string;
  location: {
    building: string;
    floor: number;
    area: string;
  };
  workstationCount: number;
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 用户账户接口
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'manager' | 'user';
  employeeId?: string;
  permissions: string[];
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 审计日志接口
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

// 分页查询接口
export interface PaginationQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// 分页响应接口
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 搜索结果接口
export interface SearchResult {
  employees: Employee[];
  workstations: Workstation[];
  total: number;
}

// 数据库连接状态接口
export interface DatabaseStatus {
  connected: boolean;
  tables: number;
  totalRecords: number;
  lastSync: string;
  health: 'healthy' | 'warning' | 'error';
}

// 服务器状态接口
export interface ServerStatus {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    upload: number;
    download: number;
  };
  uptime: number;
  processes: number;
}

// 权限常量
export const PERMISSIONS = {
  // 工作站权限
  WORKSTATION_VIEW: 'workstation:view',
  WORKSTATION_CREATE: 'workstation:create',
  WORKSTATION_UPDATE: 'workstation:update',
  WORKSTATION_DELETE: 'workstation:delete',
  
  // 员工权限
  EMPLOYEE_VIEW: 'employee:view',
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_UPDATE: 'employee:update',
  EMPLOYEE_DELETE: 'employee:delete',
  
  // 部门权限
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_CREATE: 'department:create',
  DEPARTMENT_UPDATE: 'department:update',
  DEPARTMENT_DELETE: 'department:delete',
  
  // 用户权限
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // 系统权限
  SYSTEM_ADMIN: 'system:admin',
  AUDIT_VIEW: 'audit:view'
} as const;

// 角色权限映射
export const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.WORKSTATION_VIEW,
    PERMISSIONS.WORKSTATION_CREATE,
    PERMISSIONS.WORKSTATION_UPDATE,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_UPDATE,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.AUDIT_VIEW
  ],
  user: [
    PERMISSIONS.WORKSTATION_VIEW,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.DEPARTMENT_VIEW
  ]
} as const;