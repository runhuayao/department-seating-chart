import dotenv from 'dotenv';
// 确保环境变量在模块加载时就被加载
dotenv.config();

import { Pool, PoolClient } from 'pg';

// 数据库模式配置
const DATABASE_MODE = process.env.DATABASE_MODE || 'auto'; // 'postgresql', 'memory', 'auto'
const FORCE_POSTGRESQL = process.env.FORCE_POSTGRESQL === 'true';
let isPostgreSQLAvailable = false;

// PostgreSQL数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'department_map',
  max: parseInt(process.env.DB_CONNECTION_LIMIT || '10'), // 最大连接数
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 空闲超时
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // 连接超时
  // SSL配置（生产环境建议启用）
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
};

// 创建PostgreSQL连接池
export const pool = new Pool(dbConfig);

// PostgreSQL连接池事件监听
pool.on('connect', (client) => {
  console.log('✓ PostgreSQL数据库连接已建立');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL连接池错误:', err);
  if ((err as any).code === 'ECONNREFUSED') {
    console.log('🔄 PostgreSQL连接被拒绝，请检查数据库服务是否启动');
  }
});

// PostgreSQL数据库健康检查
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isPostgreSQLAvailable = true;
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL数据库健康检查失败:', error);
    isPostgreSQLAvailable = false;
    return false;
  }
}

// 获取当前数据库模式
export function getDatabaseMode(): 'postgresql' | 'memory' {
  if (DATABASE_MODE === 'postgresql') return 'postgresql';
  if (DATABASE_MODE === 'memory') return 'memory';
  // auto模式：根据PostgreSQL可用性自动选择
  return isPostgreSQLAvailable ? 'postgresql' : 'memory';
}

// 检查是否使用PostgreSQL
export function isUsingPostgreSQL(): boolean {
  return getDatabaseMode() === 'postgresql';
}

// 安全的PostgreSQL查询执行函数（防SQL注入）
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = []
): Promise<T> {
  try {
    const result = await pool.query(query, params);
    return result.rows as T;
  } catch (error) {
    console.error('❌ PostgreSQL查询执行失败:', {
      query: query.substring(0, 100) + '...',
      error: error.message
    });
    throw error;
  }
}

// PostgreSQL事务执行函数
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

// 数据库初始化函数
export async function initializeDatabase(): Promise<boolean> {
  console.log('🔧 数据库模式配置:', DATABASE_MODE);
  console.log('🔒 强制PostgreSQL模式:', FORCE_POSTGRESQL);
  
  const currentMode = getDatabaseMode();
  console.log('📊 当前数据库模式:', currentMode);
  
  if (currentMode === 'postgresql') {
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('✅ PostgreSQL数据库连接成功');
      return true;
    } else {
      if (FORCE_POSTGRESQL) {
        console.error('❌ PostgreSQL数据库连接失败，但已启用强制PostgreSQL模式');
        console.error('🚨 请安装并启动PostgreSQL服务后重试');
        console.error('📋 安装步骤:');
        console.error('   1. 下载PostgreSQL: https://www.postgresql.org/download/windows/');
        console.error('   2. 安装并设置密码为: password');
        console.error('   3. 启动PostgreSQL服务');
        console.error('   4. 重启本应用');
        throw new Error('PostgreSQL连接失败，强制模式下不允许使用内存数据库');
      }
      console.log('❌ PostgreSQL数据库连接失败，切换到内存模式');
    }
  }
  
  // 内存模式处理
  if (FORCE_POSTGRESQL) {
    throw new Error('已启用强制PostgreSQL模式，不允许使用内存数据库');
  }
  
  console.log('🧠 使用内存数据库模式');
  console.log('💡 提示: 安装PostgreSQL后重启服务以使用数据库模式');
  return false;
}

// 优雅关闭PostgreSQL数据库连接
export async function closeDatabaseConnections(): Promise<void> {
  try {
    await pool.end();
    console.log('✓ PostgreSQL数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭PostgreSQL数据库连接池失败:', error);
  }
}

export default { 
  pool, 
  initializeDatabase, 
  checkDatabaseHealth,
  executeQuery,
  executeTransaction,
  closeDatabaseConnections,
  getDatabaseMode,
  isUsingPostgreSQL
};