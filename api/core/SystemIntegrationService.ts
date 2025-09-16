/**
 * 系统集成服务 - 系统架构关联逻辑集成层组件
 * 负责协调多个前端系统与后端API的集成和通信
 */

import { EventEmitter } from 'events';
import { ConnectionManager } from './ConnectionManager';
import { DataSyncService } from './DataSyncService';

interface SystemInfo {
  id: string;
  name: string;
  type: 'department-map' | 'server-management' | 'api-monitor';
  port: number;
  baseUrl: string;
  status: 'online' | 'offline' | 'error';
  version: string;
  capabilities: string[];
  lastHealthCheck: Date;
  metadata: {
    description: string;
    maintainer: string;
    dependencies: string[];
    endpoints: string[];
  };
}

interface IntegrationConfig {
  healthCheckInterval: number;
  timeoutMs: number;
  retryAttempts: number;
  loadBalancing: boolean;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

interface ServiceRequest {
  id: string;
  source: string;
  target: string;
  method: string;
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: Date;
  timeout?: number;
}

interface ServiceResponse {
  requestId: string;
  status: number;
  data?: any;
  error?: string;
  timestamp: Date;
  duration: number;
}

export class SystemIntegrationService extends EventEmitter {
  private connectionManager: ConnectionManager;
  private dataSyncService: DataSyncService;
  private systems: Map<string, SystemInfo> = new Map();
  private config: IntegrationConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private circuitBreakers: Map<string, { failures: number; lastFailure: Date; isOpen: boolean }> = new Map();

  // 系统配置定义
  private systemConfigs = {
    'department-map': {
      name: '部门地图系统',
      port: 5173,
      baseUrl: 'http://localhost:5173',
      capabilities: ['department-visualization', 'user-management', 'workstation-mapping'],
      endpoints: ['/api/departments', '/api/users', '/api/workstations'],
      metadata: {
        description: '部门组织架构可视化和工位管理系统',
        maintainer: 'Frontend Team',
        dependencies: ['api-service', 'postgresql', 'redis']
      }
    },
    'server-management': {
      name: '服务器管理系统',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      capabilities: ['server-monitoring', 'resource-management', 'alert-system'],
      endpoints: ['/api/servers', '/api/resources', '/api/alerts'],
      metadata: {
        description: '服务器资源监控和管理系统',
        maintainer: 'Infrastructure Team',
        dependencies: ['api-service', 'monitoring-agents']
      }
    },
    'api-monitor': {
      name: 'API监控系统',
      port: 8080,
      baseUrl: 'http://localhost:8080',
      capabilities: ['api-monitoring', 'performance-analysis', 'log-aggregation'],
      endpoints: ['/api/metrics', '/api/logs', '/api/performance'],
      metadata: {
        description: 'API性能监控和日志分析系统',
        maintainer: 'DevOps Team',
        dependencies: ['api-service', 'elasticsearch', 'grafana']
      }
    }
  };

  constructor(
    connectionManager: ConnectionManager,
    dataSyncService: DataSyncService,
    config: Partial<IntegrationConfig> = {}
  ) {
    super();
    this.connectionManager = connectionManager;
    this.dataSyncService = dataSyncService;
    this.config = {
      healthCheckInterval: 30000, // 30秒
      timeoutMs: 10000, // 10秒
      retryAttempts: 3,
      loadBalancing: false,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000 // 1分钟
      },
      ...config
    };

    this.initialize();
  }

  /**
   * 初始化系统集成服务
   */
  private async initialize(): Promise<void> {
    try {
      // 初始化系统信息
      this.initializeSystems();
      
      // 启动健康检查
      this.startHealthCheck();
      
      // 监听连接管理器事件
      this.setupConnectionListeners();
      
      // 监听数据同步事件
      this.setupDataSyncListeners();
      
      console.log('✅ SystemIntegrationService initialized');
    } catch (error) {
      console.error('❌ SystemIntegrationService initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化系统信息
   */
  private initializeSystems(): void {
    for (const [type, config] of Object.entries(this.systemConfigs)) {
      const systemInfo: SystemInfo = {
        id: `${type}-${Date.now()}`,
        name: config.name,
        type: type as 'department-map' | 'server-management' | 'api-monitor',
        port: config.port,
        baseUrl: config.baseUrl,
        status: 'offline',
        version: '3.1.0',
        capabilities: config.capabilities,
        lastHealthCheck: new Date(),
        metadata: {
          description: config.metadata.description,
          maintainer: config.metadata.maintainer,
          dependencies: config.metadata.dependencies,
          endpoints: config.endpoints
        }
      };
      
      this.systems.set(type, systemInfo);
      
      // 初始化熔断器
      this.circuitBreakers.set(type, {
        failures: 0,
        lastFailure: new Date(0),
        isOpen: false
      });
    }
  }

  /**
   * 设置连接管理器监听器
   */
  private setupConnectionListeners(): void {
    this.connectionManager.on('system:connected', (connection) => {
      this.handleSystemConnected(connection);
    });
    
    this.connectionManager.on('system:disconnected', (connection) => {
      this.handleSystemDisconnected(connection);
    });
    
    this.connectionManager.on('system:timeout', (connection) => {
      this.handleSystemTimeout(connection);
    });
  }

  /**
   * 设置数据同步监听器
   */
  private setupDataSyncListeners(): void {
    this.dataSyncService.on('sync:completed', (operation) => {
      this.handleSyncCompleted(operation);
    });
    
    this.dataSyncService.on('sync:failed', (operation) => {
      this.handleSyncFailed(operation);
    });
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const healthPromises = Array.from(this.systems.values()).map(async (system) => {
      try {
        const isHealthy = await this.checkSystemHealth(system);
        
        if (isHealthy) {
          system.status = 'online';
          system.lastHealthCheck = new Date();
          
          // 重置熔断器
          const breaker = this.circuitBreakers.get(system.type);
          if (breaker && breaker.isOpen) {
            breaker.isOpen = false;
            breaker.failures = 0;
            console.log(`🔄 Circuit breaker reset for ${system.type}`);
          }
        } else {
          system.status = 'error';
          this.handleSystemError(system, new Error('Health check failed'));
        }
      } catch (error) {
        system.status = 'error';
        this.handleSystemError(system, error as Error);
      }
    });

    await Promise.allSettled(healthPromises);
    
    // 发布健康状态更新
    this.emit('health:updated', this.getSystemsHealth());
  }

  /**
   * 检查系统健康状态
   */
  private async checkSystemHealth(system: SystemInfo): Promise<boolean> {
    try {
      const response = await fetch(`${system.baseUrl}/health`, {
        method: 'GET',
        timeout: this.config.timeoutMs
      } as any);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 处理系统连接事件
   */
  private handleSystemConnected(connection: any): void {
    const system = this.systems.get(connection.type);
    if (system) {
      system.status = 'online';
      system.id = connection.id;
      system.lastHealthCheck = new Date();
      
      console.log(`🔗 System integrated: ${system.name} (${connection.type})`);
      this.emit('system:integrated', system);
      
      // 发送系统配置信息
      this.sendSystemConfiguration(system);
    }
  }

  /**
   * 处理系统断开事件
   */
  private handleSystemDisconnected(connection: any): void {
    const system = this.systems.get(connection.type);
    if (system) {
      system.status = 'offline';
      
      console.log(`🔌 System disconnected: ${system.name} (${connection.type})`);
      this.emit('system:disconnected', system);
    }
  }

  /**
   * 处理系统超时事件
   */
  private handleSystemTimeout(connection: any): void {
    const system = this.systems.get(connection.type);
    if (system) {
      system.status = 'error';
      this.handleSystemError(system, new Error('Connection timeout'));
    }
  }

  /**
   * 处理系统错误
   */
  private handleSystemError(system: SystemInfo, error: Error): void {
    console.error(`❌ System error: ${system.name}`, error);
    
    // 更新熔断器
    const breaker = this.circuitBreakers.get(system.type);
    if (breaker && this.config.circuitBreaker.enabled) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.failures >= this.config.circuitBreaker.failureThreshold) {
        breaker.isOpen = true;
        console.warn(`⚠️ Circuit breaker opened for ${system.type}`);
        
        // 设置恢复定时器
        setTimeout(() => {
          breaker.isOpen = false;
          breaker.failures = 0;
          console.log(`🔄 Circuit breaker recovery attempt for ${system.type}`);
        }, this.config.circuitBreaker.recoveryTimeout);
      }
    }
    
    this.emit('system:error', { system, error });
  }

  /**
   * 发送系统配置信息
   */
  private sendSystemConfiguration(system: SystemInfo): void {
    const config = {
      systemInfo: {
        id: system.id,
        type: system.type,
        version: system.version,
        capabilities: system.capabilities
      },
      integrationConfig: {
        apiBaseUrl: 'http://localhost:3001/api',
        websocketUrl: 'ws://localhost:3001',
        syncEnabled: true,
        healthCheckInterval: this.config.healthCheckInterval
      },
      dataSync: {
        tables: this.getRelevantTables(system.type),
        conflictResolution: 'timestamp_wins'
      }
    };
    
    this.connectionManager.sendToSystem(system.id, 'system_config', config);
  }

  /**
   * 获取系统相关的数据表
   */
  private getRelevantTables(systemType: string): string[] {
    const tableMapping = {
      'department-map': ['departments', 'users', 'workstations'],
      'server-management': ['departments', 'users', 'servers', 'resources'],
      'api-monitor': ['users', 'system_logs', 'api_metrics']
    };
    
    return tableMapping[systemType as keyof typeof tableMapping] || [];
  }

  /**
   * 处理同步完成事件
   */
  private handleSyncCompleted(operation: any): void {
    // 通知相关系统数据已同步
    if (operation.target) {
      operation.target.forEach((target: string) => {
        const system = this.systems.get(target);
        if (system && system.status === 'online') {
          this.connectionManager.sendToSystem(system.id, 'sync_completed', {
            table: operation.table,
            operation: operation.type,
            timestamp: operation.timestamp
          });
        }
      });
    }
  }

  /**
   * 处理同步失败事件
   */
  private handleSyncFailed(operation: any): void {
    console.error(`❌ Sync failed for ${operation.table}:`, operation.error);
    
    // 通知相关系统同步失败
    if (operation.target) {
      operation.target.forEach((target: string) => {
        const system = this.systems.get(target);
        if (system && system.status === 'online') {
          this.connectionManager.sendToSystem(system.id, 'sync_failed', {
            table: operation.table,
            operation: operation.type,
            error: operation.error,
            timestamp: operation.timestamp
          });
        }
      });
    }
  }

  /**
   * 服务间通信代理
   */
  public async proxyRequest(request: ServiceRequest): Promise<ServiceResponse> {
    const startTime = Date.now();
    
    try {
      // 检查熔断器
      const breaker = this.circuitBreakers.get(request.target);
      if (breaker?.isOpen) {
        throw new Error(`Circuit breaker is open for ${request.target}`);
      }
      
      // 获取目标系统
      const targetSystem = this.systems.get(request.target);
      if (!targetSystem || targetSystem.status !== 'online') {
        throw new Error(`Target system ${request.target} is not available`);
      }
      
      // 构建请求URL
      const url = `${targetSystem.baseUrl}${request.endpoint}`;
      
      // 发送请求
      const response = await fetch(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': request.id,
          'X-Source-System': request.source,
          ...request.headers
        },
        body: request.data ? JSON.stringify(request.data) : undefined,
        timeout: request.timeout || this.config.timeoutMs
      } as any);
      
      const responseData = await response.json();
      
      const serviceResponse: ServiceResponse = {
        requestId: request.id,
        status: response.status,
        data: responseData,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      
      // 记录成功请求
      this.emit('request:completed', { request, response: serviceResponse });
      
      return serviceResponse;
    } catch (error) {
      const serviceResponse: ServiceResponse = {
        requestId: request.id,
        status: 500,
        error: (error as Error).message,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      
      // 记录失败请求
      this.emit('request:failed', { request, response: serviceResponse, error });
      
      // 更新熔断器
      const breaker = this.circuitBreakers.get(request.target);
      if (breaker) {
        breaker.failures++;
        breaker.lastFailure = new Date();
      }
      
      return serviceResponse;
    }
  }

  /**
   * 广播事件到所有系统
   */
  public broadcastEvent(event: string, data: any, excludeSystem?: string): void {
    for (const [type, system] of this.systems) {
      if (system.status === 'online' && type !== excludeSystem) {
        this.connectionManager.sendToSystem(system.id, event, data);
      }
    }
    
    console.log(`📡 Event broadcasted: ${event}`, data);
  }

  /**
   * 获取系统健康状态
   */
  public getSystemsHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    systems: Array<{
      type: string;
      name: string;
      status: string;
      lastHealthCheck: Date;
      capabilities: string[];
    }>;
    circuitBreakers: Array<{
      system: string;
      isOpen: boolean;
      failures: number;
      lastFailure: Date;
    }>;
  } {
    const systemsArray = Array.from(this.systems.values());
    const onlineSystems = systemsArray.filter(s => s.status === 'online').length;
    const totalSystems = systemsArray.length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (onlineSystems === totalSystems) {
      overall = 'healthy';
    } else if (onlineSystems > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }
    
    return {
      overall,
      systems: systemsArray.map(system => ({
        type: system.type,
        name: system.name,
        status: system.status,
        lastHealthCheck: system.lastHealthCheck,
        capabilities: system.capabilities
      })),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([system, breaker]) => ({
        system,
        isOpen: breaker.isOpen,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure
      }))
    };
  }

  /**
   * 获取系统集成指标
   */
  public getIntegrationMetrics(): {
    totalSystems: number;
    onlineSystems: number;
    offlineSystems: number;
    errorSystems: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  } {
    const systemsArray = Array.from(this.systems.values());
    
    return {
      totalSystems: systemsArray.length,
      onlineSystems: systemsArray.filter(s => s.status === 'online').length,
      offlineSystems: systemsArray.filter(s => s.status === 'offline').length,
      errorSystems: systemsArray.filter(s => s.status === 'error').length,
      totalRequests: 0, // 这些指标需要从实际请求日志中统计
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  /**
   * 重启系统集成
   */
  public async restartIntegration(systemType: string): Promise<void> {
    const system = this.systems.get(systemType);
    if (!system) {
      throw new Error(`System ${systemType} not found`);
    }
    
    console.log(`🔄 Restarting integration for ${system.name}`);
    
    // 重置系统状态
    system.status = 'offline';
    
    // 重置熔断器
    const breaker = this.circuitBreakers.get(systemType);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      breaker.lastFailure = new Date(0);
    }
    
    // 触发重新连接
    this.emit('system:restart', system);
    
    console.log(`✅ Integration restart initiated for ${system.name}`);
  }

  /**
   * 关闭系统集成服务
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing SystemIntegrationService...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // 通知所有系统服务即将关闭
    this.broadcastEvent('service_shutdown', { timestamp: new Date() });
    
    // 清理系统状态
    this.systems.clear();
    this.circuitBreakers.clear();
    
    console.log('✅ SystemIntegrationService closed');
  }
}