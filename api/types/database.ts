/**
 * 数据库类型定义
 */

// 基础接口
export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

// 部门接口
export interface Department extends BaseEntity {
  name: string;
  description?: string;
  parent_id?: number;
  manager_id?: number;
  location?: string;
}

// 员工接口
export interface Employee extends BaseEntity {
  name: string;
  email: string;
  phone?: string;
  position: string;
  department_id: number;
  hire_date: string;
  status: 'active' | 'inactive' | 'terminated';
}

// 工位接口
export interface Desk extends BaseEntity {
  desk_number: string;
  department_id: number;
  floor: number;
  area: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  assigned_employee_id?: number;
  assigned_at?: string;
  ip_address?: string;
  computer_name?: string;
  equipment_info?: string;
}

// 用户接口
export interface User extends BaseEntity {
  username: string;
  password_hash: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  employee_id?: number;
  status: 'active' | 'inactive' | 'suspended';
  last_login_at?: string;
}

// 系统日志接口
export interface SystemLog {
  id: number;
  user_id?: number;
  action: string;
  resource_type: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// 工位分配接口
export interface DeskAssignment extends BaseEntity {
  desk_id: number;
  employee_id: number;
  assigned_by: number;
  assigned_at: string;
  released_at?: string;
  status: 'active' | 'released';
  notes?: string;
}

// 用户会话接口
export interface UserSession extends BaseEntity {
  user_id: number;
  token: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  status: 'active' | 'expired' | 'revoked';
}

// 扩展接口
export interface EmployeeWithDetails extends Employee {
  employee_id?: string;
  department?: {
    id: number;
    name: string;
    code?: string;
  };
  current_desk?: {
    id: number;
    desk_number: string;
  };
  user_account?: {
    username: string;
    role: string;
  };
}

export interface DeskWithDetails extends Desk {
  department?: {
    id: number;
    name: string;
  };
  assigned_employee?: {
    id: number;
    name: string;
    employee_id?: string;
  };
}

export interface DepartmentStats {
  department_id: number;
  department_name: string;
  total_desks: number;
  occupied_desks: number;
  available_desks: number;
  total_employees: number;
  occupancy_rate: number;
}

export interface SystemStats {
  total_departments: number;
  total_employees: number;
  total_desks: number;
  occupied_desks: number;
  available_desks: number;
  overall_occupancy_rate: number;
}

// 查询参数接口
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface SearchParams {
  keyword?: string;
  department_id?: number;
  status?: string;
  floor?: number;
  area?: string;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 工作站信息接口
export interface WorkstationInfo {
  id: number;
  desk_id: number;
  ip_address: string;
  computer_name: string;
  mac_address?: string;
  operating_system?: string;
  cpu_info?: string;
  memory_info?: string;
  disk_info?: string;
  network_info?: string;
  last_online_at?: string;
  status: 'online' | 'offline' | 'maintenance';
  created_at: string;
  updated_at: string;
}

// 同步记录接口
export interface SyncRecord {
  id: number;
  sync_type: 'full' | 'incremental';
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  record_id?: number;
  data?: any;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// 工位接口（别名）
export interface Workstation extends Desk {
  // Workstation是Desk的别名，用于兼容性
}

// 数据库状态接口
export interface DatabaseStatus {
  connected: boolean;
  health: 'healthy' | 'warning' | 'error';
  lastUpdated: string;
  totalRecords: number;
  version?: string;
  host?: string;
  database?: string;
}