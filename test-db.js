import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './api/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

async function testConnection() {
  try {
    console.log('测试数据库连接...');
    console.log('配置:', {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'department_map',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD ? '***' : '(empty)'
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    
    console.log('数据库连接成功!');
    console.log('当前时间:', result.rows[0].current_time);
    console.log('PostgreSQL版本:', result.rows[0].version.split(' ')[0]);
    
    // 检查数据库是否存在
    const dbCheck = await pool.query("SELECT datname FROM pg_database WHERE datname = $1", [process.env.DB_NAME || 'department_map']);
    if (dbCheck.rows.length === 0) {
      console.log('警告: 数据库', process.env.DB_NAME || 'department_map', '不存在');
    } else {
      console.log('数据库', process.env.DB_NAME || 'department_map', '存在');
    }
    
    await pool.end();
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

testConnection();