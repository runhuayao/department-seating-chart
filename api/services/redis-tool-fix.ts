// Redis工具界面客户端库修复服务
import Redis from 'ioredis';

interface RedisToolConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

interface RedisInfo {
  server: any;
  clients: any;
  memory: any;
  persistence: any;
  stats: any;
  replication: any;
  cpu: any;
  keyspace: any;
}

class RedisToolFixService {
  private static instance: RedisToolFixService;
  private redis: Redis;
  private config: RedisToolConfig;
  private isConnected: boolean = false;

  private constructor() {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };

    this.initializeRedisClient();
  }

  public static getInstance(): RedisToolFixService {
    if (!RedisToolFixService.instance) {
      RedisToolFixService.instance = new RedisToolFixService();
    }
    return RedisToolFixService.instance;
  }

  // 初始化Redis客户端
  private initializeRedisClient(): void {
    this.redis = new Redis(this.config);

    this.redis.on('connect', () => {
      console.log('✅ Redis工具客户端连接成功');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis工具客户端错误:', error.message);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('🔌 Redis工具客户端连接已关闭');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Redis工具客户端正在重连...');
    });
  }

  // 确保连接
  async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.redis.connect();
        console.log('✅ Redis工具客户端重新连接成功');
      } catch (error: any) {
        console.error('❌ Redis工具客户端连接失败:', error.message);
        throw error;
      }
    }
  }

  // 获取Redis服务器信息
  async getRedisInfo(): Promise<RedisInfo> {
    await this.ensureConnection();
    
    try {
      const info = await this.redis.info();
      const parsedInfo = this.parseRedisInfo(info);
      
      return parsedInfo;
    } catch (error: any) {
      console.error('❌ 获取Redis信息失败:', error.message);
      throw error;
    }
  }

  // 解析Redis INFO命令输出
  private parseRedisInfo(info: string): RedisInfo {
    const sections: any = {};
    let currentSection = '';
    
    info.split('\r\n').forEach(line => {
      if (line.startsWith('#')) {
        currentSection = line.substring(2).toLowerCase();
        sections[currentSection] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (currentSection) {
          sections[currentSection][key] = value;
        }
      }
    });

    return {
      server: sections.server || {},
      clients: sections.clients || {},
      memory: sections.memory || {},
      persistence: sections.persistence || {},
      stats: sections.stats || {},
      replication: sections.replication || {},
      cpu: sections.cpu || {},
      keyspace: sections.keyspace || {}
    };
  }

  // 获取所有键
  async getAllKeys(pattern: string = '*', limit: number = 100): Promise<string[]> {
    await this.ensureConnection();
    
    try {
      const keys = await this.redis.keys(pattern);
      return keys.slice(0, limit);
    } catch (error: any) {
      console.error('❌ 获取Redis键失败:', error.message);
      throw error;
    }
  }

  // 获取键值
  async getKeyValue(key: string): Promise<any> {
    await this.ensureConnection();
    
    try {
      const type = await this.redis.type(key);
      
      switch (type) {
        case 'string':
          return await this.redis.get(key);
        case 'hash':
          return await this.redis.hgetall(key);
        case 'list':
          return await this.redis.lrange(key, 0, -1);
        case 'set':
          return await this.redis.smembers(key);
        case 'zset':
          return await this.redis.zrange(key, 0, -1, 'WITHSCORES');
        default:
          return null;
      }
    } catch (error: any) {
      console.error('❌ 获取键值失败:', error.message);
      throw error;
    }
  }

  // 设置键值
  async setKeyValue(key: string, value: any, ttl?: number): Promise<boolean> {
    await this.ensureConnection();
    
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        await this.redis.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error: any) {
      console.error('❌ 设置键值失败:', error.message);
      throw error;
    }
  }

  // 删除键
  async deleteKey(key: string): Promise<boolean> {
    await this.ensureConnection();
    
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error: any) {
      console.error('❌ 删除键失败:', error.message);
      throw error;
    }
  }

  // 获取数据库大小
  async getDatabaseSize(): Promise<number> {
    await this.ensureConnection();
    
    try {
      return await this.redis.dbsize();
    } catch (error: any) {
      console.error('❌ 获取数据库大小失败:', error.message);
      throw error;
    }
  }

  // 清空数据库
  async flushDatabase(): Promise<boolean> {
    await this.ensureConnection();
    
    try {
      await this.redis.flushdb();
      console.log('🧹 Redis数据库已清空');
      return true;
    } catch (error: any) {
      console.error('❌ 清空数据库失败:', error.message);
      throw error;
    }
  }

  // 执行Redis命令
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    await this.ensureConnection();
    
    try {
      return await this.redis.call(command, ...args);
    } catch (error: any) {
      console.error('❌ 执行Redis命令失败:', error.message);
      throw error;
    }
  }

  // 获取连接状态
  getConnectionStatus(): any {
    return {
      isConnected: this.isConnected,
      status: this.redis.status,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      },
      lastError: null // 需要实际实现错误记录
    };
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureConnection();
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch (error: any) {
      console.error('❌ Redis连接测试失败:', error.message);
      return false;
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      console.log('✅ Redis工具客户端已断开连接');
    } catch (error: any) {
      console.error('❌ Redis断开连接失败:', error.message);
    }
  }

  // 重新连接
  async reconnect(): Promise<void> {
    try {
      await this.disconnect();
      this.initializeRedisClient();
      await this.ensureConnection();
      console.log('✅ Redis工具客户端重新连接成功');
    } catch (error: any) {
      console.error('❌ Redis重新连接失败:', error.message);
      throw error;
    }
  }
}

const redisToolFixService = RedisToolFixService.getInstance();

export default redisToolFixService;
export { RedisToolFixService, RedisToolConfig, RedisInfo };