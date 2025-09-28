const { Pool } = require('pg');
require('dotenv').config({ path: './api/.env' });

// 数据库连接配置
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function fixDatabase() {
  console.log('🔧 开始修复数据库表结构...');
  
  try {
    // 检查并添加users表缺失的字段
    console.log('📋 检查users表结构...');
    
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('现有字段:', existingColumns);
    
    const requiredColumns = [
      'employee_number',
      'department_id', 
      'full_name',
      'failed_login_attempts',
      'last_failed_login',
      'refresh_token'
    ];
    
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column)) {
        console.log(`➕ 添加字段: ${column}`);
        
        let sql = '';
        switch (column) {
          case 'employee_number':
            sql = 'ALTER TABLE users ADD COLUMN employee_number VARCHAR(50)';
            break;
          case 'department_id':
            sql = 'ALTER TABLE users ADD COLUMN department_id INTEGER';
            break;
          case 'full_name':
            sql = 'ALTER TABLE users ADD COLUMN full_name VARCHAR(255)';
            break;
          case 'failed_login_attempts':
            sql = 'ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0';
            break;
          case 'last_failed_login':
            sql = 'ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP';
            break;
          case 'refresh_token':
            sql = 'ALTER TABLE users ADD COLUMN refresh_token TEXT';
            break;
        }
        
        await pool.query(sql);
        console.log(`✅ 成功添加字段: ${column}`);
      } else {
        console.log(`✓ 字段已存在: ${column}`);
      }
    }
    
    // 检查并添加desks表的floor字段
    console.log('\n📋 检查desks表结构...');
    
    const checkDesksColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'desks' AND table_schema = 'public'
    `);
    
    const existingDesksColumns = checkDesksColumns.rows.map(row => row.column_name);
    console.log('desks表现有字段:', existingDesksColumns);
    
    if (!existingDesksColumns.includes('floor')) {
      console.log('➕ 添加desks表floor字段...');
      await pool.query('ALTER TABLE desks ADD COLUMN floor INTEGER DEFAULT 1');
      console.log('✅ 成功添加floor字段');
    } else {
      console.log('✓ floor字段已存在');
    }
    
    // 更新现有用户的employee_number
    console.log('\n🔄 更新现有用户数据...');
    const updateResult = await pool.query(`
      UPDATE users 
      SET employee_number = 'EMP' || LPAD(id::text, 6, '0')
      WHERE employee_number IS NULL
    `);
    console.log(`✅ 更新了 ${updateResult.rowCount} 个用户的员工编号`);
    
    // 创建索引
    console.log('\n📊 创建索引...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_employee_number ON users(employee_number)',
      'CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)',
      'CREATE INDEX IF NOT EXISTS idx_desks_floor ON desks(floor)',
      'CREATE INDEX IF NOT EXISTS idx_desks_department_id ON desks(department_id)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
        console.log('✅ 索引创建成功');
      } catch (error) {
        console.log('⚠️ 索引可能已存在:', error.message);
      }
    }
    
    // 验证修复结果
    console.log('\n🔍 验证修复结果...');
    const finalCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 users表最终结构:');
    finalCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    console.log('\n✅ 数据库表结构修复完成!');
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    await pool.end();
  }
}

fixDatabase();