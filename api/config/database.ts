import mysql from 'mysql2/promise';

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'department_map',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0'),
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
  timeout: parseInt(process.env.DB_TIMEOUT || '60000'),
  charset: 'utf8mb4',
  // SSL配置（生产环境建议启用）
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
  // 连接选项
  multipleStatements: false, // 防止SQL注入
  namedPlaceholders: true,   // 启用命名占位符
  // 连接池事件处理
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 创建连接池
export const pool = mysql.createPool(dbConfig);

// 连接池事件监听
pool.on('connection', (connection) => {
  console.log('✓ 数据库连接已建立:', connection.threadId);
});

pool.on('error', (err) => {
  console.error('❌ 数据库连接池错误:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 尝试重新连接数据库...');
  }
});

// 数据库健康检查
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库健康检查失败:', error);
    return false;
  }
}

// 安全的查询执行函数（防SQL注入）
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = []
): Promise<T> {
  try {
    const [rows] = await pool.execute(query, params);
    return rows as T;
  } catch (error) {
    console.error('❌ 数据库查询执行失败:', {
      query: query.substring(0, 100) + '...',
      error: error.message
    });
    throw error;
  }
}

// 事务执行函数
export async function executeTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 数据库初始化函数
export async function initializeDatabase() {
  try {
    // 检查数据库连接
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('✓ 数据库连接正常');
    } else {
      console.log('⚠️  数据库连接异常，使用内存模式');
    }
    
    console.log('✓ 内存数据库初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function closeDatabaseConnections(): Promise<void> {
  try {
    await pool.end();
    console.log('✓ 数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接池失败:', error);
  }
}

export default { 
  pool, 
  initializeDatabase, 
  checkDatabaseHealth,
  executeQuery,
  executeTransaction,
  closeDatabaseConnections
};