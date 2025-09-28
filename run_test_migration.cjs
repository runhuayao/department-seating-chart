const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runTestMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 开始执行简化迁移测试...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'test_migration_simple.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 执行SQL脚本...');
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 执行SQL脚本
      const result = await client.query(sqlContent);
      
      console.log('✅ SQL脚本执行成功');
      console.log('📊 执行结果:', result);
      
      // 提交事务
      await client.query('COMMIT');
      console.log('✅ 事务提交成功');
      
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      console.error('❌ 事务回滚:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('💥 迁移测试失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runTestMigration();