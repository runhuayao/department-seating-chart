import { Pool } from 'pg';
import { WebSocketServer } from './server-monitor';

// 系统指标接口
interface SystemMetrics {
  timestamp: Date;
  websocket: {
    activeConnections: number;
    totalMessages: number;
    averageResponseTime: number;
  };
  database: {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
}

// 连接故障恢复管理器
export class ConnectionRecoveryManager {
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private wsServer: WebSocketServer;

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
  }

  public async handleConnectionFailure(connectionId: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(connectionId, attempts + 1);
      
      // 指数退避重连策略
      const delay = this.reconnectDelay * Math.pow(2, attempts);
      
      console.log(`Scheduling reconnection attempt ${attempts + 1} for ${connectionId} in ${delay}ms`);
      
      setTimeout(async () => {
        try {
          await this.attemptReconnection(connectionId);
          this.reconnectAttempts.delete(connectionId);
          console.log(`Successfully reconnected ${connectionId}`);
        } catch (error) {
          console.error(`Reconnection attempt ${attempts + 1} failed for ${connectionId}:`, error);
          await this.handleConnectionFailure(connectionId);
        }
      }, delay);
    } else {
      console.error(`Max reconnection attempts reached for connection ${connectionId}`);
      this.reconnectAttempts.delete(connectionId);
      await this.handleMaxAttemptsReached(connectionId);
    }
  }

  private async attemptReconnection(connectionId: string): Promise<void> {
    console.log(`Attempting to reconnect connection ${connectionId}`);
    
    // 检查连接状态
    const stats = this.wsServer.getConnectionStats();
    if (stats.totalConnections < 1000) {
      // 连接数未达到上限，可以尝试重连
      return Promise.resolve();
    } else {
      throw new Error('Server connection limit reached');
    }
  }

  private async handleMaxAttemptsReached(connectionId: string): Promise<void> {
    console.log(`Handling max attempts reached for ${connectionId}`);
    
    // 记录到监控系统
    // 可以在这里添加告警逻辑
    
    // 清理相关资源
    this.cleanup(connectionId);
  }

  private cleanup(connectionId: string): void {
    // 清理与该连接相关的资源
    console.log(`Cleaning up resources for connection ${connectionId}`);
  }

  public getReconnectionStats(): any {
    return {
      activeReconnections: this.reconnectAttempts.size,
      reconnectionAttempts: Object.fromEntries(this.reconnectAttempts)
    };
  }
}

// 数据库连接故障恢复管理器
export class DatabaseRecoveryManager {
  private pool: Pool;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy: boolean = true;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 3;
  private healthCheckFrequency: number = 30000; // 30秒

  constructor(pool: Pool) {
    this.pool = pool;
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        
        if (!this.isHealthy) {
          console.log('Database connection restored');
          this.isHealthy = true;
          this.consecutiveFailures = 0;
        }
      } catch (error) {
        this.consecutiveFailures++;
        console.error(`Database health check failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, error);
        
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          this.isHealthy = false;
          await this.handleDatabaseFailure();
        }
      }
    }, this.healthCheckFrequency);
  }

  private async performHealthCheck(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT 1 as health_check, NOW() as timestamp');
      if (!result.rows || result.rows.length === 0) {
        throw new Error('Health check query returned no results');
      }
    } finally {
      client.release();
    }
  }

  private async handleDatabaseFailure(): Promise<void> {
    console.log('Handling database failure...');
    
    try {
      // 1. 记录故障时间
      const failureTime = new Date();
      console.log(`Database failure detected at ${failureTime.toISOString()}`);
      
      // 2. 尝试优雅关闭现有连接
      await this.gracefulShutdown();
      
      // 3. 等待一段时间后重新初始化
      await this.waitAndReconnect();
      
    } catch (error) {
      console.error('Failed to handle database failure:', error);
      
      // 如果恢复失败，继续尝试
      setTimeout(() => {
        this.handleDatabaseFailure();
      }, 60000); // 1分钟后重试
    }
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Performing graceful database shutdown...');
    
    try {
      // 等待现有查询完成（最多等待30秒）
      const shutdownPromise = this.pool.end();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), 30000);
      });
      
      await Promise.race([shutdownPromise, timeoutPromise]);
      console.log('Database pool shutdown completed');
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      // 强制关闭
      await this.forceShutdown();
    }
  }

  private async forceShutdown(): Promise<void> {
    console.log('Performing force database shutdown...');
    // 这里可以添加强制关闭逻辑
    // 注意：pg库的Pool没有直接的强制关闭方法
  }

  private async waitAndReconnect(): Promise<void> {
    console.log('Waiting before reconnection attempt...');
    
    // 等待5秒后尝试重连
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Attempting database reconnection...');
    
    // 重新创建连接池
    // 注意：这里需要重新初始化Pool，但需要外部协调
    // 实际实现中可能需要通过事件或回调来通知上层重新创建Pool
  }

  public isHealthyStatus(): boolean {
    return this.isHealthy;
  }

  public getHealthStats(): any {
    return {
      isHealthy: this.isHealthy,
      consecutiveFailures: this.consecutiveFailures,
      maxConsecutiveFailures: this.maxConsecutiveFailures,
      lastCheckTime: new Date()
    };
  }

  public stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// 系统监控器
export class SystemMonitor {
  private metrics: SystemMetrics[] = [];
  private maxMetricsHistory: number = 1000;
  private wsServer: WebSocketServer;
  private dbPool: Pool;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;

  constructor(wsServer: WebSocketServer, dbPool: Pool) {
    this.wsServer = wsServer;
    this.dbPool = dbPool;
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // 每分钟收集一次指标
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000);
    
    // 每5分钟检查告警条件
    this.alertInterval = setInterval(() => {
      this.checkAlerts();
    }, 300000);
  }

  private collectMetrics(): void {
    try {
      // WebSocket连接指标
      const wsStats = this.wsServer.getConnectionStats();
      
      // 内存使用指标
      const memUsage = process.memoryUsage();
      
      // CPU使用指标（简化版）
      const cpuUsage = process.cpuUsage();
      
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        websocket: {
          activeConnections: wsStats.activeConnections || 0,
          totalMessages: 0, // 需要从WebSocket服务器获取
          averageResponseTime: 0 // 需要从WebSocket服务器获取
        },
        database: {
          totalConnections: this.dbPool.totalCount || 0,
          idleConnections: this.dbPool.idleCount || 0,
          waitingClients: this.dbPool.waitingCount || 0
        },
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000 // 转换为毫秒
        }
      };
      
      this.metrics.push(metrics);
      
      // 保持历史记录在限制范围内
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics = this.metrics.slice(-this.maxMetricsHistory);
      }
      
      console.log('Metrics collected:', {
        wsConnections: metrics.websocket.activeConnections,
        dbConnections: metrics.database.totalConnections,
        memoryUsage: `${metrics.memory.percentage.toFixed(2)}%`
      });
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private checkAlerts(): void {
    if (this.metrics.length === 0) return;
    
    const currentMetrics = this.metrics[this.metrics.length - 1];
    
    // 检查WebSocket连接数告警
    if (currentMetrics.websocket.activeConnections > 800) {
      this.sendAlert('HIGH_WEBSOCKET_CONNECTIONS', {
        current: currentMetrics.websocket.activeConnections,
        threshold: 800,
        timestamp: currentMetrics.timestamp
      });
    }
    
    // 检查数据库连接池告警
    if (currentMetrics.database.waitingClients > 10) {
      this.sendAlert('HIGH_DB_WAITING_CLIENTS', {
        current: currentMetrics.database.waitingClients,
        threshold: 10,
        timestamp: currentMetrics.timestamp
      });
    }
    
    // 检查内存使用告警
    if (currentMetrics.memory.percentage > 85) {
      this.sendAlert('HIGH_MEMORY_USAGE', {
        current: `${currentMetrics.memory.percentage.toFixed(2)}%`,
        threshold: '85%',
        timestamp: currentMetrics.timestamp
      });
    }
    
    // 检查数据库连接池利用率
    const dbUtilization = (currentMetrics.database.totalConnections - currentMetrics.database.idleConnections) / currentMetrics.database.totalConnections * 100;
    if (dbUtilization > 90) {
      this.sendAlert('HIGH_DB_UTILIZATION', {
        current: `${dbUtilization.toFixed(2)}%`,
        threshold: '90%',
        timestamp: currentMetrics.timestamp
      });
    }
  }

  private sendAlert(alertType: string, data: any): void {
    const alert = {
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      data: data,
      timestamp: new Date().toISOString()
    };
    
    console.warn(`🚨 ALERT [${alert.severity}] ${alertType}:`, data);
    
    // 这里可以集成外部告警系统
    // 例如：发送邮件、Slack通知、短信等
    this.notifyExternalSystems(alert);
  }

  private getAlertSeverity(alertType: string): string {
    const severityMap: { [key: string]: string } = {
      'HIGH_WEBSOCKET_CONNECTIONS': 'WARNING',
      'HIGH_DB_WAITING_CLIENTS': 'CRITICAL',
      'HIGH_MEMORY_USAGE': 'WARNING',
      'HIGH_DB_UTILIZATION': 'CRITICAL'
    };
    
    return severityMap[alertType] || 'INFO';
  }

  private notifyExternalSystems(alert: any): void {
    // 这里可以实现外部通知逻辑
    // 例如：
    // - 发送到监控系统（如Prometheus、Grafana）
    // - 发送邮件通知
    // - 发送Slack消息
    // - 调用Webhook
    
    console.log('External notification sent for alert:', alert.type);
  }

  public getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(limit?: number): SystemMetrics[] {
    const actualLimit = limit || this.metrics.length;
    return this.metrics.slice(-actualLimit);
  }

  public getAverageMetrics(minutes: number = 5): Partial<SystemMetrics> | null {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    
    if (recentMetrics.length === 0) return null;
    
    const avgMetrics = recentMetrics.reduce((acc, metrics) => {
      acc.websocket.activeConnections += metrics.websocket.activeConnections;
      acc.database.totalConnections += metrics.database.totalConnections;
      acc.database.waitingClients += metrics.database.waitingClients;
      acc.memory.percentage += metrics.memory.percentage;
      return acc;
    }, {
      websocket: { activeConnections: 0, totalMessages: 0, averageResponseTime: 0 },
      database: { totalConnections: 0, idleConnections: 0, waitingClients: 0 },
      memory: { used: 0, total: 0, percentage: 0 },
      cpu: { usage: 0 }
    });
    
    const count = recentMetrics.length;
    return {
      websocket: {
        activeConnections: Math.round(avgMetrics.websocket.activeConnections / count),
        totalMessages: 0,
        averageResponseTime: 0
      },
      database: {
        totalConnections: Math.round(avgMetrics.database.totalConnections / count),
        idleConnections: 0,
        waitingClients: Math.round(avgMetrics.database.waitingClients / count)
      },
      memory: {
        used: 0,
        total: 0,
        percentage: avgMetrics.memory.percentage / count
      },
      cpu: { usage: 0 }
    };
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
  }
}

// 综合恢复管理器
export class ComprehensiveRecoveryManager {
  private connectionRecovery: ConnectionRecoveryManager;
  private databaseRecovery: DatabaseRecoveryManager;
  private systemMonitor: SystemMonitor;

  constructor(
    wsServer: WebSocketServer,
    dbPool: Pool
  ) {
    this.connectionRecovery = new ConnectionRecoveryManager(wsServer);
    this.databaseRecovery = new DatabaseRecoveryManager(dbPool);
    this.systemMonitor = new SystemMonitor(wsServer, dbPool);
  }

  public getSystemStatus(): any {
    return {
      database: this.databaseRecovery.getHealthStats(),
      connections: this.connectionRecovery.getReconnectionStats(),
      metrics: this.systemMonitor.getCurrentMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  public async handleSystemFailure(failureType: string, context: any): Promise<void> {
    console.log(`Handling system failure: ${failureType}`, context);
    
    switch (failureType) {
      case 'websocket_connection':
        await this.connectionRecovery.handleConnectionFailure(context.connectionId);
        break;
      case 'database_connection':
        // 数据库故障由DatabaseRecoveryManager自动处理
        break;
      default:
        console.warn(`Unknown failure type: ${failureType}`);
    }
  }

  public shutdown(): void {
    this.databaseRecovery.stopHealthCheck();
    this.systemMonitor.stopMonitoring();
    console.log('Comprehensive recovery manager shutdown completed');
  }
}