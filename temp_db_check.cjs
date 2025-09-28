const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function main() {
  try {
    // 检查departments表结构
    const deptStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'departments' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('departments表结构:');
    deptStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 检查employees表结构
    const empStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'employees' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\nemployees表结构:');
    empStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 检查部门数据
    const depts = await pool.query('SELECT * FROM departments ORDER BY name');
    console.log('数据库中的部门数据:');
    depts.rows.forEach(dept => {
      console.log(`  ID: ${dept.id}, Name: ${dept.name}, Description: ${dept.description}`);
    });

    // 检查员工数据
    const employees = await pool.query('SELECT id, name, email, department_id FROM employees ORDER BY id');
    console.log('\n数据库中的员工数据:');
    console.log(`总员工数: ${employees.rows.length}`);
    employees.rows.forEach(emp => {
      console.log(`  ID: ${emp.id}, Name: ${emp.name}, Email: ${emp.email}, Department ID: ${emp.department_id}`);
    });
    
  } catch (err) {
    console.error('操作失败:', err.message);
  } finally {
    pool.end();
  }
}

main();