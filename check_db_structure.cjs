const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'department_map',
  user: 'postgres',
  password: process.env.DB_PASSWORD
});

async function checkTableStructure() {
  try {
    console.log('检查employees表结构:');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'employees' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('employees表不存在');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    console.log('\n检查departments表结构:');
    const deptResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'departments' 
      ORDER BY ordinal_position
    `);
    
    if (deptResult.rows.length === 0) {
      console.log('departments表不存在');
    } else {
      deptResult.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();