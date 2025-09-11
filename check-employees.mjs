import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'department_map',
  user: 'postgres',
  password: 'postgres123'
});

async function checkEmployees() {
  try {
    const result = await pool.query('SELECT * FROM employees ORDER BY id');
    
    console.log('员工列表:');
    result.rows.forEach(row => {
      console.log(`- ID: ${row.id}, 姓名: ${row.name}, 部门ID: ${row.department_id}`);
    });
    
    // 特别检查是否有"王五"
    const wangwuResult = await pool.query("SELECT * FROM employees WHERE name ILIKE '%王五%'");
    console.log('\n包含"王五"的员工:');
    if (wangwuResult.rows.length > 0) {
      wangwuResult.rows.forEach(row => {
        console.log(`- ID: ${row.id}, 姓名: ${row.name}, 部门ID: ${row.department_id}`);
      });
    } else {
      console.log('没有找到包含"王五"的员工');
    }
    
  } catch (error) {
    console.error('检查员工数据失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkEmployees();