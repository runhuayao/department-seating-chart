/**
 * 系统监控服务
 * 基于WebSocket与PostgreSQL组件关联技术文档实现
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { WebSocketConnectionManager } from './connection-manager';
import { ConnectionRecoveryManager, DatabaseRecoveryManager } from './recovery-manager';
import os from 'os';
import fs from 'fs/promises';

// 监控指标接口
export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  database: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  websocket: {
    totalConnections: number;
    activeConnections: number;
    messageCount: number;
    errorCount: number;
  };
  redis: {
    connected: boolean;
    usedMemory: number;
    keyCount: number;
    commandsProcessed: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

// 告警级别枚举
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 告警类型枚举
export enum AlertType {
  HIGH_CPU_USAGE = 'high_cpu_usage',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  DATABASE_CONNECTION_LIMIT = 'database_connection_limit',
  WEBSOCKET_CONNECTION_LIMIT = 'websocket_connection_limit',
  SLOW_QUERY = 'slow_query',
  CONNECTION_ERROR = 'connection_error',
  DISK_SPACE_LOW = 'disk_space_low',
  REDIS_CONNECTION_LOST = 'redis_connection_lost'
}

// 告警接口
export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

// 监控配置接口
export interface MonitorConfig {
  metricsInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    dbConnectionUsage: number;
    wsConnectionUsage: number;
    slowQueryTime: number;
  };
  retentionPeriod: number;
  enableAlerts: boolean;
}

/**
 * 系统监控器
 */
export class SystemMonitor extends EventEmitter {
  private pool: Pool;
  private redis: Redis;
  private connectionManager: WebSocketConnectionManager;
  private connectionRecovery: ConnectionRecoveryManager;
  private databaseRecovery: DatabaseRecoveryManager;
  
  private metricsHistory: SystemMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private config: MonitorConfig;
  
  // 性能计数器
  private queryCount: number = 0;
  private totalQueryTime: number = 0;
  private slowQueryCount: number = 0;
  private networkStats = {
    bytesIn: 0,
    bytesOut: 0,
    packetsIn: 0,
    packetsOut: 0
  };
  
  constructor(
    pool: Pool,
    redis: Redis,
    connectionManager: WebSocketConnectionManager,
    connectionRecovery: ConnectionRecoveryManager,
    databaseRecovery: DatabaseRecoveryManager,
    config: Partial<MonitorConfig> = {}
  ) {
    super();
    this.pool = pool;
    this.redis = redis;
    this.connectionManager = connectionManager;
    this.connectionRecovery = connectionRecovery;
    this.databaseRecovery = databaseRecovery;
    
    this.config = {
      metricsInterval: 30000, // 30秒
      alertThresholds: {
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        diskUsage: 90, // 90%
        dbConnectionUsage: 80, // 80%
        wsConnectionUsage: 90, // 90%
        slowQueryTime: 1000 // 1秒
      },
      retentionPeriod: 24 * 60 * 60 * 1000, // 24小时
      enableAlerts: true,
      ...config
    };
    
    this.setupEventHandlers();
    this.startMonitoring();
  }
  
  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听数据库查询事件
    this.pool.on('connect', () => {
      this.emit('database_connection_created');
    });
    
    this.pool.on('error', (error) => {
      this.createAlert(
        AlertType.CONNECTION_ERROR,
        AlertLevel.ERROR,
        `Database connection error: ${error.message}`,
        { error: error.message }
      );
    });
    
    // 监听WebSocket事件
    this.connectionManager.on('connection_added', () => {
      this.checkWebSocketConnectionLimit();
    });
    
    this.connectionManager.on('connection_error', (data) => {
      this.createAlert(
        AlertType.CONNECTION_ERROR,
        AlertLevel.WARNING,
        `WebSocket connection error: ${data.error.message}`,
        { connectionId: data.connectionId, error: data.error.message }
      );
    });
    
    // 监听恢复管理器事件
    this.connectionRecovery.on('recovery_failed', (data) => {
      this.createAlert(
        AlertType.CONNECTION_ERROR,
        AlertLevel.CRITICAL,
        `Connection recovery failed for ${data.connectionId}`,
        data
      );
    });
    
    this.databaseRecovery.on('circuit_breaker_triggered', (data) => {
      this.createAlert(
        AlertType.CONNECTION_ERROR,
        AlertLevel.CRITICAL,
        `Database circuit breaker triggered after ${data.failureCount} failures`,
        data
      );
    });
  }
  
  /**
   * 开始监控
   */
  private startMonitoring(): void {
    console.log('Starting system monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        this.checkAlertConditions();
        this.cleanupOldData();
      } catch (error) {
        console.error('Error during monitoring cycle:', error);
      }
    }, this.config.metricsInterval);
  }
  
  /**
   * 收集系统指标
   */
  private async collectMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: await this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      database: await this.getDatabaseMetrics(),
      websocket: this.getWebSocketMetrics(),
      redis: await this.getRedisMetrics(),
      network: this.getNetworkMetrics()
    };
    
    this.metricsHistory.push(metrics);
    this.emit('metrics_collected', metrics);
    
    // 广播指标给WebSocket客户端
    this.connectionManager.broadcastToChannel('system_metrics', {
      type: 'system_metrics',
      data: metrics
    });
  }
  
  /**
   * 获取CPU指标
   */
  private async getCPUMetrics(): Promise<{ usage: number; loadAverage: number[] }> {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // 计算CPU使用率
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    
    const usage = 100 - (totalIdle / totalTick) * 100;
    
    return {
      usage: Math.round(usage * 100) / 100,
      loadAverage
    };
  }
  
  /**
   * 获取内存指标
   */
  private getMemoryMetrics(): SystemMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;
    
    return {
      total,
      used,
      free,
      usage: Math.round(usage * 100) / 100
    };
  }
  
  /**
   * 获取数据库指标
   */
  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const poolStats = {
        totalConnections: this.pool.totalCount,
        activeConnections: this.pool.totalCount - this.pool.idleCount,
        idleConnections: this.pool.idleCount,
        waitingConnections: this.pool.waitingCount
      };
      
      const averageQueryTime = this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0;
      
      return {
        ...poolStats,
        queryCount: this.queryCount,
        averageQueryTime: Math.round(averageQueryTime * 100) / 100,
        slowQueries: this.slowQueryCount
      };
    } catch (error) {
      console.error('Error getting database metrics:', error);
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
        queryCount: this.queryCount,
        averageQueryTime: 0,
        slowQueries: this.slowQueryCount
      };
    }
  }
  
  /**
   * 获取WebSocket指标
   */
  private getWebSocketMetrics(): SystemMetrics['websocket'] {
    const stats = this.connectionManager.getStats();
    
    return {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      messageCount: stats.totalMessages,
      errorCount: stats.connectionsByStatus.error || 0
    };
  }
  
  /**
   * 获取Redis指标
   */
  private async getRedisMetrics(): Promise<SystemMetrics['redis']> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      const stats = await this.redis.info('stats');
      
      // 解析内存使用情况
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      // 解析命令处理数量
      const commandsMatch = stats.match(/total_commands_processed:(\d+)/);
      const commandsProcessed = commandsMatch ? parseInt(commandsMatch[1]) : 0;
      
      return {
        connected: true,
        usedMemory,
        keyCount,
        commandsProcessed
      };
    } catch (error) {
      console.error('Error getting Redis metrics:', error);
      return {
        connected: false,
        usedMemory: 0,
        keyCount: 0,
        commandsProcessed: 0
      };
    }
  }
  
  /**
   * 获取网络指标
   */
  private getNetworkMetrics(): SystemMetrics['network'] {
    // 这里返回累计的网络统计
    return { ...this.networkStats };
  }
  
  /**
   * 记录查询性能
   */
  public recordQuery(duration: number): void {
    this.queryCount++;
    this.totalQueryTime += duration;
    
    if (duration > this.config.alertThresholds.slowQueryTime) {
      this.slowQueryCount++;
      
      if (this.config.enableAlerts) {
        this.createAlert(
          AlertType.SLOW_QUERY,
          AlertLevel.WARNING,
          `Slow query detected: ${duration}ms`,
          { duration, threshold: this.config.alertThresholds.slowQueryTime }
        );
      }
    }
  }
  
  /**
   * 记录网络流量
   */
  public recordNetworkTraffic(bytesIn: number, bytesOut: number, packetsIn: number = 1, packetsOut: number = 1): void {
    this.networkStats.bytesIn += bytesIn;
    this.networkStats.bytesOut += bytesOut;
    this.networkStats.packetsIn += packetsIn;
    this.networkStats.packetsOut += packetsOut;
  }
  
  /**
   * 检查告警条件
   */
  private checkAlertConditions(): void {
    if (!this.config.enableAlerts || this.metricsHistory.length === 0) {
      return;
    }
    
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    
    // 检查CPU使用率
    if (latestMetrics.cpu.usage > this.config.alertThresholds.cpuUsage) {
      this.createAlert(
        AlertType.HIGH_CPU_USAGE,
        AlertLevel.WARNING,
        `High CPU usage: ${latestMetrics.cpu.usage}%`,
        { usage: latestMetrics.cpu.usage, threshold: this.config.alertThresholds.cpuUsage }
      );
    }
    
    // 检查内存使用率
    if (latestMetrics.memory.usage > this.config.alertThresholds.memoryUsage) {
      this.createAlert(
        AlertType.HIGH_MEMORY_USAGE,
        AlertLevel.WARNING,
        `High memory usage: ${latestMetrics.memory.usage}%`,
        { usage: latestMetrics.memory.usage, threshold: this.config.alertThresholds.memoryUsage }
      );
    }
    
    // 检查数据库连接使用率
    this.checkDatabaseConnectionLimit(latestMetrics);
    
    // 检查WebSocket连接使用率
    this.checkWebSocketConnectionLimit();
    
    // 检查Redis连接
    if (!latestMetrics.redis.connected) {
      this.createAlert(
        AlertType.REDIS_CONNECTION_LOST,
        AlertLevel.ERROR,
        'Redis connection lost',
        { timestamp: latestMetrics.timestamp }
      );
    }
  }
  
  /**
   * 检查数据库连接限制
   */
  private checkDatabaseConnectionLimit(metrics: SystemMetrics): void {
    const maxConnections = this.pool.options.max || 10;
    const connectionUsage = (metrics.database.totalConnections / maxConnections) * 100;
    
    if (connectionUsage > this.config.alertThresholds.dbConnectionUsage) {
      this.createAlert(
        AlertType.DATABASE_CONNECTION_LIMIT,
        AlertLevel.WARNING,
        `High database connection usage: ${connectionUsage.toFixed(1)}%`,
        {
          usage: connectionUsage,
          current: metrics.database.totalConnections,
          max: maxConnections,
          threshold: this.config.alertThresholds.dbConnectionUsage
        }
      );
    }
  }
  
  /**
   * 检查WebSocket连接限制
   */
  private checkWebSocketConnectionLimit(): void {
    const stats = this.connectionManager.getStats();
    const maxConnections = 1000; // 假设最大连接数
    const connectionUsage = (stats.totalConnections / maxConnections) * 100;
    
    if (connectionUsage > this.config.alertThresholds.wsConnectionUsage) {
      this.createAlert(
        AlertType.WEBSOCKET_CONNECTION_LIMIT,
        AlertLevel.WARNING,
        `High WebSocket connection usage: ${connectionUsage.toFixed(1)}%`,
        {
          usage: connectionUsage,
          current: stats.totalConnections,
          max: maxConnections,
          threshold: this.config.alertThresholds.wsConnectionUsage
        }
      );
    }
  }
  
  /**
   * 创建告警
   */
  private createAlert(
    type: AlertType,
    level: AlertLevel,
    message: string,
    metadata?: any
  ): void {
    const alertId = this.generateAlertId();
    const alert: Alert = {
      id: alertId,
      type,
      level,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };
    
    this.alerts.set(alertId, alert);
    
    console.log(`Alert created [${level.toUpperCase()}]: ${message}`);
    this.emit('alert_created', alert);
    
    // 广播告警给WebSocket客户端
    this.connectionManager.broadcastToChannel('system_alerts', {
      type: 'system_alert',
      data: alert
    });
  }
  
  /**
   * 解决告警
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    console.log(`Alert resolved: ${alert.message}`);
    this.emit('alert_resolved', alert);
    
    // 广播告警解决给WebSocket客户端
    this.connectionManager.broadcastToChannel('system_alerts', {
      type: 'alert_resolved',
      data: alert
    });
    
    return true;
  }
  
  /**
   * 清理旧数据
   */
  private cleanupOldData(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.config.retentionPeriod);
    
    // 清理旧的指标数据
    this.metricsHistory = this.metricsHistory.filter(
      metrics => metrics.timestamp > cutoffTime
    );
    
    // 清理已解决的旧告警
    const alertsToDelete: string[] = [];
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        alertsToDelete.push(alertId);
      }
    }
    
    alertsToDelete.forEach(alertId => {
      this.alerts.delete(alertId);
    });
  }
  
  /**
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取系统状态摘要
   */
  public getSystemStatus(): any {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    
    return {
      timestamp: new Date(),
      healthy: activeAlerts.filter(alert => alert.level === AlertLevel.CRITICAL).length === 0,
      metrics: latestMetrics,
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(alert => alert.level === AlertLevel.CRITICAL).length,
        warning: activeAlerts.filter(alert => alert.level === AlertLevel.WARNING).length,
        info: activeAlerts.filter(alert => alert.level === AlertLevel.INFO).length
      },
      performance: {
        queryCount: this.queryCount,
        averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        slowQueries: this.slowQueryCount
      }
    };
  }
  
  /**
   * 获取历史指标
   */
  public getHistoricalMetrics(hours: number = 1): SystemMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(metrics => metrics.timestamp > cutoffTime);
  }
  
  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }
  
  /**
   * 获取所有告警
   */
  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
  
  /**
   * 生成性能报告
   */
  public generatePerformanceReport(hours: number = 24): any {
    const metrics = this.getHistoricalMetrics(hours);
    
    if (metrics.length === 0) {
      return { error: 'No metrics available for the specified period' };
    }
    
    const cpuUsages = metrics.map(m => m.cpu.usage);
    const memoryUsages = metrics.map(m => m.memory.usage);
    const queryTimes = metrics.map(m => m.database.averageQueryTime).filter(t => t > 0);
    
    return {
      period: `${hours} hours`,
      dataPoints: metrics.length,
      cpu: {
        average: this.calculateAverage(cpuUsages),
        max: Math.max(...cpuUsages),
        min: Math.min(...cpuUsages)
      },
      memory: {
        average: this.calculateAverage(memoryUsages),
        max: Math.max(...memoryUsages),
        min: Math.min(...memoryUsages)
      },
      database: {
        totalQueries: this.queryCount,
        slowQueries: this.slowQueryCount,
        averageQueryTime: queryTimes.length > 0 ? this.calculateAverage(queryTimes) : 0,
        maxQueryTime: queryTimes.length > 0 ? Math.max(...queryTimes) : 0
      },
      alerts: {
        total: this.alerts.size,
        resolved: Array.from(this.alerts.values()).filter(a => a.resolved).length,
        active: Array.from(this.alerts.values()).filter(a => !a.resolved).length
      }
    };
  }
  
  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }
  
  /**
   * 关闭监控器
   */
  public shutdown(): void {
    console.log('Shutting down system monitor...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    console.log('System monitor shutdown complete');
  }
}