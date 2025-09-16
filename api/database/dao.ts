/**
 * 数据访问层 (Data Access Object)
 * 封装所有数据库操作
 */
import { db, executeQuery } from './memory.js';
import {
  Department,
  Employee,
  Desk,
  User,
  SystemLog,
  DeskAssignment,
  UserSession,
  DepartmentStats,
  PaginationParams,
  SearchParams,
  EmployeeWithDetails
} from '../types/database.js';
import { DeskWithDetails } from '../../shared/types.js';

/**
 * 部门数据访问对象
 */
export class DepartmentDAO {
  /**
   * 获取所有部门
   */
  static async findAll(): Promise<Department[]> {
    const result = await db.query({
      text: 'SELECT * FROM departments ORDER BY name'
    });
    return result.rows;
  }

  /**
   * 根据ID获取部门
   */
  static async findById(id: number): Promise<Department | null> {
    const result = await db.query({
      text: 'SELECT * FROM departments WHERE id = $1',
      values: [id]
    });
    return result.rows[0] || null;
  }

  /**
   * 创建部门
   */
  static async create(department: Omit<Department, 'id' | 'created_at' | 'updated_at'>): Promise<Department> {
    const result = await db.query({
      text: `INSERT INTO departments (name, code, description, floor, building, manager_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      values: [department.name, department.code, department.description, department.floor, department.building, department.manager_id]
    });
    return result.rows[0];
  }

  /**
   * 更新部门
   */
  static async update(id: number, department: Partial<Department>): Promise<Department | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(department).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    const result = await db.query({
      text: `UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    });
    return result.rows[0] || null;
  }

  /**
   * 删除部门
   */
  static async delete(id: number): Promise<boolean> {
    const result = await db.query({
      text: 'DELETE FROM departments WHERE id = $1',
      values: [id]
    });
    return result.rows.length > 0;
  }

  /**
   * 获取部门统计信息
   */
  static async getStats(departmentId?: number): Promise<DepartmentStats[]> {
    const whereClause = departmentId ? 'WHERE d.id = $1' : '';
    const values = departmentId ? [departmentId] : [];

    const result = await db.query({
      text: `
        SELECT 
          d.id as department_id,
          d.name as department_name,
          COUNT(DISTINCT desk.id) as total_desks,
          COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END) as occupied_desks,
          COUNT(DISTINCT CASE WHEN desk.status = 'available' THEN desk.id END) as available_desks,
          COUNT(DISTINCT e.id) as total_employees,
          CASE 
            WHEN COUNT(DISTINCT desk.id) > 0 
            THEN ROUND((COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END)::decimal / COUNT(DISTINCT desk.id)) * 100, 2)
            ELSE 0 
          END as occupancy_rate
        FROM departments d
        LEFT JOIN desks desk ON d.id = desk.department_id
        LEFT JOIN employees e ON d.id = e.department_id
        ${whereClause}
        GROUP BY d.id, d.name
        ORDER BY d.name
      `,
      values
    });
    return result.rows;
  }
}

/**
 * 员工数据访问对象
 */
export class EmployeeDAO {
  /**
   * 获取所有员工（分页）
   */
  static async findAll(pagination: PaginationParams, search?: SearchParams): Promise<{ employees: EmployeeWithDetails[], total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (search?.keyword) {
      whereClause += ` AND (e.name ILIKE $${paramIndex} OR e.employee_id ILIKE $${paramIndex} OR e.email ILIKE $${paramIndex})`;
      values.push(`%${search.keyword}%`);
      paramIndex++;
    }

    if (search?.department_id) {
      whereClause += ` AND e.department_id = $${paramIndex}`;
      values.push(search.department_id);
      paramIndex++;
    }

    if (search?.status) {
      whereClause += ` AND e.status = $${paramIndex}`;
      values.push(search.status);
      paramIndex++;
    }

    // 获取总数
    const countResult = await db.query({
      text: `SELECT COUNT(*) FROM employees e ${whereClause}`,
      values
    });
    const total = parseInt(countResult.rows[0].count);

    // 获取分页数据
    values.push(pagination.limit, pagination.offset);
    const result = await db.query({
      text: `
        SELECT 
          e.*,
          d.name as department_name,
          d.code as department_code,
          desk.id as current_desk_id,
          desk.desk_number as current_desk_number
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN desk_assignments da ON e.id = da.employee_id AND da.status = 'active'
        LEFT JOIN desks desk ON da.desk_id = desk.id
        ${whereClause}
        ORDER BY e.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values
    });

    const employees = result.rows.map(row => ({
      id: row.id,
      employee_id: row.employee_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      department_id: row.department_id,
      position: row.position,
      avatar_url: row.avatar_url,
      status: row.status,
      hire_date: row.hire_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      department: row.department_name ? {
        id: row.department_id,
        name: row.department_name,
        code: row.department_code
      } : undefined,
      current_desk: row.current_desk_id ? {
        id: row.current_desk_id,
        desk_number: row.current_desk_number
      } : undefined
    }));

    return { employees, total };
  }

  /**
   * 根据ID获取员工详情
   */
  static async findById(id: number): Promise<EmployeeWithDetails | null> {
    const result = await db.query({
      text: `
        SELECT 
          e.*,
          d.name as department_name,
          d.code as department_code,
          desk.id as current_desk_id,
          desk.desk_number as current_desk_number,
          u.id as user_id,
          u.username as user_username,
          u.role as user_role
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN desk_assignments da ON e.id = da.employee_id AND da.status = 'active'
        LEFT JOIN desks desk ON da.desk_id = desk.id
        LEFT JOIN users u ON e.id = u.employee_id
        WHERE e.id = $1
      `,
      values: [id]
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      employee_id: row.employee_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      department_id: row.department_id,
      position: row.position,
      avatar_url: row.avatar_url,
      status: row.status,
      hire_date: row.hire_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      department: row.department_name ? {
        id: row.department_id,
        name: row.department_name,
        code: row.department_code
      } : undefined,
      current_desk: row.current_desk_id ? {
        id: row.current_desk_id,
        desk_number: row.current_desk_number
      } : undefined,
      user_account: row.user_username ? {
        id: row.user_id,
        username: row.user_username,
        role: row.user_role
      } : undefined
    };
  }

  /**
   * 创建员工
   */
  static async create(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const result = await db.query({
      text: `
        INSERT INTO employees (employee_id, name, email, phone, department_id, position, avatar_url, status, hire_date) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
      `,
      values: [
        employee.employee_id,
        employee.name,
        employee.email,
        employee.phone,
        employee.department_id,
        employee.position,
        employee.avatar_url,
        employee.status,
        employee.hire_date
      ]
    });
    return result.rows[0];
  }

  /**
   * 搜索员工（按姓名或工号）
   */
  static async search(keyword: string): Promise<Employee[]> {
    const result = await db.query({
      text: `
        SELECT e.*, d.name as department_name 
        FROM employees e 
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.name ILIKE $1 OR e.employee_id ILIKE $1
        ORDER BY e.name
        LIMIT 20
      `,
      values: [`%${keyword}%`]
    });
    return result.rows;
  }
}

/**
 * 工位数据访问对象
 */
export class DeskDAO {
  /**
   * 根据部门ID获取工位列表
   */
  static async findByDepartmentId(departmentId: number): Promise<DeskWithDetails[]> {
    const result = await db.query({
      text: `
        SELECT 
          d.*,
          da.id as assignment_id,
          da.employee_id,
          da.assigned_at,
          da.status as assignment_status,
          e.name as employee_name,
          e.employee_id as employee_code,
          wi.ip_address as workstation_ip,
          wi.computer_name as workstation_name,
          wi.status as workstation_status
        FROM desks d
        LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
        LEFT JOIN employees e ON da.employee_id = e.id
        LEFT JOIN workstation_info wi ON d.id = wi.desk_id
        WHERE d.department_id = $1
        ORDER BY d.desk_number
      `,
      values: [departmentId]
    });

    return result.rows.map(row => ({
      id: row.id,
      desk_number: row.desk_number,
      department_id: row.department_id,
      x_position: row.x_position,
      y_position: row.y_position,
      width: parseFloat(row.width),
      height: parseFloat(row.height),
      status: row.status,
      ip_address: row.ip_address,
      computer_name: row.computer_name,
      equipment_info: row.equipment_info,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignment: row.assignment_id ? {
        id: row.assignment_id,
        desk_id: row.id,
        employee_id: row.employee_id,
        assigned_at: row.assigned_at,
        status: row.assignment_status
      } : null,
      employee: row.employee_name ? {
        id: row.employee_id,
        name: row.employee_name,
        employee_id: row.employee_code
      } : null,
      workstation: row.workstation_ip ? {
        ip_address: row.workstation_ip,
        computer_name: row.workstation_name,
        status: row.workstation_status
      } : null
    }));
  }

  /**
   * 创建工位
   */
  static async create(desk: Omit<Desk, 'id' | 'created_at' | 'updated_at'>): Promise<Desk> {
    const result = await db.query({
      text: `
        INSERT INTO desks (desk_number, department_id, x_position, y_position, width, height, status, ip_address, computer_name, equipment_info) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
      `,
      values: [
        desk.desk_number,
        desk.department_id,
        desk.x_position,
        desk.y_position,
        desk.width,
        desk.height,
        desk.status,
        desk.ip_address,
        desk.computer_name,
        desk.equipment_info
      ]
    });
    return result.rows[0];
  }

  /**
   * 分配工位
   */
  static async assignDesk(deskId: number, employeeId: number, assignedBy?: number): Promise<any> {
    try {
      // 检查工位是否可用
      const deskResult = await executeQuery(
        'SELECT status FROM desks WHERE id = $1',
        [deskId]
      );
      
      if (deskResult.length === 0) {
        throw new Error('工位不存在');
      }
      
      if (deskResult[0].status !== 'available') {
        throw new Error('工位不可用');
      }

      // 检查员工是否已有工位
      const existingAssignment = await executeQuery(
        'SELECT id FROM desk_assignments WHERE employee_id = $1 AND status = $2',
        [employeeId, 'active']
      );
      
      if (existingAssignment.length > 0) {
        throw new Error('员工已有工位分配');
      }

      const assignmentResult = await executeQuery(
        `INSERT INTO desk_assignments (desk_id, employee_id, assigned_by, status) 
         VALUES ($1, $2, $3, 'active') RETURNING *`,
        [deskId, employeeId, assignedBy]
      );

      // 更新工位状态
      await executeQuery(
        'UPDATE desks SET status = $1 WHERE id = $2',
        ['occupied', deskId]
      );

      return assignmentResult[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * 释放工位
   */
  static async releaseDesk(deskId: number): Promise<boolean> {
    try {
      // 更新分配记录状态
      const assignmentResult = await executeQuery(
        `UPDATE desk_assignments 
         SET status = 'inactive', released_at = CURRENT_TIMESTAMP 
         WHERE desk_id = $1 AND status = 'active'`,
        [deskId]
      );

      // 更新工位状态
      await executeQuery(
        'UPDATE desks SET status = $1 WHERE id = $2',
        ['available', deskId]
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 搜索工位
   */
  static async search(keyword: string): Promise<DeskWithDetails[]> {
    const result = await db.query({
      text: `
        SELECT 
          d.*,
          da.id as assignment_id,
          da.employee_id,
          e.name as employee_name,
          dept.name as department_name
        FROM desks d
        LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
        LEFT JOIN employees e ON da.employee_id = e.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE d.desk_number ILIKE $1 OR dept.name ILIKE $1 OR e.name ILIKE $1
        ORDER BY d.desk_number
        LIMIT 20
      `,
      values: [`%${keyword}%`]
    });

    return result.rows.map(row => ({
      id: row.id,
      desk_number: row.desk_number,
      department_id: row.department_id,
      x_position: parseFloat(row.x_position),
      y_position: parseFloat(row.y_position),
      width: parseFloat(row.width),
      height: parseFloat(row.height),
      status: row.status,
      ip_address: row.ip_address,
      computer_name: row.computer_name,
      equipment_info: row.equipment_info,
      created_at: row.created_at,
      updated_at: row.updated_at,
      department: row.department_name ? {
        name: row.department_name
      } : undefined,
      employee: row.employee_name ? {
        id: row.employee_id,
        name: row.employee_name
      } : undefined
    }));
  }
}

/**
 * 系统统计数据访问对象
 */
export class SystemStatsDAO {
  /**
   * 获取系统统计信息
   */
  static async getSystemStats(): Promise<any> {
    const result = await db.query({
      text: `
        SELECT 
          (SELECT COUNT(*) FROM departments) as total_departments,
          (SELECT COUNT(*) FROM employees WHERE status = 'active') as total_employees,
          (SELECT COUNT(*) FROM desks) as total_desks,
          (SELECT COUNT(*) FROM desk_assignments WHERE status = 'active') as total_assignments,
          (SELECT COUNT(*) FROM workstation_info WHERE status = 'online') as online_workstations,
          (SELECT MAX(completed_at) FROM sync_records WHERE status = 'success') as last_sync_time
      `
    });

    const row = result.rows[0];
    const occupancyRate = row.total_desks > 0 ? (row.total_assignments / row.total_desks) * 100 : 0;

    return {
      total_departments: parseInt(row.total_departments),
      total_employees: parseInt(row.total_employees),
      total_desks: parseInt(row.total_desks),
      total_assignments: parseInt(row.total_assignments),
      occupancy_rate: Math.round(occupancyRate * 100) / 100,
      online_workstations: parseInt(row.online_workstations),
      last_sync_time: row.last_sync_time
    };
  }
}

/**
 * 系统日志数据访问对象
 */
export class SystemLogDAO {
  /**
   * 记录系统日志
   */
  static async log(log: Omit<SystemLog, 'id' | 'created_at'>): Promise<SystemLog> {
    const result = await db.query({
      text: `
        INSERT INTO system_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `,
      values: [
        log.user_id,
        log.action,
        log.resource_type,
        log.resource_id,
        log.details,
        log.ip_address,
        log.user_agent
      ]
    });
    return result.rows[0];
  }
}