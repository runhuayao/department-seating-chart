#!/usr/bin/env node

/**
 * PostgreSQL连接测试脚本
 * 用于诊断MCP PostgreSQL服务器连接问题
 */

const { Pool } = require('pg');
require('dotenv').config();

// 从环境变量读取配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '113464',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

console.log('🔍 PostgreSQL连接测试');
console.log('配置信息:');
console.log(`  主机: ${dbConfig.host}`);
console.log(`  端口: ${dbConfig.port}`);
console.log(`  数据库: ${dbConfig.database}`);
console.log(`  用户: ${dbConfig.user}`);
console.log(`  SSL: ${dbConfig.ssl ? 'enabled' : 'disabled'}`);
console.log('');

async function testConnection() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔌 尝试连接到PostgreSQL...');
    const client = await pool.connect();
    
    console.log('✅ 连接成功!');
    
    // 测试基本查询
    console.log('\n📊 执行测试查询...');
    const result = await client.query('SELECT version(), current_database(), current_user;');
    
    console.log('数据库版本:', result.rows[0].version);
    console.log('当前数据库:', result.rows[0].current_database);
    console.log('当前用户:', result.rows[0].current_user);
    
    // 测试表查询
    console.log('\n📋 检查表结构...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('数据库表:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.release();
    console.log('\n🎉 PostgreSQL连接测试完成!');
    
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('\n🔧 可能的解决方案:');
    console.error('1. 检查PostgreSQL服务是否运行');
    console.error('2. 验证用户名和密码');
    console.error('3. 检查pg_hba.conf认证配置');
    console.error('4. 确保数据库存在');
    console.error('5. 检查防火墙设置');
    
    if (error.code) {
      console.error(`\n错误代码: ${error.code}`);
    }
  } finally {
    await pool.end();
  }
}

// 运行测试
testConnection().catch(console.error);