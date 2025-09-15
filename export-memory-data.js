/**
 * 数据迁移脚本：将内存数据库数据导出为SQL格式
 */

// 内存数据库的数据结构（从memory.ts复制）
const memoryData = {
  departments: [
    {
      id: 1,
      name: '技术部',
      description: '负责产品开发和技术支持',
      manager_id: 1,
      floor: 3,
      area: '开发区A',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      name: '市场部',
      description: '负责市场推广和销售',
      manager_id: 4,
      floor: 2,
      area: '市场区B',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      name: '人事部',
      description: '负责人力资源管理',
      manager_id: 7,
      floor: 1,
      area: '行政区C',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 4,
      name: '设计部',
      description: '负责产品设计和用户体验',
      manager_id: 10,
      floor: 4,
      area: '设计区D',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 5,
      name: '运营部',
      description: '负责产品运营和数据分析',
      manager_id: 12,
      floor: 2,
      area: '运营区E',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  
  employees: [
    // 技术部员工
    {
      id: 1,
      name: '张三',
      email: 'zhangsan@company.com',
      phone: '13800138001',
      position: '技术总监',
      department_id: 1,
      hire_date: '2022-01-15',
      status: 'active'
    },
    {
      id: 2,
      name: '李四',
      email: 'lisi@company.com',
      phone: '13800138002',
      position: '高级开发工程师',
      department_id: 1,
      hire_date: '2022-03-01',
      status: 'active'
    },
    {
      id: 3,
      name: '王五',
      email: 'wangwu@company.com',
      phone: '13800138003',
      position: '前端开发工程师',
      department_id: 1,
      hire_date: '2022-05-10',
      status: 'active'
    },
    // 市场部员工
    {
      id: 4,
      name: '赵六',
      email: 'zhaoliu@company.com',
      phone: '13800138004',
      position: '市场总监',
      department_id: 2,
      hire_date: '2021-12-01',
      status: 'active'
    },
    {
      id: 5,
      name: '钱七',
      email: 'qianqi@company.com',
      phone: '13800138005',
      position: '销售经理',
      department_id: 2,
      hire_date: '2022-02-15',
      status: 'active'
    },
    {
      id: 6,
      name: '孙八',
      email: 'sunba@company.com',
      phone: '13800138006',
      position: '市场专员',
      department_id: 2,
      hire_date: '2022-04-01',
      status: 'active'
    },
    // 人事部员工
    {
      id: 7,
      name: '周九',
      email: 'zhoujiu@company.com',
      phone: '13800138007',
      position: '人事总监',
      department_id: 3,
      hire_date: '2021-11-01',
      status: 'active'
    },
    {
      id: 8,
      name: '吴十',
      email: 'wushi@company.com',
      phone: '13800138008',
      position: '招聘专员',
      department_id: 3,
      hire_date: '2022-06-01',
      status: 'active'
    },
    {
      id: 9,
      name: '郑十一',
      email: 'zhengshiyi@company.com',
      phone: '13800138009',
      position: '薪酬专员',
      department_id: 3,
      hire_date: '2022-07-15',
      status: 'active'
    },
    // 设计部员工
    {
      id: 10,
      name: '王十二',
      email: 'wangshier@company.com',
      phone: '13800138010',
      position: '设计总监',
      department_id: 4,
      hire_date: '2022-01-01',
      status: 'active'
    },
    {
      id: 11,
      name: '冯十三',
      email: 'fengshisan@company.com',
      phone: '13800138011',
      position: 'UX设计师',
      department_id: 4,
      hire_date: '2023-06-01',
      status: 'active'
    },
    // 运营部员工
    {
      id: 12,
      name: '陈十四',
      email: 'chenshisi@company.com',
      phone: '13800138012',
      position: '运营经理',
      department_id: 5,
      hire_date: '2022-10-01',
      status: 'active'
    },
    {
      id: 13,
      name: '褚十五',
      email: 'chushiwu@company.com',
      phone: '13800138013',
      position: '数据分析师',
      department_id: 5,
      hire_date: '2023-07-01',
      status: 'active'
    },
    {
      id: 14,
      name: '卫十六',
      email: 'weishiliu@company.com',
      phone: '13800138014',
      position: '内容运营',
      department_id: 5,
      hire_date: '2023-08-15',
      status: 'active'
    }
  ],
  
  desks: [
    {
      id: 1,
      desk_number: 'A001',
      department_id: 1,
      floor: 3,
      area: '开发区A',
      x_position: 100,
      y_position: 100,
      width: 120,
      height: 80,
      status: 'available',
      assigned_employee_id: null
    },
    {
      id: 2,
      desk_number: 'A002',
      department_id: 1,
      floor: 3,
      area: '开发区A',
      x_position: 250,
      y_position: 100,
      width: 120,
      height: 80,
      status: 'occupied',
      assigned_employee_id: 2,
      ip_address: '192.168.1.101',
      computer_name: 'DEV-PC-001',
      equipment_info: 'Dell OptiPlex 7090'
    },
    {
      id: 3,
      desk_number: 'A003',
      department_id: 1,
      floor: 3,
      area: '开发区A',
      x_position: 400,
      y_position: 100,
      width: 120,
      height: 80,
      status: 'occupied',
      assigned_employee_id: 3,
      ip_address: '192.168.1.102',
      computer_name: 'DEV-PC-002',
      equipment_info: 'HP EliteDesk 800'
    },
    {
      id: 4,
      desk_number: 'B001',
      department_id: 2,
      floor: 2,
      area: '市场区B',
      x_position: 100,
      y_position: 200,
      width: 120,
      height: 80,
      status: 'occupied',
      assigned_employee_id: 4,
      ip_address: '192.168.1.201',
      computer_name: 'MKT-PC-001',
      equipment_info: 'Lenovo ThinkCentre M720'
    },
    {
      id: 5,
      desk_number: 'B002',
      department_id: 2,
      floor: 2,
      area: '市场区B',
      x_position: 250,
      y_position: 200,
      width: 120,
      height: 80,
      status: 'available',
      assigned_employee_id: null
    }
  ]
};

/**
 * 生成SQL插入语句
 */
function generateSQL() {
  let sql = '-- 数据迁移SQL脚本\n-- 从内存数据库导出的完整数据\n\n';
  
  // 清空现有数据
  sql += '-- 清空现有数据\n';
  sql += 'TRUNCATE TABLE desk_assignments CASCADE;\n';
  sql += 'TRUNCATE TABLE desks CASCADE;\n';
  sql += 'TRUNCATE TABLE employees CASCADE;\n';
  sql += 'TRUNCATE TABLE departments CASCADE;\n\n';
  
  // 插入部门数据
  sql += '-- 插入部门数据\n';
  sql += 'INSERT INTO departments (id, name, description, manager_id, floor, area, created_at, updated_at) VALUES\n';
  const deptValues = memoryData.departments.map(dept => 
    `(${dept.id}, '${dept.name}', '${dept.description}', ${dept.manager_id || 'NULL'}, ${dept.floor}, '${dept.area}', NOW(), NOW())`
  ).join(',\n');
  sql += deptValues + ';\n\n';
  
  // 插入员工数据
  sql += '-- 插入员工数据\n';
  sql += 'INSERT INTO employees (id, name, email, phone, position, department_id, hire_date, status, created_at, updated_at) VALUES\n';
  const empValues = memoryData.employees.map(emp => 
    `(${emp.id}, '${emp.name}', '${emp.email}', '${emp.phone}', '${emp.position}', ${emp.department_id}, '${emp.hire_date}', '${emp.status}', NOW(), NOW())`
  ).join(',\n');
  sql += empValues + ';\n\n';
  
  // 插入工位数据
  sql += '-- 插入工位数据\n';
  sql += 'INSERT INTO desks (id, desk_number, department_id, floor, area, x_position, y_position, width, height, status, assigned_employee_id, assigned_at, ip_address, computer_name, equipment_info, created_at, updated_at) VALUES\n';
  const deskValues = memoryData.desks.map(desk => {
    const assignedAt = desk.assigned_employee_id ? 'NOW()' : 'NULL';
    const ipAddress = desk.ip_address ? `'${desk.ip_address}'` : 'NULL';
    const computerName = desk.computer_name ? `'${desk.computer_name}'` : 'NULL';
    const equipmentInfo = desk.equipment_info ? `'${desk.equipment_info}'` : 'NULL';
    
    return `(${desk.id}, '${desk.desk_number}', ${desk.department_id}, ${desk.floor}, '${desk.area}', ${desk.x_position}, ${desk.y_position}, ${desk.width}, ${desk.height}, '${desk.status}', ${desk.assigned_employee_id || 'NULL'}, ${assignedAt}, ${ipAddress}, ${computerName}, ${equipmentInfo}, NOW(), NOW())`;
  }).join(',\n');
  sql += deskValues + ';\n\n';
  
  // 重置序列
  sql += '-- 重置序列\n';
  sql += `SELECT setval('departments_id_seq', ${Math.max(...memoryData.departments.map(d => d.id))});\n`;
  sql += `SELECT setval('employees_id_seq', ${Math.max(...memoryData.employees.map(e => e.id))});\n`;
  sql += `SELECT setval('desks_id_seq', ${Math.max(...memoryData.desks.map(d => d.id))});\n\n`;
  
  // 创建搜索视图和索引
  sql += '-- 创建搜索视图\n';
  sql += `CREATE OR REPLACE VIEW employee_search_view AS
SELECT 
    e.id,
    e.name,
    e.email,
    e.phone,
    e.position,
    e.department_id,
    d.name as department_name,
    e.hire_date,
    e.status,
    (e.name || ' ' || e.position || ' ' || d.name || ' ' || COALESCE(e.email, '')) as search_text
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.status = 'active';\n\n`;
  
  sql += '-- 创建全文搜索索引\n';
  sql += `CREATE INDEX IF NOT EXISTS idx_employees_search ON employees USING gin(to_tsvector('simple', name || ' ' || position || ' ' || email));\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_departments_search ON departments USING gin(to_tsvector('simple', name || ' ' || description));\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_desks_search ON desks USING gin(to_tsvector('simple', desk_number || ' ' || area));\n\n`;
  
  return sql;
}

// 生成并输出SQL
const sqlContent = generateSQL();
console.log('生成的SQL脚本：');
console.log(sqlContent);

// 写入文件
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const outputPath = path.join(__dirname, 'api', 'sql', 'complete_data_migration.sql');
fs.writeFileSync(outputPath, sqlContent, 'utf8');
console.log(`\n✓ SQL脚本已保存到: ${outputPath}`);

// 统计信息
console.log('\n数据统计：');
console.log(`- 部门数量: ${memoryData.departments.length}`);
console.log(`- 员工数量: ${memoryData.employees.length}`);
console.log(`- 工位数量: ${memoryData.desks.length}`);

// 按部门统计员工
const deptStats = {};
memoryData.employees.forEach(emp => {
  const dept = memoryData.departments.find(d => d.id === emp.department_id);
  const deptName = dept ? dept.name : '未知部门';
  deptStats[deptName] = (deptStats[deptName] || 0) + 1;
});

console.log('\n各部门员工数量：');
Object.entries(deptStats).forEach(([dept, count]) => {
  console.log(`- ${dept}: ${count}人`);
});