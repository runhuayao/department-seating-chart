// 服务健康检查机制
import { Request, Response } from 'express';
import cacheService from './cache.js';
import dbManager from '../config/database.js';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    server: ServiceStatus;
  };
  version: string;
  environment: string;
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: number;

  private constructor() {
    this.startTime = Date.now();
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  // 检查数据库健康状态
  async checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      await dbManager.testConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // 检查Redis健康状态
  async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      if (!cacheService.isRedisConnected()) {
        throw new Error('Redis连接未建立');
      }

      // 测试Redis操作
      await cacheService.set('health:check', 'ok', 10);
      const value = await cacheService.get('health:check');
      
      if (value !== 'ok') {
        throw new Error('Redis读写测试失败');
      }

      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 100 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // 检查服务器健康状态
  checkServer(): ServiceStatus {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = process.memoryUsage();
    
    // 检查内存使用情况
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    const isMemoryHealthy = memoryUsageMB < 500; // 500MB阈值

    return {
      status: isMemoryHealthy ? 'up' : 'degraded',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      error: !isMemoryHealthy ? `内存使用过高: ${memoryUsageMB.toFixed(2)}MB` : undefined
    };
  }

  // 获取完整健康状态
  async getHealthStatus(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis()
    ]);
    
    const server = this.checkServer();
    
    // 计算整体状态
    const services = { database, redis, server };
    const allUp = Object.values(services).every(service => service.status === 'up');
    const anyDown = Object.values(services).some(service => service.status === 'down');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (anyDown) {
      overallStatus = 'unhealthy';
    } else if (allUp) {
      overallStatus = 'healthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services,
      version: process.env.npm_package_version || '3.1.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  // Express路由处理器
  async healthHandler(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      // 根据健康状态设置HTTP状态码
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        ...healthStatus,
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('健康检查失败:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  // 简单的健康检查（快速响应）
  async simpleHealthHandler(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '3.1.0'
    });
  }

  // 就绪检查（检查所有依赖服务）
  async readinessHandler(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      // 就绪检查要求所有服务都正常
      const isReady = healthStatus.status === 'healthy';
      
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString(),
        services: healthStatus.services
      });
    } catch (error: any) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  // 存活检查（仅检查服务器本身）
  livenessHandler(req: Request, res: Response): void {
    const server = this.checkServer();
    const isAlive = server.status !== 'down';
    
    res.status(isAlive ? 200 : 503).json({
      alive: isAlive,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      server
    });
  }

  // 获取详细的系统信息
  async systemInfoHandler(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      res.json({
        ...healthStatus,
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid,
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

const healthCheckService = HealthCheckService.getInstance();

export default healthCheckService;
export { HealthCheckService, HealthStatus, ServiceStatus };