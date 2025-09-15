// 跨系统查询服务
// 实现5173端口(部门地图系统)和3000端口(M1服务器管理系统)之间的双向查询功能

import { io, Socket } from 'socket.io-client';

// 跨系统查询接口定义
interface CrossSystemQueryRequest {
  type: 'employee_search' | 'workstation_query' | 'department_info' | 'status_sync';
  query: string;
  filters?: {
    department?: string;
    status?: 'online' | 'offline';
    dateRange?: {
      start: string;
      end: string;
    };
  };
  sourceSystem: 'dept_map_5175' | 'm1_server_3000';
  targetSystem: 'dept_map_5175' | 'm1_server_3000';
  requestId: string;
}

interface CrossSystemQueryResponse {
  requestId: string;
  success: boolean;
  data: any;
  error?: string;
  timestamp: string;
  sourceSystem: string;
}

interface SystemEndpoint {
  port: number;
  baseUrl: string;
  wsUrl: string;
  systemId: 'dept_map_5175' | 'm1_server_3000';
}

class CrossSystemQueryService {
  private static instance: CrossSystemQueryService;
  private wsConnections: Map<string, Socket> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private readonly QUERY_TIMEOUT = 10000; // 10秒超时
  private readonly MAX_RETRIES = 3;
  
  // 系统端点配置
  private readonly systemEndpoints: Map<string, SystemEndpoint> = new Map([
    ['dept_map_5175', {
      port: 5175,
      baseUrl: 'http://localhost:5175',
      wsUrl: 'http://localhost:8080', // 共享后端WebSocket
      systemId: 'dept_map_5175'
    }],
    ['m1_server_3000', {
      port: 3000,
      baseUrl: 'http://localhost:3000',
      wsUrl: 'http://localhost:8080', // 共享后端WebSocket
      systemId: 'm1_server_3000'
    }]
  ]);

  private constructor() {
    this.initializeConnections();
  }

  public static getInstance(): CrossSystemQueryService {
    if (!CrossSystemQueryService.instance) {
      CrossSystemQueryService.instance = new CrossSystemQueryService();
    }
    return CrossSystemQueryService.instance;
  }

  /**
   * 初始化WebSocket连接
   */
  private initializeConnections(): void {
    this.systemEndpoints.forEach((endpoint, systemId) => {
      const socket = io(endpoint.wsUrl + '/data-sync', {
        transports: ['polling', 'websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        forceNew: true,
        upgrade: true,
        query: {
          systemId: systemId,
          clientType: 'cross-system-query'
        }
      });

      socket.on('connect', () => {
        console.log(`跨系统查询服务已连接到 ${systemId}`);
      });

      socket.on('disconnect', () => {
        console.log(`跨系统查询服务与 ${systemId} 断开连接`);
      });

      socket.on('cross-system-response', (response: CrossSystemQueryResponse) => {
        this.handleQueryResponse(response);
      });

      socket.on('cross-system-broadcast', (data: any) => {
        this.handleBroadcastData(data);
      });

      this.wsConnections.set(systemId, socket);
    });
  }

  /**
   * 执行跨系统查询
   */
  public async executeQuery(
    targetSystem: 'dept_map_5175' | 'm1_server_3000',
    queryType: 'employee_search' | 'workstation_query' | 'department_info' | 'status_sync',
    query: string,
    filters?: any
  ): Promise<any> {
    const requestId = this.generateRequestId();
    const sourceSystem = this.getCurrentSystemId();
    
    const queryRequest: CrossSystemQueryRequest = {
      type: queryType,
      query,
      filters,
      sourceSystem,
      targetSystem,
      requestId
    };

    return new Promise((resolve, reject) => {
      // 设置超时处理
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`跨系统查询超时: ${queryType} to ${targetSystem}`));
      }, this.QUERY_TIMEOUT);

      // 存储请求回调
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });

      // 发送查询请求
      this.sendQueryRequest(queryRequest);
    });
  }

  /**
   * 发送查询请求
   */
  private sendQueryRequest(request: CrossSystemQueryRequest): void {
    const targetSocket = this.wsConnections.get(request.targetSystem);
    
    if (!targetSocket || !targetSocket.connected) {
      // 如果WebSocket未连接，尝试HTTP API调用
      this.fallbackToHttpQuery(request);
      return;
    }

    targetSocket.emit('cross-system-query', request);
  }

  /**
   * HTTP API备用查询方法
   */
  private async fallbackToHttpQuery(request: CrossSystemQueryRequest): Promise<void> {
    try {
      const endpoint = this.systemEndpoints.get(request.targetSystem);
      if (!endpoint) {
        throw new Error(`未知的目标系统: ${request.targetSystem}`);
      }

      let apiUrl = '';
      switch (request.type) {
        case 'employee_search':
          apiUrl = `${endpoint.baseUrl}/api/findUser?name=${encodeURIComponent(request.query)}`;
          break;
        case 'workstation_query':
          apiUrl = `${endpoint.baseUrl}/api/desks?dept=${encodeURIComponent(request.query)}`;
          break;
        case 'department_info':
          apiUrl = `${endpoint.baseUrl}/api/departments/${encodeURIComponent(request.query)}`;
          break;
        case 'status_sync':
          apiUrl = `${endpoint.baseUrl}/api/status?dept=${encodeURIComponent(request.query)}`;
          break;
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cross-System-Query': 'true',
          'X-Request-Id': request.requestId
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const queryResponse: CrossSystemQueryResponse = {
        requestId: request.requestId,
        success: true,
        data,
        timestamp: new Date().toISOString(),
        sourceSystem: request.targetSystem
      };

      this.handleQueryResponse(queryResponse);
    } catch (error) {
      const errorResponse: CrossSystemQueryResponse = {
        requestId: request.requestId,
        success: false,
        data: null,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString(),
        sourceSystem: request.targetSystem
      };

      this.handleQueryResponse(errorResponse);
    }
  }

  /**
   * 处理查询响应
   */
  private handleQueryResponse(response: CrossSystemQueryResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    
    if (!pendingRequest) {
      console.warn(`收到未知请求ID的响应: ${response.requestId}`);
      return;
    }

    // 清除超时定时器
    clearTimeout(pendingRequest.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.success) {
      pendingRequest.resolve(response.data);
    } else {
      pendingRequest.reject(new Error(response.error || '跨系统查询失败'));
    }
  }

  /**
   * 处理广播数据
   */
  private handleBroadcastData(data: any): void {
    // 处理来自其他系统的广播数据
    console.log('收到跨系统广播数据:', data);
    
    // 触发自定义事件，让其他组件可以监听
    window.dispatchEvent(new CustomEvent('cross-system-broadcast', {
      detail: data
    }));
  }

  /**
   * 广播数据到其他系统
   */
  public broadcastToOtherSystems(data: any, excludeSystem?: string): void {
    this.wsConnections.forEach((socket, systemId) => {
      if (systemId !== excludeSystem && socket.connected) {
        socket.emit('cross-system-broadcast', {
          ...data,
          sourceSystem: this.getCurrentSystemId(),
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 员工搜索跨系统查询
   */
  public async searchEmployeeAcrossSystems(name: string, filters?: any): Promise<any[]> {
    const results = [];
    
    // 并行查询所有系统
    const queryPromises = Array.from(this.systemEndpoints.keys())
      .filter(systemId => systemId !== this.getCurrentSystemId())
      .map(async (systemId) => {
        try {
          const result = await this.executeQuery(
            systemId as 'dept_map_5175' | 'm1_server_3000',
            'employee_search',
            name,
            filters
          );
          return { systemId, data: result, success: true };
        } catch (error) {
          console.error(`查询系统 ${systemId} 失败:`, error);
          return { systemId, data: null, success: false, error };
        }
      });

    const queryResults = await Promise.allSettled(queryPromises);
    
    queryResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.push({
          system: result.value.systemId,
          data: result.value.data
        });
      }
    });

    return results;
  }

  /**
   * 工位状态同步
   */
  public async syncWorkstationStatus(department?: string): Promise<any> {
    const syncResults = new Map();
    
    const syncPromises = Array.from(this.systemEndpoints.keys())
      .filter(systemId => systemId !== this.getCurrentSystemId())
      .map(async (systemId) => {
        try {
          const result = await this.executeQuery(
            systemId as 'dept_map_5175' | 'm1_server_3000',
            'status_sync',
            department || 'all'
          );
          syncResults.set(systemId, result);
        } catch (error) {
          console.error(`同步系统 ${systemId} 状态失败:`, error);
          syncResults.set(systemId, { error: error.message });
        }
      });

    await Promise.allSettled(syncPromises);
    return Object.fromEntries(syncResults);
  }

  /**
   * 获取当前系统ID
   */
  private getCurrentSystemId(): 'dept_map_5175' | 'm1_server_3000' {
    // 根据当前端口判断系统类型
    const currentPort = window.location.port;
    if (currentPort === '5175') {
      return 'dept_map_5175';
    } else if (currentPort === '3000') {
      return 'm1_server_3000';
    }
    // 默认返回部门地图系统
    return 'dept_map_5175';
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取连接状态
   */
  public getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.wsConnections.forEach((socket, systemId) => {
      status[systemId] = socket.connected;
    });
    return status;
  }

  /**
   * 重新连接所有系统
   */
  public reconnectAll(): void {
    this.wsConnections.forEach((socket) => {
      if (!socket.connected) {
        socket.connect();
      }
    });
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    // 清理所有待处理的请求
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout);
      request.reject(new Error('服务已销毁'));
    });
    this.pendingRequests.clear();

    // 断开所有WebSocket连接
    this.wsConnections.forEach((socket) => {
      socket.disconnect();
    });
    this.wsConnections.clear();
  }
}

// 导出单例实例
export const crossSystemQuery = CrossSystemQueryService.getInstance();
export default CrossSystemQueryService;

// 导出类型定义
export type {
  CrossSystemQueryRequest,
  CrossSystemQueryResponse,
  SystemEndpoint
};