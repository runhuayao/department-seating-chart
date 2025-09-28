import { Router } from 'express';
import db from '../models/database.js';
import { authenticateToken, requireUserOrAdmin, requireAdmin, rateLimiter } from '../middleware/auth.js';

const router = Router();

// 应用频率限制和认证
router.use(rateLimiter(50, 15 * 60 * 1000)); // 每15分钟最多50次请求
router.use(authenticateToken); // 所有员工API都需要认证

// 错误处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 获取所有员工 - 需要用户或管理员权限
router.get('/', requireUserOrAdmin, asyncHandler(async (req: any, res: any) => {
  const { department, status, position } = req.query;
  let employees = await db.getEmployees();
  
  // 过滤条件
  if (department) {
    employees = employees.filter(emp => emp.department === department);
  }
  
  if (status) {
    employees = employees.filter(emp => emp.status === status);
  }
  
  if (position) {
    employees = employees.filter(emp => emp.position.toLowerCase().includes(position.toLowerCase()));
  }
  
  res.json(employees);
}));

// 获取单个员工
router.get('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const employee = await db.getEmployeeById(id);
  
  if (!employee) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  res.json(employee);
}));

// 根据员工ID获取员工
router.get('/by-employee-id/:employeeId', asyncHandler(async (req: any, res: any) => {
  const { employeeId } = req.params;
  const employees = await db.getEmployees();
  const employee = employees.find(emp => emp.employeeId === employeeId);
  
  if (!employee) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  res.json(employee);
}));

// 创建员工 - 需要管理员权限
router.post('/', requireAdmin, asyncHandler(async (req: any, res: any) => {
  const { 
    employeeId, 
    name, 
    email, 
    phone, 
    department, 
    position, 
    workstationId, 
    permissions 
  } = req.body;
  
  // 验证必填字段
  if (!employeeId || !name || !email || !department || !position) {
    return res.status(400).json({ 
      error: '缺少必要参数',
      required: ['employeeId', 'name', 'email', 'department', 'position']
    });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  
  // 检查员工ID是否已存在
  const existingEmployees = await db.getEmployees();
  const employeeIdExists = existingEmployees.some(emp => emp.employeeId === employeeId);
  if (employeeIdExists) {
    return res.status(409).json({ error: '员工ID已存在' });
  }
  
  // 检查邮箱是否已存在
  const emailExists = existingEmployees.some(emp => emp.email === email);
  if (emailExists) {
    return res.status(409).json({ error: '邮箱已被使用' });
  }
  
  // 验证工作站是否存在且未被分配
  if (workstationId) {
    const workstation = await db.getWorkstationById(workstationId);
    if (!workstation) {
      return res.status(400).json({ error: '指定的工作站不存在' });
    }
    if (workstation.assignedUser) {
      return res.status(409).json({ error: '工作站已被分配给其他用户' });
    }
  }
  
  try {
    const newEmployee = await db.createEmployee({
      employeeId,
      name,
      email,
      phone: phone || '',
      department,
      position,
      workstationId: workstationId || null,
      status: 'active',
      permissions: permissions || ['workstation:view']
    });
    
    // 如果分配了工作站，更新工作站的分配用户
    if (workstationId) {
      await db.updateWorkstation(workstationId, { assignedUser: newEmployee.id });
    }

    res.status(201).json({
      message: '员工创建成功',
      employee: newEmployee
    });
  } catch (error) {
    console.error('创建员工失败:', error);
    res.status(500).json({ error: '创建员工失败' });
  }
}));

// 更新员工 - 需要管理员权限
router.put('/:id', requireAdmin, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const updates = req.body;
  
  // 如果更新邮箱，检查是否重复
  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    
    const existingEmployees = await db.getEmployees();
    const emailExists = existingEmployees.some(emp => emp.email === updates.email && emp.id !== id);
    if (emailExists) {
      return res.status(409).json({ error: '邮箱已被使用' });
    }
  }
  
  // 如果更新员工ID，检查是否重复
  if (updates.employeeId) {
    const existingEmployees = await db.getEmployees();
    const employeeIdExists = existingEmployees.some(emp => emp.employeeId === updates.employeeId && emp.id !== id);
    if (employeeIdExists) {
      return res.status(409).json({ error: '员工ID已存在' });
    }
  }
  
  // 如果更新工作站分配
  if (updates.workstationId !== undefined) {
    const currentEmployee = await db.getEmployeeById(id);
    if (!currentEmployee) {
      return res.status(404).json({ error: '员工不存在' });
    }
    
    // 如果有新的工作站分配
    if (updates.workstationId) {
      const workstation = await db.getWorkstationById(updates.workstationId);
      if (!workstation) {
        return res.status(400).json({ error: '指定的工作站不存在' });
      }
      if (workstation.assignedUser && workstation.assignedUser !== id) {
        return res.status(409).json({ error: '工作站已被分配给其他用户' });
      }
    }
    
    // 清除原工作站的分配
    if (currentEmployee.workstationId && currentEmployee.workstationId !== updates.workstationId) {
      await db.updateWorkstation(currentEmployee.workstationId, { assignedUser: null });
    }
    
    // 设置新工作站的分配
    if (updates.workstationId) {
      await db.updateWorkstation(updates.workstationId, { assignedUser: id });
    }
  }
  
  const updatedEmployee = await db.updateEmployee(id, updates);
  
  if (!updatedEmployee) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  res.json({
    message: '员工信息更新成功',
    employee: updatedEmployee
  });
}));

// 删除员工 - 需要管理员权限
router.delete('/:id', requireAdmin, asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  
  // 获取员工信息以清除工作站分配
  const employee = await db.getEmployeeById(id);
  if (employee && employee.workstationId) {
    await db.updateWorkstation(employee.workstationId, { assignedUser: null });
  }
  
  const deleted = await db.deleteEmployee(id);
  
  if (!deleted) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  res.json({ message: '员工删除成功' });
}));

// 员工状态统计 - 需要用户或管理员权限
router.get('/stats/status', requireUserOrAdmin, asyncHandler(async (req: any, res: any) => {
  const employees = await db.getEmployees();
  
  const stats = {
    total: employees.length,
    active: employees.filter(emp => emp.status === 'active').length,
    inactive: employees.filter(emp => emp.status === 'inactive').length,
    withWorkstation: employees.filter(emp => emp.workstationId).length,
    withoutWorkstation: employees.filter(emp => !emp.workstationId).length
  };
  
  res.json(stats);
}));

// 按部门统计员工 - 需要用户或管理员权限
router.get('/stats/department', requireUserOrAdmin, asyncHandler(async (req: any, res: any) => {
  const employees = await db.getEmployees();
  
  const departmentStats = employees.reduce((acc: any, emp) => {
    if (!acc[emp.department]) {
      acc[emp.department] = {
        total: 0,
        active: 0,
        inactive: 0,
        positions: {}
      };
    }
    
    acc[emp.department].total++;
    acc[emp.department][emp.status]++;
    
    // 统计职位
    if (!acc[emp.department].positions[emp.position]) {
      acc[emp.department].positions[emp.position] = 0;
    }
    acc[emp.department].positions[emp.position]++;
    
    return acc;
  }, {});
  
  res.json(departmentStats);
}));

// 批量操作 - 需要管理员权限
router.post('/batch', requireAdmin, asyncHandler(async (req: any, res: any) => {
  const { action, ids, data } = req.body;
  
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '缺少操作类型或员工ID列表' });
  }
  
  const results = [];
  
  for (const id of ids) {
    try {
      switch (action) {
        case 'activate':
          const activeEmp = await db.updateEmployee(id, { status: 'active' });
          results.push({ id, success: !!activeEmp, action: 'activate' });
          break;
        case 'deactivate':
          const inactiveEmp = await db.updateEmployee(id, { status: 'inactive' });
          results.push({ id, success: !!inactiveEmp, action: 'deactivate' });
          break;
        case 'update_department':
          if (!data?.department) {
            results.push({ id, success: false, error: '缺少部门信息' });
            break;
          }
          const deptEmp = await db.updateEmployee(id, { department: data.department });
          results.push({ id, success: !!deptEmp, action: 'update_department' });
          break;
        case 'delete':
          // 清除工作站分配
          const employee = await db.getEmployeeById(id);
          if (employee && employee.workstationId) {
            await db.updateWorkstation(employee.workstationId, { assignedUser: null });
          }
          const deleted = await db.deleteEmployee(id);
          results.push({ id, success: deleted, action: 'delete' });
          break;
        default:
          results.push({ id, success: false, error: '不支持的操作类型' });
      }
    } catch (error) {
      results.push({ id, success: false, error: '操作失败' });
    }
  }
  
  res.json({
    message: '批量操作完成',
    results
  });
}));

export default router;