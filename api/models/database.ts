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
        location: { floor: 3, room: '301', seat: 'A01' },
        department: '开发部',
        status: 'active',
        specifications: { cpu: 'Intel i7', memory: '16GB', storage: '512GB SSD' },
        assignedUser: 'emp-001',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'ws-002',
        name: '测试部-工作站-001',
        ipAddress: '192.168.1.102',
        macAddress: '00:11:22:33:44:56',
        location: { floor: 3, room: '302', seat: 'B01' },
        department: '测试部',
        status: 'active',
        specifications: { cpu: 'Intel i5', memory: '8GB', storage: '256GB SSD' },
        assignedUser: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      }
    ];
    
    sampleWorkstations.forEach(ws => this.memoryWorkstations.set(ws.id, ws));
    
    // 更新总记录数
    this.updateMemoryTotalRecords();
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
      
      this.connectionStatus.totalRecords = parseInt(result[0]?.count || '0');
      this.connectionStatus.lastSync = new Date().toISOString();
    } catch (error) {
      console.error('更新记录数失败:', error);
    }
  }

  // 工作站操作
  async getWorkstations(): Promise<Workstation[]> {
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<any[]>(`
          SELECT 
            d.id, d.desk_number as name, d.status, d.equipment, d.notes,
            d.position_x as "xPosition", d.position_y as "yPosition", d.width, d.height,
            d.created_at as "createdAt", d.updated_at as "updatedAt",
            dept.name as department, ada.employee_id,
            CASE WHEN ada.employee_id IS NOT NULL THEN ada.employee_name ELSE NULL END as "assignedUser"
          FROM desks d
          LEFT JOIN departments dept ON d.department_id = dept.id
          LEFT JOIN active_desk_assignments ada ON d.id = ada.desk_id
          ORDER BY d.created_at DESC
        `);
        
        // 转换为前端期望的格式
        return result.map(row => ({
          id: row.id.toString(),
          name: row.name,
          ipAddress: '', // 从notes中提取或设为空
          macAddress: '',
          location: `Position (${row.xPosition || 0}, ${row.yPosition || 0})`,
          department: row.department || 'Unknown',
          status: row.status,
          specifications: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : (row.equipment || {}),
          assignedUser: row.assignedUser,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
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
      const result = await executeQuery<any[]>(`
        SELECT 
          d.id, d.desk_number as name, d.status, d.equipment, d.notes,
          d.position_x as "xPosition", d.position_y as "yPosition", d.width, d.height,
          d.created_at as "createdAt", d.updated_at as "updatedAt",
          dept.name as department, ada.employee_id,
          CASE WHEN ada.employee_id IS NOT NULL THEN ada.employee_name ELSE NULL END as "assignedUser"
        FROM desks d
        LEFT JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN active_desk_assignments ada ON d.id = ada.desk_id
        WHERE d.id = $1
      `, [id]);
      
      if (result.length === 0) return null;
      
      const row = result[0];
      return {
        id: row.id.toString(),
        name: row.name,
        ipAddress: '', // 从notes中提取或设为空
        macAddress: '',
        location: `Position (${row.xPosition || 0}, ${row.yPosition || 0})`,
        department: row.department || 'Unknown',
        status: row.status,
        specifications: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : (row.equipment || {}),
        assignedUser: row.assignedUser,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      console.error('获取工作站详情失败:', error);
      return null;
    }
  }

  async createWorkstation(workstation: Omit<Workstation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workstation> {
    const now = new Date();
    
    if (isUsingPostgreSQL()) {
      try {
        // 根据实际表结构创建工位
        const result = await executeQuery<any[]>(`
          INSERT INTO desks (
            desk_number, department_id, position_x, position_y, width, height, 
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
          location: workstation.location || '',
          department: workstation.department || '',
          status: result[0].status,
          specifications: workstation.specifications || {},
          assignedUser: null,
          createdAt: result[0].created_at,
          updatedAt: result[0].updated_at
        };
        
        // 记录审计日志
        await this.addAuditLog(null, 'CREATE', 'workstation', newWorkstation.id, workstation);
        await this.updateTotalRecords();
        
        return newWorkstation;
      } catch (error) {
        console.error('创建工作站失败:', error);
        throw error;
      }
    } else {
      // 内存模式
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newWorkstation: Workstation = {
        id,
        ...workstation,
        createdAt: now,
        updatedAt: now
      };
      
      this.memoryWorkstations.set(id, newWorkstation);
      this.updateMemoryTotalRecords();
      
      // 记录审计日志
      await this.addAuditLog(null, 'CREATE', 'workstation', id, workstation);
      
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
          setParts.push(`desk_number = $${paramIndex++}`);
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
            const employeeResult = await executeQuery<any[]>(`
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
          UPDATE desks 
          SET ${setParts.join(', ')}
          WHERE id = $${paramIndex}
        `, values);

        await this.addAuditLog(null, 'UPDATE', 'workstation', id, updates);
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
        await this.addAuditLog(null, 'UPDATE', 'workstation', id, updates);
        return updated;
      }
      return null;
    }
  }

  async deleteWorkstation(id: string): Promise<boolean> {
    try {
      const result = await executeQuery<{count: number}[]>(`
        DELETE FROM desks WHERE id = $1
      `, [id]);
      
      const deleted = result.length > 0;
      if (deleted) {
        await this.addAuditLog(null, 'DELETE', 'workstation', id, {});
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
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<Employee[]>(`
          SELECT 
            id, employee_id as "employeeId", name, email, phone, department_id as "departmentId", 
            position, status, hire_date as "hireDate", avatar_url as "avatarUrl",
            created_at as "createdAt", updated_at as "updatedAt"
          FROM employees 
          ORDER BY created_at DESC
        `);
        return result;
      } catch (error) {
        console.error('获取员工列表失败:', error);
        return [];
      }
    } else {
      return Array.from(this.memoryEmployees.values());
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    try {
      const result = await executeQuery<Employee[]>(`
        SELECT 
          id, employee_id as "employeeId", name, email, phone, department_id as "departmentId", 
          position, status, hire_date as "hireDate", avatar_url as "avatarUrl",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM employees 
        WHERE id = $1
      `, [id]);
      return result[0] || null;
    } catch (error) {
      console.error('获取员工详情失败:', error);
      return null;
    }
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const now = new Date();
    
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery<any[]>(`
          INSERT INTO employees (
            employee_id, name, email, phone, department, position, 
            workstation_id, status, permissions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          employee.employeeId,
          employee.name,
          employee.email,
          employee.phone,
          employee.department,
          employee.position,
          employee.workstationId,
          employee.status || 'active',
          employee.permissions || 'user'
        ]);
        
        const newEmployee = {
          id: result[0].id.toString(),
          employeeId: result[0].employee_id,
          name: result[0].name,
          email: result[0].email,
          phone: result[0].phone,
          department: result[0].department,
          position: result[0].position,
          workstationId: result[0].workstation_id,
          status: result[0].status,
          permissions: result[0].permissions,
          createdAt: result[0].created_at,
          updatedAt: result[0].updated_at
        };
        
        await this.addAuditLog(null, 'CREATE', 'employee', newEmployee.id, employee);
        await this.updateTotalRecords();
        
        return newEmployee;
      } catch (error) {
        console.error('创建员工失败:', error);
        throw error;
      }
    } else {
      // 内存模式
      const id = `emp-${Date.now()}`;
      const newEmployee: Employee = {
        id,
        ...employee,
        createdAt: now,
        updatedAt: now
      };
      
      this.memoryEmployees.set(id, newEmployee);
      this.updateMemoryTotalRecords();
      
      await this.addAuditLog(null, 'CREATE', 'employee', id, employee);
      
      return newEmployee;
    }
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    if (isUsingPostgreSQL()) {
      try {
        const setParts: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
          setParts.push(`name = $${paramIndex++}`);
          values.push(updates.name);
        }
        if (updates.email !== undefined) {
          setParts.push(`email = $${paramIndex++}`);
          values.push(updates.email);
        }
        if (updates.phone !== undefined) {
          setParts.push(`phone = $${paramIndex++}`);
          values.push(updates.phone);
        }
        if (updates.department !== undefined) {
          setParts.push(`department = $${paramIndex++}`);
          values.push(updates.department);
        }
        if (updates.position !== undefined) {
          setParts.push(`position = $${paramIndex++}`);
          values.push(updates.position);
        }
        if (updates.workstationId !== undefined) {
          setParts.push(`workstation_id = $${paramIndex++}`);
          values.push(updates.workstationId);
        }
        if (updates.status !== undefined) {
          setParts.push(`status = $${paramIndex++}`);
          values.push(updates.status);
        }
        if (updates.permissions !== undefined) {
          setParts.push(`permissions = $${paramIndex++}`);
          values.push(updates.permissions);
        }

        if (setParts.length === 0) {
          return await this.getEmployeeById(id);
        }

        setParts.push(`updated_at = $${paramIndex++}`);
        values.push(new Date());
        values.push(id);

        await executeQuery(`
          UPDATE employees 
          SET ${setParts.join(', ')}
          WHERE id = $${paramIndex}
        `, values);

        await this.addAuditLog(null, 'UPDATE', 'employee', id, updates);
        await this.updateTotalRecords();
        
        return await this.getEmployeeById(id);
      } catch (error) {
        console.error('更新员工失败:', error);
        return null;
      }
    } else {
      // 内存模式
      const existing = this.memoryEmployees.get(id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date() };
        this.memoryEmployees.set(id, updated);
        this.updateMemoryTotalRecords();
        await this.addAuditLog(null, 'UPDATE', 'employee', id, updates);
        return updated;
      }
      return null;
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    if (isUsingPostgreSQL()) {
      try {
        const result = await executeQuery(`
          DELETE FROM employees WHERE id = $1
        `, [id]);
        
        const deleted = result.rowCount > 0;
        if (deleted) {
          await this.addAuditLog(null, 'DELETE', 'employee', id, {});
          await this.updateTotalRecords();
        }
        return deleted;
      } catch (error) {
        console.error('删除员工失败:', error);
        return false;
      }
    } else {
      // 内存模式
      const deleted = this.memoryEmployees.delete(id);
      if (deleted) {
        this.updateMemoryTotalRecords();
        await this.addAuditLog(null, 'DELETE', 'employee', id, {});
      }
      return deleted;
    }
  }

  // 部门操作
  async getDepartments(): Promise<Department[]> {
    try {
      const result = await executeQuery<Department[]>(`
        SELECT 
          id, name, code, description, location, workstation_count as "workstationCount",
          employee_count as "employeeCount", created_at as "createdAt", updated_at as "updatedAt"
        FROM departments 
        ORDER BY created_at DESC
      `);
      return result;
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return [];
    }
  }

  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const result = await executeQuery<Department[]>(`
        SELECT 
          id, name, code, description, location, workstation_count as "workstationCount",
          employee_count as "employeeCount", created_at as "createdAt", updated_at as "updatedAt"
        FROM departments 
        WHERE id = $1
      `, [id]);
      return result[0] || null;
    } catch (error) {
      console.error('获取部门详情失败:', error);
      return null;
    }
  }

  // 搜索功能
  async search(query: string): Promise<{ employees: Employee[], workstations: Workstation[] }> {
    try {
      const employees = await executeQuery<Employee[]>(`
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

      const workstations = await executeQuery<Workstation[]>(`
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

      return { employees, workstations };
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
  private async addAuditLog(userId: string | null, action: string, resource: string, resourceId: string, details: any) {
    const id = `log-${Date.now()}`;
    const timestamp = new Date();
    
    if (isUsingPostgreSQL()) {
      try {
        await executeQuery(`
          INSERT INTO audit_logs (
            id, user_id, action, resource, resource_id, details, 
            ip_address, user_agent, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          id, userId, action, resource, resourceId, details,
          '127.0.0.1', 'Server', timestamp
        ]);
      } catch (error) {
        console.error('添加审计日志失败:', error);
      }
    } else {
      // 内存模式
      const auditLog: AuditLog = {
        id,
        userId,
        action,
        resource,
        resourceId,
        details,
        ipAddress: '127.0.0.1',
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
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    try {
      const result = await executeQuery<AuditLog[]>(`
        SELECT 
          id, user_id as "userId", action, resource, resource_id as "resourceId",
          details, ip_address as "ipAddress", user_agent as "userAgent", timestamp
        FROM audit_logs 
        ORDER BY timestamp DESC 
        LIMIT $1
      `, [limit]);
      return result;
    } catch (error) {
      console.error('获取审计日志失败:', error);
      return [];
    }
  }

  // 数据同步（检查数据库连接）
  async syncData(): Promise<boolean> {
    try {
      await executeQuery('SELECT 1');
      this.connectionStatus.lastSync = new Date().toISOString();
      this.connectionStatus.health = 'healthy';
      return true;
    } catch (error) {
      console.error('数据同步失败:', error);
      this.connectionStatus.health = 'error';
      return false;
    }
  }
}

// 创建并导出数据库实例
const db = new HybridDatabase();
export default db;