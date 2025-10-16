import { Pool, PoolClient, PoolConfig } from 'pg';
import { Logger } from '../../infrastructure/logging/logger';
import { EventEmitter } from 'events';

export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
  min?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingClients: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  connectionErrors: number;
  poolErrors: number;
  lastError?: string;
  uptime: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

/**
 * PostgreSQL连接池管理器
 * 提供高性能的数据库连接管理和查询执行
 */
export class DatabaseConnectionPool extends EventEmitter {
  private pool: Pool;
  private logger: Logger;
  private config: DatabaseConfig;
  private metrics: ConnectionMetrics;
  private startTime: number;
  private queryTimes: number[] = [];
  private maxQueryTimeHistory: number = 1000;
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown: boolean = false;

  constructor(config: DatabaseConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.startTime = Date.now();
    this.initializeMetrics();
    this.createPool();
    this.setupEventHandlers();
    this.startHealthCheck();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      poolErrors: 0,
      uptime: 0
    };
  }

  /**
   * 创建连接池
   */
  private createPool(): void {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.max || 20,
      min: this.config.min || 5,
      idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis || 10000,
      acquireTimeoutMillis: this.config.acquireTimeoutMillis || 60000,
      createTimeoutMillis: this.config.createTimeoutMillis || 30000,
      destroyTimeoutMillis: this.config.destroyTimeoutMillis || 5000,
      reapIntervalMillis: this.config.reapIntervalMillis || 1000,
      createRetryIntervalMillis: this.config.createRetryIntervalMillis || 200,
      allowExitOnIdle: false
    };

    this.pool = new Pool(poolConfig);

    this.logger.info('Database connection pool created', {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      maxConnections: poolConfig.max,
      minConnections: poolConfig.min
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 连接建立事件
    this.pool.on('connect', (client: PoolClient) => {
      this.metrics.totalConnections++;
      this.logger.debug('Database client connected', {
        totalConnections: this.metrics.totalConnections
      });
      this.emit('connect', client);
    });

    // 连接获取事件
    this.pool.on('acquire', (client: PoolClient) => {
      this.updateConnectionMetrics();
      this.logger.debug('Database client acquired');
      this.emit('acquire', client);
    });

    // 连接释放事件
    this.pool.on('release', (err: Error | undefined, client: PoolClient) => {
      this.updateConnectionMetrics();
      if (err) {
        this.metrics.connectionErrors++;
        this.logger.error('Database client release error', { error: err.message });
      } else {
        this.logger.debug('Database client released');
      }
      this.emit('release', err, client);
    });

    // 连接移除事件
    this.pool.on('remove', (client: PoolClient) => {
      this.updateConnectionMetrics();
      this.logger.debug('Database client removed');
      this.emit('remove', client);
    });

    // 连接错误事件
    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.metrics.poolErrors++;
      this.metrics.lastError = err.message;
      this.logger.error('Database pool error', {
        error: err.message,
        stack: err.stack
      });
      this.emit('error', err, client);
    });
  }

  /**
   * 更新连接指标
   */
  private updateConnectionMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;
    this.metrics.uptime = Date.now() - this.startTime;
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.logger.error('Health check failed', { error: (error as Error).message });
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const duration = Date.now() - startTime;

      const isHealthy = result.rows.length > 0 && duration < 5000;
      
      if (isHealthy) {
        this.logger.debug('Database health check passed', { duration });
      } else {
        this.logger.warn('Database health check slow', { duration });
      }

      this.emit('health_check', { healthy: isHealthy, duration });
      return isHealthy;
    } catch (error) {
      this.logger.error('Database health check failed', { error: (error as Error).message });
      this.emit('health_check', { healthy: false, error: (error as Error).message });
      return false;
    }
  }

  /**
   * 执行查询
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;
      
      this.metrics.successfulQueries++;
      this.recordQueryTime(duration);
      
      this.logger.debug('Database query executed', {
        query: text.substring(0, 100),
        duration,
        rowCount: result.rowCount
      });

      return result as QueryResult<T>;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedQueries++;
      this.recordQueryTime(duration);
      
      this.logger.error('Database query failed', {
        query: text.substring(0, 100),
        params,
        duration,
        error: (error as Error).message
      });

      throw error;
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      
      this.logger.debug('Database transaction committed');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      
      this.logger.error('Database transaction rolled back', {
        error: (error as Error).message
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取连接客户端
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      this.logger.debug('Database client acquired manually');
      return client;
    } catch (error) {
      this.metrics.connectionErrors++;
      this.logger.error('Failed to acquire database client', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 批量执行查询
   */
  async batchQuery<T = any>(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult<T>[]> {
    const results: QueryResult<T>[] = [];
    
    return this.transaction(async (client) => {
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result as QueryResult<T>);
      }
      return results;
    });
  }

  /**
   * 执行预处理语句
   */
  async preparedQuery<T = any>(name: string, text: string, params?: any[]): Promise<QueryResult<T>> {
    const client = await this.getClient();
    
    try {
      // 准备语句
      await client.query(`PREPARE ${name} AS ${text}`);
      
      // 执行预处理语句
      const result = await client.query(`EXECUTE ${name}`, params);
      
      // 释放预处理语句
      await client.query(`DEALLOCATE ${name}`);
      
      return result as QueryResult<T>;
    } finally {
      client.release();
    }
  }

  /**
   * 流式查询（用于大数据集）
   */
  createQueryStream(text: string, params?: any[]): NodeJS.ReadableStream {
    const QueryStream = require('pg-query-stream');
    
    return new Promise((resolve, reject) => {
      this.pool.connect((err, client, release) => {
        if (err) {
          reject(err);
          return;
        }

        const query = new QueryStream(text, params);
        const stream = client.query(query);
        
        stream.on('end', () => {
          release();
        });
        
        stream.on('error', (error: Error) => {
          release();
          reject(error);
        });

        resolve(stream);
      });
    }) as any;
  }

  /**
   * 记录查询时间
   */
  private recordQueryTime(duration: number): void {
    this.queryTimes.push(duration);
    
    // 保持历史记录大小限制
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes = this.queryTimes.slice(-this.maxQueryTimeHistory);
    }
    
    // 计算平均查询时间
    this.metrics.averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * 获取连接池指标
   */
  getMetrics(): ConnectionMetrics {
    this.updateConnectionMetrics();
    return { ...this.metrics };
  }

  /**
   * 获取详细统计信息
   */
  getDetailedStats(): {
    metrics: ConnectionMetrics;
    queryTimePercentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    poolConfig: {
      max: number;
      min: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
    };
  } {
    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const length = sortedTimes.length;
    
    const percentiles = {
      p50: length > 0 ? sortedTimes[Math.floor(length * 0.5)] : 0,
      p90: length > 0 ? sortedTimes[Math.floor(length * 0.9)] : 0,
      p95: length > 0 ? sortedTimes[Math.floor(length * 0.95)] : 0,
      p99: length > 0 ? sortedTimes[Math.floor(length * 0.99)] : 0
    };

    return {
      metrics: this.getMetrics(),
      queryTimePercentiles: percentiles,
      poolConfig: {
        max: this.pool.options.max || 0,
        min: this.pool.options.min || 0,
        idleTimeoutMillis: this.pool.options.idleTimeoutMillis || 0,
        connectionTimeoutMillis: this.pool.options.connectionTimeoutMillis || 0
      }
    };
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW() as current_time');
      this.logger.info('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 获取数据库信息
   */
  async getDatabaseInfo(): Promise<{
    version: string;
    currentDatabase: string;
    currentUser: string;
    serverTime: Date;
    timezone: string;
  }> {
    const result = await this.query(`
      SELECT 
        version() as version,
        current_database() as current_database,
        current_user as current_user,
        now() as server_time,
        current_setting('timezone') as timezone
    `);

    return result.rows[0];
  }

  /**
   * 优雅关闭连接池
   */
  async shutdown(timeout: number = 10000): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Database pool is already shutting down');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Starting database pool shutdown');

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 设置关闭超时
    const shutdownPromise = this.pool.end();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), timeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.info('Database pool shutdown completed');
    } catch (error) {
      this.logger.error('Database pool shutdown failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 强制关闭所有连接
   */
  async forceShutdown(): Promise<void> {
    this.logger.warn('Force shutting down database pool');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 强制结束所有连接
    await this.pool.end();
    
    this.logger.info('Database pool force shutdown completed');
  }

  /**
   * 重置连接池
   */
  async reset(): Promise<void> {
    this.logger.info('Resetting database connection pool');
    
    await this.shutdown();
    this.initializeMetrics();
    this.createPool();
    this.setupEventHandlers();
    this.startHealthCheck();
    
    this.logger.info('Database connection pool reset completed');
  }

  /**
   * 检查连接池是否健康
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // 检查基本指标
    const hasConnections = metrics.totalConnections > 0;
    const hasIdleConnections = metrics.idleConnections > 0;
    const lowErrorRate = metrics.poolErrors < 10 && metrics.connectionErrors < 10;
    const reasonableQueryTime = metrics.averageQueryTime < 1000;
    
    return hasConnections && hasIdleConnections && lowErrorRate && reasonableQueryTime;
  }

  /**
   * 获取连接池状态
   */
  getStatus(): {
    healthy: boolean;
    uptime: number;
    connections: {
      total: number;
      idle: number;
      active: number;
      waiting: number;
    };
    queries: {
      total: number;
      successful: number;
      failed: number;
      averageTime: number;
    };
    errors: {
      connection: number;
      pool: number;
      lastError?: string;
    };
  } {
    const metrics = this.getMetrics();
    
    return {
      healthy: this.isHealthy(),
      uptime: metrics.uptime,
      connections: {
        total: metrics.totalConnections,
        idle: metrics.idleConnections,
        active: metrics.activeConnections,
        waiting: metrics.waitingClients
      },
      queries: {
        total: metrics.totalQueries,
        successful: metrics.successfulQueries,
        failed: metrics.failedQueries,
        averageTime: metrics.averageQueryTime
      },
      errors: {
        connection: metrics.connectionErrors,
        pool: metrics.poolErrors,
        lastError: metrics.lastError
      }
    };
  }
}