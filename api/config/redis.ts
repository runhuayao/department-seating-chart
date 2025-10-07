// Redis连接配置和连接池管理
// 针对Docker容器环境优化的Redis配置

import Redis, { RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';

// Redis配置接口
interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  
  // 连接池配置
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  retryDelayOnClusterDown: number;
  maxRetriesPerRequest: number;
  
  // 超时配置
  connectTimeout: number;
  commandTimeout: number;
  lazyConnect: boolean;
  
  // 重连配置
  retryStrategy: (times: number) => number | null;
  reconnectOnError: (err: Error) => boolean;
  
  // 连接池配置
  family: number;
  keepAlive: boolean;
  
  // 性能优化
  enableAutoPipelining: boolean;
  maxLoadingTimeout: number;
}

// Redis连接管理器
class RedisManager extends EventEmitter {
  private client: Redis;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private readonly MAX_RETRY_ATTEMPTS = 10;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    // Redis配置 - 针对本地开发环境优化
    this.config = {
      // 基础连接配置
      host: process.env.REDIS_HOST || '127.0.0.1', // 本地Redis服务器
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      
      // 连接池配置
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      
      // 超时配置 - Docker环境适配
      connectTimeout: 10000, // 10秒连接超时
      commandTimeout: 5000,  // 5秒命令超时
      lazyConnect: true,     // 延迟连接
      
      // 重连策略 - 指数退避
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`🔄 Redis重连尝试 ${times}, 延迟 ${delay}ms`);
        return delay;
      },
      
      // 错误重连判断
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
      
      // 网络配置
      family: 4, // IPv4
      keepAlive: true,
      
      // 性能优化
      enableAutoPipelining: true,
      maxLoadingTimeout: 5000,
      
      // 事件监听
      showFriendlyErrorStack: true
    };

    this.initializeClient();
    this.setupEventListeners();
    this.startHealthCheck();
  }

  // 初始化Redis客户端
  private initializeClient(): void {
    this.client = new Redis(this.config);
    console.log(`🔗 Redis客户端初始化完成 - 目标: ${this.config.host}:${this.config.port}`);
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    this.client.on('connect', () => {
      console.log('✅ Redis连接已建立');
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.emit('connected');
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis客户端就绪');
      this.emit('ready');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis连接错误:', error.message);
      this.isConnected = false;
      this.emit('error', error);
    });

    this.client.on('close', () => {
      console.log('🔌 Redis连接已关闭');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.client.on('reconnecting', (ms) => {
      console.log(`🔄 Redis正在重连... (${ms}ms后)`);
      this.connectionAttempts++;
      this.emit('reconnecting', ms);
    });

    this.client.on('end', () => {
      console.log('🔚 Redis连接已结束');
      this.isConnected = false;
      this.emit('end');
    });
  }

  // 连接Redis
  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log('✅ Redis已连接，跳过重复连接');
        return;
      }

      console.log('🔗 正在连接Redis...');
      await this.client.connect();
      
    } catch (error: any) {
      console.error('❌ Redis连接失败:', error.message);
      
      if (this.connectionAttempts < this.MAX_RETRY_ATTEMPTS) {
        const delay = Math.min(this.connectionAttempts * 1000, 10000);
        console.log(`⏳ ${delay}ms后重试连接...`);
        
        setTimeout(() => {
          this.connect();
        }, delay);
      } else {
        console.error('❌ Redis连接重试次数已达上限');
        throw error;
      }
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      await this.client.disconnect();
      this.isConnected = false;
      console.log('✅ Redis连接已断开');
      
    } catch (error: any) {
      console.error('❌ Redis断开连接失败:', error.message);
      throw error;
    }
  }

  // 获取Redis客户端实例
  getClient(): Redis {
    return this.client;
  }

  // 检查连接状态
  isRedisConnected(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        await this.connect();
      }

      const pong = await this.client.ping();
      const isHealthy = pong === 'PONG';
      
      if (isHealthy) {
        console.log('✅ Redis连接测试成功');
      } else {
        console.warn('⚠️ Redis连接测试异常');
      }
      
      return isHealthy;
      
    } catch (error: any) {
      console.error('❌ Redis连接测试失败:', error.message);
      return false;
    }
  }

  // 获取连接信息
  getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      status: this.client.status,
      connectionAttempts: this.connectionAttempts,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout
      }
    };
  }

  // 获取Redis服务器信息
  async getServerInfo(): Promise<any> {
    try {
      if (!this.isRedisConnected()) {
        throw new Error('Redis未连接');
      }

      const info = await this.client.info();
      return this.parseRedisInfo(info);
      
    } catch (error: any) {
      console.error('❌ 获取Redis服务器信息失败:', error.message);
      throw error;
    }
  }

  // 解析Redis INFO命令输出
  private parseRedisInfo(info: string): any {
    const sections: any = {};
    let currentSection = 'general';
    
    info.split('\r\n').forEach(line => {
      if (line.startsWith('# ')) {
        currentSection = line.substring(2).toLowerCase();
        sections[currentSection] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (!sections[currentSection]) {
          sections[currentSection] = {};
        }
        sections[currentSection][key] = value;
      }
    });
    
    return sections;
  }

  // 启动健康检查
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.testConnection();
      } catch (error) {
        console.warn('⚠️ Redis健康检查失败:', error);
      }
    }, 30000); // 每30秒检查一次

    console.log('💓 Redis健康检查已启动');
  }

  // 执行Redis命令（带重试机制）
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isRedisConnected()) {
          await this.connect();
        }

        return await this.client.call(command, ...args);
        
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Redis命令执行失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError!;
  }

  // 批量操作
  async pipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
    try {
      if (!this.isRedisConnected()) {
        await this.connect();
      }

      const pipeline = this.client.pipeline();
      
      commands.forEach(([command, ...args]) => {
        pipeline.call(command, ...args);
      });

      const results = await pipeline.exec();
      return results?.map(([error, result]) => {
        if (error) throw error;
        return result;
      }) || [];
      
    } catch (error: any) {
      console.error('❌ Redis批量操作失败:', error.message);
      throw error;
    }
  }
}

// 创建单例实例
const redisManager = new RedisManager();

export default redisManager;
export { RedisManager, RedisConfig };