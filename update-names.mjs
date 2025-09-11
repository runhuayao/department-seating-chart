import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'department_map',
  user: 'postgres',
  password: 'postgres123'
});

async function updateNames() {
  try {
    // 更新王五的姓名
    await pool.query("UPDATE employees SET name = '王五' WHERE id = 3");
    console.log('更新王五成功');
    
    // 验证更新结果
    const result = await pool.query('SELECT id, name FROM employees WHERE id = 3');
    console.log('验证结果:', result.rows[0]);
    
  } catch (error) {
    console.error('更新失败:', error.message);
  } finally {
    await pool.end();
  }
}

updateNames();
