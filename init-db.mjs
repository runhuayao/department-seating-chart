import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建数据库连接池
const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'department_map',
  user: 'postgres',
  password: 'postgres123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initDatabase() {
  try {
    console.log('🔧 开始初始化数据库...');
    
    // 读取SQL初始化脚本
    const sqlFile = path.join(__dirname, 'api', 'sql', 'init_postgresql.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📋 执行SQL脚本...');
    
    // 执行SQL脚本
    await pool.query(sql);
    
    console.log('✅ 数据库初始化完成');
    
    // 验证表是否创建成功
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 已创建的表:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // 检查employees表结构
    const employeesColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employees' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n👤 employees表结构:');
    employeesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
  } finally {
    await pool.end();
  }
}