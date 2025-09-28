#!/usr/bin/env node

/**
 * PostgreSQL认证修复脚本
 * 创建一个使用md5认证的用户来解决MCP连接问题
 */

const { Pool } = require('pg');
require('dotenv').config();

// 使用管理员权限连接
const adminConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '113464',
  ssl: false
};

async function fixPostgreSQLAuth() {
  const pool = new Pool(adminConfig);
  
  try {
    console.log('🔧 PostgreSQL认证修复开始...');
    
    const client = await pool.connect();
    
    // 检查当前用户
    console.log('\n📋 检查当前用户信息...');
    const userResult = await client.query(`
      SELECT usename, usesuper, usecreatedb 
      FROM pg_user 
      WHERE usename = $1;
    `, [adminConfig.user]);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`用户: ${user.usename}`);
      console.log(`超级用户: ${user.usesuper}`);
      console.log(`可创建数据库: ${user.usecreatedb}`);
    }
    
    // 检查认证方法
    console.log('\n🔍 检查认证配置...');
    const authResult = await client.query(`
      SELECT name, setting, context 
      FROM pg_settings 
      WHERE name IN ('password_encryption', 'ssl');
    `);
    
    authResult.rows.forEach(row => {
      console.log(`${row.name}: ${row.setting}`);
    });
    
    // 尝试创建一个MCP专用用户
    console.log('\n👤 创建MCP专用用户...');
    
    try {
      // 删除已存在的用户（如果有）
      await client.query('DROP USER IF EXISTS mcp_user;');
      
      // 创建新用户
      await client.query(`
        CREATE USER mcp_user WITH 
        PASSWORD '113464' 
        CREATEDB 
        LOGIN;
      `);
      
      // 授予权限
      await client.query('GRANT ALL PRIVILEGES ON DATABASE department_map TO mcp_user;');
      await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;');
      await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;');
      
      console.log('✅ MCP用户创建成功!');
      
      // 测试新用户连接
      console.log('\n🧪 测试MCP用户连接...');
      const mcpConfig = {
        ...adminConfig,
        user: 'mcp_user'
      };
      
      const mcpPool = new Pool(mcpConfig);
      const mcpClient = await mcpPool.connect();
      
      const testResult = await mcpClient.query('SELECT current_user, version();');
      console.log('MCP用户连接成功:', testResult.rows[0].current_user);
      
      mcpClient.release();
      await mcpPool.end();
      
    } catch (userError) {
      console.log('⚠️  MCP用户创建失败，使用现有用户');
      console.log('错误:', userError.message);
    }
    
    client.release();
    console.log('\n🎉 认证修复完成!');
    
    console.log('\n📝 建议的MCP配置:');
    console.log('使用以下连接字符串:');
    console.log('postgresql://mcp_user:113464@localhost:5432/department_map');
    console.log('或者:');
    console.log('postgresql://postgres:113464@localhost:5432/department_map');
    
  } catch (error) {
    console.error('❌ 认证修复失败:', error.message);
    console.error('\n🔧 建议:');
    console.error('1. 检查PostgreSQL服务状态');
    console.error('2. 验证管理员密码');
    console.error('3. 检查pg_hba.conf配置');
  } finally {
    await pool.end();
  }
}

// 运行修复
fixPostgreSQLAuth().catch(console.error);