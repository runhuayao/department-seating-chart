import { Pool } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '113464',
  ssl: false,
  connectionTimeoutMillis: 10000,
};

console.log('数据库配置:', {
  ...config,
  password: '***' // 隐藏密码
});

const pool = new Pool(config);

async function testConnection() {
  try {
    console.log('正在测试数据库连接...');
    const client = await pool.connect();
    console.log('✅ 数据库连接成功!');
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ 查询测试成功:', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0]
    });
    
    // 测试表是否存在
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('✅ 数据库表:', tablesResult.rows.map(row => row.table_name));
    
    client.release();
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    await pool.end();
  }
}

testConnection();