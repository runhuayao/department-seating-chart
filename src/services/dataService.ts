// 渐进式API迁移服务层
// 支持静态数据和API数据的混合使用，实现M0到M1的平滑过渡

import { DataAdapter, M0Employee, M0Desk, M1Employee, M1Desk, M1Assignment } from '../adapters/dataAdapter';
import {
  Employee,
  Desk,
  DepartmentConfig,
  getEmployeeById as getStaticEmployeeById,
  getEmployeesByDepartment as getStaticEmployeesByDepartment,
  getDesksByDepartment as getStaticDesksByDepartment,
  getDepartmentConfig as getStaticDepartmentConfig,
  getHomepageOverview as getStaticHomepageOverview
} from '../data/departmentData';

/**
 * API响应接口定义
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

interface DeskWithAssignment {
  desk: M1Desk;
  assignment?: M1Assignment;
}

/**
 * 数据服务类 - 统一的数据访问接口
 * 支持静态数据和API数据的混合使用
 */
export class DataService {
  private static instance: DataService;
  private useAPI: boolean;
  private apiBaseUrl: string;
  private fallbackToStatic: boolean;

  private constructor() {
    // 通过环境变量控制是否使用API
    this.useAPI = process.env.REACT_APP_USE_API === 'true';
    this.apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '/api';
    this.fallbackToStatic = process.env.REACT_APP_FALLBACK_TO_STATIC !== 'false';
    
    console.log('DataService initialized:', {
      useAPI: this.useAPI,
      apiBaseUrl: this.apiBaseUrl,
      fallbackToStatic: this.fallbackToStatic
    });
  }

  /**
   * 获取DataService单例实例
   */
  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /**
   * 动态切换数据源
   * @param useAPI 是否使用API
   */
  setUseAPI(useAPI: boolean): void {
    this.useAPI = useAPI;
    console.log('DataService switched to:', useAPI ? 'API' : 'Static');
  }

  /**
   * 获取部门配置信息
   * @param department 部门名称
   * @returns 部门配置
   */
  async getDepartmentConfig(department: string): Promise<DepartmentConfig | undefined> {
    if (this.useAPI) {
      try {
        const response = await this.fetchAPI<DepartmentConfig>(`/departments/${department}`);
        if (response.success) {
          return response.data;
        }
        throw new Error(response.error || 'Failed to fetch department config');
      } catch (error) {
        console.warn('API调用失败，降级到静态数据:', error);
        if (this.fallbackToStatic) {
          return this.getStaticDepartmentConfig(department);
        }
        throw error;
      }
    } else {
      return this.getStaticDepartmentConfig(department);
    }
  }

  /**
   * 根据员工ID获取员工信息
   * @param employeeId 员工ID
   * @returns 员工信息
   */
  async getEmployeeById(employeeId: number): Promise<Employee | undefined> {
    if (this.useAPI) {
      try {
        const response = await this.fetchAPI<M1Employee>(`/employees/${employeeId}`);
        if (response.success) {
          return DataAdapter.adaptEmployee(response.data);
        }
        throw new Error(response.error || 'Employee not found');
      } catch (error) {
        console.warn('API调用失败，降级到静态数据:', error);
        if (this.fallbackToStatic) {
          return getStaticEmployeeById(employeeId);
        }
        throw error;
      }
    } else {
      return getStaticEmployeeById(employeeId);
    }
  }

  /**
   * 根据部门获取员工列表
   * @param department 部门名称
   * @returns 员工列表
   */
  async getEmployeesByDepartment(department: string): Promise<Employee[]> {
    if (this.useAPI) {
      try {
        const deptId = DataAdapter.getDepartmentId(department);
        const response = await this.fetchAPI<M1Employee[]>(`/employees/by-dept/${deptId}`);
        if (response.success) {
          return DataAdapter.adaptEmployees(response.data);
        }
        throw new Error(response.error || 'Failed to fetch employees');
      } catch (error) {
        console.warn('API调用失败，降级到静态数据:', error);
        if (this.fallbackToStatic) {
          return getStaticEmployeesByDepartment(department);
        }
        throw error;
      }
    } else {
      return getStaticEmployeesByDepartment(department);
    }
  }

  /**
   * 根据部门获取工位列表
   * @param department 部门名称
   * @returns 工位列表
   */
  async getDesksByDepartment(department: string): Promise<Desk[]> {
    if (this.useAPI) {
      try {
        const deptId = DataAdapter.getDepartmentId(department);
        const response = await this.fetchAPI<DeskWithAssignment[]>(`/desks/by-dept/${deptId}`);
        if (response.success) {
          return response.data.map(item => 
            DataAdapter.adaptDesk(item.desk, item.assignment)
          );
        }
        throw new Error(response.error || 'Failed to fetch desks');
      } catch (error) {
        console.warn('API调用失败，降级到静态数据:', error);
        if (this.fallbackToStatic) {
          return getStaticDesksByDepartment(department);
        }
        throw error;
      }
    } else {
      return getStaticDesksByDepartment(department);
    }
  }

  /**
   * 搜索员工
   * @param query 搜索关键词
   * @param department 部门过滤（可选）
   * @returns 员工列表
   */
  async searchEmployees(query: string, department?: string): Promise<Employee[]> {
    if (this.useAPI) {
      try {
        const params = new URLSearchParams({ q: query });
        if (department) {
          params.append('dept', DataAdapter.getDepartmentId(department).toString());
        }
        const response = await this.fetchAPI<M1Employee[]>(`/employees/search?${params}`);
        if (response.success) {
          return DataAdapter.adaptEmployees(response.data);
        }
        throw new Error(response.error || 'Search failed');
      } catch (error) {
        console.warn('API搜索失败，降级到静态数据搜索:', error);
        if (this.fallbackToStatic) {
          return this.searchStaticEmployees(query, department);
        }
        throw error;
      }
    } else {
      return this.searchStaticEmployees(query, department);
    }
  }

  /**
   * 获取首页概览数据
   * @returns 首页概览
   */
  async getHomepageOverview(): Promise<Record<string, { totalDesks: number; occupiedDesks: number; onlineCount: number; offlineCount: number }>> {
    if (this.useAPI) {
      try {
        const response = await this.fetchAPI<Record<string, { totalDesks: number; occupiedDesks: number; onlineCount: number; offlineCount: number }>>('/overview/homepage');
        if (response.success) {
          return response.data;
        }
        throw new Error(response.error || 'Failed to fetch overview');
      } catch (error) {
        console.warn('API调用失败，降级到静态数据:', error);
        if (this.fallbackToStatic) {
          return getStaticHomepageOverview();
        }
        throw error;
      }
    } else {
      return getStaticHomepageOverview();
    }
  }

  /**
   * 上报员工状态心跳
   * @param employeeId 员工ID
   * @param status 状态
   * @returns 是否成功
   */
  async reportHeartbeat(employeeId: number, status: 'online' | 'offline'): Promise<boolean> {
    if (this.useAPI) {
      try {
        const response = await this.fetchAPI<{ success: boolean }>('/status/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ employeeId, status })
        });
        return response.success && response.data.success;
      } catch (error) {
        console.warn('心跳上报失败:', error);
        return false;
      }
    } else {
      // 静态数据模式下，心跳上报无效果
      console.log('静态数据模式，心跳上报被忽略:', { employeeId, status });
      return true;
    }
  }

  /**
   * 检查API健康状态
   * @returns 健康状态
   */
  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.useAPI) {
      return { healthy: true, message: 'Static data mode' };
    }

    try {
      const response = await this.fetchAPI<{ status: string; timestamp: string }>('/health');
      return {
        healthy: response.success && response.data.status === 'ok',
        message: response.success ? 'API is healthy' : response.error
      };
    } catch (error) {
      return {
        healthy: false,
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // 私有方法

  /**
   * 统一的API请求方法
   * @param endpoint API端点
   * @param options 请求选项
   * @returns API响应
   */
  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * 获取静态部门配置
   * @param department 部门名称
   * @returns 部门配置
   */
  private getStaticDepartmentConfig(department: string): DepartmentConfig | undefined {
    return getStaticDepartmentConfig(department);
  }

  /**
   * 静态数据员工搜索
   * @param query 搜索关键词
   * @param department 部门过滤
   * @returns 员工列表
   */
  private searchStaticEmployees(query: string, department?: string): Employee[] {
    let employees = department 
      ? getStaticEmployeesByDepartment(department)
      : [];
    
    if (!department) {
      // 如果没有指定部门，搜索所有部门
      const allDepts = ['Engineering', 'Marketing', 'Sales', 'HR'];
      employees = allDepts.flatMap(dept => getStaticEmployeesByDepartment(dept));
    }

    const lowerQuery = query.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(lowerQuery) ||
      emp.department.toLowerCase().includes(lowerQuery)
    );
  }
}

// 导出单例实例
export const dataService = DataService.getInstance();

// 导出便捷函数
export const {
  getDepartmentConfig,
  getEmployeeById,
  getEmployeesByDepartment,
  getDesksByDepartment,
  searchEmployees,
  getHomepageOverview,
  reportHeartbeat,
  checkHealth
} = {
  getDepartmentConfig: (dept: string) => dataService.getDepartmentConfig(dept),
  getEmployeeById: (id: number) => dataService.getEmployeeById(id),
  getEmployeesByDepartment: (dept: string) => dataService.getEmployeesByDepartment(dept),
  getDesksByDepartment: (dept: string) => dataService.getDesksByDepartment(dept),
  searchEmployees: (query: string, dept?: string) => dataService.searchEmployees(query, dept),
  getHomepageOverview: () => dataService.getHomepageOverview(),
  reportHeartbeat: (id: number, status: 'online' | 'offline') => dataService.reportHeartbeat(id, status),
  checkHealth: () => dataService.checkHealth()
};