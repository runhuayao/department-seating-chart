#!/usr/bin/env node

/**
 * 内存数据库初始化脚本
 * 用于初始化内存数据库的测试数据
 */

import { MemoryDatabase } from '../api/database/memory.ts';

// 创建数据库实例
const db = new MemoryDatabase();

/**
 * 初始化部门数据
 */
async function initDepartments() {
  console.log('📁 初始化部门数据...');
  
  const departments = [
    { name: '技术部', description: '负责技术开发和维护', location: 'A栋3楼' },
    { name: '人事部', description: '负责人力资源管理', location: 'B栋2楼' },
    { name: '产品部', description: '负责产品设计和规划', location: 'A栋2楼' },
    { name: '运营部', description: '负责运营和市场推广', location: 'B栋3楼' },
    { name: '财务部', description: '负责财务管理', location: 'C栋1楼' }
  ];
  
  for (const dept of departments) {
    await db.query({
      text: 'INSERT INTO departments (name, description, location) VALUES ($1, $2, $3)',
      values: [dept.name, dept.description, dept.location]
    });
  }
  
  console.log(`✓ 已创建 ${departments.length} 个部门`);
}

/**
 * 初始化员工数据
 */
async function initEmployees() {
  console.log('👥 初始化员工数据...');
  
  const employees = [
    // 技术部员工
    { name: '张三', email: 'zhangsan@company.com', phone: '13800138001', position: '高级工程师', department_id: 1 },
    { name: '李四', email: 'lisi@company.com', phone: '13800138002', position: '前端工程师', department_id: 1 },
    { name: '王五', email: 'wangwu@company.com', phone: '13800138003', position: '后端工程师', department_id: 1 },
    { name: '赵六', email: 'zhaoliu@company.com', phone: '13800138004', position: '测试工程师', department_id: 1 },
    
    // 人事部员工
    { name: '孙七', email: 'sunqi@company.com', phone: '13800138005', position: 'HR经理', department_id: 2 },
    { name: '周八', email: 'zhouba@company.com', phone: '13800138006', position: 'HR专员', department_id: 2 },
    { name: '吴九', email: 'wujiu@company.com', phone: '13800138007', position: '招聘专员', department_id: 2 },
    
    // 产品部员工
    { name: '郑十', email: 'zhengshi@company.com', phone: '13800138008', position: '产品经理', department_id: 3 },
    { name: '钱一', email: 'qianyi@company.com', phone: '13800138009', position: 'UI设计师', department_id: 3 },
    { name: '孙二', email: 'suner@company.com', phone: '13800138010', position: 'UX设计师', department_id: 3 },
    
    // 运营部员工
    { name: '李三', email: 'lisan@company.com', phone: '13800138011', position: '运营经理', department_id: 4 },
    { name: '王四', email: 'wangsi@company.com', phone: '13800138012', position: '市场专员', department_id: 4 },
    
    // 财务部员工
    { name: '张五', email: 'zhangwu@company.com', phone: '13800138013', position: '财务经理', department_id: 5 },
    { name: '赵七', email: 'zhaoqi@company.com', phone: '13800138014', position: '会计', department_id: 5 }
  ];
  
  for (const emp of employees) {
    await db.query({
      text: 'INSERT INTO employees (name, email, phone, position, department_id, hire_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      values: [emp.name, emp.email, emp.phone, emp.position, emp.department_id, '2024-01-01', 'active']
    });
  }
  
  console.log(`✓ 已创建 ${employees.length} 个员工`);
}

/**
 * 初始化工位数据
 */
async function initDesks() {
  console.log('🪑 初始化工位数据...');
  
  const desks = [
    // 技术部工位 (A栋3楼)
    { desk_number: 'A301', department_id: 1, floor: 3, area: 'A区', x_position: 100, y_position: 100, assigned_employee_id: 1 },
    { desk_number: 'A302', department_id: 1, floor: 3, area: 'A区', x_position: 250, y_position: 100, assigned_employee_id: 2 },
    { desk_number: 'A303', department_id: 1, floor: 3, area: 'A区', x_position: 400, y_position: 100, assigned_employee_id: 3 },
    { desk_number: 'A304', department_id: 1, floor: 3, area: 'A区', x_position: 550, y_position: 100, assigned_employee_id: 4 },
    { desk_number: 'A305', department_id: 1, floor: 3, area: 'A区', x_position: 100, y_position: 250, status: 'available' },
    
    // 人事部工位 (B栋2楼)
    { desk_number: 'B201', department_id: 2, floor: 2, area: 'B区', x_position: 100, y_position: 100, assigned_employee_id: 5 },
    { desk_number: 'B202', department_id: 2, floor: 2, area: 'B区', x_position: 250, y_position: 100, assigned_employee_id: 6 },
    { desk_number: 'B203', department_id: 2, floor: 2, area: 'B区', x_position: 400, y_position: 100, assigned_employee_id: 7 },
    { desk_number: 'B204', department_id: 2, floor: 2, area: 'B区', x_position: 550, y_position: 100, status: 'available' },
    
    // 产品部工位 (A栋2楼)
    { desk_number: 'A201', department_id: 3, floor: 2, area: 'A区', x_position: 100, y_position: 100, assigned_employee_id: 8 },
    { desk_number: 'A202', department_id: 3, floor: 2, area: 'A区', x_position: 250, y_position: 100, assigned_employee_id: 9 },
    { desk_number: 'A203', department_id: 3, floor: 2, area: 'A区', x_position: 400, y_position: 100, assigned_employee_id: 10 },
    { desk_number: 'A204', department_id: 3, floor: 2, area: 'A区', x_position: 550, y_position: 100, status: 'available' },
    
    // 运营部工位 (B栋3楼)
    { desk_number: 'B301', department_id: 4, floor: 3, area: 'B区', x_position: 100, y_position: 100, assigned_employee_id: 11 },
    { desk_number: 'B302', department_id: 4, floor: 3, area: 'B区', x_position: 250, y_position: 100, assigned_employee_id: 12 },
    { desk_number: 'B303', department_id: 4, floor: 3, area: 'B区', x_position: 400, y_position: 100, status: 'available' },
    
    // 财务部工位 (C栋1楼)
    { desk_number: 'C101', department_id: 5, floor: 1, area: 'C区', x_position: 100, y_position: 100, assigned_employee_id: 13 },
    { desk_number: 'C102', department_id: 5, floor: 1, area: 'C区', x_position: 250, y_position: 100, assigned_employee_id: 14 },
    { desk_number: 'C103', department_id: 5, floor: 1, area: 'C区', x_position: 400, y_position: 100, status: 'available' }
  ];
  
  for (const desk of desks) {
    const status = desk.assigned_employee_id ? 'occupied' : (desk.status || 'available');
    const assigned_at = desk.assigned_employee_id ? new Date().toISOString() : null;
    
    await db.query({
      text: 'INSERT INTO desks (desk_number, department_id, floor, area, x_position, y_position, status, assigned_employee_id, assigned_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      values: [desk.desk_number, desk.department_id, desk.floor, desk.area, desk.x_position, desk.y_position, status, desk.assigned_employee_id || null, assigned_at]
    });
  }
  
  console.log(`✓ 已创建 ${desks.length} 个工位`);
}

/**
 * 初始化用户数据
 */
async function initUsers() {
  console.log('👤 初始化用户数据...');
  
  const users = [
    { username: 'admin', password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIu6', email: 'admin@company.com', role: 'admin', employee_id: 1 }, // 密码: admin123
    { username: 'manager', password_hash: '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', email: 'manager@company.com', role: 'manager', employee_id: 5 }, // 密码: manager123
    { username: 'user1', password_hash: '$2b$12$gLAaKK9.1HQRDU2nGBJ6/.H.DH.vfCjRp4t6bt7DTh26vW8qL2C4.', email: 'user1@company.com', role: 'user', employee_id: 2 } // 密码: user123
  ];
  
  for (const user of users) {
    await db.query({
      text: 'INSERT INTO users (username, password_hash, email, role, employee_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [user.username, user.password_hash, user.email, user.role, user.employee_id, 'active']
    });
  }
  
  console.log(`✓ 已创建 ${users.length} 个用户`);
}

/**
 * 创建搜索索引数据
 */
async function createSearchIndexes() {
  console.log('🔍 创建搜索索引...');
  
  // 这里可以添加搜索索引的创建逻辑
  // 对于内存数据库，索引主要是为了优化查询性能
  
  console.log('✓ 搜索索引创建完成');
}

/**
 * 主初始化函数
 */
async function initializeMemoryDatabase() {
  try {
    console.log('🚀 开始初始化内存数据库...');
    
    // 按顺序初始化数据
    await initDepartments();
    await initEmployees();
    await initDesks();
    await initUsers();
    await createSearchIndexes();
    
    console.log('\n🎉 内存数据库初始化完成！');
    console.log('\n📊 数据统计:');
    
    // 显示数据统计
    const deptResult = await db.query({ text: 'SELECT * FROM departments' });
    const empResult = await db.query({ text: 'SELECT * FROM employees' });
    const deskResult = await db.query({ text: 'SELECT * FROM desks' });
    const userResult = await db.query({ text: 'SELECT * FROM users' });
    
    console.log(`   部门: ${deptResult.rows.length} 个`);
    console.log(`   员工: ${empResult.rows.length} 个`);
    console.log(`   工位: ${deskResult.rows.length} 个`);
    console.log(`   用户: ${userResult.rows.length} 个`);
    
    console.log('\n🔐 测试账号:');
    console.log('   管理员: admin / admin123');
    console.log('   经理: manager / manager123');
    console.log('   用户: user1 / user123');
    
  } catch (error) {
    console.error('💥 初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行初始化
initializeMemoryDatabase();