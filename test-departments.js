import { executeQuery } from './api/config/database.ts';

async function testDepartments() {
  try {
    console.log('检查数据库中的部门数据...');
    
    // 查询所有部门及其员工数量
    const departments = await executeQuery(`
      SELECT 
        d.name, 
        d.code,
        COUNT(e.id) as employee_count
      FROM departments d 
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name
    `);
    
    console.log('\n=== 部门员工统计 ===');
    departments.forEach(row => {
      console.log(`${row.name} (${row.code}): ${row.employee_count} 人`);
    });
    
    // 查询总员工数
    const totalEmployees = await executeQuery(`
      SELECT COUNT(*) as total FROM employees WHERE status = 'active'
    `);
    
    console.log(`\n总员工数: ${totalEmployees[0].total} 人`);
    
    // 测试搜索功能
    console.log('\n=== 测试跨部门搜索 ===');
    const searchResults = await executeQuery(`
      SELECT 
        e.name as employee_name,
        e.position,
        d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.status = 'active'
      ORDER BY d.name, e.name
      LIMIT 10
    `);
    
    searchResults.forEach(row => {
      console.log(`${row.employee_name} - ${row.position} (${row.department_name})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

testDepartments();