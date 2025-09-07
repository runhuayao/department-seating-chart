// 数据库模型和操作类
import { Workstation, Employee, Department, User, AuditLog, DatabaseStatus } from '../../shared/types.js';

// 内存数据库类（模拟真实数据库）
class MemoryDatabase {
  private workstations: Map<string, Workstation> = new Map();
  private employees: Map<string, Employee> = new Map();
  private departments: Map<string, Department> = new Map();
  private users: Map<string, User> = new Map();
  private auditLogs: AuditLog[] = [];
  private connectionStatus: DatabaseStatus;

  constructor() {
    this.connectionStatus = {
      connected: true,
      tables: 5,
      totalRecords: 0,
      lastSync: new Date().toISOString(),
      health: 'healthy'
    };
    
    // 初始化示例数据
    this.initializeData();
  }

  // 初始化示例数据
  private initializeData() {
    // 初始化部门数据
    const departments: Department[] = [
      {
        id: 'dept-001',
        name: '技术部',
        code: 'TECH',
        description: '负责技术开发和维护',
        location: { building: 'A栋', floor: 3, area: '东区' },
        workstationCount: 25,
        employeeCount: 20,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'dept-002',
        name: '市场部',
        code: 'MKT',
        description: '负责市场推广和销售',
        location: { building: 'A栋', floor: 2, area: '西区' },
        workstationCount: 15,
        employeeCount: 12,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'dept-003',
        name: '人事部',
        code: 'HR',
        description: '负责人力资源管理',
        location: { building: 'B栋', floor: 1, area: '中区' },
        workstationCount: 8,
        employeeCount: 6,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      }
    ];

    departments.forEach(dept => this.departments.set(dept.id, dept));

    // 初始化员工数据
    const employees: Employee[] = [
      {
        id: 'emp-001',
        employeeId: 'E001',
        name: '张三',
        email: 'zhangsan@company.com',
        phone: '13800138001',
        department: '技术部',
        position: '高级工程师',
        workstationId: 'ws-001',
        status: 'active',
        permissions: ['workstation:view', 'workstation:update'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'emp-002',
        employeeId: 'E002',
        name: '李四',
        email: 'lisi@company.com',
        phone: '13800138002',
        department: '技术部',
        position: '前端工程师',
        workstationId: 'ws-002',
        status: 'active',
        permissions: ['workstation:view'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'emp-003',
        employeeId: 'E003',
        name: '王五',
        email: 'wangwu@company.com',
        phone: '13800138003',
        department: '市场部',
        position: '市场专员',
        workstationId: 'ws-003',
        status: 'active',
        permissions: ['workstation:view'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      }
    ];

    employees.forEach(emp => this.employees.set(emp.id, emp));

    // 初始化工作站数据
    const workstations: Workstation[] = [
      {
        id: 'ws-001',
        name: '开发工作站-001',
        ipAddress: '192.168.1.101',
        macAddress: '00:1B:44:11:3A:B7',
        location: {
          floor: 3,
          room: 'A301',
          position: { x: 100, y: 150 }
        },
        department: '技术部',
        status: 'online',
        specifications: {
          cpu: 'Intel i7-12700K',
          memory: '32GB DDR4',
          storage: '1TB NVMe SSD',
          os: 'Windows 11 Pro'
        },
        assignedUser: 'emp-001',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'ws-002',
        name: '开发工作站-002',
        ipAddress: '192.168.1.102',
        macAddress: '00:1B:44:11:3A:B8',
        location: {
          floor: 3,
          room: 'A301',
          position: { x: 200, y: 150 }
        },
        department: '技术部',
        status: 'online',
        specifications: {
          cpu: 'Intel i5-12400F',
          memory: '16GB DDR4',
          storage: '512GB NVMe SSD',
          os: 'Windows 11 Pro'
        },
        assignedUser: 'emp-002',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'ws-003',
        name: '办公工作站-001',
        ipAddress: '192.168.1.201',
        macAddress: '00:1B:44:11:3A:C1',
        location: {
          floor: 2,
          room: 'A201',
          position: { x: 150, y: 100 }
        },
        department: '市场部',
        status: 'online',
        specifications: {
          cpu: 'Intel i5-11400',
          memory: '16GB DDR4',
          storage: '256GB SSD',
          os: 'Windows 10 Pro'
        },
        assignedUser: 'emp-003',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      }
    ];

    workstations.forEach(ws => this.workstations.set(ws.id, ws));

    // 初始化用户数据
    const users: User[] = [
      {
        id: 'user-001',
        username: 'admin',
        email: 'admin@company.com',
        passwordHash: '$2b$10$hash...', // 实际应用中应该是加密后的密码
        role: 'admin',
        employeeId: 'emp-001',
        permissions: ['system:admin'],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      }
    ];

    users.forEach(user => this.users.set(user.id, user));

    // 更新总记录数
    this.updateTotalRecords();
  }

  // 更新总记录数
  private updateTotalRecords() {
    this.connectionStatus.totalRecords = 
      this.workstations.size + 
      this.employees.size + 
      this.departments.size + 
      this.users.size + 
      this.auditLogs.length;
    this.connectionStatus.lastSync = new Date().toISOString();
  }

  // 工作站操作
  async getWorkstations(): Promise<Workstation[]> {
    return Array.from(this.workstations.values());
  }

  async getWorkstationById(id: string): Promise<Workstation | null> {
    return this.workstations.get(id) || null;
  }

  async createWorkstation(workstation: Omit<Workstation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workstation> {
    const id = `ws-${Date.now()}`;
    const newWorkstation: Workstation = {
      ...workstation,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workstations.set(id, newWorkstation);
    this.updateTotalRecords();
    
    // 记录审计日志
    this.addAuditLog('user-001', 'CREATE', 'workstation', id, newWorkstation);
    
    return newWorkstation;
  }

  async updateWorkstation(id: string, updates: Partial<Workstation>): Promise<Workstation | null> {
    const workstation = this.workstations.get(id);
    if (!workstation) return null;

    const updatedWorkstation = {
      ...workstation,
      ...updates,
      id,
      updatedAt: new Date()
    };

    this.workstations.set(id, updatedWorkstation);
    this.updateTotalRecords();
    
    // 记录审计日志
    this.addAuditLog('user-001', 'UPDATE', 'workstation', id, updates);
    
    return updatedWorkstation;
  }

  async deleteWorkstation(id: string): Promise<boolean> {
    const deleted = this.workstations.delete(id);
    if (deleted) {
      this.updateTotalRecords();
      // 记录审计日志
      this.addAuditLog('user-001', 'DELETE', 'workstation', id, {});
    }
    return deleted;
  }

  // 员工操作
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    return this.employees.get(id) || null;
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = `emp-${Date.now()}`;
    const newEmployee: Employee = {
      ...employee,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.employees.set(id, newEmployee);
    this.updateTotalRecords();
    
    // 记录审计日志
    this.addAuditLog('user-001', 'CREATE', 'employee', id, newEmployee);
    
    return newEmployee;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    const employee = this.employees.get(id);
    if (!employee) return null;

    const updatedEmployee = {
      ...employee,
      ...updates,
      id,
      updatedAt: new Date()
    };

    this.employees.set(id, updatedEmployee);
    this.updateTotalRecords();
    
    // 记录审计日志
    this.addAuditLog('user-001', 'UPDATE', 'employee', id, updates);
    
    return updatedEmployee;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const deleted = this.employees.delete(id);
    if (deleted) {
      this.updateTotalRecords();
      // 记录审计日志
      this.addAuditLog('user-001', 'DELETE', 'employee', id, {});
    }
    return deleted;
  }

  // 部门操作
  async getDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async getDepartmentById(id: string): Promise<Department | null> {
    return this.departments.get(id) || null;
  }

  // 搜索功能
  async search(query: string): Promise<{ employees: Employee[], workstations: Workstation[] }> {
    const lowerQuery = query.toLowerCase();
    
    const employees = Array.from(this.employees.values()).filter(emp => 
      emp.name.toLowerCase().includes(lowerQuery) ||
      emp.employeeId.toLowerCase().includes(lowerQuery) ||
      emp.email.toLowerCase().includes(lowerQuery) ||
      emp.department.toLowerCase().includes(lowerQuery)
    );

    const workstations = Array.from(this.workstations.values()).filter(ws => 
      ws.name.toLowerCase().includes(lowerQuery) ||
      ws.ipAddress.includes(lowerQuery) ||
      ws.department.toLowerCase().includes(lowerQuery) ||
      ws.location.room.toLowerCase().includes(lowerQuery)
    );

    return { employees, workstations };
  }

  // 获取数据库状态
  async getStatus(): Promise<DatabaseStatus> {
    return { ...this.connectionStatus };
  }

  // 添加审计日志
  private addAuditLog(userId: string, action: string, resource: string, resourceId: string, details: any) {
    const log: AuditLog = {
      id: `log-${Date.now()}`,
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress: '127.0.0.1',
      userAgent: 'Server',
      timestamp: new Date()
    };
    
    this.auditLogs.push(log);
    
    // 保持最近1000条日志
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
    
    this.updateTotalRecords();
  }

  // 获取审计日志
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogs.slice(-limit).reverse();
  }

  // 数据同步（模拟）
  async syncData(): Promise<boolean> {
    try {
      // 模拟同步延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connectionStatus.lastSync = new Date().toISOString();
      this.connectionStatus.health = 'healthy';
      
      return true;
    } catch (error) {
      this.connectionStatus.health = 'error';
      return false;
    }
  }
}

// 导出数据库实例
export const db = new MemoryDatabase();
export default db;