/**
 * SQLite数据库连接和初始化
 * 用于开发环境的轻量级数据库解决方案
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '../../data/department_map.db');

// 创建数据库连接
let db: Database.Database;

/**
 * 获取数据库连接
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
export function initializeDatabase(): void {
  const database = getDatabase();
  
  // 启用外键约束
  database.pragma('foreign_keys = ON');
  
  // 创建部门表
  database.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id INTEGER,
      manager_id INTEGER,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES departments(id),
      FOREIGN KEY (manager_id) REFERENCES employees(id)
    );
  `);
  
  // 创建员工表
  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      position TEXT,
      department_id INTEGER NOT NULL,
      hire_date DATE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );
  `);
  
  // 创建工位表
  database.exec(`
    CREATE TABLE IF NOT EXISTS desks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desk_number TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL,
      floor INTEGER,
      area TEXT,
      x_position REAL,
      y_position REAL,
      width REAL DEFAULT 120,
      height REAL DEFAULT 80,
      status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
      assigned_employee_id INTEGER,
      assigned_at DATETIME,
      ip_address TEXT,
      computer_name TEXT,
      equipment_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id)
    );
  `);
  
  // 创建用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
      employee_id INTEGER,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);
  
  // 创建权限表
  database.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // 创建角色权限关联表
  database.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (permission_id) REFERENCES permissions(id),
      UNIQUE(role, permission_id)
    );
  `);
  
  // 创建系统日志表
  database.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // 创建工位历史记录表
  database.exec(`
    CREATE TABLE IF NOT EXISTS desk_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desk_id INTEGER NOT NULL,
      employee_id INTEGER,
      assigned_by INTEGER,
      assigned_at DATETIME NOT NULL,
      released_at DATETIME,
      status TEXT NOT NULL CHECK (status IN ('assigned', 'released')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (desk_id) REFERENCES desks(id),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    );
  `);
  
  // 创建会话表
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // 创建索引
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_desks_department ON desks(department_id);
    CREATE INDEX IF NOT EXISTS idx_desks_employee ON desks(assigned_employee_id);
    CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_desk_assignments_desk ON desk_assignments(desk_id);
    CREATE INDEX IF NOT EXISTS idx_desk_assignments_employee ON desk_assignments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
  `);
  
  console.log('✓ SQLite数据库表结构初始化完成');
}

/**
 * 插入初始数据
 */
export function insertInitialData(): void {
  const database = getDatabase();
  
  // 检查是否已有数据
  const deptCount = database.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
  if (deptCount.count > 0) {
    console.log('✓ 数据库已包含初始数据，跳过插入');
    return;
  }
  
  // 插入默认部门
  const insertDept = database.prepare(`
    INSERT INTO departments (name, description, location) 
    VALUES (?, ?, ?)
  `);
  
  const departments = [
    ['技术部', '负责公司技术研发和系统维护', '3楼'],
    ['市场部', '负责市场推广和客户关系维护', '2楼'],
    ['人事部', '负责人力资源管理和招聘', '1楼'],
    ['财务部', '负责财务管理和会计核算', '1楼']
  ];
  
  departments.forEach(dept => {
    insertDept.run(dept[0], dept[1], dept[2]);
  });
  
  // 插入默认员工
  const insertEmp = database.prepare(`
    INSERT INTO employees (name, email, position, department_id, hire_date) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const employees = [
    ['张三', 'zhangsan@company.com', '技术经理', 1, '2023-01-15'],
    ['李四', 'lisi@company.com', '前端开发', 1, '2023-02-01'],
    ['王五', 'wangwu@company.com', '后端开发', 1, '2023-02-15'],
    ['赵六', 'zhaoliu@company.com', '市场经理', 2, '2023-01-10'],
    ['钱七', 'qianqi@company.com', '销售代表', 2, '2023-03-01']
  ];
  
  employees.forEach(emp => {
    insertEmp.run(emp[0], emp[1], emp[2], emp[3], emp[4]);
  });
  
  // 插入默认工位
  const insertDesk = database.prepare(`
    INSERT INTO desks (desk_number, department_id, floor, area, x_position, y_position) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const desks = [
    ['A001', 1, 3, '开发区A', 100, 100],
    ['A002', 1, 3, '开发区A', 250, 100],
    ['A003', 1, 3, '开发区A', 400, 100],
    ['B001', 2, 2, '市场区B', 100, 200],
    ['B002', 2, 2, '市场区B', 250, 200]
  ];
  
  desks.forEach(desk => {
    insertDesk.run(desk[0], desk[1], desk[2], desk[3], desk[4], desk[5]);
  });
  
  // 插入默认用户（密码: admin123）
  const insertUser = database.prepare(`
    INSERT INTO users (username, password_hash, email, role, employee_id) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  // 这里使用简单的密码哈希，实际应用中应该使用bcrypt
  const adminPasswordHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G'; // admin123
  
  insertUser.run('admin', adminPasswordHash, 'admin@company.com', 'admin', 1);
  
  // 插入默认权限
  const insertPermission = database.prepare(`
    INSERT INTO permissions (name, description, resource, action) 
    VALUES (?, ?, ?, ?)
  `);
  
  const permissions = [
    ['查看工位', '查看工位信息', 'desk', 'read'],
    ['管理工位', '创建、修改、删除工位', 'desk', 'write'],
    ['查看员工', '查看员工信息', 'employee', 'read'],
    ['管理员工', '创建、修改、删除员工', 'employee', 'write'],
    ['查看部门', '查看部门信息', 'department', 'read'],
    ['管理部门', '创建、修改、删除部门', 'department', 'write'],
    ['系统管理', '系统配置和用户管理', 'system', 'admin']
  ];
  
  permissions.forEach(perm => {
    insertPermission.run(perm[0], perm[1], perm[2], perm[3]);
  });
  
  // 插入角色权限关联
  const insertRolePermission = database.prepare(`
    INSERT INTO role_permissions (role, permission_id) 
    VALUES (?, ?)
  `);
  
  // 管理员拥有所有权限
  for (let i = 1; i <= 7; i++) {
    insertRolePermission.run('admin', i);
  }
  
  // 经理拥有部分权限
  [1, 2, 3, 4, 5, 6].forEach(permId => {
    insertRolePermission.run('manager', permId);
  });
  
  // 普通用户只有查看权限
  [1, 3, 5].forEach(permId => {
    insertRolePermission.run('user', permId);
  });
  
  console.log('✓ 初始数据插入完成');
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}

// 进程退出时关闭数据库
process.on('exit', closeDatabase);
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});