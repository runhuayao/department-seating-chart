// 数据库配置和连接池管理
// 基于用户认证与授权系统设计方案

import { Pool, PoolClient, PoolConfig } from 'pg';
import { EventEmitter } from 'events';

// 数据库配置接口
interface DatabaseConfig extends PoolConfig {
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
}

// 用户上下文接口
interface UserContext {
  userId?: number;
  username?: string;
  role?: string;
  departmentId?: number;
}

class DatabaseManager extends EventEmitter {
  private pool: Pool;
  private config: DatabaseConfig;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly RETRY_DELAY = 5000; // 5秒

  constructor() {
    super();
    
    // 数据库配置
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'department_map',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      
      // 连接池配置
      max: parseInt(process.env.DB_POOL_MAX || '20'), // 最大连接数
      min: parseInt(process.env.DB_POOL_MIN || '2'),  // 最小连接数
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 空闲超时
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // 连接超时
      
      // SSL配置
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      
      // 应用程序名称
      application_name: 'department_map_api'
    };

    this.initializePool();
  }

  // 初始化连接池
  private initializePool() {
    this.pool = new Pool(this.config);

    // 连接池事件监听
    this.pool.on('connect', (client: PoolClient) => {
      console.log('数据库连接已建立');
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.emit('connected', client);
    });

    this.pool.on('error', (err: Error) => {
      console.error('数据库连接池错误:', err);
      this.isConnected = false;
      this.emit('error', err);
      
      // 尝试重新连接
      this.handleReconnection();
    });

    this.pool.on('acquire', (client: PoolClient) => {
      console.log('获取数据库连接');
    });

    this.pool.on('remove', (client: PoolClient) => {
      console.log('移除数据库连接');
    });

    // 测试初始连接
    this.testConnection();
  }

  // 测试数据库连接
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();
      
      console.log('数据库连接测试成功:', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version.split(' ')[0]
      });
      
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      this.isConnected = false;
      return false;
    }
  }

  // 处理重新连接
  private async handleReconnection() {
    if (this.connectionAttempts >= this.MAX_RETRY_ATTEMPTS) {
      console.error('达到最大重连次数，停止重连');
      this.emit('maxRetriesReached');
      return;
    }

    this.connectionAttempts++;
    console.log(`尝试重新连接数据库 (${this.connectionAttempts}/${this.MAX_RETRY_ATTEMPTS})`);

    setTimeout(async () => {
      try {
        await this.testConnection();
        if (this.isConnected) {
          console.log('数据库重连成功');
          this.emit('reconnected');
        } else {
          this.handleReconnection();
        }
      } catch (error) {
        console.error('重连失败:', error);
        this.handleReconnection();
      }
    }, this.RETRY_DELAY * this.connectionAttempts); // 递增延迟
  }

  // 执行查询（带用户上下文）
  public async query(text: string, params?: any[], userContext?: UserContext) {
    const client = await this.pool.connect();
    
    try {
      // 设置用户上下文
      if (userContext) {
        await this.setUserContext(client, userContext);
      }
      
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // 记录慢查询
      if (duration > 1000) {
        console.warn(`慢查询检测 (${duration}ms):`, {
          query: text.substring(0, 100),
          params: params?.slice(0, 5),
          user: userContext?.username
        });
      }
      
      return result;
    } finally {
      client.release();
    }
  }

  // 执行事务
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    userContext?: UserContext
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 设置用户上下文
      if (userContext) {
        await this.setUserContext(client, userContext);
      }
      
      const result = await callback(client);
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 设置用户上下文（用于RLS）
  private async setUserContext(client: PoolClient, userContext: UserContext) {
    const settings = [];
    
    if (userContext.userId) {
      settings.push(`SET app.current_user_id = '${userContext.userId}'`);
    }
    
    if (userContext.username) {
      settings.push(`SET app.current_username = '${userContext.username}'`);
    }
    
    if (userContext.role) {
      settings.push(`SET app.current_user_role = '${userContext.role}'`);
    }
    
    if (userContext.departmentId) {
      settings.push(`SET app.current_department_id = '${userContext.departmentId}'`);
    }
    
    // 批量执行设置
    if (settings.length > 0) {
      await client.query(settings.join('; '));
    }
  }

  // 获取连接池状态
  public getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      config: {
        max: this.config.max,
        min: this.config.min,
        host: this.config.host,
        database: this.config.database,
        user: this.config.user
      }
    };
  }

  // 健康检查
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      const start = Date.now();
      const result = await this.query(
        'SELECT 1 as test, NOW() as timestamp, pg_database_size(current_database()) as db_size'
      );
      const responseTime = Date.now() - start;
      
      const poolStatus = this.getPoolStatus();
      
      return {
        status: 'healthy',
        details: {
          responseTime,
          timestamp: result.rows[0].timestamp,
          databaseSize: result.rows[0].db_size,
          pool: poolStatus
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          pool: this.getPoolStatus()
        }
      };
    }
  }

  // 执行数据库迁移检查
  public async checkMigrations(): Promise<{
    applied: string[];
    pending: string[];
  }> {
    try {
      // 检查迁移表是否存在
      const tableExists = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        )
      `);
      
      if (!tableExists.rows[0].exists) {
        // 创建迁移表
        await this.query(`
          CREATE TABLE schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return { applied: [], pending: [] };
      }
      
      // 获取已应用的迁移
      const appliedResult = await this.query(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      
      const applied = appliedResult.rows.map(row => row.version);
      
      // TODO: 扫描迁移文件目录获取待应用的迁移
      const pending: string[] = [];
      
      return { applied, pending };
    } catch (error) {
      console.error('检查迁移状态失败:', error);
      throw error;
    }
  }

  // 获取数据库统计信息
  public async getStatistics() {
    try {
      const stats = await this.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);
      
      const connections = await this.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      return {
        tables: stats.rows,
        connections: connections.rows[0],
        pool: this.getPoolStatus()
      };
    } catch (error) {
      console.error('获取数据库统计信息失败:', error);
      throw error;
    }
  }

  // 关闭连接池
  public async close(): Promise<void> {
    console.log('关闭数据库连接池...');
    
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('数据库连接池已关闭');
      this.emit('closed');
    } catch (error) {
      console.error('关闭数据库连接池失败:', error);
      throw error;
    }
  }
}

// 创建全局数据库管理器实例
const dbManager = new DatabaseManager();

// 导出连接池和管理器
export const pool = dbManager;
export default dbManager;
export { DatabaseManager, UserContext };

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在关闭数据库连接...');
  await dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭数据库连接...');
  await dbManager.close();
  process.exit(0);
});