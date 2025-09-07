// 工位管理服务层
// 支持工位的增删改查、搜索和统计功能
// 集成云函数调用和安全传输机制

import { rbacService } from './rbacService';
import { validateWorkstation, sanitizeWorkstationData } from '../utils/validation';
import { SecureHTTP, AuditLogger, DataMasking } from '../utils/security';
import type { 
  Workstation, 
  WorkstationMetadata, 
  WorkstationStatus,
  WorkstationFormData,
  WorkstationSearchParams,
  WorkstationStats,
  WorkstationAPIResponse,
  WorkstationListResponse,
  WorkstationStatsResponse
} from '../types/workstation';
import type {
  WorkstationCreateRequest,
  WorkstationUpdateRequest
} from '../types/workstation';

/**
 * API响应接口定义
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

/**
 * 工位服务类 - 统一的工位管理接口
 * 支持云函数调用和安全数据传输
 */
export class WorkstationService {
  private static instance: WorkstationService;
  private apiBaseUrl: string;
  private enableCloudFunction: boolean;
  private authToken: string | null = null;

  private constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '/api';
    this.enableCloudFunction = process.env.REACT_APP_ENABLE_CLOUD_FUNCTION === 'true';
    
    console.log('WorkstationService initialized:', {
      apiBaseUrl: this.apiBaseUrl,
      enableCloudFunction: this.enableCloudFunction
    });
  }

  /**
   * 获取WorkstationService单例实例
   */
  static getInstance(): WorkstationService {
    if (!WorkstationService.instance) {
      WorkstationService.instance = new WorkstationService();
    }
    return WorkstationService.instance;
  }

  /**
   * 设置认证令牌
   * @param token 认证令牌
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * 获取工位列表
   * @param params 查询参数
   * @returns 工位列表响应
   */
  async getWorkstations(params?: {
    page?: number;
    limit?: number;
    department?: string;
    status?: WorkstationStatus;
    search?: string;
  }): Promise<WorkstationListResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.department) queryParams.append('department', params.department);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);

      const endpoint = `/workstations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.fetchAPI<WorkstationListResponse>(endpoint);
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch workstations');
    } catch (error) {
      console.error('获取工位列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取工位详情
   * @param id 工位ID
   * @returns 工位详情
   */
  async getWorkstationById(id: string): Promise<Workstation> {
    try {
      const response = await this.fetchAPI<Workstation>(`/workstations/${id}`);
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Workstation not found');
    } catch (error) {
      console.error('获取工位详情失败:', error);
      throw error;
    }
  }

  /**
   * 创建新工位
   * @param workstation 工位信息
   * @returns 创建的工位
   */
  async createWorkstation(workstation: WorkstationCreateRequest): Promise<Workstation> {
    try {
      // 权限检查
      if (!rbacService.hasPermission('workstation', 'create')) {
        AuditLogger.log('CREATE_WORKSTATION_DENIED', 'workstation', { reason: '权限不足' });
        throw new Error('没有创建工位的权限');
      }

      // 数据清理和验证
      const sanitizedData = sanitizeWorkstationData(workstation);
      const validation = validateWorkstation(sanitizedData);
      
      if (!validation.isValid) {
        AuditLogger.log('CREATE_WORKSTATION_VALIDATION_FAILED', 'workstation', { 
          errors: validation.errors,
          data: DataMasking.maskSensitiveData(sanitizedData)
        });
        throw new Error(`数据验证失败: ${validation.errors.join(', ')}`);
      }

      // 记录操作日志
      AuditLogger.log('CREATE_WORKSTATION_ATTEMPT', 'workstation', {
        workstationName: sanitizedData.name,
        department: sanitizedData.department
      });
      
      // 如果启用云函数，使用云函数调用
      if (this.enableCloudFunction) {
        const result = await this.createWorkstationViaCloudFunction(sanitizedData);
        AuditLogger.log('CREATE_WORKSTATION_SUCCESS', 'workstation', {
          workstationId: result.id,
          workstationName: result.name
        });
        return result;
      }
      
      // 直接API调用
      const response = await this.fetchAPI<Workstation>('/workstations', {
        method: 'POST',
        body: JSON.stringify(sanitizedData)
      });
      
      if (response.success) {
        console.log('工位创建成功:', response.data);
        AuditLogger.log('CREATE_WORKSTATION_SUCCESS', 'workstation', {
          workstationId: response.data.id,
          workstationName: response.data.name
        });
        return response.data;
      }
      
      AuditLogger.log('CREATE_WORKSTATION_FAILED', 'workstation', {
        error: response.error,
        workstationName: sanitizedData.name
      });
      throw new Error(response.error || 'Failed to create workstation');
    } catch (error) {
      console.error('创建工位失败:', error);
      AuditLogger.log('CREATE_WORKSTATION_ERROR', 'workstation', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 更新工位信息
   * @param id 工位ID
   * @param updates 更新数据
   * @returns 更新后的工位
   */
  async updateWorkstation(id: string, updates: WorkstationUpdateRequest): Promise<Workstation> {
    try {
      // 数据验证
      this.validateWorkstationData(updates, true);
      
      const response = await this.fetchAPI<Workstation>(`/workstations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      if (response.success) {
        console.log('工位更新成功:', response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to update workstation');
    } catch (error) {
      console.error('更新工位失败:', error);
      throw error;
    }
  }

  /**
   * 删除工位
   * @param id 工位ID
   * @returns 是否成功
   */
  async deleteWorkstation(id: string): Promise<boolean> {
    try {
      const response = await this.fetchAPI<{ success: boolean }>(`/workstations/${id}`, {
        method: 'DELETE'
      });
      
      if (response.success) {
        console.log('工位删除成功:', id);
        return response.data.success;
      }
      throw new Error(response.error || 'Failed to delete workstation');
    } catch (error) {
      console.error('删除工位失败:', error);
      throw error;
    }
  }

  /**
   * 搜索工位
   * @param params 搜索参数
   * @returns 搜索结果
   */
  async searchWorkstations(params: WorkstationSearchParams): Promise<WorkstationListResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append('q', params.query);
      if (params.department) queryParams.append('department', params.department);
      if (params.status) queryParams.append('status', params.status);
      if (params.ipRange) queryParams.append('ipRange', params.ipRange);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const response = await this.fetchAPI<WorkstationListResponse>(`/workstations/search?${queryParams}`);
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Search failed');
    } catch (error) {
      console.error('搜索工位失败:', error);
      throw error;
    }
  }

  /**
   * 获取工位统计信息
   * @returns 统计数据
   */
  async getWorkstationStats(): Promise<WorkstationStats> {
    try {
      const response = await this.fetchAPI<WorkstationStats>('/workstations/stats');
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch stats');
    } catch (error) {
      console.error('获取工位统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量导入工位
   * @param workstations 工位列表
   * @returns 导入结果
   */
  async batchImportWorkstations(workstations: WorkstationCreateRequest[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // 批量验证
      workstations.forEach((ws, index) => {
        try {
          this.validateWorkstationData(ws);
        } catch (error) {
          throw new Error(`第${index + 1}行数据验证失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      const response = await this.fetchAPI<{
        success: number;
        failed: number;
        errors: string[];
      }>('/workstations/batch', {
        method: 'POST',
        body: JSON.stringify({ workstations })
      });
      
      if (response.success) {
        console.log('批量导入完成:', response.data);
        return response.data;
      }
      throw new Error(response.error || 'Batch import failed');
    } catch (error) {
      console.error('批量导入工位失败:', error);
      throw error;
    }
  }

  /**
   * 检查工位服务健康状态
   * @returns 健康状态
   */
  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const response = await this.fetchAPI<{ status: string; timestamp: string }>('/workstations/health');
      return {
        healthy: response.success && response.data.status === 'ok',
        message: response.success ? 'Workstation service is healthy' : response.error
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Workstation service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers as Record<string, string>
    };

    // 添加认证头
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // 添加请求时间戳和签名（安全传输）
    const timestamp = Date.now().toString();
    headers['X-Timestamp'] = timestamp;
    headers['X-Request-ID'] = this.generateRequestId();

    let response: Response;
    
    try {
      // 根据请求方法选择安全HTTP方法
      const method = (options?.method || 'GET').toUpperCase();
      const requestData = options?.body ? JSON.parse(options.body as string) : undefined;
      
      const requestOptions = {
        ...options,
        headers
      };
      
      switch (method) {
        case 'POST':
          response = await SecureHTTP.post(url, requestData, requestOptions);
          break;
        case 'PUT':
          response = await SecureHTTP.put(url, requestData, requestOptions);
          break;
        case 'DELETE':
          response = await SecureHTTP.delete(url, requestOptions);
          break;
        default:
          response = await SecureHTTP.get(url, requestOptions);
      }

      if (!response.ok) {
        const errorText = await response.text();
        AuditLogger.log('API_REQUEST_ERROR', 'workstation', {
          endpoint,
          method,
          status: response.status,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 记录成功的API调用
      AuditLogger.log('API_REQUEST_SUCCESS', 'workstation', {
        endpoint,
        method,
        status: response.status
      });
      
      return data;
    } catch (error) {
      AuditLogger.log('API_REQUEST_EXCEPTION', 'workstation', {
        endpoint,
        error: error instanceof Error ? error.message : '网络请求失败'
      });
      throw error;
    }
  }

  /**
   * 通过云函数创建工位
   * @param workstation 工位信息
   * @returns 创建的工位
   */
  private async createWorkstationViaCloudFunction(workstation: WorkstationCreateRequest): Promise<Workstation> {
    try {
      // 模拟云函数调用逻辑
      console.log('使用云函数创建工位:', workstation);
      
      // 加密敏感数据
      const encryptedData = this.encryptSensitiveData(workstation);
      
      // 调用云函数API
      const response = await this.callCloudFunction('workstations/create', {
        data: encryptedData,
        metadata: {
          source: 'frontend',
          version: '1.0',
          timestamp: Date.now()
        }
      });
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Cloud function call failed');
    } catch (error) {
      console.error('云函数调用失败:', error);
      // 降级到直接API调用
      console.log('降级到直接API调用');
      return await this.createWorkstationDirectly(workstation);
    }
  }

  /**
   * 云函数调用
   * @param functionName 函数名称
   * @param data 请求数据
   * @returns 响应结果
   */
  private async callCloudFunction(functionName: string, data: any): Promise<any> {
    try {
      const url = `${this.apiBaseUrl}/cloud-functions/${functionName}`;
      
      // 使用安全HTTP请求
      const response = await SecureHTTP.post(url, data, {
        headers: {
          'X-Function-Name': functionName,
          'X-Request-Source': 'M0-Frontend'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        AuditLogger.log('CLOUD_FUNCTION_ERROR', 'workstation', {
          functionName,
          status: response.status,
          error: errorText
        });
        throw new Error(`云函数调用失败: ${response.statusText}`);
      }

      const result = await response.json();
      
      // 记录成功的云函数调用
      AuditLogger.log('CLOUD_FUNCTION_SUCCESS', 'workstation', {
        functionName,
        dataSize: JSON.stringify(data).length
      });
      
      return result;
    } catch (error) {
      console.error('云函数调用错误:', error);
      AuditLogger.log('CLOUD_FUNCTION_EXCEPTION', 'workstation', {
        functionName,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 直接API调用创建工位
   * @param workstation 工位信息
   * @returns 创建的工位
   */
  private async createWorkstationDirectly(workstation: WorkstationCreateRequest): Promise<Workstation> {
    const response = await this.fetchAPI<Workstation>('/workstations', {
      method: 'POST',
      body: JSON.stringify(workstation)
    });
    
    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to create workstation');
  }

  /**
   * 验证工位数据
   * @param data 工位数据
   * @param isUpdate 是否为更新操作
   */
  private validateWorkstationData(data: WorkstationCreateRequest | WorkstationUpdateRequest, isUpdate = false): void {
    if (!isUpdate) {
      const createData = data as WorkstationCreateRequest;
      if (!createData.name?.trim()) {
        throw new Error('工位名称不能为空');
      }
      if (!createData.ipAddress?.trim()) {
        throw new Error('IP地址不能为空');
      }
      if (!createData.department?.trim()) {
        throw new Error('部门信息不能为空');
      }
    }

    // IP地址格式验证
    if (data.ipAddress && !this.isValidIPAddress(data.ipAddress)) {
      throw new Error('IP地址格式不正确');
    }

    // 工位名称长度验证
    if (data.name && (data.name.length < 2 || data.name.length > 50)) {
      throw new Error('工位名称长度应在2-50个字符之间');
    }

    // 用户名验证
    if (data.username && (data.username.length < 2 || data.username.length > 30)) {
      throw new Error('用户名长度应在2-30个字符之间');
    }
  }

  /**
   * 验证IP地址格式
   * @param ip IP地址
   * @returns 是否有效
   */
  private isValidIPAddress(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * 加密敏感数据
   * @param data 原始数据
   * @returns 加密后的数据
   */
  private encryptSensitiveData(data: WorkstationCreateRequest): string {
    // 简单的Base64编码，实际项目中应使用更安全的加密算法
    try {
      return btoa(JSON.stringify(data));
    } catch (error) {
      console.warn('数据加密失败，使用原始数据:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * 生成请求ID
   * @returns 请求ID
   */
  private generateRequestId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const workstationService = WorkstationService.getInstance();

// 导出便捷函数
export const {
  getWorkstations,
  getWorkstationById,
  createWorkstation,
  updateWorkstation,
  deleteWorkstation,
  searchWorkstations,
  getWorkstationStats,
  batchImportWorkstations,
  checkHealth: checkWorkstationHealth
} = {
  getWorkstations: (params?: any) => workstationService.getWorkstations(params),
  getWorkstationById: (id: string) => workstationService.getWorkstationById(id),
  createWorkstation: (data: WorkstationCreateRequest) => workstationService.createWorkstation(data),
  updateWorkstation: (id: string, data: WorkstationUpdateRequest) => workstationService.updateWorkstation(id, data),
  deleteWorkstation: (id: string) => workstationService.deleteWorkstation(id),
  searchWorkstations: (params: WorkstationSearchParams) => workstationService.searchWorkstations(params),
  getWorkstationStats: () => workstationService.getWorkstationStats(),
  batchImportWorkstations: (data: WorkstationCreateRequest[]) => workstationService.batchImportWorkstations(data),
  checkHealth: () => workstationService.checkHealth()
};