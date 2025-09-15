import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'department_map',
};

async function initDatabase() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔧 开始初始化数据库...');
    
    // 读取并执行初始化脚本
    const sqlFile = path.join(__dirname, '..', 'migrations', '001_create_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📋 执行表结构创建脚本...');
    await pool.query(sql);
    console.log('✅ 表结构创建完成');
    
    // 读取并执行拼音支持脚本
    const pinyinSqlFile = path.join(__dirname, '..', 'migrations', '003_add_pinyin_support.sql');
    if (fs.existsSync(pinyinSqlFile)) {
      const pinyinSql = fs.readFileSync(pinyinSqlFile, 'utf8');
      console.log('📋 执行拼音支持脚本...');
      await pool.query(pinyinSql);
      console.log('✅ 拼音支持添加完成');
    }
    
    // 验证数据
    const employeeCount = await pool.query('SELECT COUNT(*) FROM employees');
    const deskCount = await pool.query('SELECT COUNT(*) FROM desks');
    
    console.log('📊 数据库初始化完成:');
    console.log(`   - 员工数量: ${employeeCount.rows[0].count}`);
    console.log(`   - 工位数量: ${deskCount.rows[0].count}`);
    
    // 测试搜索功能
    console.log('🔍 测试搜索功能...');
    const searchResult = await pool.query(`
      SELECT e.name, e.name_pinyin, e.employee_number 
      FROM employees e 
      WHERE e.name ILIKE '%王五%' OR e.name_pinyin ILIKE '%wangwu%'
    `);
    console.log('搜索"王五"结果:', searchResult.rows);
    
    const deskResult = await pool.query(`
      SELECT d.desk_number, d.status 
      FROM desks d 
      WHERE d.desk_number ILIKE '%E03%'
    `);
    console.log('搜索"E03"结果:', deskResult.rows);
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行初始化
initDatabase()
  .then(() => {
    console.log('🎉 数据库初始化成功完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 初始化过程中发生错误:', error);
    process.exit(1);
  });