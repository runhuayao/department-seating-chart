// 混合数据库模型和操作类（PostgreSQL + 内存备用模式）
import { Workstation, Employee, Department, User, AuditLog, DatabaseStatus } from '../../shared/types.js';
import dbManager from '../config/database.js';
import cacheService from '../services/cache.js';

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

  // 检查PostgreSQL是否可用
  private async isPostgreSQLAvailable(): Promise<boolean> {
    try {
      await dbManager.testConnection();
      return true;
    } catch (error) {
      console.warn('PostgreSQL不可用，使用内存数据库:', error);
      return false;
    }
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
      }
    ];

    // 初始化内存存储
    sampleWorkstations.forEach(ws => {
      this.memoryWorkstations.set(ws.id, ws);
    });
  }

  // 获取工位总数
  async getWorkstationCount(): Promise<number> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`SELECT COUNT(*) as count FROM workstations`);
        return parseInt(result.rows[0].count);
      }
      return this.memoryWorkstations.size;
    } catch (error) {
      console.error('获取工位总数失败:', error);
      return this.memoryWorkstations.size;
    }
  }

  // 获取所有工位
  async getWorkstations(): Promise<Workstation[]> {
    const cacheKey = 'workstations:all';
    
    // 尝试从缓存获取
    const cached = await cacheService.get<Workstation[]>(cacheKey);
    if (cached) {
      console.log('从Redis缓存获取工位数据');
      return cached;
    }

    try {
      let workstations: Workstation[];
      
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM workstations ORDER BY created_at DESC
        `);
        workstations = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          ipAddress: row.ip_address,
          macAddress: row.mac_address,
          location: row.location,
          department: row.department,
          status: row.status,
          specifications: row.specifications,
          assignedUser: row.assigned_user,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
      } else {
        workstations = Array.from(this.memoryWorkstations.values());
      }

      // 缓存结果
      await cacheService.set(cacheKey, workstations, 300); // 缓存5分钟
      return workstations;
    } catch (error) {
      console.error('获取工位失败:', error);
      return Array.from(this.memoryWorkstations.values());
    }
  }

  // 根据ID获取工位
  async getWorkstationById(id: string): Promise<Workstation | null> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM workstations WHERE id = $1
        `, [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
          id: row.id,
          name: row.name,
          ipAddress: row.ip_address,
          macAddress: row.mac_address,
          location: row.location,
          department: row.department,
          status: row.status,
          specifications: row.specifications,
          assignedUser: row.assigned_user,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };
      }
      return this.memoryWorkstations.get(id) || null;
    } catch (error) {
      console.error('获取工位详情失败:', error);
      return this.memoryWorkstations.get(id) || null;
    }
  }

  // 创建工位
  async createWorkstation(workstation: Omit<Workstation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workstation> {
    const id = `ws-${Date.now()}`;
    const now = new Date();
    const newWorkstation: Workstation = {
      ...workstation,
      id,
      createdAt: now,
      updatedAt: now
    };

    try {
      if (await this.isPostgreSQLAvailable()) {
        // 插入到workstations表
        try {
          await dbManager.query(`
            INSERT INTO workstations (id, name, ip_address, mac_address, location, department, status, specifications, assigned_user, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            newWorkstation.id,
            newWorkstation.name,
            newWorkstation.ipAddress,
            newWorkstation.macAddress,
            JSON.stringify(newWorkstation.location),
            newWorkstation.department,
            newWorkstation.status,
            JSON.stringify(newWorkstation.specifications),
            newWorkstation.assignedUser,
            newWorkstation.createdAt,
            newWorkstation.updatedAt
          ]);
          console.log('工位已成功插入PostgreSQL数据库:', newWorkstation.id);
        } catch (dbError: any) {
          console.warn('PostgreSQL插入失败，使用内存模式:', dbError.message);
        }
      }
      
      this.memoryWorkstations.set(id, newWorkstation);
      await this.addAuditLog('CREATE', 'workstation', id, null, newWorkstation);
      
      // 清除相关缓存
      await cacheService.del('workstations:all');
      await cacheService.del('departments:all'); // 清除部门缓存，因为工位数量可能变化
      
      return newWorkstation;
    } catch (error) {
      console.error('创建工位失败:', error);
      throw error;
    }
  }

  // 更新工位
  async updateWorkstation(id: string, updates: Partial<Workstation>): Promise<Workstation | null> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const setParts: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
          setParts.push(`name = $${paramIndex++}`);
          values.push(updates.name);
        }
        if (updates.ipAddress !== undefined) {
          setParts.push(`ip_address = $${paramIndex++}`);
          values.push(updates.ipAddress);
        }
        if (updates.macAddress !== undefined) {
          setParts.push(`mac_address = $${paramIndex++}`);
          values.push(updates.macAddress);
        }
        if (updates.location !== undefined) {
          setParts.push(`location = $${paramIndex++}`);
          values.push(JSON.stringify(updates.location));
        }
        if (updates.department !== undefined) {
          setParts.push(`department = $${paramIndex++}`);
          values.push(updates.department);
        }
        if (updates.status !== undefined) {
          setParts.push(`status = $${paramIndex++}`);
          values.push(updates.status);
        }
        if (updates.specifications !== undefined) {
          setParts.push(`specifications = $${paramIndex++}`);
          values.push(JSON.stringify(updates.specifications));
        }
        if (updates.assignedUser !== undefined) {
          setParts.push(`assigned_user = $${paramIndex++}`);
          values.push(updates.assignedUser);
        }

        if (setParts.length === 0) {
          return await this.getWorkstationById(id);
        }

        setParts.push(`updated_at = $${paramIndex++}`);
        values.push(new Date());
        values.push(id);

        await dbManager.query(`
          UPDATE workstations 
          SET ${setParts.join(', ')}
          WHERE id = $${paramIndex}
        `, values);

        await this.addAuditLog('UPDATE', 'workstation', id, null, updates);
        return await this.getWorkstationById(id);
      } else {
        // 内存模式
        const existing = this.memoryWorkstations.get(id);
        if (existing) {
          const updated = { ...existing, ...updates, updatedAt: new Date() };
          this.memoryWorkstations.set(id, updated);
          await this.addAuditLog('UPDATE', 'workstation', id, existing, updates);
          return updated;
        }
        return null;
      }
    } catch (error) {
      console.error('更新工位失败:', error);
      return null;
    }
  }

  // 删除工位
  async deleteWorkstation(id: string): Promise<boolean> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          DELETE FROM workstations WHERE id = $1
        `, [id]);
        
        const deleted = result.rowCount > 0;
        if (deleted) {
          await this.addAuditLog('DELETE', 'workstation', id, null, {});
        }
        return deleted;
      } else {
        // 内存模式
        const deleted = this.memoryWorkstations.delete(id);
        if (deleted) {
          await this.addAuditLog('DELETE', 'workstation', id, null, {});
        }
        return deleted;
      }
    } catch (error) {
      console.error('删除工位失败:', error);
      return false;
    }
  }

  // 获取数据库状态
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query('SELECT 1');
        return {
          connected: true,
          tables: 5,
          totalRecords: await this.getWorkstationCount(),
          lastSync: new Date().toISOString(),
          health: 'healthy'
        };
      }
      return this.connectionStatus;
    } catch (error) {
      console.error('获取数据库状态失败:', error);
      return {
        connected: false,
        tables: 0,
        totalRecords: 0,
        lastSync: new Date().toISOString(),
        health: 'error'
      };
    }
  }

  // 添加审计日志
  async addAuditLog(action: string, table: string, recordId: string, oldData: any, newData: any): Promise<void> {
    const auditLog: AuditLog = {
      id: `audit-${Date.now()}`,
      action,
      table,
      recordId,
      oldData,
      newData,
      timestamp: new Date(),
      userId: 'system'
    };

    try {
      if (await this.isPostgreSQLAvailable()) {
        await dbManager.query(`
          INSERT INTO audit_logs (id, action, table_name, record_id, old_data, new_data, timestamp, user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          auditLog.id,
          auditLog.action,
          auditLog.table,
          auditLog.recordId,
          JSON.stringify(auditLog.oldData),
          JSON.stringify(auditLog.newData),
          auditLog.timestamp,
          auditLog.userId
        ]);
      }
      
      this.memoryAuditLogs.push(auditLog);
    } catch (error) {
      console.error('添加审计日志失败:', error);
    }
  }

  // 获取部门列表
  async getDepartments(): Promise<Department[]> {
    const cacheKey = 'departments:all';
    
    // 尝试从缓存获取
    const cached = await cacheService.get<Department[]>(cacheKey);
    if (cached) {
      console.log('从Redis缓存获取部门数据');
      return cached;
    }

    try {
      let departments: Department[];
      
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM departments ORDER BY id ASC
        `);
        departments = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          displayName: row.display_name,
          description: row.description,
          floor: row.floor,
          totalDesks: row.total_desks || 0,
          occupiedDesks: row.occupied_desks || 0,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
      } else {
        // 内存模式返回默认部门数据
        departments = [
          { 
            id: '1', 
            name: 'Engineering', 
            displayName: '工程部',
            description: '负责产品开发和技术创新',
            floor: 3,
            totalDesks: 20,
            occupiedDesks: 15,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          { 
            id: '2', 
            name: 'Marketing', 
            displayName: '市场部',
            description: '负责市场推广和品牌建设',
            floor: 2,
            totalDesks: 12,
            occupiedDesks: 10,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          { 
            id: '3', 
            name: 'Sales', 
            displayName: '销售部',
            description: '负责销售业务和客户关系',
            floor: 2,
            totalDesks: 15,
            occupiedDesks: 12,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          { 
            id: '4', 
            name: 'HR', 
            displayName: '人力资源部',
            description: '负责人力资源管理和企业文化',
            floor: 1,
            totalDesks: 8,
            occupiedDesks: 6,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
      }

      // 缓存结果
      await cacheService.set(cacheKey, departments, 600); // 缓存10分钟
      return departments;
    } catch (error) {
      console.error('获取部门列表失败:', error);
      // 返回默认部门数据作为降级方案
      return [
        { 
          id: '1', 
          name: 'Engineering', 
          displayName: '工程部',
          description: '负责产品开发和技术创新',
          floor: 3,
          totalDesks: 20,
          occupiedDesks: 15,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: '2', 
          name: 'Marketing', 
          displayName: '市场部',
          description: '负责市场推广和品牌建设',
          floor: 2,
          totalDesks: 12,
          occupiedDesks: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: '3', 
          name: 'Sales', 
          displayName: '销售部',
          description: '负责销售业务和客户关系',
          floor: 2,
          totalDesks: 15,
          occupiedDesks: 12,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: '4', 
          name: 'HR', 
          displayName: '人力资源部',
          description: '负责人力资源管理和企业文化',
          floor: 1,
          totalDesks: 8,
          occupiedDesks: 6,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }
  }

  // 根据ID获取部门
  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM departments WHERE id = $1
        `, [id]);
        return result.rows[0] || null;
      }
      return this.memoryDepartments.get(id) || null;
    } catch (error) {
      console.error('获取部门失败:', error);
      return this.memoryDepartments.get(id) || null;
    }
  }

  // 获取员工列表
  async getEmployees(): Promise<Employee[]> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM employees ORDER BY created_at DESC
        `);
        return result.rows.map(row => ({
          id: row.id,
          employeeId: row.employee_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          position: row.position,
          workstationId: row.workstation_id,
          status: row.status,
          permissions: row.permissions,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
      }
      return Array.from(this.memoryEmployees.values());
    } catch (error) {
      console.error('获取员工列表失败:', error);
      return Array.from(this.memoryEmployees.values());
    }
  }

  // 根据ID获取员工
  async getEmployeeById(id: string): Promise<Employee | null> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM employees WHERE id = $1
        `, [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
          id: row.id,
          employeeId: row.employee_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          position: row.position,
          workstationId: row.workstation_id,
          status: row.status,
          permissions: row.permissions,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };
      }
      return this.memoryEmployees.get(id) || null;
    } catch (error) {
      console.error('获取员工详情失败:', error);
      return this.memoryEmployees.get(id) || null;
    }
  }

  // 更新员工
  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    try {
      if (await this.isPostgreSQLAvailable()) {
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

        await dbManager.query(`
          UPDATE employees 
          SET ${setParts.join(', ')}
          WHERE id = $${paramIndex}
        `, values);

        await this.addAuditLog('UPDATE', 'employee', id, null, updates);
        return await this.getEmployeeById(id);
      } else {
        // 内存模式
        const existing = this.memoryEmployees.get(id);
        if (existing) {
          const updated = { ...existing, ...updates, updatedAt: new Date() };
          this.memoryEmployees.set(id, updated);
          await this.addAuditLog('UPDATE', 'employee', id, existing, updates);
          return updated;
        }
        return null;
      }
    } catch (error) {
      console.error('更新员工失败:', error);
      return null;
    }
  }

  // 删除员工
  async deleteEmployee(id: string): Promise<boolean> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          DELETE FROM employees WHERE id = $1
        `, [id]);
        
        const deleted = result.rowCount > 0;
        if (deleted) {
          await this.addAuditLog('DELETE', 'employee', id, null, {});
        }
        return deleted;
      } else {
        // 内存模式
        const deleted = this.memoryEmployees.delete(id);
        if (deleted) {
          await this.addAuditLog('DELETE', 'employee', id, null, {});
        }
        return deleted;
      }
    } catch (error) {
      console.error('删除员工失败:', error);
      return false;
    }
  }

  // 获取数据库状态
  async getStatus(): Promise<DatabaseStatus> {
    return await this.getDatabaseStatus();
  }

  // 数据同步
  async syncData(): Promise<boolean> {
    try {
      if (await this.isPostgreSQLAvailable()) {
        await dbManager.query('SELECT 1');
        return true;
      }
      return false;
    } catch (error) {
      console.error('数据同步失败:', error);
      return false;
    }
  }
}

// 创建全局数据库实例
const database = new HybridDatabase();

export default database;
export { HybridDatabase };