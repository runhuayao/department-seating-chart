/**
 * PostgreSQL数据库初始化脚本
 * 执行增强版的数据库初始化，包含全量索引和所有部门数据
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '113464',
  ssl: process.env.DB_SSL === 'true'
};

async function initializePostgreSQL() {
  const client = new pg.Client(dbConfig);
  
  try {
    console.log('🔌 连接到PostgreSQL数据库...');
    console.log(`📍 数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    await client.connect();
    console.log('✅ 数据库连接成功');
    
    // 读取SQL初始化脚本
    const sqlPath = join(__dirname, '..', 'api', 'sql', 'enhanced_postgresql_init.sql');
    console.log(`📄 读取SQL脚本: ${sqlPath}`);
    
    const sqlScript = readFileSync(sqlPath, 'utf8');
    console.log(`📊 SQL脚本大小: ${sqlScript.length} 字符`);
    
    // 执行SQL脚本
    console.log('🚀 开始执行数据库初始化...');
    const startTime = Date.now();
    
    await client.query(sqlScript);
    
    const endTime = Date.now();
    console.log(`✅ 数据库初始化完成，耗时: ${endTime - startTime}ms`);
    
    // 验证数据
    console.log('\n📊 验证数据完整性:');
    
    const departmentCount = await client.query('SELECT COUNT(*) FROM departments');
    console.log(`   部门数量: ${departmentCount.rows[0].count}`);
    
    const employeeCount = await client.query('SELECT COUNT(*) FROM employees');
    console.log(`   员工数量: ${employeeCount.rows[0].count}`);
    
    const deskCount = await client.query('SELECT COUNT(*) FROM desks');
    console.log(`   工位数量: ${deskCount.rows[0].count}`);
    
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`   用户数量: ${userCount.rows[0].count}`);
    
    // 验证索引
    const indexCount = await client.query(`
      SELECT COUNT(*) FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    console.log(`   索引数量: ${indexCount.rows[0].count}`);
    
    // 验证各部门员工分布
    console.log('\n🏢 各部门员工分布:');
    const deptStats = await client.query(`
      SELECT 
        d.name as department_name,
        COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
    
    deptStats.rows.forEach(row => {
      console.log(`   ${row.department_name}: ${row.employee_count} 人`);
    });
    
    // 测试搜索功能
    console.log('\n🔍 测试搜索功能:');
    
    // 测试员工姓名搜索
    const nameSearch = await client.query(`
      SELECT name, position, department_name 
      FROM employee_search_view 
      WHERE name ILIKE '%张%'
    `);
    console.log(`   姓名搜索(张): ${nameSearch.rows.length} 条结果`);
    nameSearch.rows.forEach(row => {
      console.log(`     - ${row.name} (${row.position}) - ${row.department_name}`);
    });
    
    // 测试部门搜索
    const deptSearch = await client.query(`
      SELECT name, position, department_name 
      FROM employee_search_view 
      WHERE department_name = '人事部'
    `);
    console.log(`   部门搜索(人事部): ${deptSearch.rows.length} 条结果`);
    deptSearch.rows.forEach(row => {
      console.log(`     - ${row.name} (${row.position})`);
    });
    
    // 测试跨部门搜索
    const crossSearch = await client.query(`
      SELECT name, position, department_name 
      FROM employee_search_view 
      WHERE position ILIKE '%经理%'
    `);
    console.log(`   职位搜索(经理): ${crossSearch.rows.length} 条结果`);
    crossSearch.rows.forEach(row => {
      console.log(`     - ${row.name} (${row.position}) - ${row.department_name}`);
    });
    
    console.log('\n🎉 PostgreSQL数据库初始化和验证完成！');
    console.log('✨ 所有部门数据已建立完整索引，支持全文搜索');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   错误详情: ${error.detail}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 数据库连接已关闭');
  }
}

// 执行初始化
initializePostgreSQL().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});