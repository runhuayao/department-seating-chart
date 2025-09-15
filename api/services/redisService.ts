import { createClient, RedisClientType } from 'redis';
import { Employee, Department, Desk } from '../types/database.js';

/**
 * Redis缓存服务
 * 提供高性能的分布式缓存解决方案，与PostgreSQL 16.6兼容
 */
export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly DEFAULT_TTL = 300; // 5分钟默认过期时间

  private constructor() {
    // 从环境变量获取Redis配置
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisDb = parseInt(process.env.REDIS_DB || '0');

    // 创建Redis客户端
    this.client = createClient({
      url: redisUrl,
      socket: {
        host: redisHost,
        port: redisPort,
        reconnectStrategy: (retries) => {
          console.log(`Redis重连尝试 ${retries}`);
          return Math.min(retries * 50, 500);
        }
      },
      password: redisPassword,
      database: redisDb
    });

    // 设置事件监听器
    this.client.on('connect', () => {
      console.log('Redis客户端已连接');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis连接错误:', err);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('Redis连接已断开');
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * 连接到Redis服务器
   */
  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        console.log('Redis服务已连接');
      }
    } catch (error) {
      console.error('Redis连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开Redis连接
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        console.log('Redis连接已断开');
      }
    } catch (error) {
      console.error('Redis断开连接失败:', error);
    }
  }

  /**
   * 检查Redis连接状态
   */
  public isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 设置缓存数据
   */
  public async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, serializedValue);
      console.log(`Redis缓存已设置: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`Redis设置缓存失败 ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取缓存数据
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Redis获取缓存失败 ${key}:`, error);
      return null;
    }
  }

  /**
   * 删除缓存数据
   */
  public async del(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.client.del(key);
      console.log(`Redis缓存已删除: ${key}`);
    } catch (error) {
      console.error(`Redis删除缓存失败 ${key}:`, error);
    }
  }

  /**
   * 检查缓存是否存在
   */
  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis检查缓存存在失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   */
  public async expire(key: string, ttl: number): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.client.expire(key, ttl);
      console.log(`Redis缓存过期时间已设置: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`Redis设置过期时间失败 ${key}:`, error);
    }
  }

  /**
   * 获取缓存剩余过期时间
   */
  public async ttl(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Redis获取TTL失败 ${key}:`, error);
      return -1;
    }
  }

  /**
   * 清空所有缓存
   */
  public async flushAll(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.client.flushAll();
      console.log('Redis所有缓存已清空');
    } catch (error) {
      console.error('Redis清空缓存失败:', error);
    }
  }

  /**
   * 获取Redis信息
   */
  public async getInfo(): Promise<string> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      return await this.client.info();
    } catch (error) {
      console.error('Redis获取信息失败:', error);
      return '';
    }
  }

  /**
   * 缓存部门数据
   */
  public async cacheDepartments(departments: Department[], ttl: number = 600): Promise<void> {
    await this.set('departments:all', departments, ttl);
  }

  /**
   * 获取缓存的部门数据
   */
  public async getCachedDepartments(): Promise<Department[] | null> {
    return await this.get<Department[]>('departments:all');
  }

  /**
   * 缓存员工数据
   */
  public async cacheEmployees(employees: Employee[], ttl: number = 600): Promise<void> {
    await this.set('employees:all', employees, ttl);
  }

  /**
   * 获取缓存的员工数据
   */
  public async getCachedEmployees(): Promise<Employee[] | null> {
    return await this.get<Employee[]>('employees:all');
  }

  /**
   * 缓存工位数据
   */
  public async cacheWorkstations(workstations: Desk[], ttl: number = 600): Promise<void> {
    await this.set('workstations:all', workstations, ttl);
  }

  /**
   * 获取缓存的工位数据
   */
  public async getCachedWorkstations(): Promise<Desk[] | null> {
    return await this.get<Desk[]>('workstations:all');
  }

  /**
   * 缓存搜索结果
   */
  public async cacheSearchResult(query: string, type: string, result: any, ttl: number = 300): Promise<void> {
    const key = `search:${type}:${Buffer.from(query).toString('base64')}`;
    await this.set(key, result, ttl);
  }

  /**
   * 获取缓存的搜索结果
   */
  public async getCachedSearchResult<T>(query: string, type: string): Promise<T | null> {
    const key = `search:${type}:${Buffer.from(query).toString('base64')}`;
    return await this.get<T>(key);
  }

  /**
   * 使相关缓存失效
   */
  public async invalidateRelatedCache(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`Redis相关缓存已失效: ${pattern} (${keys.length}个键)`);
      }
    } catch (error) {
      console.error(`Redis使缓存失效失败 ${pattern}:`, error);
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{ status: string; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 导出单例实例
export const redisService = RedisService.getInstance();