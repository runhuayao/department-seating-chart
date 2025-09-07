// M1数据适配层 - 实现M0和M1数据格式之间的转换
// 确保M0组件接口保持不变，通过适配层实现平滑过渡

// M0版本数据接口（保持不变）
export interface M0Employee {
  employee_id: number;
  name: string;
  department: string;
  status: 'online' | 'offline';
}

export interface M0Desk {
  desk_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  employee_id?: number;
  department: string;
}

// M1版本数据接口（新的API格式）
export interface M1Employee {
  id: number;
  name: string;
  deptId: number;
  title?: string;
  email?: string;
  phone?: string;
  status?: 'online' | 'offline';
  createdAt: Date;
  updatedAt: Date;
}

export interface M1Desk {
  id: string;
  label: string;
  deptId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface M1Assignment {
  id: number;
  employeeId: number;
  deskId: string;
  active: boolean;
  assignedAt: Date;
}

export interface M1Department {
  id: number;
  name: string;
  displayName: string;
  floor: string;
  mapId: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 数据适配器类 - 负责M0和M1数据格式转换
 */
export class DataAdapter {
  // 部门ID到名称的映射关系
  private static readonly DEPT_ID_TO_NAME: Record<number, string> = {
    1: 'Engineering',
    2: 'Marketing',
    3: 'Sales',
    4: 'HR'
  };

  // 部门名称到ID的映射关系
  private static readonly DEPT_NAME_TO_ID: Record<string, number> = {
    'Engineering': 1,
    'Marketing': 2,
    'Sales': 3,
    'HR': 4
  };

  /**
   * 将M1员工数据适配为M0格式
   * @param m1Employee M1格式的员工数据
   * @returns M0格式的员工数据
   */
  static adaptEmployee(m1Employee: M1Employee): M0Employee {
    return {
      employee_id: m1Employee.id,
      name: m1Employee.name,
      department: this.getDepartmentName(m1Employee.deptId),
      status: m1Employee.status || 'offline'
    };
  }

  /**
   * 将M1工位数据适配为M0格式
   * @param m1Desk M1格式的工位数据
   * @param assignment 工位分配信息（可选）
   * @returns M0格式的工位数据
   */
  static adaptDesk(m1Desk: M1Desk, assignment?: M1Assignment): M0Desk {
    return {
      desk_id: m1Desk.id,
      x: m1Desk.x,
      y: m1Desk.y,
      w: m1Desk.w,
      h: m1Desk.h,
      label: m1Desk.label,
      employee_id: assignment?.active ? assignment.employeeId : undefined,
      department: this.getDepartmentName(m1Desk.deptId)
    };
  }

  /**
   * 将M0员工数据转换为M1格式
   * @param m0Employee M0格式的员工数据
   * @returns M1格式的员工数据
   */
  static convertEmployeeToM1(m0Employee: M0Employee): Omit<M1Employee, 'createdAt' | 'updatedAt'> {
    return {
      id: m0Employee.employee_id,
      name: m0Employee.name,
      deptId: this.getDepartmentId(m0Employee.department),
      status: m0Employee.status
    };
  }

  /**
   * 将M0工位数据转换为M1格式
   * @param m0Desk M0格式的工位数据
   * @returns M1格式的工位数据
   */
  static convertDeskToM1(m0Desk: M0Desk): Omit<M1Desk, 'createdAt' | 'updatedAt'> {
    return {
      id: m0Desk.desk_id,
      label: m0Desk.label,
      deptId: this.getDepartmentId(m0Desk.department),
      x: m0Desk.x,
      y: m0Desk.y,
      w: m0Desk.w,
      h: m0Desk.h
    };
  }

  /**
   * 根据部门ID获取部门名称
   * @param deptId 部门ID
   * @returns 部门名称
   */
  static getDepartmentName(deptId: number): string {
    return this.DEPT_ID_TO_NAME[deptId] || 'Unknown';
  }

  /**
   * 根据部门名称获取部门ID
   * @param deptName 部门名称
   * @returns 部门ID
   */
  static getDepartmentId(deptName: string): number {
    return this.DEPT_NAME_TO_ID[deptName] || 0;
  }

  /**
   * 批量适配员工数据
   * @param m1Employees M1格式的员工数据数组
   * @returns M0格式的员工数据数组
   */
  static adaptEmployees(m1Employees: M1Employee[]): M0Employee[] {
    return m1Employees.map(emp => this.adaptEmployee(emp));
  }

  /**
   * 批量适配工位数据
   * @param m1Desks M1格式的工位数据数组
   * @param assignments 工位分配信息数组
   * @returns M0格式的工位数据数组
   */
  static adaptDesks(m1Desks: M1Desk[], assignments: M1Assignment[] = []): M0Desk[] {
    return m1Desks.map(desk => {
      const assignment = assignments.find(a => a.deskId === desk.id && a.active);
      return this.adaptDesk(desk, assignment);
    });
  }

  /**
   * 验证数据适配的正确性
   * @param original 原始数据
   * @param adapted 适配后的数据
   * @returns 验证结果
   */
  static validateEmployeeAdaptation(original: M1Employee, adapted: M0Employee): boolean {
    return (
      original.id === adapted.employee_id &&
      original.name === adapted.name &&
      this.getDepartmentName(original.deptId) === adapted.department &&
      (original.status || 'offline') === adapted.status
    );
  }

  /**
   * 验证工位数据适配的正确性
   * @param original M1工位数据
   * @param adapted M0工位数据
   * @returns 验证结果
   */
  static validateDeskAdaptation(original: M1Desk, adapted: M0Desk): boolean {
    return (
      original.id === adapted.desk_id &&
      original.label === adapted.label &&
      this.getDepartmentName(original.deptId) === adapted.department &&
      original.x === adapted.x &&
      original.y === adapted.y &&
      original.w === adapted.w &&
      original.h === adapted.h
    );
  }

  /**
   * 获取所有部门的映射关系
   * @returns 部门映射关系对象
   */
  static getDepartmentMappings() {
    return {
      idToName: { ...this.DEPT_ID_TO_NAME },
      nameToId: { ...this.DEPT_NAME_TO_ID }
    };
  }

  /**
   * 检查部门是否存在
   * @param deptName 部门名称
   * @returns 是否存在
   */
  static isDepartmentValid(deptName: string): boolean {
    return deptName in this.DEPT_NAME_TO_ID;
  }

  /**
   * 检查部门ID是否存在
   * @param deptId 部门ID
   * @returns 是否存在
   */
  static isDepartmentIdValid(deptId: number): boolean {
    return deptId in this.DEPT_ID_TO_NAME;
  }
}

// 导出类型定义供其他模块使用
// Types are already exported above, no need to re-export