import { apiRequest } from '../utils/api';

interface SyncStatus {
  lastSync: string;
  isOnline: boolean;
  pendingChanges: number;
  conflictCount: number;
}

interface DataChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: string;
  synced: boolean;
}

// API响应接口定义
interface CountResponse {
  count: number;
}

interface WorkstationsResponse {
  workstations: any[];
  count?: number;
}

interface EmployeesResponse {
  employees: any[];
  count?: number;
}

interface DepartmentsResponse {
  departments: any[];
  count?: number;
}

class DataSyncService {
  private syncQueue: DataChange[] = [];
  private isOnline: boolean = navigator.onLine;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    // 监听网络状态变化
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // 从本地存储恢复未同步的数据
    this.loadPendingChanges();
    
    // 启动定期同步
    this.startPeriodicSync();
  }

  /**
   * 添加数据变更到同步队列
   */
  public addChange(change: Omit<DataChange, 'id' | 'timestamp' | 'synced'>): void {
    const dataChange: DataChange = {
      ...change,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      synced: false
    };

    this.syncQueue.push(dataChange);
    this.savePendingChanges();
    
    // 如果在线，立即尝试同步
    if (this.isOnline) {
      this.syncChanges();
    }
    
    this.notifyListeners();
  }

  /**
   * 手动触发同步
   */
  public async sync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('网络连接不可用');
    }
    
    await this.syncChanges();
  }

  /**
   * 获取同步状态
   */
  public getStatus(): SyncStatus {
    const pendingChanges = this.syncQueue.filter(change => !change.synced).length;
    const lastSync = localStorage.getItem('lastSyncTime') || new Date().toISOString();
    
    return {
      lastSync,
      isOnline: this.isOnline,
      pendingChanges,
      conflictCount: 0 // TODO: 实现冲突检测
    };
  }

  /**
   * 添加状态监听器
   */
  public addStatusListener(listener: (status: SyncStatus) => void): void {
    this.listeners.add(listener);
  }

  /**
   * 移除状态监听器
   */
  public removeStatusListener(listener: (status: SyncStatus) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * 检查数据一致性
   */
  public async checkConsistency(): Promise<{
    overall: { consistent: boolean; issues: number };
    workstations: { total: number; online: number; offline: number; maintenance: number; orphaned: number; consistent: boolean };
    employees: { total: number; active: number; inactive: number; orphaned: number; consistent: boolean };
    departments: { total: number; withEmployees: number; consistent: boolean };
  }> {
    try {
      const [workstationsResponse, employeesResponse, departmentsResponse] = await Promise.all([
        apiRequest('/workstations/count') as Promise<CountResponse>,
        apiRequest('/employees/count') as Promise<CountResponse>,
        apiRequest('/departments/count') as Promise<CountResponse>
      ]);

      // 获取本地缓存的数据计数（这里简化处理）
      const localWorkstations = parseInt(localStorage.getItem('localWorkstationsCount') || '0');
      const localEmployees = parseInt(localStorage.getItem('localEmployeesCount') || '0');
      const localDepartments = parseInt(localStorage.getItem('localDepartmentsCount') || '0');

      const workstationsConsistent = localWorkstations === (workstationsResponse.count || 0);
      const employeesConsistent = localEmployees === (employeesResponse.count || 0);
      const departmentsConsistent = localDepartments === (departmentsResponse.count || 0);
      const overallConsistent = workstationsConsistent && employeesConsistent && departmentsConsistent;
      
      // 计算问题数量
      let issues = 0;
      if (!workstationsConsistent) issues++;
      if (!employeesConsistent) issues++;
      if (!departmentsConsistent) issues++;

      return {
        overall: {
          consistent: overallConsistent,
          issues: issues
        },
        workstations: {
          total: workstationsResponse.count || 0,
          online: Math.floor((workstationsResponse.count || 0) * 0.8), // 模拟数据
          offline: Math.floor((workstationsResponse.count || 0) * 0.15),
          maintenance: Math.floor((workstationsResponse.count || 0) * 0.05),
          orphaned: workstationsConsistent ? 0 : Math.abs(localWorkstations - (workstationsResponse.count || 0)),
          consistent: workstationsConsistent
        },
        employees: {
          total: employeesResponse.count || 0,
          active: Math.floor((employeesResponse.count || 0) * 0.9), // 模拟数据
          inactive: Math.floor((employeesResponse.count || 0) * 0.1),
          orphaned: employeesConsistent ? 0 : Math.abs(localEmployees - (employeesResponse.count || 0)),
          consistent: employeesConsistent
        },
        departments: {
          total: departmentsResponse.count || 0,
          withEmployees: Math.floor((departmentsResponse.count || 0) * 0.95), // 模拟数据
          consistent: departmentsConsistent
        }
      };
    } catch (error) {
      console.error('检查数据一致性失败:', error);
      throw error;
    }
  }

  /**
   * 修复数据不一致
   */
  public async repairInconsistency(table: string): Promise<void> {
    try {
      console.log(`开始修复 ${table} 表的数据不一致...`);
      
      // 根据表名执行不同的修复策略
      switch (table) {
        case 'workstations':
          await this.repairWorkstations();
          break;
        case 'employees':
          await this.repairEmployees();
          break;
        case 'departments':
          await this.repairDepartments();
          break;
        default:
          throw new Error(`不支持的表: ${table}`);
      }
      
      console.log(`${table} 表数据修复完成`);
    } catch (error) {
      console.error(`修复 ${table} 表数据失败:`, error);
      throw error;
    }
  }

  private async syncChanges(): Promise<void> {
    const unsyncedChanges = this.syncQueue.filter(change => !change.synced);
    
    if (unsyncedChanges.length === 0) {
      return;
    }

    console.log(`开始同步 ${unsyncedChanges.length} 个数据变更...`);

    for (const change of unsyncedChanges) {
      try {
        await this.syncSingleChange(change);
        change.synced = true;
      } catch (error) {
        console.error('同步数据变更失败:', error, change);
        // 继续处理其他变更
      }
    }

    // 移除已同步的变更
    this.syncQueue = this.syncQueue.filter(change => !change.synced);
    this.savePendingChanges();
    
    // 更新最后同步时间
    localStorage.setItem('lastSyncTime', new Date().toISOString());
    
    this.notifyListeners();
  }

  private async syncSingleChange(change: DataChange): Promise<void> {
    const endpoint = `/${change.table}`;
    
    switch (change.type) {
      case 'create':
        await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(change.data)
        });
        break;
        
      case 'update':
        await apiRequest(`${endpoint}/${change.data.id}`, {
          method: 'PUT',
          body: JSON.stringify(change.data)
        });
        break;
        
      case 'delete':
        await apiRequest(`${endpoint}/${change.data.id}`, {
          method: 'DELETE'
        });
        break;
    }
  }

  private async repairWorkstations(): Promise<void> {
    const response = await apiRequest('/workstations') as WorkstationsResponse;
    const remoteWorkstations = response.workstations || [];
    
    // 更新本地缓存
    localStorage.setItem('cachedWorkstations', JSON.stringify(remoteWorkstations));
    localStorage.setItem('localWorkstationsCount', remoteWorkstations.length.toString());
  }

  private async repairEmployees(): Promise<void> {
    const response = await apiRequest('/employees') as EmployeesResponse;
    const remoteEmployees = response.employees || [];
    
    // 更新本地缓存
    localStorage.setItem('cachedEmployees', JSON.stringify(remoteEmployees));
    localStorage.setItem('localEmployeesCount', remoteEmployees.length.toString());
  }

  private async repairDepartments(): Promise<void> {
    const response = await apiRequest('/departments') as DepartmentsResponse;
    const remoteDepartments = response.departments || [];
    
    // 更新本地缓存
    localStorage.setItem('cachedDepartments', JSON.stringify(remoteDepartments));
    localStorage.setItem('localDepartmentsCount', remoteDepartments.length.toString());
  }

  private handleOnline(): void {
    this.isOnline = true;
    console.log('网络连接已恢复，开始同步数据...');
    this.syncChanges();
    this.notifyListeners();
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log('网络连接已断开，数据将在本地缓存');
    this.notifyListeners();
  }

  private startPeriodicSync(): void {
    // 每30秒尝试同步一次
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.syncQueue.some(change => !change.synced)) {
        this.syncChanges();
      }
    }, 30000);
  }

  private loadPendingChanges(): void {
    try {
      const saved = localStorage.getItem('pendingDataChanges');
      if (saved) {
        this.syncQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载待同步数据失败:', error);
      this.syncQueue = [];
    }
  }

  private savePendingChanges(): void {
    try {
      localStorage.setItem('pendingDataChanges', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('保存待同步数据失败:', error);
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('通知状态监听器失败:', error);
      }
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // API调用方法
  private async apiCall(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API调用失败: ${response.statusText}`);
    }
    
    return response.json();
  }

  // 获取同步状态
  async getSyncStatus() {
    try {
      const response = await this.apiCall('/data-sync/status');
      return response.data;
    } catch (error) {
      console.error('获取同步状态失败:', error);
      throw error;
    }
  }



  // 修复数据不一致
  async repairData(type: string, options: any = {}) {
    try {
      const response = await this.apiCall('/data-sync/repair', {
        method: 'POST',
        body: JSON.stringify({ type, options })
      });
      return response.data;
    } catch (error) {
      console.error('数据修复失败:', error);
      throw error;
    }
  }

  // 强制同步
  async forceSync() {
    try {
      const response = await this.apiCall('/data-sync/force-sync', {
        method: 'POST'
      });
      return response.data;
    } catch (error) {
      console.error('强制同步失败:', error);
      throw error;
    }
  }

  // 获取审计日志
  async getAuditLogs(params: any = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await this.apiCall(`/data-sync/audit-logs?${queryString}`);
      return response.data;
    } catch (error) {
      console.error('获取审计日志失败:', error);
      throw error;
    }
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    this.listeners.clear();
  }
}

// 创建全局实例
export const dataSyncService = new DataSyncService();
export default DataSyncService;
export type { SyncStatus, DataChange };