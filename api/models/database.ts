// 混合数据库模型和操作类（PostgreSQL + 内存备用模式）
import { Workstation, Employee, Department, User, AuditLog, DatabaseStatus } from '../../shared/types.js';
import dbManager from '../config/database.js';

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
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM workstations ORDER BY created_at DESC
        `);
        return result.rows.map(row => ({
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
      }
      return Array.from(this.memoryWorkstations.values());
    } catch (error) {
      console.error('获取工位失败:', error);
      return Array.from(this.memoryWorkstations.values());
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
      }
      
      this.memoryWorkstations.set(id, newWorkstation);
      await this.addAuditLog('CREATE', 'workstation', id, null, newWorkstation);
      return newWorkstation;
    } catch (error) {
      console.error('创建工位失败:', error);
      throw error;
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
    try {
      if (await this.isPostgreSQLAvailable()) {
        const result = await dbManager.query(`
          SELECT * FROM departments ORDER BY name
        `);
        return result.rows;
      }
      return Array.from(this.memoryDepartments.values());
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return Array.from(this.memoryDepartments.values());
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
}

// 创建全局数据库实例
const database = new HybridDatabase();

export default database;
export { HybridDatabase };