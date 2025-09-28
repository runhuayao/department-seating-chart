const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function testEmployeeJoin() {
  try {
    console.log('测试员工数据JOIN操作...');
    
    const query = `
      WITH dept_mapping AS (
          SELECT id, name FROM departments
      )
      SELECT 
          emp_data.name,
          emp_data.employee_id,
          emp_data.dept_name,
          dm.id as department_id,
          dm.name as dept_db_name
      FROM (
          VALUES 
          -- 技术部员工
          ('张三', 'DEV001', '技术部', '前端工程师', 'zhangsan@company.com', '13800138001', 'present', '2023-01-15'),
          ('李四', 'DEV002', '技术部', '后端工程师', 'lisi@company.com', '13800138002', 'present', '2023-02-20'),
          ('王五', 'DEV003', '技术部', '全栈工程师', 'wangwu@company.com', '13800138003', 'absent', '2023-03-10'),
          ('赵六', 'DEV004', '技术部', '架构师', 'zhaoliu@company.com', '13800138004', 'present', '2022-12-01'),
          
          -- 产品部员工
          ('钱七', 'DES001', '产品部', 'UI设计师', 'qianqi@company.com', '13800138005', 'present', '2023-04-05'),
          ('孙八', 'DES002', '产品部', 'UX设计师', 'sunba@company.com', '13800138006', 'present', '2023-05-12'),
          ('周九', 'DES003', '产品部', '视觉设计师', 'zhoujiu@company.com', '13800138007', 'absent', '2023-06-18'),
          
          -- 运营部员工
          ('吴十', 'MKT001', '运营部', '市场经理', 'wushi@company.com', '13800138008', 'present', '2023-01-08'),
          ('郑十一', 'MKT002', '运营部', '品牌专员', 'zhengshiyi@company.com', '13800138009', 'present', '2023-07-22'),
          
          -- 人事部员工
          ('王十二', 'HR001', '人事部', '人事经理', 'wangshier@company.com', '13800138010', 'present', '2022-11-15'),
          ('李十三', 'HR002', '人事部', '招聘专员', 'lishisan@company.com', '13800138011', 'absent', '2023-08-30')
      ) AS emp_data(name, employee_id, dept_name, position, email, phone, status, hire_date)
      LEFT JOIN dept_mapping dm ON dm.name = emp_data.dept_name
      ORDER BY emp_data.name;
    `;
    
    const result = await pool.query(query);
    
    console.log('JOIN测试结果:');
    console.log(`匹配到的记录数: ${result.rows.length}`);
    
    result.rows.forEach(row => {
      console.log(`员工: ${row.name}, 员工ID: ${row.employee_id}, 期望部门: ${row.dept_name}, 匹配部门ID: ${row.department_id}, 数据库部门名: ${row.dept_db_name}`);
    });
    
    // 检查哪些员工没有匹配到部门
    const unmatchedEmployees = result.rows.filter(row => !row.department_id);
    if (unmatchedEmployees.length > 0) {
      console.log('\n未匹配到部门的员工:');
      unmatchedEmployees.forEach(emp => {
        console.log(`- ${emp.name} (期望部门: ${emp.dept_name})`);
      });
    }
    
  } catch (err) {
    console.error('测试失败:', err.message);
  } finally {
    await pool.end();
  }
}

testEmployeeJoin();