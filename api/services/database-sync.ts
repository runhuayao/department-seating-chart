import { Pool } from 'pg';
import Redis from 'ioredis';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

interface SyncOperation {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  conditions?: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

class DatabaseSyncService {
  private static instance: DatabaseSyncService;
  private masterPool: Pool;
  private slavePool: Pool;
  private redis: Redis;
  private syncQueue: SyncOperation[] = [];
  private isProcessing: boolean = false;
  private syncInterval: NodeJS.Timeout;

  private constructor() {
    this.initializeDatabasePools();
    this.initializeRedis();
    this.startSyncProcessor();
  }

  public static getInstance(): DatabaseSyncService {
    if (!DatabaseSyncService.instance) {
      DatabaseSyncService.instance = new DatabaseSyncService();
    }
    return DatabaseSyncService.instance;
  }

  // 初始化数据库连接池
  private initializeDatabasePools() {
    const masterConfig: DatabaseConfig = {
      host: process.env.DB_MASTER_HOST || 'localhost',
      port: parseInt(process.env.DB_MASTER_PORT || '5432'),
      database: process.env.DB_NAME || 'department_map',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true'
    };

    const slaveConfig: DatabaseConfig = {
      host: process.env.DB_SLAVE_HOST || process.env.DB_MASTER_HOST || 'localhost',
      port: parseInt(process.env.DB_SLAVE_PORT || process.env.DB_MASTER_PORT || '5432'),
      database: process.env.DB_NAME || 'department_map',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true'
    };

    this.masterPool = new Pool({
      ...masterConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    this.slavePool = new Pool({
      ...slaveConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    console.log('🗄️ 数据库连接池初始化完成 - 主从架构');
  }

  // 初始化Redis连接
  private initializeRedis() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    console.log('💾 Redis连接初始化完成');
  }

  // 启动同步处理器
  private startSyncProcessor() {
    this.syncInterval = setInterval(async () => {
      if (!this.isProcessing && this.syncQueue.length > 0) {
        await this.processSyncQueue();
      }
    }, 1000); // 每秒处理一次同步队列

    console.log('🔄 数据库同步处理器已启动');
  }

  // 双写操作 - 主数据库写入，从数据库同步
  public async dualWrite(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<any> {
    const syncOp: SyncOperation = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      ...operation
    };

    try {
      // 1. 主数据库写入
      const masterResult = await this.executeOnMaster(syncOp);
      
      // 2. 添加到同步队列 (异步同步到从数据库)
      this.syncQueue.push(syncOp);
      
      // 3. 缓存操作结果
      await this.cacheOperationResult(syncOp, masterResult);

      console.log(`✅ 主数据库写入成功 - 操作: ${syncOp.type}, 表: ${syncOp.table}`);
      return masterResult;
    } catch (error) {
      console.error('主数据库写入失败:', error);
      
      // 记录失败操作到Redis
      await this.cacheFailedOperation(syncOp, error.message);
      throw error;
    }
  }

  // 在主数据库执行操作
  private async executeOnMaster(operation: SyncOperation): Promise<any> {
    const client = await this.masterPool.connect();
    
    try {
      await client.query('BEGIN');
      
      let result;
      switch (operation.type) {
        case 'INSERT':
          result = await this.executeInsert(client, operation);
          break;
        case 'UPDATE':
          result = await this.executeUpdate(client, operation);
          break;
        case 'DELETE':
          result = await this.executeDelete(client, operation);
          break;
        default:
          throw new Error(`不支持的操作类型: ${operation.type}`);
      }
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 在从数据库执行操作
  private async executeOnSlave(operation: SyncOperation): Promise<any> {
    const client = await this.slavePool.connect();
    
    try {
      await client.query('BEGIN');
      
      let result;
      switch (operation.type) {
        case 'INSERT':
          result = await this.executeInsert(client, operation);
          break;
        case 'UPDATE':
          result = await this.executeUpdate(client, operation);
          break;
        case 'DELETE':
          result = await this.executeDelete(client, operation);
          break;
        default:
          throw new Error(`不支持的操作类型: ${operation.type}`);
      }
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 执行INSERT操作
  private async executeInsert(client: any, operation: SyncOperation) {
    const columns = Object.keys(operation.data);
    const values = Object.values(operation.data);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${operation.table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    const result = await client.query(query, values);
    return result.rows[0];
  }

  // 执行UPDATE操作
  private async executeUpdate(client: any, operation: SyncOperation) {
    const setClause = Object.keys(operation.data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const values = Object.values(operation.data);
    const whereClause = Object.keys(operation.conditions || {})
      .map((key, index) => `${key} = $${values.length + index + 1}`)
      .join(' AND ');
    
    const whereValues = Object.values(operation.conditions || {});
    
    const query = `
      UPDATE ${operation.table}
      SET ${setClause}
      ${whereClause ? `WHERE ${whereClause}` : ''}
      RETURNING *
    `;
    
    const result = await client.query(query, [...values, ...whereValues]);
    return result.rows[0];
  }

  // 执行DELETE操作
  private async executeDelete(client: any, operation: SyncOperation) {
    const whereClause = Object.keys(operation.conditions || {})
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');
    
    const whereValues = Object.values(operation.conditions || {});
    
    const query = `
      DELETE FROM ${operation.table}
      ${whereClause ? `WHERE ${whereClause}` : ''}
      RETURNING *
    `;
    
    const result = await client.query(query, whereValues);
    return result.rows[0];
  }

  // 处理同步队列
  private async processSyncQueue() {
    if (this.syncQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const operations = [...this.syncQueue];
    this.syncQueue = [];

    console.log(`🔄 处理同步队列 - 操作数量: ${operations.length}`);

    for (const operation of operations) {
      try {
        // 同步到从数据库
        await this.executeOnSlave(operation);
        
        // 更新Redis同步状态
        await this.updateSyncStatus(operation.id, 'completed');
        
        console.log(`✅ 从数据库同步成功 - 操作: ${operation.id}`);
      } catch (error) {
        console.error(`❌ 从数据库同步失败 - 操作: ${operation.id}`, error);
        
        // 重试机制
        if (operation.retryCount < operation.maxRetries) {
          operation.retryCount++;
          this.syncQueue.push(operation);
          console.log(`🔄 操作重试 - 操作: ${operation.id}, 重试次数: ${operation.retryCount}`);
        } else {
          // 记录失败操作
          await this.recordFailedSync(operation, error.message);
          console.error(`💀 操作最终失败 - 操作: ${operation.id}`);
        }
      }
    }

    this.isProcessing = false;
  }

  // 缓存操作结果
  private async cacheOperationResult(operation: SyncOperation, result: any) {
    const cacheKey = `sync:result:${operation.id}`;
    const cacheData = {
      operation,
      result,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
    
    await this.redis.set(cacheKey, JSON.stringify(cacheData), 'EX', 3600); // 1小时过期
  }

  // 缓存失败操作
  private async cacheFailedOperation(operation: SyncOperation, errorMessage: string) {
    const cacheKey = `sync:failed:${operation.id}`;
    const cacheData = {
      operation,
      error: errorMessage,
      status: 'failed',
      timestamp: new Date().toISOString()
    };
    
    await this.redis.set(cacheKey, JSON.stringify(cacheData), 'EX', 86400); // 24小时过期
  }

  // 更新同步状态
  private async updateSyncStatus(operationId: string, status: string) {
    const statusKey = `sync:status:${operationId}`;
    await this.redis.set(statusKey, status, 'EX', 3600);
  }

  // 记录失败的同步操作
  private async recordFailedSync(operation: SyncOperation, errorMessage: string) {
    const failedKey = `sync:failed:${operation.id}`;
    const failedData = {
      operation,
      error: errorMessage,
      finalFailureTime: new Date().toISOString(),
      retryCount: operation.retryCount
    };
    
    await this.redis.set(failedKey, JSON.stringify(failedData), 'EX', 86400 * 7); // 7天保留
  }

  // 获取同步状态统计
  public async getSyncStats() {
    try {
      const completedKeys = await this.redis.keys('sync:result:*');
      const failedKeys = await this.redis.keys('sync:failed:*');
      const pendingCount = this.syncQueue.length;

      return {
        completed: completedKeys.length,
        failed: failedKeys.length,
        pending: pendingCount,
        queueSize: this.syncQueue.length,
        isProcessing: this.isProcessing,
        lastProcessTime: new Date().toISOString()
      };
    } catch (error) {
      console.error('获取同步统计失败:', error);
      return {
        completed: 0,
        failed: 0,
        pending: 0,
        queueSize: 0,
        isProcessing: false,
        error: error.message
      };
    }
  }

  // 手动触发同步
  public async triggerManualSync(): Promise<void> {
    if (this.isProcessing) {
      throw new Error('同步正在进行中，请稍后再试');
    }

    console.log('🔄 手动触发数据库同步');
    await this.processSyncQueue();
  }

  // 检查数据库连接健康状态
  public async checkDatabaseHealth() {
    const health = {
      master: { connected: false, latency: 0, error: null },
      slave: { connected: false, latency: 0, error: null },
      redis: { connected: false, latency: 0, error: null }
    };

    // 检查主数据库
    try {
      const start = Date.now();
      await this.masterPool.query('SELECT 1');
      health.master.connected = true;
      health.master.latency = Date.now() - start;
    } catch (error) {
      health.master.error = error.message;
    }

    // 检查从数据库
    try {
      const start = Date.now();
      await this.slavePool.query('SELECT 1');
      health.slave.connected = true;
      health.slave.latency = Date.now() - start;
    } catch (error) {
      health.slave.error = error.message;
    }

    // 检查Redis
    try {
      const start = Date.now();
      await this.redis.ping();
      health.redis.connected = true;
      health.redis.latency = Date.now() - start;
    } catch (error) {
      health.redis.error = error.message;
    }

    return health;
  }

  // 获取主数据库连接
  public getMasterPool(): Pool {
    return this.masterPool;
  }

  // 获取从数据库连接 (用于读操作)
  public getSlavePool(): Pool {
    return this.slavePool;
  }

  // 读写分离 - 读操作使用从数据库
  public async executeReadQuery(query: string, values?: any[]): Promise<any> {
    try {
      const result = await this.slavePool.query(query, values);
      return result.rows;
    } catch (error) {
      console.warn('从数据库查询失败，切换到主数据库:', error.message);
      // 从数据库失败时切换到主数据库
      const result = await this.masterPool.query(query, values);
      return result.rows;
    }
  }

  // 写操作使用主数据库并同步到从数据库
  public async executeWriteQuery(
    query: string, 
    values?: any[], 
    table?: string
  ): Promise<any> {
    const operation: SyncOperation = {
      id: `write-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.getOperationType(query),
      table: table || this.extractTableName(query),
      data: values || [],
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3
    };

    return await this.dualWrite(operation);
  }

  // 从SQL语句提取操作类型
  private getOperationType(query: string): 'INSERT' | 'UPDATE' | 'DELETE' {
    const upperQuery = query.trim().toUpperCase();
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    return 'UPDATE'; // 默认
  }

  // 从SQL语句提取表名
  private extractTableName(query: string): string {
    const upperQuery = query.trim().toUpperCase();
    const match = upperQuery.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  // 销毁服务
  public async destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // 处理剩余的同步队列
    if (this.syncQueue.length > 0) {
      console.log(`🔄 处理剩余同步队列 - 数量: ${this.syncQueue.length}`);
      await this.processSyncQueue();
    }

    await this.masterPool.end();
    await this.slavePool.end();
    await this.redis.disconnect();
    
    console.log('🔚 数据库同步服务已销毁');
  }
}

export const databaseSyncService = DatabaseSyncService.getInstance();
export default databaseSyncService;