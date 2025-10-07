// 自动服务重启机制
import { EventEmitter } from 'events';
import healthCheckService from './health-check.js';
import cacheService from './cache.js';
import dbManager from '../config/database.js';

interface RestartConfig {
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  gracefulShutdownTimeout: number;
}

interface RestartEvent {
  timestamp: string;
  reason: string;
  attempt: number;
  success: boolean;
  error?: string;
}

class AutoRestartService extends EventEmitter {
  private static instance: AutoRestartService;
  private config: RestartConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private restartHistory: RestartEvent[] = [];
  private currentRetries: number = 0;
  private isRestarting: boolean = false;
  private server: any = null;

  private constructor(config: Partial<RestartConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      healthCheckInterval: 30000, // 30秒检查一次
      gracefulShutdownTimeout: 10000,
      ...config
    };
  }

  public static getInstance(config?: Partial<RestartConfig>): AutoRestartService {
    if (!AutoRestartService.instance) {
      AutoRestartService.instance = new AutoRestartService(config);
    }
    return AutoRestartService.instance;
  }

  // 设置服务器实例
  setServer(server: any): void {
    this.server = server;
  }

  // 启动自动重启监控
  startMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    console.log('🔄 启动自动重启监控...');
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // 监听进程信号
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获异常:', error);
      this.handleCriticalError('uncaughtException', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的Promise拒绝:', reason);
      this.handleCriticalError('unhandledRejection', reason);
    });

    console.log('✅ 自动重启监控已启动');
  }

  // 停止监控
  stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    console.log('🛑 自动重启监控已停止');
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = await healthCheckService.getHealthStatus();
      
      if (healthStatus.status === 'unhealthy') {
        console.warn('⚠️ 系统健康检查失败，准备重启...');
        await this.initiateRestart('health_check_failed');
      } else if (healthStatus.status === 'degraded') {
        console.warn('⚠️ 系统性能降级，监控中...');
        this.emit('degraded', healthStatus);
      } else {
        // 健康状态良好，重置重试计数
        this.currentRetries = 0;
      }
    } catch (error: any) {
      console.error('❌ 健康检查执行失败:', error.message);
      await this.initiateRestart('health_check_error');
    }
  }

  // 处理关键错误
  private async handleCriticalError(type: string, error: any): Promise<void> {
    console.error(`🚨 关键错误 [${type}]:`, error);
    
    // 记录错误
    this.restartHistory.push({
      timestamp: new Date().toISOString(),
      reason: `critical_error_${type}`,
      attempt: this.currentRetries + 1,
      success: false,
      error: error.message || String(error)
    });

    await this.initiateRestart(`critical_error_${type}`);
  }

  // 启动重启流程
  private async initiateRestart(reason: string): Promise<void> {
    if (this.isRestarting) {
      console.log('⏳ 重启已在进行中，跳过...');
      return;
    }

    if (this.currentRetries >= this.config.maxRetries) {
      console.error('❌ 达到最大重试次数，停止自动重启');
      this.emit('max_retries_reached', { reason, retries: this.currentRetries });
      return;
    }

    this.isRestarting = true;
    this.currentRetries++;

    console.log(`🔄 开始第 ${this.currentRetries} 次重启 (原因: ${reason})`);

    try {
      // 优雅关闭当前服务
      await this.gracefulShutdown();
      
      // 等待重启延迟
      await this.delay(this.config.retryDelay);
      
      // 重新启动服务
      await this.restartServices();
      
      // 记录成功重启
      const restartEvent: RestartEvent = {
        timestamp: new Date().toISOString(),
        reason,
        attempt: this.currentRetries,
        success: true
      };
      
      this.restartHistory.push(restartEvent);
      console.log('✅ 服务重启成功');
      
      this.emit('restart_success', restartEvent);
      
    } catch (error: any) {
      console.error('❌ 服务重启失败:', error.message);
      
      const restartEvent: RestartEvent = {
        timestamp: new Date().toISOString(),
        reason,
        attempt: this.currentRetries,
        success: false,
        error: error.message
      };
      
      this.restartHistory.push(restartEvent);
      this.emit('restart_failed', restartEvent);
      
      // 递归重试
      setTimeout(() => {
        this.initiateRestart(reason);
      }, this.config.retryDelay);
      
    } finally {
      this.isRestarting = false;
    }
  }

  // 优雅关闭服务
  private async gracefulShutdown(): Promise<void> {
    console.log('🔄 开始优雅关闭服务...');
    
    const shutdownPromises: Promise<void>[] = [];

    // 关闭HTTP服务器
    if (this.server) {
      shutdownPromises.push(new Promise((resolve) => {
        this.server.close(() => {
          console.log('✅ HTTP服务器已关闭');
          resolve();
        });
      }));
    }

    // 关闭数据库连接
    shutdownPromises.push(
      dbManager.disconnect().then(() => {
        console.log('✅ 数据库连接已关闭');
      }).catch((error) => {
        console.warn('⚠️ 数据库关闭警告:', error.message);
      })
    );

    // 关闭Redis连接
    shutdownPromises.push(
      cacheService.disconnect().then(() => {
        console.log('✅ Redis连接已关闭');
      }).catch((error) => {
        console.warn('⚠️ Redis关闭警告:', error.message);
      })
    );

    // 等待所有服务关闭或超时
    await Promise.race([
      Promise.all(shutdownPromises),
      this.delay(this.config.gracefulShutdownTimeout)
    ]);

    console.log('✅ 服务优雅关闭完成');
  }

  // 重新启动服务
  private async restartServices(): Promise<void> {
    console.log('🚀 重新启动服务...');
    
    try {
      // 重新连接数据库
      await dbManager.testConnection();
      console.log('✅ 数据库重新连接成功');
      
      // 重新连接Redis
      await cacheService.connect();
      console.log('✅ Redis重新连接成功');
      
      // 重新启动HTTP服务器
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.listen(process.env.PORT || 8080, (error: any) => {
            if (error) {
              reject(error);
            } else {
              console.log('✅ HTTP服务器重新启动成功');
              resolve(this.server);
            }
          });
        });
      }
      
    } catch (error) {
      console.error('❌ 服务重启过程失败:', error);
      throw error;
    }
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取重启历史
  getRestartHistory(): RestartEvent[] {
    return [...this.restartHistory];
  }

  // 获取当前状态
  getStatus(): any {
    return {
      isMonitoring: this.healthCheckTimer !== null,
      isRestarting: this.isRestarting,
      currentRetries: this.currentRetries,
      maxRetries: this.config.maxRetries,
      restartHistory: this.restartHistory.slice(-10), // 最近10次记录
      config: this.config
    };
  }

  // 手动触发重启
  async manualRestart(reason: string = 'manual_trigger'): Promise<void> {
    console.log('🔄 手动触发服务重启...');
    await this.initiateRestart(reason);
  }

  // 重置重试计数
  resetRetryCount(): void {
    this.currentRetries = 0;
    console.log('🔄 重试计数已重置');
  }

  // 更新配置
  updateConfig(newConfig: Partial<RestartConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ 自动重启配置已更新:', this.config);
  }
}

const autoRestartService = AutoRestartService.getInstance();

export default autoRestartService;
export { AutoRestartService, RestartConfig, RestartEvent };