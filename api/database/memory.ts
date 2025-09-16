/**
 * 内存数据库实现
 * 用于开发和测试环境的简单数据存储
 */

// 数据存储接口
interface MemoryStore {
  departments: any[];
  employees: any[];
  desks: any[];
  users: any[];
  permissions: any[];
  rolePermissions: any[];
  systemLogs: any[];
  deskAssignments: any[];
  userSessions: any[];
}

// 内存数据存储
let store: MemoryStore = {
  departments: [],
  employees: [],
  desks: [],
  users: [],
  permissions: [],
  rolePermissions: [],
  systemLogs: [],
  deskAssignments: [],
  userSessions: []
};

// ID生成器
let idCounters: { [key: string]: number } = {
  departments: 0,
  employees: 0,
  desks: 0,
  users: 0,
  permissions: 0,
  rolePermissions: 0,
  systemLogs: 0,
  deskAssignments: 0,
  userSessions: 0
};

/**
 * 生成新的ID
 */
function generateId(table: string): number {
  return ++idCounters[table];
}

/**
 * 模拟数据库查询接口
 */
export class MemoryDatabase {
  /**
   * 执行查询
   */
  async query(config: { text: string; values?: any[] }): Promise<{ rows: any[] }> {
    const { text, values = [] } = config;
    
    // 简单的SQL解析和执行
    const sql = text.toLowerCase().trim();
    
    if (sql.startsWith('select')) {
      return this.handleSelect(text, values);
    } else if (sql.startsWith('insert')) {
      return this.handleInsert(text, values);
    } else if (sql.startsWith('update')) {
      return this.handleUpdate(text, values);
    } else if (sql.startsWith('delete')) {
      return this.handleDelete(text, values);
    } else {
      // 对于其他SQL语句（如CREATE TABLE），直接返回成功
      return { rows: [] };
    }
  }
  
  /**
   * 处理SELECT查询
   */
  private async handleSelect(sql: string, values: any[]): Promise<{ rows: any[] }> {
    const lowerSql = sql.toLowerCase();
    
    // 用户登录查询
    if (lowerSql.includes('from users') && lowerSql.includes('where u.username')) {
      const username = values[0];
      const user = store.users.find(u => u.username === username && u.status === 'active');
      if (user) {
        const employee = store.employees.find(e => e.id === user.employee_id);
        return {
          rows: [{
            ...user,
            employee_name: employee?.name,
            department_id: employee?.department_id
          }]
        };
      }
      return { rows: [] };
    }
    
    // 用户详情查询
    if (lowerSql.includes('from users u') && lowerSql.includes('where u.id')) {
      const userId = values[0];
      const user = store.users.find(u => u.id === userId && u.status === 'active');
      if (user) {
        const employee = store.employees.find(e => e.id === user.employee_id);
        return {
          rows: [{
            ...user,
            employee_name: employee?.name,
            department_id: employee?.department_id
          }]
        };
      }
      return { rows: [] };
    }
    
    // 部门查询
    if (lowerSql.includes('from departments')) {
      return { rows: store.departments };
    }
    
    // 员工查询
    if (lowerSql.includes('from employees')) {
      if (lowerSql.includes('where department_id')) {
        const deptId = values[0];
        return { rows: store.employees.filter(e => e.department_id === deptId) };
      }
      return { rows: store.employees };
    }
    
    // 工位查询
    if (lowerSql.includes('from desks')) {
      if (lowerSql.includes('where department_id')) {
        const deptId = values[0];
        return { rows: store.desks.filter(d => d.department_id === deptId) };
      }
      if (lowerSql.includes('where id')) {
        const deskId = values[0];
        const desk = store.desks.find(d => d.id === deskId);
        return { rows: desk ? [desk] : [] };
      }
      return { rows: store.desks };
    }
    
    // 检查用户名是否存在
    if (lowerSql.includes('select id from users where username')) {
      const username = values[0];
      const user = store.users.find(u => u.username === username);
      return { rows: user ? [{ id: user.id }] : [] };
    }
    
    // 检查邮箱是否存在
    if (lowerSql.includes('select id from users where email')) {
      const email = values[0];
      const user = store.users.find(u => u.email === email);
      return { rows: user ? [{ id: user.id }] : [] };
    }
    
    // 检查员工是否存在
    if (lowerSql.includes('select id from employees where id')) {
      const empId = values[0];
      const employee = store.employees.find(e => e.id === empId);
      return { rows: employee ? [{ id: employee.id }] : [] };
    }
    
    // 获取用户密码
    if (lowerSql.includes('select password_hash from users where id')) {
      const userId = values[0];
      const user = store.users.find(u => u.id === userId);
      return { rows: user ? [{ password_hash: user.password_hash }] : [] };
    }
    
    return { rows: [] };
  }
  
  /**
   * 处理INSERT查询
   */
  private async handleInsert(sql: string, values: any[]): Promise<{ rows: any[] }> {
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('into users')) {
      const [username, passwordHash, email, employeeId, role] = values;
      const newUser = {
        id: generateId('users'),
        username,
        password_hash: passwordHash,
        email,
        employee_id: employeeId,
        role,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.users.push(newUser);
      return { rows: [newUser] };
    }
    
    if (lowerSql.includes('into desks')) {
      const [deskNumber, departmentId, floor, area, xPos, yPos] = values;
      const newDesk = {
        id: generateId('desks'),
        desk_number: deskNumber,
        department_id: departmentId,
        floor,
        area,
        x_position: xPos,
        y_position: yPos,
        width: 120,
        height: 80,
        status: 'available',
        assigned_employee_id: null,
        assigned_at: null,
        ip_address: null,
        computer_name: null,
        equipment_info: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.desks.push(newDesk);
      return { rows: [newDesk] };
    }
    
    if (lowerSql.includes('into system_logs')) {
      const [userId, action, resourceType, resourceId, details, ipAddress, userAgent] = values;
      const newLog = {
        id: generateId('systemLogs'),
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      };
      store.systemLogs.push(newLog);
      return { rows: [newLog] };
    }
    
    return { rows: [] };
  }
  
  /**
   * 处理UPDATE查询
   */
  private async handleUpdate(sql: string, values: any[]): Promise<{ rows: any[] }> {
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('update users set last_login_at')) {
      const userId = values[0];
      const user = store.users.find(u => u.id === userId);
      if (user) {
        user.last_login_at = new Date().toISOString();
        user.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    
    if (lowerSql.includes('update users set password_hash')) {
      const [newPasswordHash, userId] = values;
      const user = store.users.find(u => u.id === userId);
      if (user) {
        user.password_hash = newPasswordHash;
        user.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    
    if (lowerSql.includes('update desks set')) {
      // 处理工位更新
      const deskId = values[values.length - 1]; // 最后一个参数通常是ID
      const desk = store.desks.find(d => d.id === deskId);
      if (desk) {
        // 根据SQL内容更新相应字段
        if (lowerSql.includes('assigned_employee_id')) {
          desk.assigned_employee_id = values[0];
          desk.status = 'occupied';
          desk.assigned_at = new Date().toISOString();
        }
        desk.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    
    return { rows: [] };
  }
  
  /**
   * 处理DELETE查询
   */
  private async handleDelete(sql: string, values: any[]): Promise<{ rows: any[] }> {
    // 暂时不实现删除功能
    return { rows: [] };
  }
}

/**
 * 初始化内存数据库
 */
export function initializeMemoryDatabase(): void {
  // 插入默认部门
  store.departments = [
    {
      id: 1,
      name: '技术部',
      description: '负责公司技术研发和系统维护',
      parent_id: null,
      manager_id: 1,
      location: '3楼',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      name: '市场部',
      description: '负责市场推广和客户关系维护',
      parent_id: null,
      manager_id: 4,
      location: '2楼',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      name: '人事部',
      description: '负责人力资源管理和招聘',
      parent_id: null,
      manager_id: null,
      location: '1楼',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  // 插入默认员工
  store.employees = [
    {
      id: 1,
      name: '张三',
      email: 'zhangsan@company.com',
      phone: '13800138001',
      position: '技术经理',
      department_id: 1,
      hire_date: '2023-01-15',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      name: '李四',
      email: 'lisi@company.com',
      phone: '13800138002',
      position: '前端开发',
      department_id: 1,
      hire_date: '2023-02-01',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      name: '王五',
      email: 'wangwu@company.com',
      phone: '13800138003',
      position: '后端开发',
      department_id: 1,
      hire_date: '2023-02-15',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 4,
      name: '赵六',
      email: 'zhaoliu@company.com',
      phone: '13800138004',
      position: '市场经理',
      department_id: 2,
      hire_date: '2023-01-10',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 5,
      name: '钱七',
      email: 'qianqi@company.com',
      phone: '13800138005',
      position: '销售代表',
      department_id: 2,
      hire_date: '2023-03-01',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  // 插入默认工位
  store.desks = [
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
      assigned_employee_id: null,
      assigned_at: null,
      ip_address: null,
      computer_name: null,
      equipment_info: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      assigned_at: new Date().toISOString(),
      ip_address: '192.168.1.101',
      computer_name: 'DEV-PC-001',
      equipment_info: 'Dell OptiPlex 7090',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      assigned_at: new Date().toISOString(),
      ip_address: '192.168.1.102',
      computer_name: 'DEV-PC-002',
      equipment_info: 'HP EliteDesk 800',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      assigned_at: new Date().toISOString(),
      ip_address: '192.168.1.201',
      computer_name: 'MKT-PC-001',
      equipment_info: 'Lenovo ThinkCentre M720',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      assigned_employee_id: null,
      assigned_at: null,
      ip_address: null,
      computer_name: null,
      equipment_info: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  // 插入默认用户（密码: 123456）
  store.users = [
    {
      id: 1,
      username: 'admin',
      password_hash: '$2b$12$Mz.2uGUBIsUUTqfrYzV2P.bEuwCwES.k19u7fG3HED44OnHKc30.G', // 123456
      email: 'admin@company.com',
      role: 'admin',
      employee_id: 1,
      status: 'active',
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      username: 'manager',
      password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', // admin123
      email: 'manager@company.com',
      role: 'manager',
      employee_id: 4,
      status: 'active',
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  // 更新ID计数器
  idCounters = {
    departments: 3,
    employees: 5,
    desks: 5,
    users: 2,
    permissions: 0,
    rolePermissions: 0,
    systemLogs: 0,
    deskAssignments: 0,
    userSessions: 0
  };
  
  console.log('✓ 内存数据库初始化完成');
}

// 创建数据库实例
export const db = new MemoryDatabase();

// 导出executeQuery函数用于兼容
export const executeQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
  const result = await db.query({ text: sql, values: params });
  return result.rows;
};

// 初始化数据
initializeMemoryDatabase();