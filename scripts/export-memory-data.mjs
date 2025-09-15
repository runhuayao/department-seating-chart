#!/usr/bin/env node

/**
 * 内存数据库数据导出脚本
 * 将内存数据库中的数据导出为SQL格式，用于更新PostgreSQL初始化脚本
 */

import fs from 'fs/promises';
import path from 'path';

// 内存数据库数据结构
const memoryData = {
  departments: [
    {
      id: 1,
      name: '技术部',
      description: '负责公司技术研发和系统维护',
      parent_id: null,
      manager_id: 1,
      location: '3楼'
    },
    {
      id: 2,
      name: '市场部',
      description: '负责市场推广和客户关系维护',
      parent_id: null,
      manager_id: 4,
      location: '2楼'
    },
    {
      id: 3,
      name: '人事部',
      description: '负责人力资源管理和招聘',
      parent_id: null,
      manager_id: 6,
      location: '1楼'
    },
    {
      id: 4,
      name: '产品部',
      description: '负责产品设计和用户体验',
      parent_id: null,
      manager_id: 9,
      location: '4楼'
    },
    {
      id: 5,
      name: '运营部',
      description: '负责业务运营和数据分析',
      parent_id: null,
      manager_id: 12,
      location: '2楼'
    }
  ],
  
  employees: [
    // 技术部员工
    { id: 1, name: '张三', email: 'zhangsan@company.com', phone: '13800138001', position: '技术经理', department_id: 1, hire_date: '2023-01-15', status: 'active' },
    { id: 2, name: '李四', email: 'lisi@company.com', phone: '13800138002', position: '前端开发', department_id: 1, hire_date: '2023-02-01', status: 'active' },
    { id: 3, name: '王五', email: 'wangwu@company.com', phone: '13800138003', position: '后端开发', department_id: 1, hire_date: '2023-02-15', status: 'active' },
    // 市场部员工
    { id: 4, name: '赵六', email: 'zhaoliu@company.com', phone: '13800138004', position: '市场经理', department_id: 2, hire_date: '2023-01-10', status: 'active' },
    { id: 5, name: '钱七', email: 'qianqi@company.com', phone: '13800138005', position: '销售代表', department_id: 2, hire_date: '2023-03-01', status: 'active' },
    // 人事部员工
    { id: 6, name: '孙八', email: 'sunba@company.com', phone: '13800138006', position: '人事经理', department_id: 3, hire_date: '2022-12-01', status: 'active' },
    { id: 7, name: '周九', email: 'zhoujiu@company.com', phone: '13800138007', position: '招聘专员', department_id: 3, hire_date: '2023-04-01', status: 'active' },
    { id: 8, name: '吴十', email: 'wushi@company.com', phone: '13800138008', position: '薪酬专员', department_id: 3, hire_date: '2023-05-15', status: 'active' },
    // 产品部员工
    { id: 9, name: '郑十一', email: 'zhengshiyi@company.com', phone: '13800138009', position: '产品经理', department_id: 4, hire_date: '2022-11-01', status: 'active' },
    { id: 10, name: '王十二', email: 'wangshier@company.com', phone: '13800138010', position: 'UI设计师', department_id: 4, hire_date: '2023-03-15', status: 'active' },
    { id: 11, name: '冯十三', email: 'fengshisan@company.com', phone: '13800138011', position: 'UX设计师', department_id: 4, hire_date: '2023-06-01', status: 'active' },
    // 运营部员工
    { id: 12, name: '陈十四', email: 'chenshisi@company.com', phone: '13800138012', position: '运营经理', department_id: 5, hire_date: '2022-10-01', status: 'active' },
    { id: 13, name: '褚十五', email: 'chushiwu@company.com', phone: '13800138013', position: '数据分析师', department_id: 5, hire_date: '2023-07-01', status: 'active' },
    { id: 14, name: '卫十六', email: 'weishiliu@company.com', phone: '13800138014', position: '内容运营', department_id: 5, hire_date: '2023-08-15', status: 'active' }
  ],
  
  desks: [
    { id: 1, desk_number: 'A001', department_id: 1, floor: 3, area: '开发区A', x_position: 100, y_position: 100, width: 120, height: 80, status: 'available', assigned_employee_id: null },
    { id: 2, desk_number: 'A002', department_id: 1, floor: 3, area: '开发区A', x_position: 250, y_position: 100, width: 120, height: 80, status: 'occupied', assigned_employee_id: 2 },
    { id: 3, desk_number: 'A003', department_id: 1, floor: 3, area: '开发区A', x_position: 400, y_position: 100, width: 120, height: 80, status: 'occupied', assigned_employee_id: 3 },
    { id: 4, desk_number: 'B001', department_id: 2, floor: 2, area: '市场区B', x_position: 100, y_position: 200, width: 120, height: 80, status: 'occupied', assigned_employee_id: 4 },
    { id: 5, desk_number: 'B002', department_id: 2, floor: 2, area: '市场区B', x_position: 250, y_position: 200, width: 120, height: 80, status: 'available', assigned_employee_id: null }
  ],
  
  users: [
    { id: 1, username: 'admin', password_hash: '$2b$12$Mz.2uGUBIsUUTqfrYzV2P.bEuwCwES.k19u7fG3HED44OnHKc30.G', email: 'admin@company.com', role: 'admin', employee_id: 1, status: 'active' },
    { id: 2, username: 'manager', password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', email: 'manager@company.com', role: 'manager', employee_id: 4, status: 'active' }
  ]
};

/**
 * 生成部门数据的SQL插入语句
 */
function generateDepartmentSQL() {
  const values = memoryData.departments.map(dept => {
    const name = dept.name.replace(/'/g, "''");
    const description = dept.description.replace(/'/g, "''");
    const location = dept.location.replace(/'/g, "''");
    const displayName = name; // display_name 使用 name 的值
    
    return `(${dept.id}, '${name}', '${displayName}', '${description}', ${dept.parent_id || 'NULL'}, ${dept.manager_id || 'NULL'}, '${location}', NOW(), NOW())`;
  }).join(',\n    ');
  
  return `-- 插入部门数据\nINSERT INTO departments (id, name, display_name, description, parent_id, manager_id, location, created_at, updated_at) VALUES\n    ${values};\n`;
}

/**
 * 生成员工数据的SQL插入语句
 */
function generateEmployeeSQL() {
  const values = memoryData.employees.map(emp => {
    const name = emp.name.replace(/'/g, "''");
    const email = emp.email.replace(/'/g, "''");
    const phone = emp.phone.replace(/'/g, "''");
    const position = emp.position.replace(/'/g, "''");
    const employeeNumber = `EMP${emp.id.toString().padStart(3, '0')}`; // 生成员工编号
    
    return `(${emp.id}, '${name}', '${email}', '${phone}', '${position}', ${emp.department_id}, '${emp.hire_date}', '${emp.status}', '${employeeNumber}', NOW(), NOW())`;
  }).join(',\n    ');
  
  return `-- 插入员工数据\nINSERT INTO employees (id, name, email, phone, position, department_id, hire_date, status, employee_number, created_at, updated_at) VALUES\n    ${values};\n`;
}

/**
 * 生成工位数据的SQL插入语句
 */
function generateDeskSQL() {
  const values = memoryData.desks.map(desk => {
    const deskNumber = desk.desk_number.replace(/'/g, "''");
    const area = desk.area.replace(/'/g, "''");
    
    return `(${desk.id}, '${deskNumber}', ${desk.department_id}, ${desk.floor}, '${area}', ${desk.x_position}, ${desk.y_position}, ${desk.width}, ${desk.height}, '${desk.status}', NOW(), NOW())`;
  }).join(',\n    ');
  
  return `-- 插入工位数据\nINSERT INTO desks (id, desk_number, department_id, floor, area, x_position, y_position, width, height, status, created_at, updated_at) VALUES\n    ${values};\n`;
}

/**
 * 生成工位分配数据的SQL插入语句
 */
function generateDeskAssignmentSQL() {
  const assignments = memoryData.desks.filter(desk => desk.assigned_employee_id);
  
  if (assignments.length === 0) {
    return '-- 无工位分配数据\n';
  }
  
  const values = assignments.map(desk => {
    return `(${desk.id}, ${desk.assigned_employee_id}, NOW(), 'active')`;
  }).join(',\n    ');
  
  return `-- 插入工位分配数据\nINSERT INTO desk_assignments (desk_id, employee_id, assigned_at, status) VALUES\n    ${values};\n`;
}

/**
 * 生成用户数据的SQL插入语句
 */
function generateUserSQL() {
  const values = memoryData.users.map(user => {
    const username = user.username.replace(/'/g, "''");
    const email = user.email.replace(/'/g, "''");
    
    return `(${user.id}, '${username}', '${user.password_hash}', '${email}', '${user.role}', ${user.employee_id}, '${user.status}', NOW(), NOW())`;
  }).join(',\n    ');
  
  return `-- 插入用户数据\nINSERT INTO users (id, username, password_hash, email, role, employee_id, status, created_at, updated_at) VALUES\n    ${values};\n`;
}

/**
 * 生成序列重置SQL
 */
function generateSequenceResetSQL() {
  return `-- 重置序列\nSELECT setval('departments_id_seq', ${Math.max(...memoryData.departments.map(d => d.id))});\nSELECT setval('employees_id_seq', ${Math.max(...memoryData.employees.map(e => e.id))});\nSELECT setval('desks_id_seq', ${Math.max(...memoryData.desks.map(d => d.id))});\nSELECT setval('users_id_seq', ${Math.max(...memoryData.users.map(u => u.id))});\n`;
}

/**
 * 主函数：生成完整的SQL文件
 */
async function exportMemoryDataToSQL() {
  try {
    console.log('🚀 开始导出内存数据库数据...');
    
    // 生成SQL内容
    const sqlContent = `-- 内存数据库数据导出\n-- 生成时间: ${new Date().toISOString()}\n-- 此文件包含所有内存数据库中的数据，用于更新PostgreSQL初始化脚本\n\n-- 清空现有数据（按依赖关系顺序）\nTRUNCATE TABLE desk_assignments, desks, employees, departments, users RESTART IDENTITY CASCADE;\n\n${generateDepartmentSQL()}\n${generateEmployeeSQL()}\n${generateDeskSQL()}\n${generateDeskAssignmentSQL()}\n${generateUserSQL()}\n${generateSequenceResetSQL()}\n-- 数据导出完成\n`;
    
    // 写入文件
    const outputPath = path.join(process.cwd(), 'scripts', 'memory-data-export.sql');
    await fs.writeFile(outputPath, sqlContent, 'utf8');
    
    console.log('✅ 数据导出完成！');
    console.log(`📁 输出文件: ${outputPath}`);
    console.log('\n📊 导出统计:');
    console.log(`   - 部门: ${memoryData.departments.length} 个`);
    console.log(`   - 员工: ${memoryData.employees.length} 个`);
    console.log(`   - 工位: ${memoryData.desks.length} 个`);
    console.log(`   - 用户: ${memoryData.users.length} 个`);
    console.log(`   - 工位分配: ${memoryData.desks.filter(d => d.assigned_employee_id).length} 个`);
    
  } catch (error) {
    console.error('❌ 导出失败:', error);
    process.exit(1);
  }
}

// 执行导出
exportMemoryDataToSQL();

export { exportMemoryDataToSQL };