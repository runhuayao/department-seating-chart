/**
 * 数据库连接配置
 * 提供PostgreSQL数据库连接池管理
 */
import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 数据库连接池配置
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * 数据库查询接口
 */
export interface DatabaseQuery {
  text: string;
  values?: any[];
}

/**
 * 数据库连接类
 */
export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = pool;
    this.setupEventHandlers();
  }

  /**
   * 获取数据库实例（单例模式）
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      console.log('数据库连接建立成功');
    });

    this.pool.on('error', (err: Error) => {
      console.error('数据库连接池错误:', err);
    });

    this.pool.on('remove', () => {
      console.log('数据库连接已移除');
    });
  }

  /**
   * 执行查询
   */
  public async query(queryConfig: DatabaseQuery): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(queryConfig.text, queryConfig.values);
      return result;
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 执行事务
   */
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('事务执行错误:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 测试数据库连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query({ text: 'SELECT NOW() as current_time' });
      console.log('数据库连接测试成功:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取连接池状态
   */
  public getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * 关闭连接池
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log('数据库连接池已关闭');
  }
}

// 导出数据库实例
export const db = Database.getInstance();

// 导出连接池（用于特殊情况）
export { pool };

// 默认导出
export default db;