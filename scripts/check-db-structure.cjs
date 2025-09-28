const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'department_map',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkDatabaseStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 检查数据库表结构...\n');
    
    // 检查所有表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 现有表:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // 检查departments表结构
    if (tablesResult.rows.some(row => row.table_name === 'departments')) {
      console.log('\n📊 departments表结构:');
      const deptColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'departments' 
        ORDER BY ordinal_position
      `);
      
      deptColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    // 检查employees表结构
    if (tablesResult.rows.some(row => row.table_name === 'employees')) {
      console.log('\n👥 employees表结构:');
      const empColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        ORDER BY ordinal_position
      `);
      
      empColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    // 检查workstations表结构
    if (tablesResult.rows.some(row => row.table_name === 'workstations')) {
      console.log('\n🪑 workstations表结构:');
      const wsColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'workstations' 
        ORDER BY ordinal_position
      `);
      
      wsColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
  } catch (error) {
    console.error('❌ 检查数据库结构失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabaseStructure();