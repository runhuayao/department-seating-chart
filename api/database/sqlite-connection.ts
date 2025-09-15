/**
 * SQLite数据库连接类
 * 实现与PostgreSQL兼容的数据库操作接口
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Workstation, Employee, Department, DatabaseStatus } from '../types/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '../../data/department_map.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * SQLite数据库连接类
 */
export class SqliteConnection {
  private db: Database.Database;
  private connectionStatus: DatabaseStatus;

  constructor() {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.connectionStatus = {
      connected: true,
      health: 'healthy',
      totalRecords: 0,
      lastUpdated: new Date().toISOString()
    };
    
    this.initializeTables();
    this.insertInitialData();
  }

  /**
   * 初始化数据库表结构
   */
  private initializeTables(): void {
    // 创建部门表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code TEXT UNIQUE,
        description TEXT,
        location TEXT,
        workstation_count INTEGER DEFAULT 0,
        employee_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建员工表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        department TEXT,
        position TEXT,
        workstation_id INTEGER,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建工位表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workstations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
        equipment TEXT,
        notes TEXT,
        floor_number INTEGER,
        building TEXT,
        x_position REAL DEFAULT 0,
        y_position REAL DEFAULT 0,
        width REAL DEFAULT 120,
        height REAL DEFAULT 80,
        department_id INTEGER,
        employee_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
    `);

    // 创建用户表
    this.db.exec(`
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

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
      CREATE INDEX IF NOT EXISTS idx_workstations_department ON workstations(department_id);
      CREATE INDEX IF NOT EXISTS idx_workstations_employee ON workstations(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
    `);

    console.log('✓ SQLite数据库表结构初始化完成');
  }

  /**
   * 插入初始数据
   */
  private insertInitialData(): void {
    // 检查是否已有数据
    const deptCount = this.db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
    if (deptCount.count > 0) {
      console.log('✓ 数据库已包含初始数据，跳过插入');
      return;
    }

    // 插入部门数据
    const insertDept = this.db.prepare(`
      INSERT INTO departments (name, code, description, location, workstation_count, employee_count) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const departments = [
      ['技术部', 'TECH', '负责系统开发和维护', '3楼A区', 3, 3],
      ['市场部', 'MKT', '负责市场推广和客户关系维护', '2楼B区', 3, 3],
      ['人事部', 'HR', '负责人力资源管理和招聘', '1楼C区', 3, 3],
      ['设计部', 'DESIGN', '负责产品设计和用户体验', '3楼B区', 2, 2],
      ['运营部', 'OPS', '负责日常运营和客户服务', '2楼A区', 3, 3]
    ];

    departments.forEach(dept => {
      insertDept.run(dept[0], dept[1], dept[2], dept[3], dept[4], dept[5]);
    });

    // 插入员工数据
    const insertEmp = this.db.prepare(`
      INSERT INTO employees (employee_id, name, email, phone, department, position, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const employees = [
      ['EMP001', '张伟', 'zhangwei@company.com', '13800138001', '技术部', '技术总监', 'active'],
      ['EMP002', '李娜', 'lina@company.com', '13800138002', '技术部', '前端开发工程师', 'active'],
      ['EMP003', '王强', 'wangqiang@company.com', '13800138003', '技术部', '后端开发工程师', 'active'],
      ['EMP004', '刘芳', 'liufang@company.com', '13800138004', '市场部', '市场总监', 'active'],
      ['EMP005', '陈明', 'chenming@company.com', '13800138005', '市场部', '市场专员', 'active'],
      ['EMP006', '赵丽', 'zhaoli@company.com', '13800138006', '市场部', '客户经理', 'active'],
      ['EMP007', '孙涛', 'suntao@company.com', '13800138007', '人事部', '人事总监', 'active'],
      ['EMP008', '周敏', 'zhoumin@company.com', '13800138008', '人事部', '招聘专员', 'active'],
      ['EMP009', '吴刚', 'wugang@company.com', '13800138009', '人事部', '薪酬专员', 'active'],
      ['EMP010', '郑红', 'zhenghong@company.com', '13800138010', '设计部', '设计总监', 'active'],
      ['EMP011', '冯十三', 'fengshisan@company.com', '13800138011', '设计部', 'UI设计师', 'active'],
      ['EMP012', '何六', 'heliu@company.com', '13800138012', '运营部', '运营总监', 'active'],
      ['EMP013', '马七', 'maqi@company.com', '13800138013', '运营部', '运营专员', 'active'],
      ['EMP014', '朱八', 'zhuba@company.com', '13800138014', '运营部', '客服专员', 'active']
    ];

    employees.forEach(emp => {
      insertEmp.run(emp[0], emp[1], emp[2], emp[3], emp[4], emp[5], emp[6]);
    });

    // 插入工位数据
    const insertWorkstation = this.db.prepare(`
      INSERT INTO workstations (name, status, equipment, floor_number, building, x_position, y_position, department_id, employee_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const workstations = [
      ['A001', 'occupied', '台式机,双显示器', 3, 'A座', 100, 100, 1, 1],
      ['A002', 'occupied', '笔记本,外接显示器', 3, 'A座', 250, 100, 1, 2],
      ['A003', 'occupied', '台式机,双显示器', 3, 'A座', 400, 100, 1, 3],
      ['B001', 'occupied', '笔记本,投影仪', 2, 'A座', 100, 200, 2, 4],
      ['B002', 'occupied', '台式机,打印机', 2, 'A座', 250, 200, 2, 5]
    ];

    workstations.forEach(ws => {
      insertWorkstation.run(ws[0], ws[1], ws[2], ws[3], ws[4], ws[5], ws[6], ws[7], ws[8]);
    });

    // 插入默认用户（密码: admin123）
    const insertUser = this.db.prepare(`
      INSERT INTO users (username, password_hash, email, role, employee_id) 
      VALUES (?, ?, ?, ?, ?)
    `);

    const adminPasswordHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G'; // admin123
    insertUser.run('admin', adminPasswordHash, 'admin@company.com', 'admin', 1);

    console.log('✓ 初始数据插入完成');
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      this.connectionStatus.connected = true;
      this.connectionStatus.health = 'healthy';
      return true;
    } catch (error) {
      console.error('SQLite连接测试失败:', error);
      this.connectionStatus.connected = false;
      this.connectionStatus.health = 'error';
      return false;
    }
  }

  /**
   * 执行查询
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const stmt = this.db.prepare(sql);
      if (sql.trim().toLowerCase().startsWith('select')) {
        return stmt.all(...params);
      } else {
        const result = stmt.run(...params);
        return [{ changes: result.changes, lastInsertRowid: result.lastInsertRowid }];
      }
    } catch (error) {
      console.error('SQLite查询失败:', error);
      throw error;
    }
  }

  /**
   * 获取工位列表
   */
  async getWorkstations(): Promise<Workstation[]> {
    try {
      const result = this.db.prepare(`
        SELECT 
          w.id, w.name, w.status, w.equipment, w.notes, w.floor_number, w.building,
          w.x_position, w.y_position, w.width, w.height,
          w.created_at, w.updated_at, w.department_id, w.employee_id,
          d.name as department_name,
          e.name as employee_name
        FROM workstations w
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN employees e ON w.employee_id = e.id
        ORDER BY w.created_at DESC
      `).all();

      return result.map((row: any) => ({
        id: parseInt(row.id),
        desk_number: row.name || `DESK-${row.id}`,
        department_id: parseInt(row.department_id) || 1,
        floor: row.floor_number || 1,
        area: row.building || 'A座',
        x_position: row.x_position || 0,
        y_position: row.y_position || 0,
        width: row.width || 120,
        height: row.height || 80,
        status: row.status as 'available' | 'occupied' | 'maintenance' | 'reserved',
        assigned_employee_id: row.employee_id ? parseInt(row.employee_id) : undefined,
        equipment_info: row.equipment || '',
        created_at: row.created_at,
        updated_at: row.updated_at
      } as Workstation));
    } catch (error) {
      console.error('获取工位列表失败:', error);
      return [];
    }
  }

  /**
   * 获取员工列表
   */
  async getEmployees(): Promise<Employee[]> {
    try {
      const result = this.db.prepare(`
        SELECT 
          id, employee_id, name, email, phone, department, 
          position, workstation_id, status, permissions,
          created_at, updated_at
        FROM employees 
        ORDER BY created_at DESC
      `).all();

      return result.map((row: any) => ({
        id: parseInt(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone,
        position: row.position,
        department_id: parseInt(row.department) || 1, // 假设department字段存储的是department_id
        hire_date: row.created_at, // 使用created_at作为hire_date
        status: row.status as 'active' | 'inactive' | 'terminated',
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('获取员工列表失败:', error);
      return [];
    }
  }

  /**
   * 获取部门列表
   */
  async getDepartments(): Promise<Department[]> {
    try {
      const result = this.db.prepare(`
        SELECT 
          id, name, code, description, location, workstation_count,
          employee_count, created_at, updated_at
        FROM departments 
        ORDER BY created_at DESC
      `).all();

      return result.map((row: any) => ({
        id: parseInt(row.id),
        name: row.name,
        description: row.description,
        location: row.location,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return [];
    }
  }

  /**
   * 搜索功能
   */
  async search(query: string): Promise<{ employees: Employee[], workstations: Workstation[] }> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;
      
      const employeesResult = this.db.prepare(`
        SELECT 
          id, employee_id, name, email, phone, department, 
          position, workstation_id, status, permissions,
          created_at, updated_at
        FROM employees 
        WHERE 
          LOWER(name) LIKE ? OR
          LOWER(employee_id) LIKE ? OR
          LOWER(email) LIKE ? OR
          LOWER(department) LIKE ? OR
          LOWER(position) LIKE ?
        ORDER BY created_at DESC
      `).all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);

      const workstationsResult = this.db.prepare(`
        SELECT 
          w.id, w.name, w.status, w.equipment, w.notes, w.floor_number, w.building,
          w.x_position, w.y_position, w.width, w.height,
          w.created_at, w.updated_at, w.department_id, w.employee_id,
          d.name as department_name,
          e.name as employee_name
        FROM workstations w
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN employees e ON w.employee_id = e.id
        WHERE 
          LOWER(w.name) LIKE ? OR
          LOWER(w.equipment) LIKE ? OR
          LOWER(w.notes) LIKE ? OR
          LOWER(d.name) LIKE ? OR
          LOWER(e.name) LIKE ?
        ORDER BY w.created_at DESC
      `).all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);

      const employees = employeesResult.map((row: any) => ({
        id: parseInt(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone,
        position: row.position,
        department_id: parseInt(row.department) || 1, // 假设department字段存储的是department_id
        hire_date: row.created_at, // 使用created_at作为hire_date
        status: row.status as 'active' | 'inactive' | 'terminated',
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      const workstations = workstationsResult.map((row: any) => ({
        id: parseInt(row.id),
        desk_number: row.name || `DESK-${row.id}`,
        department_id: parseInt(row.department_id) || 1,
        floor: row.floor_number || 1,
        area: row.building || 'A座',
        x_position: row.x_position || 0,
        y_position: row.y_position || 0,
        width: row.width || 120,
        height: row.height || 80,
        status: row.status as 'available' | 'occupied' | 'maintenance' | 'reserved',
        assigned_employee_id: row.employee_id ? parseInt(row.employee_id) : undefined,
        equipment_info: row.equipment || '',
        created_at: row.created_at,
        updated_at: row.updated_at
      } as Workstation));

      return { employees, workstations };
    } catch (error) {
      console.error('搜索失败:', error);
      return { employees: [], workstations: [] };
    }
  }

  /**
   * 获取数据库状态
   */
  async getStatus(): Promise<DatabaseStatus> {
    try {
      const workstationCount = this.db.prepare('SELECT COUNT(*) as count FROM workstations').get() as { count: number };
      const employeeCount = this.db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
      const departmentCount = this.db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
      
      this.connectionStatus.totalRecords = workstationCount.count + employeeCount.count + departmentCount.count;
      this.connectionStatus.lastUpdated = new Date().toISOString();
      
      return { ...this.connectionStatus };
    } catch (error) {
      console.error('获取数据库状态失败:', error);
      this.connectionStatus.connected = false;
      this.connectionStatus.health = 'error';
      return { ...this.connectionStatus };
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 执行简单查询测试连接
      const result = this.db.prepare('SELECT 1 as test').get();
      return result && (result as any).test === 1;
    } catch (error) {
      console.error('SQLite连接测试失败:', error);
      this.connectionStatus.connected = false;
      this.connectionStatus.health = 'error';
      return false;
    }
  }

  /**
   * 数据同步（SQLite不需要实际同步）
   */
  async syncData(): Promise<boolean> {
    try {
      // SQLite是本地数据库，不需要实际同步
      // 这里只是更新状态
      this.connectionStatus.lastUpdated = new Date().toISOString();
      return true;
    } catch (error) {
      console.error('数据同步失败:', error);
      return false;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      this.db.close();
      console.log('✓ SQLite数据库连接已关闭');
    } catch (error) {
      console.error('关闭SQLite数据库连接失败:', error);
    }
  }
}

/**
 * 获取SQLite数据库连接实例
 */
export function getSqliteConnection(): SqliteConnection {
  return new SqliteConnection();
}

// 默认导出
export default {
  getSqliteConnection,
  SqliteConnection
};