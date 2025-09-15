import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

// 使用 tsx 来导入 TypeScript 模块
const { spawn } = require('child_process');

// 直接使用 PostgreSQL 客户端
const { Client } = require('pg');

async function runMigration() {
  let client;
  
  try {
    console.log('开始执行跨系统日志表迁移...');
    
    // 创建 PostgreSQL 客户端连接
    client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'department_map',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    });
    
    // 连接数据库
    console.log('连接数据库...');
    await client.connect();
    console.log('数据库连接成功');
    
    // 读取 SQL 迁移文件
    const migrationPath = path.join(process.cwd(), 'migrations', 'create_cross_system_logs.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('读取迁移文件:', migrationPath);
    
    // 清理和分割 SQL 语句
    const cleanedContent = sqlContent
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--'))
      .join('\n');
    
    const sqlStatements = cleanedContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`准备执行 ${sqlStatements.length} 条 SQL 语句`);
    sqlStatements.forEach((stmt, i) => {
      console.log(`语句 ${i + 1}: ${stmt.substring(0, 100)}...`);
    });
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 执行每条 SQL 语句
      for (let i = 0; i < sqlStatements.length; i++) {
        const statement = sqlStatements[i];
        console.log(`执行语句 ${i + 1}/${sqlStatements.length}`);
        await client.query(statement);
        console.log(`✅ 语句 ${i + 1} 执行成功`);
      }
      
      // 提交事务
      await client.query('COMMIT');
      console.log('所有 SQL 语句执行成功，事务已提交');
      
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
    
    // 验证表是否创建成功
    console.log('验证表创建...');
    const tableExists = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'cross_system_logs'
    `);
    
    if (tableExists.rows && tableExists.rows.length > 0) {
      console.log('✅ cross_system_logs 表创建成功');
      
      // 检查表结构
      const tableStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'cross_system_logs'
        ORDER BY ordinal_position
      `);
      
      console.log('表结构:');
      tableStructure.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
      
      // 检查初始数据
      const initialData = await client.query('SELECT COUNT(*) as count FROM cross_system_logs');
      console.log(`初始数据记录数: ${initialData.rows[0].count}`);
      
    } else {
      throw new Error('表创建失败');
    }
    
    console.log('✅ 跨系统日志表迁移完成');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (client) {
      await client.end();
    }
  }
}

// 运行迁移
runMigration();