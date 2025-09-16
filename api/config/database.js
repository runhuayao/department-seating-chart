/**
 * 数据库配置文件
 * PostgreSQL连接配置
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 数据库连接配置
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'department_map',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  // 连接池配置
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
  // SSL配置（生产环境建议启用）
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// 创建连接池
const pool = new Pool(dbConfig);

// 连接池事件监听
pool.on('connect', (client) => {
  console.log('数据库连接建立成功');
});

pool.on('error', (err, client) => {
  console.error('数据库连接池错误:', err);
});

pool.on('acquire', (client) => {
  console.log('从连接池获取连接');
});

pool.on('remove', (client) => {
  console.log('从连接池移除连接');
});

// 数据库查询封装函数
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('执行查询:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('查询执行失败:', { text, error: error.message });
    throw error;
  }
};

// 获取客户端连接
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('获取数据库客户端失败:', error);
    throw error;
  }
};

// 事务处理封装
const transaction = async (callback) => {
  const client = await getClient();
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
};

// 数据库健康检查
const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version,
      connectionCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// 关闭连接池
const end = async () => {
  try {
    await pool.end();
    console.log('数据库连接池已关闭');
  } catch (error) {
    console.error('关闭数据库连接池失败:', error);
    throw error;
  }
};

// 常用查询函数
const commonQueries = {
  // 获取表信息
  getTableInfo: async (tableName) => {
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    return result.rows;
  },

  // 获取表记录数
  getTableCount: async (tableName) => {
    const result = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  },

  // 检查表是否存在
  tableExists: async (tableName) => {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    return result.rows[0].exists;
  },

  // 获取所有表名
  getAllTables: async () => {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map(row => row.table_name);
  }
};

// 导出数据库实例和工具函数
const db = {
  query,
  getClient,
  transaction,
  healthCheck,
  end,
  pool,
  ...commonQueries
};

export default db;
export { query, getClient, transaction, healthCheck, end, pool, commonQueries };

// 初始化时测试连接
(async () => {
  try {
    const health = await healthCheck();
    if (health.status === 'healthy') {
      console.log('✓ 数据库连接初始化成功');
      console.log(`  - 数据库版本: ${health.version.substring(0, 50)}...`);
      console.log(`  - 连接池状态: 总连接数=${health.connectionCount}, 空闲=${health.idleCount}, 等待=${health.waitingCount}`);
    } else {
      console.warn('⚠ 数据库连接异常:', health.error);
    }
  } catch (error) {
    console.error('✗ 数据库初始化失败:', error.message);
  }
})();