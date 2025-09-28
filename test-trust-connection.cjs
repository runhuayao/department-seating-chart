#!/usr/bin/env node

/**
 * 测试PostgreSQL Trust认证连接
 */

const { Pool } = require('pg');
require('dotenv').config();

async function testTrustConnection() {
  console.log('🧪 测试PostgreSQL Trust认证连接...');
  
  // Trust认证配置（无密码）
  const trustConfig = {
    host: 'localhost',
    port: 5432,
    database: 'department_map',
    user: 'postgres'
    // 注意：没有password字段
  };
  
  console.log('\n📋 连接配置:');
  console.log('Host:', trustConfig.host);
  console.log('Port:', trustConfig.port);
  console.log('Database:', trustConfig.database);
  console.log('User:', trustConfig.user);
  console.log('Password: (无)');
  
  try {
    const pool = new Pool(trustConfig);
    const client = await pool.connect();
    
    console.log('\n✅ Trust认证连接成功!');
    
    // 测试查询
    const versionResult = await client.query('SELECT version();');
    console.log('\n📊 数据库版本:');
    console.log(versionResult.rows[0].version);
    
    const userResult = await client.query('SELECT current_user, current_database();');
    console.log('\n👤 当前用户:', userResult.rows[0].current_user);
    console.log('🗄️  当前数据库:', userResult.rows[0].current_database);
    
    // 测试表查询
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 数据库表:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Trust认证测试完成!');
    console.log('\n🔗 MCP连接字符串应该使用:');
    console.log('postgresql://postgres@localhost:5432/department_map');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Trust认证连接失败:', error.message);
    console.error('\n🔧 可能的原因:');
    console.error('1. PostgreSQL服务未重启以应用新的pg_hba.conf配置');
    console.error('2. pg_hba.conf配置未正确修改');
    console.error('3. 数据库不存在或用户权限问题');
    
    console.error('\n💡 建议:');
    console.error('1. 重启PostgreSQL服务');
    console.error('2. 检查pg_hba.conf配置');
    console.error('3. 验证数据库和用户是否存在');
    
    return false;
  }
}

// 运行测试
testTrustConnection().catch(console.error);