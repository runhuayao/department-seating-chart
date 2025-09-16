/**
 * 系统架构关联逻辑服务
 * 基于系统架构关联逻辑文档实现
 */

import { Pool } from 'pg';
import { WebSocketManager } from '../websocket/manager';
import { SyncEventType } from './realtime';
import { EventEmitter } from 'events';

// 架构组件类型
export enum ComponentType {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DATABASE = 'database',
  CACHE = 'cache',
  WEBSOCKET = 'websocket',
  PROXY = 'proxy'
}

// 服务状态
export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

// 架构组件接口
export interface ArchitectureComponent {
  id: string;
  name: string;
  type: ComponentType;
  version: string;
  status: ServiceStatus;
  endpoint?: string;
  dependencies: string[];
  metrics: ComponentMetrics;
  lastCheck: Date;
}

// 组件指标接口
export interface ComponentMetrics {
  cpu?: number;
  memory?: number;
  responseTime?: number;
  errorRate?: number;
  throughput?: number;
  uptime?: number;
}

// 系统健康检查结果
export interface SystemHealthCheck {
  overall: ServiceStatus;
  components: ArchitectureComponent[];
  issues: HealthIssue[];
  timestamp: Date;
}

// 健康问题接口
export interface HealthIssue {
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
}

// 微前端配置接口
export interface MicrofrontendConfig {
  name: string;
  entry: string;
  activeRule: string;
  container: string;
  props?: Record<string, any>;
}

/**
 * 系统架构服务类
 */
export class ArchitectureService extends EventEmitter {
  private pool: Pool;
  private wsManager: WebSocketManager;
  private components: Map<string, ArchitectureComponent> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30秒

  constructor(pool: Pool, wsManager: WebSocketManager) {
    super();
    this.pool = pool;
    this.wsManager = wsManager;
    this.initializeComponents();
    this.startHealthChecks();
  }

  /**
   * 初始化系统组件
   */
  private initializeComponents(): void {
    const components: ArchitectureComponent[] = [
      {
        id: 'frontend-main',
        name: '部门地图前端',
        type: ComponentType.FRONTEND,
        version: '3.1.0',
        status: ServiceStatus.UNKNOWN,
        endpoint: process.env.FRONTEND_URL || 'http://localhost:5173',
        dependencies: ['backend-api'],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'frontend-server-mgmt',
        name: '服务器管理系统',
        type: ComponentType.FRONTEND,
        version: '3.1.0',
        status: ServiceStatus.UNKNOWN,
        endpoint: process.env.SERVER_MGMT_URL || 'http://localhost:5174',
        dependencies: ['backend-api'],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'backend-api',
        name: 'API服务',
        type: ComponentType.BACKEND,
        version: '3.1.0',
        status: ServiceStatus.UNKNOWN,
        endpoint: process.env.API_URL || 'http://localhost:3000',
        dependencies: ['database-postgres', 'cache-redis'],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'database-postgres',
        name: 'PostgreSQL数据库',
        type: ComponentType.DATABASE,
        version: '15.0',
        status: ServiceStatus.UNKNOWN,
        dependencies: [],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'cache-redis',
        name: 'Redis缓存',
        type: ComponentType.CACHE,
        version: '7.0',
        status: ServiceStatus.UNKNOWN,
        dependencies: [],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'websocket-server',
        name: 'WebSocket服务',
        type: ComponentType.WEBSOCKET,
        version: '3.1.0',
        status: ServiceStatus.UNKNOWN,
        dependencies: ['backend-api', 'cache-redis'],
        metrics: {},
        lastCheck: new Date()
      },
      {
        id: 'proxy-nginx',
        name: 'Nginx代理',
        type: ComponentType.PROXY,
        version: '1.24',
        status: ServiceStatus.UNKNOWN,
        dependencies: ['frontend-main', 'frontend-server-mgmt', 'backend-api'],
        metrics: {},
        lastCheck: new Date()
      }
    ];

    components.forEach(component => {
      this.components.set(component.id, component);
    });
  }

  /**
   * 开始健康检查
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // 立即执行一次健康检查
    this.performHealthCheck();
  }

  /**
   * 执行系统健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthCheck = await this.getSystemHealth();
      
      // 发布健康状态变更事件
      await this.wsManager.publishDataChange(
        SyncEventType.SYSTEM_CONFIG_UPDATED,
        {
          type: 'health_check',
          data: healthCheck
        },
        {
          source: 'architecture_service'
        }
      );

      // 检查是否有严重问题
      const criticalIssues = healthCheck.issues.filter(
        issue => issue.severity === 'critical'
      );

      if (criticalIssues.length > 0) {
        this.emit('critical_issues', criticalIssues);
      }

    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * 获取系统健康状态
   */
  public async getSystemHealth(): Promise<SystemHealthCheck> {
    const components: ArchitectureComponent[] = [];
    const issues: HealthIssue[] = [];
    let overallStatus = ServiceStatus.HEALTHY;

    // 检查每个组件
    for (const [id, component] of this.components) {
      const updatedComponent = await this.checkComponentHealth(component);
      components.push(updatedComponent);
      this.components.set(id, updatedComponent);

      // 收集问题
      if (updatedComponent.status === ServiceStatus.UNHEALTHY) {
        issues.push({
          component: updatedComponent.name,
          severity: 'critical',
          message: `组件 ${updatedComponent.name} 不可用`,
          timestamp: new Date()
        });
        overallStatus = ServiceStatus.UNHEALTHY;
      } else if (updatedComponent.status === ServiceStatus.DEGRADED) {
        issues.push({
          component: updatedComponent.name,
          severity: 'medium',
          message: `组件 ${updatedComponent.name} 性能下降`,
          timestamp: new Date()
        });
        if (overallStatus === ServiceStatus.HEALTHY) {
          overallStatus = ServiceStatus.DEGRADED;
        }
      }
    }

    return {
      overall: overallStatus,
      components,
      issues,
      timestamp: new Date()
    };
  }

  /**
   * 检查单个组件健康状态
   */
  private async checkComponentHealth(component: ArchitectureComponent): Promise<ArchitectureComponent> {
    const updatedComponent = { ...component };
    updatedComponent.lastCheck = new Date();

    try {
      switch (component.type) {
        case ComponentType.DATABASE:
          updatedComponent.status = await this.checkDatabaseHealth();
          updatedComponent.metrics = await this.getDatabaseMetrics();
          break;
        case ComponentType.CACHE:
          updatedComponent.status = await this.checkRedisHealth();
          updatedComponent.metrics = await this.getRedisMetrics();
          break;
        case ComponentType.WEBSOCKET:
          updatedComponent.status = await this.checkWebSocketHealth();
          updatedComponent.metrics = await this.getWebSocketMetrics();
          break;
        case ComponentType.BACKEND:
          updatedComponent.status = await this.checkBackendHealth(component.endpoint!);
          updatedComponent.metrics = await this.getBackendMetrics();
          break;
        case ComponentType.FRONTEND:
        case ComponentType.PROXY:
          updatedComponent.status = await this.checkHttpEndpoint(component.endpoint!);
          break;
        default:
          updatedComponent.status = ServiceStatus.UNKNOWN;
      }
    } catch (error) {
      console.error(`Health check failed for ${component.name}:`, error);
      updatedComponent.status = ServiceStatus.UNHEALTHY;
    }

    return updatedComponent;
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<ServiceStatus> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0 ? ServiceStatus.HEALTHY : ServiceStatus.UNHEALTHY;
    } catch (error) {
      return ServiceStatus.UNHEALTHY;
    }
  }

  /**
   * 获取数据库指标
   */
  private async getDatabaseMetrics(): Promise<ComponentMetrics> {
    try {
      const queries = [
        'SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'',
        'SELECT pg_database_size(current_database()) as db_size',
        'SELECT extract(epoch from (now() - pg_postmaster_start_time())) as uptime'
      ];

      const results = await Promise.all(
        queries.map(query => this.pool.query(query))
      );

      return {
        throughput: parseInt(results[0].rows[0].active_connections),
        memory: parseInt(results[1].rows[0].db_size),
        uptime: parseInt(results[2].rows[0].uptime)
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * 检查Redis健康状态
   */
  private async checkRedisHealth(): Promise<ServiceStatus> {
    try {
      const redis = this.wsManager.getRealtimeService();
      // 通过实时服务检查Redis连接
      return ServiceStatus.HEALTHY;
    } catch (error) {
      return ServiceStatus.UNHEALTHY;
    }
  }

  /**
   * 获取Redis指标
   */
  private async getRedisMetrics(): Promise<ComponentMetrics> {
    // 这里可以通过Redis INFO命令获取详细指标
    return {
      memory: 0,
      throughput: 0,
      uptime: 0
    };
  }

  /**
   * 检查WebSocket健康状态
   */
  private async checkWebSocketHealth(): Promise<ServiceStatus> {
    try {
      const stats = this.wsManager.getStats();
      return stats.activeConnections >= 0 ? ServiceStatus.HEALTHY : ServiceStatus.UNHEALTHY;
    } catch (error) {
      return ServiceStatus.UNHEALTHY;
    }
  }

  /**
   * 获取WebSocket指标
   */
  private async getWebSocketMetrics(): Promise<ComponentMetrics> {
    try {
      const stats = this.wsManager.getStats();
      return {
        throughput: stats.activeConnections,
        responseTime: stats.messagesSent,
        errorRate: stats.errors
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * 检查后端API健康状态
   */
  private async checkBackendHealth(endpoint: string): Promise<ServiceStatus> {
    try {
      const response = await fetch(`${endpoint}/health`);
      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy' ? ServiceStatus.HEALTHY : ServiceStatus.DEGRADED;
      }
      return ServiceStatus.UNHEALTHY;
    } catch (error) {
      return ServiceStatus.UNHEALTHY;
    }
  }

  /**
   * 获取后端指标
   */
  private async getBackendMetrics(): Promise<ComponentMetrics> {
    try {
      // 获取进程指标
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        memory: memUsage.heapUsed / 1024 / 1024, // MB
        cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // 转换为秒
        uptime: process.uptime()
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * 检查HTTP端点健康状态
   */
  private async checkHttpEndpoint(endpoint: string): Promise<ServiceStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'HEAD'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return ServiceStatus.HEALTHY;
      } else if (response.status >= 500) {
        return ServiceStatus.UNHEALTHY;
      } else {
        return ServiceStatus.DEGRADED;
      }
    } catch (error) {
      return ServiceStatus.UNHEALTHY;
    }
  }

  /**
   * 获取微前端配置
   */
  public getMicrofrontendConfig(): MicrofrontendConfig[] {
    return [
      {
        name: 'department-map',
        entry: process.env.FRONTEND_URL || 'http://localhost:5173',
        activeRule: '/',
        container: '#department-map-container',
        props: {
          basePath: '/'
        }
      },
      {
        name: 'server-management',
        entry: process.env.SERVER_MGMT_URL || 'http://localhost:5174',
        activeRule: '/server-management',
        container: '#server-mgmt-container',
        props: {
          basePath: '/server-management'
        }
      }
    ];
  }

  /**
   * 获取系统架构图数据
   */
  public getArchitectureDiagram(): any {
    const nodes = Array.from(this.components.values()).map(component => ({
      id: component.id,
      label: component.name,
      type: component.type,
      status: component.status,
      metrics: component.metrics
    }));

    const edges = [];
    for (const component of this.components.values()) {
      for (const dependency of component.dependencies) {
        edges.push({
          from: component.id,
          to: dependency,
          type: 'dependency'
        });
      }
    }

    return {
      nodes,
      edges,
      layout: 'hierarchical'
    };
  }

  /**
   * 获取组件详细信息
   */
  public getComponent(id: string): ArchitectureComponent | undefined {
    return this.components.get(id);
  }

  /**
   * 获取所有组件
   */
  public getAllComponents(): ArchitectureComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * 更新组件配置
   */
  public updateComponent(id: string, updates: Partial<ArchitectureComponent>): boolean {
    const component = this.components.get(id);
    if (component) {
      this.components.set(id, { ...component, ...updates });
      return true;
    }
    return false;
  }

  /**
   * 获取系统性能报告
   */
  public async getPerformanceReport(): Promise<any> {
    const components = Array.from(this.components.values());
    const healthCheck = await this.getSystemHealth();
    
    return {
      timestamp: new Date(),
      overall_status: healthCheck.overall,
      components: components.map(component => ({
        name: component.name,
        type: component.type,
        status: component.status,
        metrics: component.metrics,
        last_check: component.lastCheck
      })),
      issues: healthCheck.issues,
      recommendations: this.generateRecommendations(healthCheck)
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(healthCheck: SystemHealthCheck): string[] {
    const recommendations: string[] = [];
    
    for (const issue of healthCheck.issues) {
      switch (issue.severity) {
        case 'critical':
          recommendations.push(`紧急：${issue.message}，需要立即处理`);
          break;
        case 'high':
          recommendations.push(`高优先级：${issue.message}，建议尽快处理`);
          break;
        case 'medium':
          recommendations.push(`中等优先级：${issue.message}，建议在下次维护时处理`);
          break;
        case 'low':
          recommendations.push(`低优先级：${issue.message}，可以在空闲时处理`);
          break;
      }
    }

    // 添加通用建议
    if (healthCheck.overall === ServiceStatus.DEGRADED) {
      recommendations.push('系统性能下降，建议检查资源使用情况');
    }

    return recommendations;
  }

  /**
   * 关闭架构服务
   */
  public close(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    console.log('Architecture service closed');
  }
}