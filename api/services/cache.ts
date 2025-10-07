// Redis缓存服务
import Redis from 'ioredis';
import redisManager from '../config/redis.js';

class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    // 使用统一的Redis管理器
    this.redis = redisManager.getClient();
    
    // 监听Redis管理器的连接状态
    redisManager.on('connected', () => {
      console.log('✅ 缓存服务Redis连接已建立');
      this.isConnected = true;
    });

    redisManager.on('error', (error) => {
      console.error('❌ 缓存服务Redis连接错误:', error.message);
      this.isConnected = false;
    });

    redisManager.on('disconnected', () => {
      console.log('🔌 缓存服务Redis连接已关闭');
      this.isConnected = false;
    });

    // 初始化连接
    this.initializeConnection();
  }

  // 初始化连接
  private async initializeConnection(): Promise<void> {
    try {
      await redisManager.connect();
    } catch (error) {
      console.error('缓存服务Redis连接初始化失败:', error);
    }
  }

  // 连接Redis
  async connect(): Promise<void> {
    try {
      await redisManager.connect();
    } catch (error) {
      console.error('Redis连接失败:', error);
    }
  }

  // 检查Redis连接状态
  isRedisConnected(): boolean {
    // 优先使用Redis管理器的连接状态
    const managerConnected = redisManager.isRedisConnected();
    console.log(`缓存服务连接状态检查: 本地=${this.isConnected}, 管理器=${managerConnected}`);
    return managerConnected;
  }

  // 断开连接
  async disconnect(): Promise<void> {
    try {
      await redisManager.disconnect();
    } catch (error) {
      console.error('Redis断开连接失败:', error);
    }
  }

  // 设置缓存
  async set(key: string, value: any, ttl: number = 3600): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        console.warn('Redis未连接，跳过缓存设置');
        return false;
      }

      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('Redis设置缓存失败:', error);
      return false;
    }
  }

  // 获取缓存
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isRedisConnected()) {
        console.warn('Redis未连接，跳过缓存获取');
        return null;
      }

      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis获取缓存失败:', error);
      return null;
    }
  }

  // 删除缓存
  async del(key: string): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        console.warn('Redis未连接，跳过缓存删除');
        return false;
      }

      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis删除缓存失败:', error);
      return false;
    }
  }

  // 清空所有缓存
  async flush(): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        console.warn('Redis未连接，跳过缓存清空');
        return false;
      }

      await this.redis.flushall();
      return true;
    } catch (error) {
      console.error('Redis清空缓存失败:', error);
      return false;
    }
  }

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        return false;
      }

      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis检查键存在失败:', error);
      return false;
    }
  }

  // 设置键的过期时间
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!this.isRedisConnected()) {
        return false;
      }

      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error('Redis设置过期时间失败:', error);
      return false;
    }
  }

  // 获取缓存统计信息
  async getStats(): Promise<any> {
    try {
      if (!this.isRedisConnected()) {
        return {
          connected: false,
          keys: 0,
          memory: '0B'
        };
      }

      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        connected: true,
        keys: keyCount,
        memory: this.parseMemoryInfo(info),
        status: this.redis.status
      };
    } catch (error) {
      console.error('获取Redis统计信息失败:', error);
      return {
        connected: false,
        keys: 0,
        memory: '0B',
        error: error.message
      };
    }
  }

  // 解析内存信息
  private parseMemoryInfo(info: string): string {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('used_memory_human:')) {
        return line.split(':')[1];
      }
    }
    return '未知';
  }

  // 关闭连接
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      console.log('Redis连接已关闭');
    } catch (error) {
      console.error('关闭Redis连接失败:', error);
    }
  }
}

// 创建全局缓存服务实例
const cacheService = new CacheService();

export default cacheService;
export { CacheService };