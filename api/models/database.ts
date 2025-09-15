// 混合数据库模型和操作类（PostgreSQL + 内存备用模式）
import { Workstation, Employee, Department, User, AuditLog, DatabaseStatus } from '../../shared/types.js';
import { pool, executeQuery, executeTransaction, isUsingPostgreSQL } from '../config/database.js';

// 混合数据库类（PostgreSQL + 内存备用模式）
class HybridDatabase {
  private connectionStatus: DatabaseStatus;
  
  // 内存数据库备用存储
  private memoryWorkstations: Map<string, Workstation> = new Map();
  private memoryEmployees: Map<string, Employee> = new Map();
  private memoryDepartments: Map<string, Department> = new Map();
  private memoryAuditLogs: AuditLog[] = [];

  constructor() {
    this.connectionStatus = {
      connected: true,
      tables: 5,
      totalRecords: 0,
      lastSync: new Date().toISOString(),
      health: 'healthy'
    };
    
    // 初始化内存数据
    this.initializeMemoryData();
  }
  
  // 初始化内存数据
  private initializeMemoryData() {
    // 添加示例工作站数据
    const sampleWorkstations: Workstation[] = [
      {
        id: 'ws-001',
        name: '开发部-工作站-001',
        ipAddress: '192.168.1.101',
        macAddress: '00:11:22:33:44:55',
        location: {
          building: 'Building A',
          floor: 3,
          room: '301',
          position: { x: 100, y: 100 }
        },
        department: '开发部',
        status: 'online',
        specifications: { cpu: 'Intel i7', memory: '16GB', storage: '512GB SSD', os: 'Windows 11' },
        assignedUser: 'emp-001',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'ws-002',
        name: '测试部-工作站-001',
        ipAddress: '192.168.1.102',
        macAddress: '00:11:22:33:44:56',
        location: {
          building: 'Building A',
          floor: 3,
          room: '302',
          position: { x: 150, y: 100 }
        },
        department: '测试部',
        status: 'online',
        specifications: { cpu: 'Intel i5', memory: '8GB', storage: '256GB SSD', os: 'Windows 10' },
        assignedUser: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      }
    ];
    
    sampleWorkstations.forEach(ws => this.memoryWorkstations.set(ws.id, ws));
    
    // 更新总记录数
    this.updateMemoryTotalRecords();
  }
  
  // 生成唯一ID
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // 更新内存模式总记录数
  private updateMemoryTotalRecords() {
    this.connectionStatus.totalRecords = 
      this.memoryWorkstations.size + 
      this.memoryEmployees.size + 
      this.memoryDepartments.size + 
      this.memoryAuditLogs.length;
    this.connectionStatus.lastSync = new Date().toISOString();
  }

  // 更新总记录数（从数据库获取）
  private async updateTotalRecords() {
    try {
      const result = await executeQuery<{count: string}[]>(`
        SELECT 
          (SELECT COUNT(*) FROM workstations) +
          (SELECT COUNT(*) FROM employees) +
          (SELECT COUNT(*) FROM departments) +
          (SELECT COUNT(*) FROM users) +
          (SELECT COUNT(*) FROM audit_logs) as count
      `);
      
      this.connectionStatus.totalRecords = parseInt((result[0] as any)?.count || '0');
      this.connectionStatus.lastSync = new Date().toISOString();
    } catch (error) {
      console.error('更新记录数失败:', error);
    }
  }

  // 工作站操作
  async getWorkstations(): Promise<Workstation[]> {
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<any>(`
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
        `);
        
        // 转换为前端期望的格式
        return result.map((row: any) => ({
          id: row.id.toString(),
          name: row.name,
          ipAddress: '', // 从notes中提取或设为空
          macAddress: '',
          location: {
            building: row.building || 'Building A',
            floor: row.floor_number || 3,
            room: '301',
            position: { x: row.x_position || 100, y: row.y_position || 100 }
          },
          department: row.department_name || row.building,
          status: row.status,
          specifications: row.equipment ? JSON.parse(row.equipment) : { cpu: '', memory: '', storage: '', os: '' },
          assignedUser: row.employee_name,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      } catch (error) {
        console.error('获取工作站列表失败:', error);
        return [];
      }
    } else {
      // 内存模式
      return Array.from(this.memoryWorkstations.values());
    }
  }

  async getWorkstationById(id: string): Promise<Workstation | null> {
    try {
      const result = await executeQuery<any>(`
        SELECT 
          w.id, w.name, w.status, w.equipment, w.notes, w.floor_number, w.building,
          w.x_position, w.y_position, w.width, w.height,
          w.created_at, w.updated_at, w.department_id, w.employee_id,
          d.name as department_name,
          e.name as employee_name
        FROM workstations w
        LEFT JOIN departments d ON w.department_id = d.id
        LEFT JOIN employees e ON w.employee_id = e.id
        WHERE w.id = $1
      `, [id]);
      
      if (result.length === 0) return null;
      
      const row = result[0] as any;
      return {
        id: row.id.toString(),
        name: row.name,
        ipAddress: '', // 从notes中提取或设为空
        macAddress: '',
        location: {
          building: row.building || 'Building A',
          floor: row.floor_number || 3,
          room: '301',
          position: { x: row.x_position || 100, y: row.y_position || 100 }
        },
        department: row.department_name || row.building,
        status: row.status,
        specifications: row.equipment ? JSON.parse(row.equipment) : {},
        assignedUser: row.employee_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('获取工作站详情失败:', error);
      return null;
    }
  }

  async createWorkstation(workstation: Omit<Workstation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workstation> {
    const now = new Date();
    const id = Date.now().toString();
    
    if (isUsingPostgreSQL()) {
      try {
        // 根据实际表结构创建工位
        const result = await executeQuery<any>(`
          INSERT INTO workstations (
            name, department_id, x_position, y_position, width, height, 
            status, equipment, notes, floor_number, building
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          workstation.name,
          1, // 默认部门ID，可以根据department名称查找
          Math.random() * 800 + 100, // 随机x位置
          Math.random() * 600 + 100, // 随机y位置
          120, // 默认宽度
          80,  // 默认高度
          workstation.status || 'available',
          workstation.specifications ? JSON.stringify(workstation.specifications) : null,
          `Location: ${workstation.location || ''}, IP: ${workstation.ipAddress || ''}`,
          3, // 默认楼层
          workstation.department || 'Building A'
        ]);
        
        // 转换为前端期望的格式
        const newWorkstation = {
          id: result[0].id.toString(),
          name: result[0].name,
          ipAddress: workstation.ipAddress || '',
          macAddress: workstation.macAddress || '',
          location: {
            building: workstation.department || 'Building A',
            floor: 3,
            room: '301',
            position: { x: result[0].x_position || 100, y: result[0].y_position || 100 }
          },
          department: workstation.department || '',
          status: result[0].status,
          specifications: workstation.specifications || { cpu: '', memory: '', storage: '', os: '' },
          assignedUser: null,
          createdAt: result[0].created_at,
          updatedAt: result[0].updated_at
        };
        
        // 记录审计日志
        await this.addAuditLog({
          user_id: null,
          action: 'CREATE',
          table_name: 'workstation',
          record_id: newWorkstation.id,
          old_values: null,
          new_values: workstation,
          ip_address: '127.0.0.1'
        });
        await this.updateTotalRecords();
        
        return newWorkstation;
      } catch (error) {
        console.error('创建工作站失败:', error);
        throw error;
      }
    } else {
      // 内存模式
      const newWorkstation: Workstation = {
        id,
        ...workstation,
        createdAt: now,
        updatedAt: now
      };
      
      this.memoryWorkstations.set(id, newWorkstation);
      this.updateMemoryTotalRecords();
      
      // 记录审计日志
      await this.addAuditLog({
        user_id: null,
        action: 'CREATE',
        table_name: 'workstation',
        record_id: id,
        old_values: null,
        new_values: workstation,
        ip_address: '127.0.0.1'
      });
      
      return newWorkstation;
    }
  }

  async updateWorkstation(id: string, updates: Partial<Workstation>): Promise<Workstation | null> {
    if (isUsingPostgreSQL()) {
      try {
        const setParts: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
          setParts.push(`name = $${paramIndex++}`);
          values.push(updates.name);
        }
        if (updates.status !== undefined) {
          setParts.push(`status = $${paramIndex++}`);
          values.push(updates.status);
        }
        if (updates.specifications !== undefined) {
          setParts.push(`equipment = $${paramIndex++}`);
          values.push(JSON.stringify(updates.specifications));
        }
        if (updates.location !== undefined) {
          // 解析location字符串，提取floor和building信息
          const locationMatch = updates.location.toString().match(/Floor (\d+), (.+)/);
          if (locationMatch) {
            setParts.push(`floor_number = $${paramIndex++}`);
            values.push(parseInt(locationMatch[1]));
            setParts.push(`building = $${paramIndex++}`);
            values.push(locationMatch[2]);
          }
        }
        if (updates.assignedUser !== undefined) {
          // 需要根据员工姓名查找employee_id
          if (updates.assignedUser) {
            const employeeResult = await executeQuery<any>(`
              SELECT id FROM employees WHERE name = $1
            `, [updates.assignedUser]);
            if (employeeResult.length > 0) {
              setParts.push(`employee_id = $${paramIndex++}`);
              values.push(employeeResult[0].id);
            }
          } else {
            setParts.push(`employee_id = $${paramIndex++}`);
            values.push(null);
          }
        }

        if (setParts.length === 0) {
          return await this.getWorkstationById(id);
        }

        setParts.push(`updated_at = $${paramIndex++}`);
        values.push(new Date());
        values.push(id);

        const result = await executeQuery(`
          UPDATE workstations 
          SET ${setParts.join(', ')}
          WHERE id = $${paramIndex}
        `, values);

        await this.addAuditLog({
          user_id: null,
          action: 'UPDATE',
          table_name: 'workstation',
          record_id: id,
          old_values: null,
          new_values: updates,
          ip_address: '127.0.0.1'
        });
        await this.updateTotalRecords();
        
        return await this.getWorkstationById(id);
      } catch (error) {
        console.error('更新工作站失败:', error);
        return null;
      }
    } else {
      // 内存模式
      const existing = this.memoryWorkstations.get(id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date() };
        this.memoryWorkstations.set(id, updated);
        this.updateMemoryTotalRecords();
        await this.addAuditLog({
          user_id: null,
          action: 'UPDATE',
          table_name: 'workstation',
          record_id: id,
          old_values: null,
          new_values: updates,
          ip_address: '127.0.0.1'
        });
        return updated;
      }
      return null;
    }
  }

  async deleteWorkstation(id: string): Promise<boolean> {
    try {
      const result = await executeQuery<any>(`
        DELETE FROM workstations WHERE id = $1
      `, [id]);
      
      const deleted = result.length > 0;
      if (deleted) {
        await this.addAuditLog({
          user_id: null,
          action: 'DELETE',
          table_name: 'workstation',
          record_id: id,
          old_values: null,
          new_values: {},
          ip_address: '127.0.0.1'
        });
        await this.updateTotalRecords();
      }
      return deleted;
    } catch (error) {
      console.error('删除工作站失败:', error);
      return false;
    }
  }

  // 员工操作
  async getEmployees(): Promise<Employee[]> {
    try {
      const result = await executeQuery<Employee>(`
        SELECT 
          id, employee_id as "employeeId", name, email, phone, department, 
          position, workstation_id as "workstationId", status, permissions,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM employees 
        ORDER BY created_at DESC
      `);
      return result;
    } catch (error) {
      console.error('获取员工列表失败:', error);
      return [];
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    try {
      const result = await executeQuery<Employee>(`
        SELECT 
          id, employee_id as "employeeId", name, email, phone, department, 
          position, workstation_id as "workstationId", status, permissions,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM employees 
        WHERE id = $1
      `, [id]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('获取员工详情失败:', error);
      return null;
    }
  }

  // 部门操作
  async getDepartments(): Promise<Department[]> {
    try {
      const result = await executeQuery<any>(`
        SELECT 
          id, name, code, description, location, workstation_count as "workstationCount",
          employee_count as "employeeCount", created_at as "createdAt", updated_at as "updatedAt"
        FROM departments 
        ORDER BY created_at DESC
      `);
      return result.map(row => ({
        id: row.id.toString(),
        name: row.name,
        code: row.code || row.name.toUpperCase(),
        description: row.description,
        managerId: row.manager_id?.toString(),
        parentDepartmentId: row.parent_department_id?.toString(),
        location: {
          building: row.building || 'Building A',
          floor: row.floor || 3,
          area: row.area || 'Area A'
        },
        workstationCount: parseInt(row.workstation_count) || 0,
        employeeCount: parseInt(row.employee_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return [];
    }
  }

  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const result = await executeQuery<any>(`
        SELECT 
          id, name, code, description, location, workstation_count as "workstationCount",
          employee_count as "employeeCount", created_at as "createdAt", updated_at as "updatedAt"
        FROM departments 
        WHERE id = $1
      `, [id]);
      
      if (result.length === 0) return null;
      
      const row = result[0] as any;
      return {
        id: row.id.toString(),
        name: row.name,
        code: row.code || row.name.toUpperCase(),
        description: row.description,
        managerId: row.manager_id?.toString(),
        parentDepartmentId: row.parent_department_id?.toString(),
        location: {
          building: row.building || 'Building A',
          floor: row.floor || 3,
          area: row.area || 'Area A'
        },
        workstationCount: parseInt(row.workstation_count) || 0,
        employeeCount: parseInt(row.employee_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('获取部门详情失败:', error);
      return null;
    }
  }

  // 搜索功能
  async search(query: string): Promise<{ employees: Employee[], workstations: Workstation[] }> {
    try {
      const employeesResult = await executeQuery<Employee>(`
        SELECT 
          id, employee_id as "employeeId", name, email, phone, department, 
          position, workstation_id as "workstationId", status, permissions,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM employees 
        WHERE 
          LOWER(name) LIKE LOWER($1) OR
          LOWER(employee_id) LIKE LOWER($1) OR
          LOWER(email) LIKE LOWER($1) OR
          LOWER(department) LIKE LOWER($1)
      `, [`%${query}%`]);

      const workstationsResult = await executeQuery<Workstation>(`
        SELECT 
          id, name, ip_address as "ipAddress", mac_address as "macAddress",
          location, department, status, specifications, assigned_user as "assignedUser",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM workstations 
        WHERE 
          LOWER(name) LIKE LOWER($1) OR
          ip_address LIKE $1 OR
          LOWER(department) LIKE LOWER($1) OR
          LOWER(location->>'room') LIKE LOWER($1)
      `, [`%${query}%`]);

      return { employees: employeesResult, workstations: workstationsResult };
    } catch (error) {
      console.error('搜索失败:', error);
      return { employees: [], workstations: [] };
    }
  }

  // 获取数据库状态
  async getStatus(): Promise<DatabaseStatus> {
    if (isUsingPostgreSQL()) {
      try {
        await this.updateTotalRecords();
        
        // 检查数据库连接状态
        const healthCheck = await executeQuery('SELECT 1');
        this.connectionStatus.connected = true;
        this.connectionStatus.health = 'healthy';
        
        return { ...this.connectionStatus };
      } catch (error) {
        console.error('获取数据库状态失败:', error);
        this.connectionStatus.connected = false;
        this.connectionStatus.health = 'error';
        return { ...this.connectionStatus };
      }
    } else {
      // 内存模式
      this.updateMemoryTotalRecords();
      return {
        ...this.connectionStatus,
        health: 'healthy'
      };
    }
  }

  // 添加审计日志
  async addAuditLog(logData: {
    user_id: string | null;
    action: string;
    table_name: string;
    record_id: string | null;
    old_values: any;
    new_values: any;
    ip_address: string;
  }) {
    const { user_id, action, table_name, record_id, old_values, new_values, ip_address } = logData;
    const id = `log-${Date.now()}`;
    const timestamp = new Date();
    
    if (isUsingPostgreSQL()) {
      try {
        await executeQuery(`
          INSERT INTO audit_logs (
            id, user_id, action, table_name, record_id, old_values, new_values,
            ip_address, user_agent, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          id, user_id, action, table_name, record_id, 
          old_values ? JSON.stringify(old_values) : null,
          new_values ? JSON.stringify(new_values) : null,
          ip_address, 'Server', timestamp
        ]);
      } catch (error) {
        console.error('添加审计日志失败:', error);
      }
    } else {
      // 内存模式
      const auditLog: AuditLog = {
        id,
        userId: user_id,
        action,
        resource: table_name,
        resourceId: record_id,
        details: { old_values, new_values },
        ipAddress: ip_address,
        userAgent: 'Server',
        timestamp
      };
      
      this.memoryAuditLogs.push(auditLog);
      this.updateMemoryTotalRecords();
      
      // 保持最近1000条记录
      if (this.memoryAuditLogs.length > 1000) {
        this.memoryAuditLogs = this.memoryAuditLogs.slice(-1000);
      }
    }
  }

  // 获取审计日志
  async getAuditLogs(options: {
    limit?: number;
    offset?: number;
    table_name?: string;
    action?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  } = {}) {
    const { limit = 50, offset = 0, table_name, action, user_id, start_date, end_date } = options;
    
    // 模拟审计日志数据
    const mockLogs = [
      {
        id: 1,
        user_id: 1,
        action: 'create',
        table_name: 'workstations',
        record_id: 1,
        old_values: null,
        new_values: { name: 'WS-001', ip_address: '192.168.1.100' },
        ip_address: '192.168.1.50',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        user_id: 1,
        action: 'update',
        table_name: 'employees',
        record_id: 1,
        old_values: { status: 'inactive' },
        new_values: { status: 'active' },
        ip_address: '192.168.1.50',
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    
    let filteredLogs = [...mockLogs];
    
    if (table_name) {
      filteredLogs = filteredLogs.filter(log => log.table_name === table_name);
    }
    
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    
    if (user_id) {
      filteredLogs = filteredLogs.filter(log => log.user_id === parseInt(user_id));
    }
    
    return filteredLogs.slice(offset, offset + limit);
  }

  // 创建员工
  async createEmployee(employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = this.generateId();
    const now = new Date();
    const employee: Employee = {
      id,
      ...employeeData,
      createdAt: now,
      updatedAt: now
    };

    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<Employee>(`
          INSERT INTO employees (id, name, department_id, position, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          employee.id,
          employee.name,
          employee.department,
          employee.position,
          employee.status,
          employee.createdAt,
          employee.updatedAt
        ]);
        
        return result[0];
      } catch (error) {
        console.error('创建员工失败:', error);
        throw error;
      }
    } else {
      // 内存模式
      this.memoryEmployees.set(id, employee);
      this.updateMemoryTotalRecords();
      return employee;
    }
  }

  // 更新员工信息
  async updateEmployee(id: string, employeeData: Partial<Employee>): Promise<Employee | null> {
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<Employee>(`
          UPDATE employees SET 
            name = COALESCE($2, name),
            department_id = COALESCE($3, department_id),
            position = COALESCE($4, position),
            status = COALESCE($5, status),
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [
          id,
          employeeData.name,
          employeeData.department,
          employeeData.position,
          employeeData.status
        ]);
        
        return result.length > 0 ? result[0] : null;
      } catch (error) {
        console.error('更新员工失败:', error);
        return null;
      }
    } else {
      // 内存模式
      const existing = this.memoryEmployees.get(id);
      if (existing) {
        const updated = { ...existing, ...employeeData, updatedAt: new Date() };
        this.memoryEmployees.set(id, updated);
        this.updateMemoryTotalRecords();
        return updated;
      }
      return null;
    }
  }

  // 删除员工
  async deleteEmployee(id: string): Promise<boolean> {
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery(`DELETE FROM employees WHERE id = $1`, [id]);
        return true;
      } catch (error) {
        console.error('删除员工失败:', error);
        return false;
      }
    } else {
      // 内存模式
      const deleted = this.memoryEmployees.delete(id);
      if (deleted) {
        this.updateMemoryTotalRecords();
      }
      return deleted;
    }
  }



  // 数据同步方法
  async syncData() {
    try {
      // 模拟数据同步过程
      const syncResult = {
        workstations: {
          checked: this.memoryWorkstations.size,
          synced: this.memoryWorkstations.size,
          errors: 0
        },
        employees: {
          checked: this.memoryEmployees.size,
          synced: this.memoryEmployees.size,
          errors: 0
        },
        departments: {
          checked: this.memoryDepartments.size,
          synced: this.memoryDepartments.size,
          errors: 0
        },
        timestamp: new Date().toISOString(),
        duration: Math.floor(Math.random() * 1000) + 500 // 模拟同步耗时
      };
      
      return syncResult;
    } catch (error) {
      throw new Error('数据同步失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }

  // 检查数据完整性
  async checkDataIntegrity() {
    const issues = [];
    
    // 检查员工部门关联
    const orphanedEmployees = Array.from(this.memoryEmployees.values()).filter(emp => 
      !Array.from(this.memoryDepartments.values()).some(dept => dept.id === emp.department)
    );
    
    if (orphanedEmployees.length > 0) {
      issues.push({
        type: 'orphaned_employees',
        count: orphanedEmployees.length,
        description: '存在没有对应部门的员工'
      });
    }
    
    // 检查工作站员工关联
    const orphanedWorkstations = Array.from(this.memoryWorkstations.values()).filter(ws => 
      ws.assignedUser && !Array.from(this.memoryEmployees.values()).some(emp => emp.name === ws.assignedUser)
    );
    
    if (orphanedWorkstations.length > 0) {
      issues.push({
        type: 'orphaned_workstations',
        count: orphanedWorkstations.length,
        description: '存在分配给不存在员工的工作站'
      });
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      checkedAt: new Date().toISOString()
    };
  }


}

// 创建并导出数据库实例
const db = new HybridDatabase();
export default db;