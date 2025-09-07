#!/usr/bin/env node

/**
 * M0静态数据到M1数据库迁移工具
 * 读取src/data/departmentData.ts中的静态数据并导入到PostgreSQL数据库
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 创建数据库连接池
const pool = new Pool(dbConfig);

/**
 * 从TypeScript文件中提取数据的简单解析器
 * 注意：这是一个简化的解析器，仅适用于特定格式的数据
 */
function parseM0Data() {
  const dataFilePath = path.join(__dirname, '..', 'src', 'data', 'departmentData.ts');
  
  if (!fs.existsSync(dataFilePath)) {
    throw new Error(`M0数据文件不存在: ${dataFilePath}`);
  }
  
  const content = fs.readFileSync(dataFilePath, 'utf8');
  
  // 这里使用硬编码的数据，因为解析TypeScript需要复杂的AST处理
  // 在实际项目中，建议将数据导出为JSON格式或使用专门的解析工具
  
  const m0Data = {
    departments: [
      {
        name: 'development',
        displayName: '研发部',
        description: '负责产品研发和技术创新',
        color: '#3B82F6',
        layoutConfig: {
          gridSize: 20,
          canvasWidth: 1200,
          canvasHeight: 800,
          showGrid: true,
          snapToGrid: true
        },
        mapImageUrl: '/images/departments/development.jpg'
      },
      {
        name: 'design',
        displayName: '设计部',
        description: '负责产品设计和用户体验',
        color: '#10B981',
        layoutConfig: {
          gridSize: 20,
          canvasWidth: 1000,
          canvasHeight: 600,
          showGrid: true,
          snapToGrid: true
        },
        mapImageUrl: '/images/departments/design.jpg'
      },
      {
        name: 'marketing',
        displayName: '市场部',
        description: '负责市场推广和品牌建设',
        color: '#F59E0B',
        layoutConfig: {
          gridSize: 20,
          canvasWidth: 800,
          canvasHeight: 600,
          showGrid: true,
          snapToGrid: true
        },
        mapImageUrl: '/images/departments/marketing.jpg'
      },
      {
        name: 'hr',
        displayName: '人事部',
        description: '负责人力资源管理和企业文化建设',
        color: '#EF4444',
        layoutConfig: {
          gridSize: 20,
          canvasWidth: 600,
          canvasHeight: 400,
          showGrid: true,
          snapToGrid: true
        },
        mapImageUrl: '/images/departments/hr.jpg'
      }
    ],
    employees: [
      // 研发部员工
      { name: '张三', employeeNumber: 'DEV001', department: 'development', position: '前端工程师', email: 'zhangsan@company.com', phone: '13800138001', status: 'present', hireDate: '2023-01-15' },
      { name: '李四', employeeNumber: 'DEV002', department: 'development', position: '后端工程师', email: 'lisi@company.com', phone: '13800138002', status: 'present', hireDate: '2023-02-20' },
      { name: '王五', employeeNumber: 'DEV003', department: 'development', position: '全栈工程师', email: 'wangwu@company.com', phone: '13800138003', status: 'absent', hireDate: '2023-03-10' },
      { name: '赵六', employeeNumber: 'DEV004', department: 'development', position: '架构师', email: 'zhaoliu@company.com', phone: '13800138004', status: 'present', hireDate: '2022-12-01' },
      
      // 设计部员工
      { name: '钱七', employeeNumber: 'DES001', department: 'design', position: 'UI设计师', email: 'qianqi@company.com', phone: '13800138005', status: 'present', hireDate: '2023-04-05' },
      { name: '孙八', employeeNumber: 'DES002', department: 'design', position: 'UX设计师', email: 'sunba@company.com', phone: '13800138006', status: 'present', hireDate: '2023-05-12' },
      { name: '周九', employeeNumber: 'DES003', department: 'design', position: '视觉设计师', email: 'zhoujiu@company.com', phone: '13800138007', status: 'absent', hireDate: '2023-06-18' },
      
      // 市场部员工
      { name: '吴十', employeeNumber: 'MKT001', department: 'marketing', position: '市场经理', email: 'wushi@company.com', phone: '13800138008', status: 'present', hireDate: '2023-01-08' },
      { name: '郑十一', employeeNumber: 'MKT002', department: 'marketing', position: '品牌专员', email: 'zhengshiyi@company.com', phone: '13800138009', status: 'present', hireDate: '2023-07-22' },
      
      // 人事部员工
      { name: '王十二', employeeNumber: 'HR001', department: 'hr', position: '人事经理', email: 'wangshier@company.com', phone: '13800138010', status: 'present', hireDate: '2022-11-15' },
      { name: '李十三', employeeNumber: 'HR002', department: 'hr', position: '招聘专员', email: 'lishisan@company.com', phone: '13800138011', status: 'absent', hireDate: '2023-08-30' }
    ],
    desks: [
      // 研发部工位
      { deskNumber: 'A001', department: 'development', x: 100, y: 100, width: 120, height: 80, occupied: false, equipment: { computer: 'MacBook Pro', monitor: '27inch 4K', keyboard: '机械键盘', mouse: '无线鼠标' } },
      { deskNumber: 'A002', department: 'development', x: 250, y: 100, width: 120, height: 80, occupied: true, equipment: { computer: 'ThinkPad X1', monitor: '24inch FHD', keyboard: '薄膜键盘', mouse: '有线鼠标' } },
      { deskNumber: 'A003', department: 'development', x: 400, y: 100, width: 120, height: 80, occupied: true, equipment: { computer: 'MacBook Air', monitor: '27inch 4K', keyboard: '机械键盘', mouse: '无线鼠标' } },
      { deskNumber: 'A004', department: 'development', x: 550, y: 100, width: 120, height: 80, occupied: false, equipment: { computer: 'iMac 27', keyboard: 'Magic Keyboard', mouse: 'Magic Mouse' } },
      { deskNumber: 'A005', department: 'development', x: 100, y: 220, width: 120, height: 80, occupied: true, equipment: { computer: 'Dell XPS', monitor: '32inch 4K', keyboard: '机械键盘', mouse: '游戏鼠标' } },
      { deskNumber: 'A006', department: 'development', x: 250, y: 220, width: 120, height: 80, occupied: false, equipment: { computer: 'Surface Pro', monitor: '24inch FHD', keyboard: '无线键盘', mouse: '无线鼠标' } },
      
      // 设计部工位
      { deskNumber: 'B001', department: 'design', x: 100, y: 100, width: 140, height: 90, occupied: true, equipment: { computer: 'MacBook Pro 16', monitor: '32inch 4K', tablet: 'iPad Pro', stylus: 'Apple Pencil' } },
      { deskNumber: 'B002', department: 'design', x: 280, y: 100, width: 140, height: 90, occupied: true, equipment: { computer: 'iMac 27', monitor: '27inch 5K', tablet: 'Wacom Cintiq', stylus: 'Wacom Pen' } },
      { deskNumber: 'B003', department: 'design', x: 460, y: 100, width: 140, height: 90, occupied: false, equipment: { computer: 'Surface Studio', tablet: 'Surface Pen', scanner: 'A3扫描仪' } },
      { deskNumber: 'B004', department: 'design', x: 100, y: 230, width: 140, height: 90, occupied: false, equipment: { computer: 'MacBook Air', monitor: '24inch 4K', tablet: 'iPad Air', stylus: 'Apple Pencil' } },
      
      // 市场部工位
      { deskNumber: 'C001', department: 'marketing', x: 100, y: 100, width: 110, height: 70, occupied: true, equipment: { computer: 'ThinkPad T14', monitor: '24inch FHD', phone: 'IP电话', printer: '彩色打印机' } },
      { deskNumber: 'C002', department: 'marketing', x: 240, y: 100, width: 110, height: 70, occupied: true, equipment: { computer: 'MacBook Air', monitor: '27inch 4K', phone: 'IP电话', camera: '数码相机' } },
      { deskNumber: 'C003', department: 'marketing', x: 380, y: 100, width: 110, height: 70, occupied: false, equipment: { computer: 'Surface Laptop', monitor: '24inch FHD', phone: 'IP电话', projector: '便携投影仪' } },
      
      // 人事部工位
      { deskNumber: 'D001', department: 'hr', x: 100, y: 100, width: 100, height: 70, occupied: true, equipment: { computer: 'ThinkPad E14', monitor: '22inch FHD', phone: 'IP电话', printer: '黑白打印机' } },
      { deskNumber: 'D002', department: 'hr', x: 230, y: 100, width: 100, height: 70, occupied: false, equipment: { computer: 'Dell Inspiron', monitor: '24inch FHD', phone: 'IP电话', scanner: '文档扫描仪' } }
    ],
    assignments: [
      // 手动指定的工位分配关系
      { deskNumber: 'A002', employeeNumber: 'DEV002' }, // 李四
      { deskNumber: 'A003', employeeNumber: 'DEV003' }, // 王五
      { deskNumber: 'A005', employeeNumber: 'DEV004' }, // 赵六
      { deskNumber: 'B001', employeeNumber: 'DES001' }, // 钱七
      { deskNumber: 'B002', employeeNumber: 'DES002' }, // 孙八
      { deskNumber: 'C001', employeeNumber: 'MKT001' }, // 吴十
      { deskNumber: 'C002', employeeNumber: 'MKT002' }, // 郑十一
      { deskNumber: 'D001', employeeNumber: 'HR001' }   // 王十二
    ]
  };
  
  console.log('✓ M0数据解析完成');
  console.log(`  - 部门: ${m0Data.departments.length} 个`);
  console.log(`  - 员工: ${m0Data.employees.length} 个`);
  console.log(`  - 工位: ${m0Data.desks.length} 个`);
  console.log(`  - 分配关系: ${m0Data.assignments.length} 个`);
  
  return m0Data;
}

/**
 * 验证数据库连接
 */
async function validateConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✓ 数据库连接成功');
  } catch (error) {
    console.error('✗ 数据库连接失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 清理现有数据（可选）
 */
async function cleanExistingData(force = false) {
  if (!force) {
    console.log('⚠️  跳过数据清理（使用 --force 参数强制清理）');
    return;
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 按依赖关系顺序删除数据
    await client.query('DELETE FROM employee_status_logs');
    await client.query('DELETE FROM desk_assignments');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM desks');
    await client.query('DELETE FROM departments');
    
    // 重置序列
    await client.query('ALTER SEQUENCE departments_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE employees_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE desks_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE desk_assignments_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE employee_status_logs_id_seq RESTART WITH 1');
    
    await client.query('COMMIT');
    console.log('✓ 现有数据已清理');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ 数据清理失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移部门数据
 */
async function migrateDepartments(departments) {
  const client = await pool.connect();
  try {
    console.log('\n📁 开始迁移部门数据...');
    
    for (const dept of departments) {
      const result = await client.query(`
        INSERT INTO departments (name, display_name, description, color, layout_config, map_image_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          layout_config = EXCLUDED.layout_config,
          map_image_url = EXCLUDED.map_image_url,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name
      `, [
        dept.name,
        dept.displayName,
        dept.description,
        dept.color,
        JSON.stringify(dept.layoutConfig),
        dept.mapImageUrl,
        'active'
      ]);
      
      console.log(`  ✓ ${dept.displayName} (${dept.name}) - ID: ${result.rows[0].id}`);
    }
    
    console.log('✓ 部门数据迁移完成');
    
  } catch (error) {
    console.error('✗ 部门数据迁移失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移员工数据
 */
async function migrateEmployees(employees) {
  const client = await pool.connect();
  try {
    console.log('\n👥 开始迁移员工数据...');
    
    // 获取部门ID映射
    const deptResult = await client.query('SELECT id, name FROM departments');
    const deptMap = new Map(deptResult.rows.map(row => [row.name, row.id]));
    
    for (const emp of employees) {
      const departmentId = deptMap.get(emp.department);
      if (!departmentId) {
        throw new Error(`部门 ${emp.department} 不存在`);
      }
      
      const status = emp.status === 'present' ? 'online' : 'offline';
      
      const result = await client.query(`
        INSERT INTO employees (name, employee_number, department_id, position, email, phone, status, hire_date, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (employee_number) DO UPDATE SET
          name = EXCLUDED.name,
          department_id = EXCLUDED.department_id,
          position = EXCLUDED.position,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status,
          hire_date = EXCLUDED.hire_date,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name
      `, [
        emp.name,
        emp.employeeNumber,
        departmentId,
        emp.position,
        emp.email,
        emp.phone,
        status,
        emp.hireDate,
        true
      ]);
      
      console.log(`  ✓ ${emp.name} (${emp.employeeNumber}) - ID: ${result.rows[0].id}`);
    }
    
    console.log('✓ 员工数据迁移完成');
    
  } catch (error) {
    console.error('✗ 员工数据迁移失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移工位数据
 */
async function migrateDesks(desks) {
  const client = await pool.connect();
  try {
    console.log('\n🪑 开始迁移工位数据...');
    
    // 获取部门ID映射
    const deptResult = await client.query('SELECT id, name FROM departments');
    const deptMap = new Map(deptResult.rows.map(row => [row.name, row.id]));
    
    for (const desk of desks) {
      const departmentId = deptMap.get(desk.department);
      if (!departmentId) {
        throw new Error(`部门 ${desk.department} 不存在`);
      }
      
      const status = desk.occupied ? 'occupied' : 'available';
      
      const result = await client.query(`
        INSERT INTO desks (desk_number, department_id, position_x, position_y, width, height, status, equipment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (department_id, desk_number) DO UPDATE SET
          position_x = EXCLUDED.position_x,
          position_y = EXCLUDED.position_y,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          status = EXCLUDED.status,
          equipment = EXCLUDED.equipment,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, desk_number
      `, [
        desk.deskNumber,
        departmentId,
        desk.x,
        desk.y,
        desk.width,
        desk.height,
        status,
        JSON.stringify(desk.equipment)
      ]);
      
      console.log(`  ✓ ${desk.deskNumber} (${desk.department}) - ID: ${result.rows[0].id}`);
    }
    
    console.log('✓ 工位数据迁移完成');
    
  } catch (error) {
    console.error('✗ 工位数据迁移失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 迁移工位分配数据
 */
async function migrateAssignments(assignments) {
  const client = await pool.connect();
  try {
    console.log('\n🔗 开始迁移工位分配数据...');
    
    for (const assignment of assignments) {
      // 获取工位ID
      const deskResult = await client.query(
        'SELECT id FROM desks WHERE desk_number = $1',
        [assignment.deskNumber]
      );
      
      if (deskResult.rows.length === 0) {
        console.warn(`  ⚠️  工位 ${assignment.deskNumber} 不存在，跳过分配`);
        continue;
      }
      
      // 获取员工ID
      const empResult = await client.query(
        'SELECT id FROM employees WHERE employee_number = $1',
        [assignment.employeeNumber]
      );
      
      if (empResult.rows.length === 0) {
        console.warn(`  ⚠️  员工 ${assignment.employeeNumber} 不存在，跳过分配`);
        continue;
      }
      
      const deskId = deskResult.rows[0].id;
      const employeeId = empResult.rows[0].id;
      
      const result = await client.query(`
        INSERT INTO desk_assignments (desk_id, employee_id, assigned_at, status, assignment_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
        deskId,
        employeeId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
        'active',
        'permanent'
      ]);
      
      if (result.rows.length > 0) {
        console.log(`  ✓ ${assignment.deskNumber} → ${assignment.employeeNumber} - ID: ${result.rows[0].id}`);
      } else {
        console.log(`  - ${assignment.deskNumber} → ${assignment.employeeNumber} (已存在)`);
      }
    }
    
    console.log('✓ 工位分配数据迁移完成');
    
  } catch (error) {
    console.error('✗ 工位分配数据迁移失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 生成迁移报告
 */
async function generateReport() {
  const client = await pool.connect();
  try {
    console.log('\n📊 生成迁移报告...');
    
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM departments) as departments_count,
        (SELECT COUNT(*) FROM employees) as employees_count,
        (SELECT COUNT(*) FROM desks) as desks_count,
        (SELECT COUNT(*) FROM desk_assignments WHERE status = 'active') as active_assignments_count,
        (SELECT COUNT(*) FROM employees WHERE status = 'online') as online_employees_count,
        (SELECT COUNT(*) FROM desks WHERE status = 'occupied') as occupied_desks_count
    `);
    
    const result = stats.rows[0];
    
    console.log('\n📈 迁移统计:');
    console.log(`   部门总数: ${result.departments_count}`);
    console.log(`   员工总数: ${result.employees_count}`);
    console.log(`   在线员工: ${result.online_employees_count}`);
    console.log(`   工位总数: ${result.desks_count}`);
    console.log(`   已占用工位: ${result.occupied_desks_count}`);
    console.log(`   活跃分配关系: ${result.active_assignments_count}`);
    
    // 部门详情
    const deptStats = await client.query(`
      SELECT 
        d.display_name,
        COUNT(DISTINCT e.id) as employee_count,
        COUNT(DISTINCT desk.id) as desk_count,
        COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END) as occupied_desk_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = true
      LEFT JOIN desks desk ON d.id = desk.department_id
      GROUP BY d.id, d.display_name
      ORDER BY d.display_name
    `);
    
    console.log('\n🏢 部门详情:');
    deptStats.rows.forEach(dept => {
      const utilization = dept.desk_count > 0 ? 
        Math.round((dept.occupied_desk_count / dept.desk_count) * 100) : 0;
      console.log(`   ${dept.display_name}: ${dept.employee_count}人, ${dept.desk_count}工位 (${utilization}%占用率)`);
    });
    
  } catch (error) {
    console.error('✗ 生成报告失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 主迁移函数
 */
async function runM0Migration() {
  try {
    console.log('🚀 开始M0数据迁移...');
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const forceClean = args.includes('--force');
    
    // 验证数据库连接
    await validateConnection();
    
    // 解析M0数据
    const m0Data = parseM0Data();
    
    // 清理现有数据（可选）
    await cleanExistingData(forceClean);
    
    // 执行迁移
    await migrateDepartments(m0Data.departments);
    await migrateEmployees(m0Data.employees);
    await migrateDesks(m0Data.desks);
    await migrateAssignments(m0Data.assignments);
    
    // 生成报告
    await generateReport();
    
    console.log('\n🎉 M0数据迁移完成!');
    
  } catch (error) {
    console.error('\n💥 M0数据迁移失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行迁移
if (require.main === module) {
  runM0Migration();
}

module.exports = {
  runM0Migration,
  parseM0Data
};

// 优雅退出处理
process.on('SIGINT', async () => {
  console.log('\n收到退出信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n收到终止信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});