const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function testEmployeeInsert() {
  try {
    console.log('开始测试员工插入...');
    
    // 首先清空员工表
    await pool.query('DELETE FROM employees');
    console.log('已清空员工表');
    
    // 检查部门数据
    const deptResult = await pool.query('SELECT id, name FROM departments ORDER BY id');
    console.log('部门数据:', deptResult.rows);
    
    // 执行员工插入
    const insertQuery = `
      WITH dept_mapping AS (
          SELECT id, name FROM departments
      )
      INSERT INTO employees (name, employee_id, department_id, position, email, phone, status, hire_date)
      SELECT 
          emp_data.name,
          emp_data.employee_id,
          dm.id as department_id,
          emp_data.position,
          emp_data.email,
          emp_data.phone,
          CASE 
              WHEN emp_data.status = 'present' THEN 'online'
              WHEN emp_data.status = 'absent' THEN 'offline'
              ELSE 'offline'
          END as status,
          emp_data.hire_date::DATE
      FROM (
          VALUES 
          ('张三', 'DEV001', '技术部', '前端工程师', 'zhangsan@company.com', '13800138001', 'present', '2023-01-15'),
          ('李四', 'DEV002', '技术部', '后端工程师', 'lisi@company.com', '13800138002', 'present', '2023-02-20'),
          ('王五', 'DEV003', '技术部', '全栈工程师', 'wangwu@company.com', '13800138003', 'absent', '2023-03-10')
      ) AS emp_data(name, employee_id, dept_name, position, email, phone, status, hire_date)
      JOIN dept_mapping dm ON dm.name = emp_data.dept_name
      RETURNING id, name, employee_id, department_id;
    `;
    
    const result = await pool.query(insertQuery);
    console.log('插入结果:', result.rows);
    console.log('成功插入员工数:', result.rowCount);
    
    // 验证插入结果
    const checkResult = await pool.query('SELECT COUNT(*) as count FROM employees');
    console.log('员工表总数:', checkResult.rows[0].count);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    await pool.end();
  }
}

testEmployeeInsert();