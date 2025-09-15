import { Employee, Department, Desk, DeskWithDetails } from '../../api/types/database.js';

/**
 * 缓存服务 - 管理SQL查询生成的缓存文件
 * 实现系统校正标准：前端数据源使用SQL查询生成的缓存文件，禁用虚拟文件
 */
class CacheService {
  private static instance: CacheService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存时间
  private readonly API_BASE_URL = 'http://localhost:8080/api';

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * 获取缓存数据，如果缓存过期或不存在则从SQL查询获取
   */
  private async getCachedData<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    const cacheTtl = ttl || this.CACHE_TTL;

    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < cached.ttl) {
      console.debug(`[CacheService] 使用缓存数据: ${key}`);
      return cached.data;
    }

    // 缓存过期或不存在，从SQL查询获取新数据
    console.debug(`[CacheService] 从SQL查询获取数据: ${key}`);
    try {
      const data = await fetcher();
      this.cache.set(key, {
        data,
        timestamp: now,
        ttl: cacheTtl
      });
      return data;
    } catch (error) {
      console.error(`[CacheService] 获取数据失败: ${key}`, error);
      // 如果有过期缓存，返回过期缓存
      if (cached) {
        console.warn(`[CacheService] 使用过期缓存: ${key}`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * 获取所有部门数据（从SQL查询缓存）
   */
  public async getDepartments(): Promise<Department[]> {
    return this.getCachedData('departments', async () => {
      const response = await fetch(`${this.API_BASE_URL}/departments`);
      if (!response.ok) {
        throw new Error(`获取部门数据失败: ${response.statusText}`);
      }
      const data = await response.json();
      return data.departments || [];
    });
  }

  /**
   * 获取所有员工数据（从SQL查询缓存）
   */
  public async getEmployees(): Promise<Employee[]> {
    return this.getCachedData('employees', async () => {
      const response = await fetch(`${this.API_BASE_URL}/employees`);
      if (!response.ok) {
        throw new Error(`获取员工数据失败: ${response.statusText}`);
      }
      const data = await response.json();
      return data.employees || [];
    });
  }

  /**
   * 获取工位数据（从SQL查询缓存）
   */
  public async getDesks(): Promise<DeskWithDetails[]> {
    return this.getCachedData('desks', async () => {
      const response = await fetch(`${this.API_BASE_URL}/desks`);
      if (!response.ok) {
        throw new Error(`获取工位数据失败: ${response.statusText}`);
      }
      const data = await response.json();
      return data.desks || [];
    });
  }

  /**
   * 搜索员工（触发新的SQL查询并更新缓存）
   */
  public async searchEmployees(query: string, departmentId?: number): Promise<Employee[]> {
    const searchKey = `search_employees_${query}_${departmentId || 'all'}`;
    
    return this.getCachedData(searchKey, async () => {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (departmentId) params.append('department_id', departmentId.toString());
      
      const response = await fetch(`${this.API_BASE_URL}/employees/search?${params}`);
      if (!response.ok) {
        throw new Error(`搜索员工失败: ${response.statusText}`);
      }
      const data = await response.json();
      
      // 搜索后更新员工缓存
      this.invalidateCache('employees');
      
      return data.employees || [];
    }, 2 * 60 * 1000); // 搜索结果缓存2分钟
  }

  /**
   * 搜索工位（触发新的SQL查询并更新缓存）
   */
  public async searchDesks(query: string, departmentId?: number): Promise<DeskWithDetails[]> {
    const searchKey = `search_desks_${query}_${departmentId || 'all'}`;
    
    return this.getCachedData(searchKey, async () => {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (departmentId) params.append('department_id', departmentId.toString());
      
      const response = await fetch(`${this.API_BASE_URL}/desks/search?${params}`);
      if (!response.ok) {
        throw new Error(`搜索工位失败: ${response.statusText}`);
      }
      const data = await response.json();
      
      // 搜索后更新工位缓存
      this.invalidateCache('desks');
      
      return data.desks || [];
    }, 2 * 60 * 1000); // 搜索结果缓存2分钟
  }

  /**
   * 获取部门员工统计（跨域搜索支持）
   */
  public async getDepartmentStats(): Promise<{ [departmentId: number]: { employeeCount: number; deskCount: number } }> {
    return this.getCachedData('department_stats', async () => {
      const response = await fetch(`${this.API_BASE_URL}/departments/stats`);
      if (!response.ok) {
        throw new Error(`获取部门统计失败: ${response.statusText}`);
      }
      const data = await response.json();
      return data.stats || {};
    });
  }

  /**
   * 全部门跨域搜索功能
   */
  public async crossDepartmentSearch(query: string): Promise<{
    employees: Employee[];
    desks: DeskWithDetails[];
    departments: Department[];
  }> {
    const searchKey = `cross_search_${query}`;
    
    return this.getCachedData(searchKey, async () => {
      const response = await fetch(`${this.API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=all`);
      if (!response.ok) {
        throw new Error(`跨部门搜索失败: ${response.statusText}`);
      }
      const data = await response.json();
      
      // 跨域搜索后更新所有相关缓存
      this.invalidateCache('employees');
      this.invalidateCache('desks');
      this.invalidateCache('departments');
      
      return {
        employees: data.data?.employees || [],
        desks: data.data?.workstations || [],
        departments: data.data?.departments || []
      };
    }, 1 * 60 * 1000); // 跨域搜索结果缓存1分钟
  }

  /**
   * 使缓存失效
   */
  public invalidateCache(key: string): void {
    this.cache.delete(key);
    console.debug(`[CacheService] 缓存已失效: ${key}`);
  }

  /**
   * 清空所有缓存
   */
  public clearAllCache(): void {
    this.cache.clear();
    console.debug('[CacheService] 所有缓存已清空');
  }

  /**
   * 预加载缓存（页面初次加载时使用）
   */
  public async preloadCache(): Promise<void> {
    console.debug('[CacheService] 开始预加载缓存...');
    try {
      await Promise.all([
        this.getDepartments(),
        this.getEmployees(),
        this.getDesks(),
        this.getDepartmentStats()
      ]);
      console.debug('[CacheService] 缓存预加载完成');
    } catch (error) {
      console.error('[CacheService] 缓存预加载失败:', error);
    }
  }

  /**
   * 获取缓存状态信息
   */
  public getCacheInfo(): { [key: string]: { size: number; timestamp: number; ttl: number } } {
    const info: { [key: string]: { size: number; timestamp: number; ttl: number } } = {};
    this.cache.forEach((value, key) => {
      info[key] = {
        size: JSON.stringify(value.data).length,
        timestamp: value.timestamp,
        ttl: value.ttl
      };
    });
    return info;
  }
}

export default CacheService.getInstance();
export { CacheService };