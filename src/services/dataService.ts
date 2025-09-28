/**
 * 数据服务 - 完全基于PostgreSQL API
 * 移除静态数据依赖，统一使用数据库数据源
 */

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// 数据接口类型定义
export interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  phone?: string;
  department_id: number;
  position?: string;
  status: 'online' | 'offline';
  hire_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  floor?: number;
  building?: string;
  created_at: string;
  updated_at: string;
}

export interface Workstation {
  id: string;
  name: string;
  ip_address?: string;
  mac_address?: string;
  location: {
    room?: string;
    seat?: string;
    floor?: number;
    position?: {
      x: number;
      y: number;
    };
    dimensions?: {
      width: number;
      height: number;
    };
  };
  department: string;
  status: 'available' | 'occupied' | 'maintenance';
  specifications?: any;
  assigned_user?: string;
  created_at: string;
  updated_at: string;
}

export interface MapConfig {
  id: number;
  department: string;
  map_id: string;
  type: string;
  url: string;
  dept_name: string;
  width?: number;
  height?: number;
  background_color?: string;
  border_color?: string;
  border_width?: number;
  border_radius?: number;
  created_at: string;
  updated_at: string;
}

// 统一的数据获取类
export class DataService {
  private static instance: DataService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  private constructor() {}
  
  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /**
   * 通用API请求方法
   */
  private async apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // 对于429错误，添加重试机制
        if (response.status === 429) {
          console.warn(`API请求被限流 [${endpoint}]，等待1秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          // 递归重试一次
          return this.apiRequest(endpoint, options);
        }
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API请求错误 [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * 缓存管理
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData<T>(key: string, data: T, ttl: number = 300000): void { // 默认5分钟缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 获取所有部门
   */
  async getDepartments(): Promise<Department[]> {
    const cacheKey = 'departments:all';
    const cached = this.getCachedData<Department[]>(cacheKey);
    if (cached) {
      console.log('📦 从缓存获取部门数据');
      return cached;
    }

    try {
      const response = await this.apiRequest<{ success: boolean; data: Department[] }>('/departments');
      if (response.success) {
        this.setCachedData(cacheKey, response.data);
        console.log(`✅ 从PostgreSQL获取到 ${response.data.length} 个部门`);
        return response.data;
      }
      throw new Error('获取部门数据失败');
    } catch (error) {
      console.error('❌ 获取部门数据失败:', error);
      return [];
    }
  }

  /**
   * 根据部门名称获取部门信息
   */
  async getDepartmentByName(name: string): Promise<Department | null> {
    const departments = await this.getDepartments();
    return departments.find(dept => 
      dept.name === name || 
      dept.display_name === name ||
      this.matchDepartmentName(name, dept)
    ) || null;
  }

  /**
   * 部门名称匹配逻辑
   */
  private matchDepartmentName(searchName: string, dept: Department): boolean {
    const nameMapping: Record<string, string[]> = {
      'Engineering': ['工程部', '技术部', '开发部'],
      'Marketing': ['市场部', '产品部'],
      'Sales': ['销售部', '运营部'],
      'HR': ['人事部', '人力资源部']
    };

    const aliases = nameMapping[dept.name] || [];
    return aliases.includes(searchName) || 
           aliases.some(alias => alias.includes(searchName)) ||
           searchName.includes(dept.name) ||
           searchName.includes(dept.display_name);
  }

  /**
   * 获取所有工位
   */
  async getWorkstations(department?: string): Promise<Workstation[]> {
    const cacheKey = department ? `workstations:${department}` : 'workstations:all';
    const cached = this.getCachedData<Workstation[]>(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取工位数据 (${department || 'all'})`);
      return cached;
    }

    try {
      const endpoint = department ? `/workstations?department=${encodeURIComponent(department)}` : '/workstations';
      const workstations = await this.apiRequest<Workstation[]>(endpoint);
      
      this.setCachedData(cacheKey, workstations);
      console.log(`✅ 从PostgreSQL获取到 ${workstations.length} 个工位 (${department || 'all'})`);
      return workstations;
    } catch (error) {
      console.error('❌ 获取工位数据失败:', error);
      return [];
    }
  }

  /**
   * 获取部门工位（支持多种部门名称匹配）
   */
  async getDepartmentWorkstations(department: string): Promise<Workstation[]> {
    try {
      // 获取部门信息
      const deptInfo = await this.getDepartmentByName(department);
      
      // 获取所有工位
      const allWorkstations = await this.getWorkstations();
      
      // 过滤部门工位
      const departmentWorkstations = allWorkstations.filter(ws => {
        return ws.department === department ||
               ws.department === deptInfo?.name ||
               ws.department === deptInfo?.display_name ||
               this.matchDepartmentName(ws.department, deptInfo || { name: department, display_name: department } as Department);
      });

      console.log(`🎯 ${department} 部门匹配到 ${departmentWorkstations.length} 个工位`);
      return departmentWorkstations;
    } catch (error) {
      console.error(`❌ 获取 ${department} 部门工位失败:`, error);
      return [];
    }
  }

  /**
   * 获取员工信息
   */
  async getEmployees(departmentId?: number): Promise<Employee[]> {
    const cacheKey = departmentId ? `employees:dept:${departmentId}` : 'employees:all';
    const cached = this.getCachedData<Employee[]>(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取员工数据 (dept:${departmentId || 'all'})`);
      return cached;
    }

    try {
      const endpoint = departmentId ? `/employees?department_id=${departmentId}` : '/employees';
      const employees = await this.apiRequest<Employee[]>(endpoint);
      
      this.setCachedData(cacheKey, employees);
      console.log(`✅ 从PostgreSQL获取到 ${employees.length} 个员工 (dept:${departmentId || 'all'})`);
      return employees;
    } catch (error) {
      console.error('❌ 获取员工数据失败:', error);
      return [];
    }
  }

  /**
   * 根据员工ID获取员工信息
   */
  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    try {
      const employee = await this.apiRequest<Employee>(`/employees/${employeeId}`);
      return employee;
    } catch (error) {
      console.error(`❌ 获取员工 ${employeeId} 信息失败:`, error);
      return null;
    }
  }

  /**
   * 获取地图配置
   */
  async getMapConfig(department: string): Promise<MapConfig | null> {
    const cacheKey = `map_config:${department}`;
    const cached = this.getCachedData<MapConfig>(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取地图配置 (${department})`);
      return cached;
    }

    try {
      // 由于maps表不存在，暂时返回默认配置
      console.log(`⚠️ ${department} 部门地图配置表不存在，使用默认配置`);
      
      const defaultConfig: MapConfig = {
        id: 1,
        department: department,
        map_id: `${department.toLowerCase()}_default`,
        type: 'svg',
        url: `/maps/${department.toLowerCase()}.svg`,
        dept_name: department,
        width: 800,
        height: 600,
        background_color: '#f8fafc',
        border_color: '#e2e8f0',
        border_width: 2,
        border_radius: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.setCachedData(cacheKey, defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.error(`❌ 获取 ${department} 地图配置失败:`, error);
      return null;
    }
  }

  /**
   * 搜索功能
   */
  async searchEmployees(query: string, department?: string): Promise<Employee[]> {
    try {
      const endpoint = `/search?q=${encodeURIComponent(query)}&type=employee${department ? `&department=${encodeURIComponent(department)}` : ''}`;
      const results = await this.apiRequest<{ employees: Employee[] }>(endpoint);
      return results.employees || [];
    } catch (error) {
      console.error('❌ 搜索员工失败:', error);
      return [];
    }
  }

  /**
   * 搜索工位
   */
  async searchWorkstations(query: string, department?: string): Promise<Workstation[]> {
    try {
      const endpoint = `/search?q=${encodeURIComponent(query)}&type=workstation${department ? `&department=${encodeURIComponent(department)}` : ''}`;
      const results = await this.apiRequest<{ workstations: Workstation[] }>(endpoint);
      return results.workstations || [];
    } catch (error) {
      console.error('❌ 搜索工位失败:', error);
      return [];
    }
  }

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ 清除缓存: ${keysToDelete.length} 项 (pattern: ${pattern})`);
    } else {
      this.cache.clear();
      console.log('🗑️ 清除所有缓存');
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 导出单例实例
export const dataService = DataService.getInstance();

// 兼容性导出（用于逐步迁移）
export const getDepartmentConfig = async (department: string) => {
  const deptInfo = await dataService.getDepartmentByName(department);
  const mapConfig = await dataService.getMapConfig(department);
  const workstations = await dataService.getDepartmentWorkstations(department);
  
  if (!deptInfo) {
    return null;
  }

  return {
    name: deptInfo.name,
    displayName: deptInfo.display_name,
    mapData: mapConfig ? {
      map_id: mapConfig.map_id,
      type: mapConfig.type,
      url: mapConfig.url,
      dept_name: mapConfig.dept_name,
      department: mapConfig.department
    } : {
      map_id: `${deptInfo.name.toLowerCase()}_default`,
      type: 'svg',
      url: `/maps/${deptInfo.name.toLowerCase()}.svg`,
      dept_name: deptInfo.display_name,
      department: deptInfo.name
    },
    desks: workstations.map(ws => ({
      desk_id: ws.id,
      x: ws.location.position?.x || 0,
      y: ws.location.position?.y || 0,
      w: ws.location.dimensions?.width || 60,
      h: ws.location.dimensions?.height || 40,
      label: ws.name,
      employee_id: ws.assigned_user ? parseInt(ws.assigned_user) || undefined : undefined,
      department: ws.department,
      assignedUser: ws.assigned_user
    }))
  };
};

export const getEmployeeById = async (employeeId: number) => {
  return await dataService.getEmployeeById(employeeId.toString());
};

export const getEmployeesByDepartment = async (department: string) => {
  const deptInfo = await dataService.getDepartmentByName(department);
  if (!deptInfo) {
    return [];
  }
  return await dataService.getEmployees(deptInfo.id);
};

export const getDesksByDepartment = async (department: string) => {
  const workstations = await dataService.getDepartmentWorkstations(department);
  return workstations.map(ws => ({
    desk_id: ws.id,
    x: ws.location.position?.x || 0,
    y: ws.location.position?.y || 0,
    w: ws.location.dimensions?.width || 60,
    h: ws.location.dimensions?.height || 40,
    label: ws.name,
    employee_id: ws.assigned_user ? parseInt(ws.assigned_user) || undefined : undefined,
    department: ws.department,
    assignedUser: ws.assigned_user,
    status: ws.status
  }));
};

export const searchEmployees = async (query: string, department?: string) => {
  return await dataService.searchEmployees(query, department);
};

export const getHomepageOverview = async () => {
  const departments = await dataService.getDepartments();
  const overview: Record<string, { totalDesks: number; occupiedDesks: number; onlineCount: number; offlineCount: number }> = {};
  
  for (const dept of departments) {
    const workstations = await dataService.getDepartmentWorkstations(dept.name);
    const employees = await dataService.getEmployees(dept.id);
    
    overview[dept.name] = {
      totalDesks: workstations.length,
      occupiedDesks: workstations.filter(ws => ws.status === 'occupied').length,
      onlineCount: employees.filter(emp => emp.status === 'online').length,
      offlineCount: employees.filter(emp => emp.status === 'offline').length
    };
  }
  
  return overview;
};