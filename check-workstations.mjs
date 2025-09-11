import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'department_map',
  user: 'postgres',
  password: 'postgres123'
});

async function checkWorkstations() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'workstations' 
      ORDER BY ordinal_position
    `);
    
    console.log('workstations表结构:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // 检查是否有数据
    const dataResult = await pool.query('SELECT COUNT(*) FROM workstations');
    console.log(`\nworkstations表记录数: ${dataResult.rows[0].count}`);
    
    if (dataResult.rows[0].count > 0) {
      const sampleData = await pool.query('SELECT * FROM workstations LIMIT 3');
      console.log('\n示例数据:');
      sampleData.rows.forEach(row => {
        console.log(row);
      });
    }
    
  } catch (error) {
    console.error('检查workstations表失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkWorkstations();