/**
 * 数据库模型定义
 * 定义所有数据表的TypeScript接口
 */

/**
 * 部门信息接口
 */
export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  floor?: number;
  building?: string;
  manager_id?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 员工信息接口
 */
export interface Employee {
  id: number;
  employee_id: string; // 工号
  name: string;
  email: string;
  phone?: string;
  department_id: number;
  position?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'on_leave';
  hire_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 工位信息接口
 */
export interface Desk {
  id: number;
  desk_number: string;
  department_id: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  ip_address?: string;
  computer_name?: string;
  equipment_info?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 工位分配记录接口
 */
export interface DeskAssignment {
  id: number;
  desk_id: number;
  employee_id: number;
  assigned_at: string;
  released_at?: string;
  status: 'active' | 'inactive' | 'temporary';
  notes?: string;
  assigned_by?: number; // 分配人员ID
  created_at: string;
  updated_at: string;
}

/**
 * 用户账户接口（用于登录认证）
 */
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'manager' | 'user';
  employee_id?: number;
  last_login?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 工作站详细信息接口（扩展信息）
 */
export interface WorkstationInfo {
  id: number;
  desk_id: number;
  ip_address: string;
  mac_address?: string;
  computer_name: string;
  operating_system?: string;
  cpu_info?: string;
  memory_info?: string;
  disk_info?: string;
  network_info?: string;
  last_online?: string;
  status: 'online' | 'offline' | 'maintenance';
  created_at: string;
  updated_at: string;
}

/**
 * 系统日志接口
 */
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

/**
 * 数据同步记录接口
 */
export interface SyncRecord {
  id: number;
  sync_type: 'full' | 'incremental' | 'manual';
  table_name: string;
  records_affected: number;
  status: 'success' | 'failed' | 'partial';
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_by?: number;
}

/**
 * 权限配置接口
 */
export interface Permission {
  id: number;
  name: string;
  code: string;
  description?: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

/**
 * 角色权限关联接口
 */
export interface RolePermission {
  id: number;
  role: string;
  permission_id: number;
  created_at: string;
}

/**
 * 数据库查询结果包装接口
 */
export interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * 搜索参数接口
 */
export interface SearchParams {
  keyword?: string;
  department_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * 工位详细信息（包含关联数据）
 */
export interface DeskWithDetails extends Desk {
  department?: Department;
  assignment?: DeskAssignment;
  employee?: Employee;
  workstation?: WorkstationInfo;
}

/**
 * 员工详细信息（包含关联数据）
 */
export interface EmployeeWithDetails extends Employee {
  department?: Department;
  current_desk?: DeskWithDetails;
  user_account?: User;
}

/**
 * 部门统计信息接口
 */
export interface DepartmentStats {
  department_id: number;
  department_name: string;
  total_desks: number;
  occupied_desks: number;
  available_desks: number;
  total_employees: number;
  occupancy_rate: number;
}

/**
 * 系统统计信息接口
 */
export interface SystemStats {
  total_departments: number;
  total_employees: number;
  total_desks: number;
  total_assignments: number;
  occupancy_rate: number;
  online_workstations: number;
  last_sync_time?: string;
}