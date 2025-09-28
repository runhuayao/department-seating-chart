// 部门地图数据管理
// 确保员工ID唯一性和部门数据隔离

export interface Employee {
  employee_id: number;
  name: string;
  department: string;
  status: 'online' | 'offline';
}

export interface Desk {
  desk_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  employee_id?: number; // 可选，空工位时为undefined
  department: string;
}

export interface MapData {
  map_id: string;
  type: string;
  url: string;
  dept_name: string;
  department: string;
}

export interface DepartmentConfig {
  name: string;
  displayName: string;
  mapData: MapData;
  desks: Desk[];
}

// 员工数据 - 确保每个员工ID唯一对应一个部门
export const employees: Employee[] = [
  // Engineering 部门员工
  { employee_id: 1001, name: '张三', department: 'Engineering', status: 'online' },
  { employee_id: 1002, name: '李四', department: 'Engineering', status: 'offline' },
  { employee_id: 1003, name: '王五', department: 'Engineering', status: 'online' },
  { employee_id: 1004, name: '赵六', department: 'Engineering', status: 'online' },
  
  // Marketing 部门员工
  { employee_id: 2001, name: '钱七', department: 'Marketing', status: 'online' },
  { employee_id: 2002, name: '孙八', department: 'Marketing', status: 'offline' },
  { employee_id: 2003, name: '周九', department: 'Marketing', status: 'online' },
  
  // Sales 部门员工
  { employee_id: 3001, name: '吴十', department: 'Sales', status: 'online' },
  { employee_id: 3002, name: '郑十一', department: 'Sales', status: 'offline' },
  
  // HR 部门员工
  { employee_id: 4001, name: '王十二', department: 'HR', status: 'online' },
];

// 部门配置数据
export const departmentConfigs: Record<string, DepartmentConfig> = {
  Engineering: {
    name: 'Engineering',
    displayName: '工程部',
    mapData: {
      map_id: 'eng_floor_2',
      type: 'svg',
      url: '/maps/engineering_floor2.svg',
      dept_name: '工程部',
      department: 'Engineering'
    },
    desks: [
      { desk_id: 'ENG-001', x: 100, y: 100, w: 60, h: 40, label: 'E01', employee_id: 1001, department: 'Engineering' },
      { desk_id: 'ENG-002', x: 200, y: 100, w: 60, h: 40, label: 'E02', employee_id: 1002, department: 'Engineering' },
      { desk_id: 'ENG-003', x: 300, y: 100, w: 60, h: 40, label: 'E03', employee_id: 1003, department: 'Engineering' },
      { desk_id: 'ENG-004', x: 400, y: 100, w: 60, h: 40, label: 'E04', department: 'Engineering' }, // 空工位
      { desk_id: 'ENG-005', x: 500, y: 100, w: 60, h: 40, label: 'E05', employee_id: 1004, department: 'Engineering' },
      { desk_id: 'ENG-006', x: 100, y: 200, w: 60, h: 40, label: 'E06', department: 'Engineering' }, // 空工位
    ]
  },
  Marketing: {
    name: 'Marketing',
    displayName: '市场部',
    mapData: {
      map_id: 'mkt_floor_3',
      type: 'svg',
      url: '/maps/marketing_floor3.svg',
      dept_name: '市场部',
      department: 'Marketing'
    },
    desks: [
      { desk_id: 'MKT-001', x: 150, y: 120, w: 60, h: 40, label: 'M01', employee_id: 2001, department: 'Marketing' },
      { desk_id: 'MKT-002', x: 250, y: 120, w: 60, h: 40, label: 'M02', employee_id: 2002, department: 'Marketing' },
      { desk_id: 'MKT-003', x: 350, y: 120, w: 60, h: 40, label: 'M03', employee_id: 2003, department: 'Marketing' },
      { desk_id: 'MKT-004', x: 450, y: 120, w: 60, h: 40, label: 'M04', department: 'Marketing' }, // 空工位
    ]
  },
  Sales: {
    name: 'Sales',
    displayName: '销售部',
    mapData: {
      map_id: 'sales_floor_4',
      type: 'svg',
      url: '/maps/sales_floor4.svg',
      dept_name: '销售部',
      department: 'Sales'
    },
    desks: [
      { desk_id: 'SAL-001', x: 120, y: 150, w: 60, h: 40, label: 'S01', employee_id: 3001, department: 'Sales' },
      { desk_id: 'SAL-002', x: 220, y: 150, w: 60, h: 40, label: 'S02', employee_id: 3002, department: 'Sales' },
      { desk_id: 'SAL-003', x: 320, y: 150, w: 60, h: 40, label: 'S03', department: 'Sales' }, // 空工位
    ]
  },
  HR: {
    name: 'HR',
    displayName: '人事部',
    mapData: {
      map_id: 'hr_floor_5',
      type: 'svg',
      url: '/maps/hr_floor5.svg',
      dept_name: '人事部',
      department: 'HR'
    },
    desks: [
      { desk_id: 'HR-001', x: 180, y: 180, w: 60, h: 40, label: 'H01', employee_id: 4001, department: 'HR' },
      { desk_id: 'HR-002', x: 280, y: 180, w: 60, h: 40, label: 'H02', department: 'HR' }, // 空工位
    ]
  }
};

// 工具函数：根据员工ID获取员工信息
export const getEmployeeById = (employeeId: number): Employee | undefined => {
  return employees.find(emp => emp.employee_id === employeeId);
};

// 工具函数：根据部门获取该部门的所有员工
export const getEmployeesByDepartment = (department: string): Employee[] => {
  return employees.filter(emp => emp.department === department);
};

// 工具函数：根据部门获取该部门的工位数据
export const getDesksByDepartment = (department: string): Desk[] => {
  const config = departmentConfigs[department];
  return config ? config.desks : [];
};

// 部门名称映射 - 支持中英文名称转换
export const DEPARTMENT_NAME_MAPPING: Record<string, string> = {
  // 中文到英文映射
  '工程部': 'Engineering',
  '市场部': 'Marketing', 
  '销售部': 'Sales',
  '人事部': 'HR',
  '开发部': 'Engineering', // 别名支持
  '技术部': 'Engineering', // 别名支持
  
  // 英文到英文映射（保持一致性）
  'Engineering': 'Engineering',
  'Marketing': 'Marketing',
  'Sales': 'Sales', 
  'HR': 'HR',
  
  // 其他可能的变体
  'engineering': 'Engineering',
  'marketing': 'Marketing',
  'sales': 'Sales',
  'hr': 'HR'
};

// 工具函数：标准化部门名称
export const normalizeDepartmentName = (department: string): string => {
  if (!department) return '';
  
  // 去除前后空格并查找映射
  const trimmed = department.trim();
  const normalized = DEPARTMENT_NAME_MAPPING[trimmed];
  
  if (normalized) {
    return normalized;
  }
  
  // 如果没有找到映射，尝试大小写不敏感匹配
  const lowerCase = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(DEPARTMENT_NAME_MAPPING)) {
    if (key.toLowerCase() === lowerCase) {
      return value;
    }
  }
  
  // 如果仍然没有找到，返回原始值
  return trimmed;
};

// 工具函数：获取部门配置（支持名称映射）
export const getDepartmentConfig = (department: string): DepartmentConfig | undefined => {
  if (!department) return undefined;
  
  // 首先尝试直接匹配
  let config = departmentConfigs[department];
  if (config) return config;
  
  // 如果直接匹配失败，尝试标准化名称后匹配
  const normalizedName = normalizeDepartmentName(department);
  config = departmentConfigs[normalizedName];
  if (config) return config;
  
  // 如果仍然没有找到，尝试模糊匹配
  for (const [key, value] of Object.entries(departmentConfigs)) {
    if (key.toLowerCase().includes(department.toLowerCase()) || 
        department.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return undefined;
};

// 工具函数：验证员工ID唯一性
export const validateEmployeeIdUniqueness = (): boolean => {
  const employeeIds = employees.map(emp => emp.employee_id);
  const uniqueIds = new Set(employeeIds);
  return employeeIds.length === uniqueIds.size;
};

// 工具函数：验证员工部门一致性
export const validateEmployeeDepartmentConsistency = (): boolean => {
  for (const [deptName, config] of Object.entries(departmentConfigs)) {
    for (const desk of config.desks) {
      if (desk.employee_id) {
        const employee = getEmployeeById(desk.employee_id);
        if (!employee || employee.department !== deptName) {
          return false;
        }
      }
    }
  }
  return true;
};

// 工具函数：获取所有部门列表
export const getAllDepartments = (): string[] => {
  return Object.keys(departmentConfigs);
};

// 工具函数：获取首页展示数据（所有部门的工位状态概览）
export const getHomepageOverview = () => {
  const overview: Record<string, { totalDesks: number; occupiedDesks: number; onlineCount: number; offlineCount: number }> = {};
  
  for (const [deptName, config] of Object.entries(departmentConfigs)) {
    const desks = config.desks;
    const occupiedDesks = desks.filter(desk => desk.employee_id);
    const onlineCount = occupiedDesks.filter(desk => {
      const employee = getEmployeeById(desk.employee_id!);
      return employee?.status === 'online';
    }).length;
    const offlineCount = occupiedDesks.length - onlineCount;
    
    overview[deptName] = {
      totalDesks: desks.length,
      occupiedDesks: occupiedDesks.length,
      onlineCount: onlineCount,
      offlineCount: offlineCount
    };
  }
  
  return overview;
};