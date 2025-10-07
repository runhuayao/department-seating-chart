// 详细性能监控服务
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';

interface PerformanceMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    heap: {
      total: number;
      used: number;
      usagePercent: number;
    };
  };
  network: {
    connections: number;
    activeRequests: number;
  };
  database: {
    connectionCount: number;
    queryTime: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  redis: {
    connectionCount: number;
    memoryUsage: number;
    hitRate: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  api: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    slowQueries: number;
  };
}

interface AlertThreshold {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  diskUsage: number;
}

class PerformanceMonitorService extends EventEmitter {
  private static instance: PerformanceMonitorService;
  private metrics: PerformanceMetrics[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private requestMetrics: Map<string, number[]> = new Map();
  private alertThresholds: AlertThreshold;
  private isMonitoring: boolean = false;

  private constructor() {
    super();
    
    this.alertThresholds = {
      cpuUsage: 80,        // CPU使用率超过80%
      memoryUsage: 85,     // 内存使用率超过85%
      responseTime: 1000,  // 响应时间超过1秒
      errorRate: 5,        // 错误率超过5%
      diskUsage: 90        // 磁盘使用率超过90%
    };
  }

  public static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService();
    }
    return PerformanceMonitorService.instance;
  }

  // 启动性能监控
  startMonitoring(interval: number = 10000): void {
    if (this.isMonitoring) {
      console.log('⚠️ 性能监控已在运行中');
      return;
    }

    console.log('📊 启动性能监控...');
    this.isMonitoring = true;

    this.monitoringTimer = setInterval(async () => {
      await this.collectMetrics();
    }, interval);

    console.log(`✅ 性能监控已启动 (间隔: ${interval}ms)`);
  }

  // 停止性能监控
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.isMonitoring = false;
    console.log('🛑 性能监控已停止');
  }

  // 收集性能指标
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // CPU指标
      const cpuUsage = await this.getCPUUsage();
      const loadAverage = os.loadavg();
      
      // 内存指标
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      
      const processMemory = process.memoryUsage();
      const heapUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;

      // 网络指标
      const networkMetrics = await this.getNetworkMetrics();
      
      // 数据库指标
      const databaseMetrics = await this.getDatabaseMetrics();
      
      // Redis指标
      const redisMetrics = await this.getRedisMetrics();
      
      // API指标
      const apiMetrics = this.getAPIMetrics();

      const metrics: PerformanceMetrics = {
        timestamp,
        cpu: {
          usage: cpuUsage,
          loadAverage,
          cores: os.cpus().length
        },
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: usedMemory,
          usagePercent: memoryUsagePercent,
          heap: {
            total: processMemory.heapTotal,
            used: processMemory.heapUsed,
            usagePercent: heapUsagePercent
          }
        },
        network: networkMetrics,
        database: databaseMetrics,
        redis: redisMetrics,
        api: apiMetrics
      };

      // 保存指标
      this.metrics.push(metrics);
      
      // 保持最近1000条记录
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // 检查告警阈值
      this.checkAlerts(metrics);
      
      // 发出监控事件
      this.emit('metrics_collected', metrics);

    } catch (error: any) {
      console.error('❌ 性能指标收集失败:', error.message);
    }
  }

  // 获取CPU使用率
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = performance.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = performance.now();
        const timeDiff = endTime - startTime;
        
        const cpuPercent = ((endUsage.user + endUsage.system) / 1000 / timeDiff) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  // 获取网络指标
  private async getNetworkMetrics(): Promise<any> {
    // 这里可以集成更详细的网络监控
    return {
      connections: 0, // 需要实际实现
      activeRequests: 0 // 需要实际实现
    };
  }

  // 获取数据库指标
  private async getDatabaseMetrics(): Promise<any> {
    try {
      const startTime = performance.now();
      // 执行简单查询测试响应时间
      await import('../config/database.js').then(db => db.default.testConnection());
      const queryTime = performance.now() - startTime;
      
      return {
        connectionCount: 1, // 需要实际实现连接池监控
        queryTime,
        status: queryTime < 100 ? 'healthy' : queryTime < 500 ? 'degraded' : 'unhealthy'
      };
    } catch (error) {
      return {
        connectionCount: 0,
        queryTime: -1,
        status: 'unhealthy'
      };
    }
  }

  // 获取Redis指标
  private async getRedisMetrics(): Promise<any> {
    try {
      const cacheService = await import('./cache.js').then(m => m.default);
      const stats = await cacheService.getStats();
      
      return {
        connectionCount: 1,
        memoryUsage: stats.memory || 0,
        hitRate: 95, // 需要实际实现
        status: cacheService.isRedisConnected() ? 'healthy' : 'unhealthy'
      };
    } catch (error) {
      return {
        connectionCount: 0,
        memoryUsage: 0,
        hitRate: 0,
        status: 'unhealthy'
      };
    }
  }

  // 获取API指标
  private getAPIMetrics(): any {
    // 计算平均响应时间
    let totalRequests = 0;
    let totalResponseTime = 0;
    
    for (const [endpoint, times] of this.requestMetrics) {
      totalRequests += times.length;
      totalResponseTime += times.reduce((sum, time) => sum + time, 0);
    }
    
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    return {
      requestCount: totalRequests,
      averageResponseTime,
      errorRate: 0, // 需要实际实现
      slowQueries: 0 // 需要实际实现
    };
  }

  // 检查告警阈值
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    // CPU告警
    if (metrics.cpu.usage > this.alertThresholds.cpuUsage) {
      alerts.push(`CPU使用率过高: ${metrics.cpu.usage.toFixed(2)}%`);
    }

    // 内存告警
    if (metrics.memory.usagePercent > this.alertThresholds.memoryUsage) {
      alerts.push(`内存使用率过高: ${metrics.memory.usagePercent.toFixed(2)}%`);
    }

    // 响应时间告警
    if (metrics.api.averageResponseTime > this.alertThresholds.responseTime) {
      alerts.push(`API响应时间过长: ${metrics.api.averageResponseTime.toFixed(2)}ms`);
    }

    // 数据库告警
    if (metrics.database.status === 'unhealthy') {
      alerts.push('数据库连接异常');
    }

    // Redis告警
    if (metrics.redis.status === 'unhealthy') {
      alerts.push('Redis连接异常');
    }

    // 发出告警
    if (alerts.length > 0) {
      console.warn('🚨 性能告警:', alerts.join(', '));
      this.emit('performance_alert', { alerts, metrics });
    }
  }

  // 记录API请求时间
  recordAPIRequest(endpoint: string, responseTime: number): void {
    if (!this.requestMetrics.has(endpoint)) {
      this.requestMetrics.set(endpoint, []);
    }
    
    const times = this.requestMetrics.get(endpoint)!;
    times.push(responseTime);
    
    // 保持最近100次请求记录
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
  }

  // 获取性能报告
  getPerformanceReport(): any {
    const recentMetrics = this.metrics.slice(-10);
    
    if (recentMetrics.length === 0) {
      return {
        status: 'no_data',
        message: '暂无性能数据'
      };
    }

    const latest = recentMetrics[recentMetrics.length - 1];
    
    // 计算趋势
    const cpuTrend = this.calculateTrend(recentMetrics.map(m => m.cpu.usage));
    const memoryTrend = this.calculateTrend(recentMetrics.map(m => m.memory.usagePercent));
    
    return {
      status: 'ok',
      timestamp: latest.timestamp,
      current: latest,
      trends: {
        cpu: cpuTrend,
        memory: memoryTrend
      },
      summary: {
        totalMetrics: this.metrics.length,
        monitoringDuration: this.getMonitoringDuration(),
        alertCount: this.getAlertCount()
      }
    };
  }

  // 计算趋势
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-3);
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const previous = values.slice(-6, -3);
    const previousAverage = previous.length > 0 ? 
      previous.reduce((sum, val) => sum + val, 0) / previous.length : average;
    
    const change = ((average - previousAverage) / previousAverage) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  // 获取监控持续时间
  private getMonitoringDuration(): number {
    if (this.metrics.length === 0) return 0;
    
    const first = new Date(this.metrics[0].timestamp);
    const last = new Date(this.metrics[this.metrics.length - 1].timestamp);
    
    return last.getTime() - first.getTime();
  }

  // 获取告警数量
  private getAlertCount(): number {
    // 这里需要实际实现告警计数
    return 0;
  }

  // 获取实时指标
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  // 获取历史指标
  getHistoricalMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  // 更新告警阈值
  updateAlertThresholds(thresholds: Partial<AlertThreshold>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('⚙️ 告警阈值已更新:', this.alertThresholds);
  }

  // 获取监控状态
  getMonitoringStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metrics.length,
      alertThresholds: this.alertThresholds,
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    };
  }

  // 清理历史数据
  clearHistory(): void {
    this.metrics = [];
    this.requestMetrics.clear();
    console.log('🧹 性能监控历史数据已清理');
  }

  // 导出性能数据
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'cpu_usage', 'memory_usage', 'response_time', 'error_rate'];
      const rows = this.metrics.map(m => [
        m.timestamp,
        m.cpu.usage.toFixed(2),
        m.memory.usagePercent.toFixed(2),
        m.api.averageResponseTime.toFixed(2),
        m.api.errorRate.toFixed(2)
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    
    return JSON.stringify(this.metrics, null, 2);
  }
}

// 中间件：记录API请求性能
export function performanceMiddleware(req: any, res: any, next: any): void {
  const startTime = performance.now();
  
  res.on('finish', () => {
    const responseTime = performance.now() - startTime;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    performanceMonitorService.recordAPIRequest(endpoint, responseTime);
    
    // 慢查询告警
    if (responseTime > 1000) {
      console.warn(`🐌 慢查询告警: ${endpoint} - ${responseTime.toFixed(2)}ms`);
    }
  });
  
  next();
}

const performanceMonitorService = PerformanceMonitorService.getInstance();

export default performanceMonitorService;
export { PerformanceMonitorService, PerformanceMetrics, AlertThreshold };