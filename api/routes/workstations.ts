import { Router } from 'express';
import db from '../models/database.js';
import { authenticateToken, requireAdmin, requireUserOrAdmin, rateLimit } from '../middleware/auth.js';

const router = Router();

// 错误处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 应用频率限制
router.use(rateLimit(50, 15 * 60 * 1000)); // 每15分钟最多50次请求

// 获取所有工作站 - 已移除登录验证
router.get('/', asyncHandler(async (req: any, res: any) => {
  const { department, status, assignedUser } = req.query;
  let workstations = await db.getWorkstations();
  
  // 过滤条件
  if (department) {
    workstations = workstations.filter(ws => ws.department === department);
  }
  
  if (status) {
    workstations = workstations.filter(ws => ws.status === status);
  }
  
  if (assignedUser) {
    workstations = workstations.filter(ws => ws.assignedUser === assignedUser);
  }
  
  res.json(workstations);
}));

// 获取单个工作站 - 已移除登录验证
router.get('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const workstation = await db.getWorkstationById(id);
  
  if (!workstation) {
    return res.status(404).json({ error: '工作站不存在' });
  }
  
  res.json(workstation);
}));

// 创建新工作站 - 已移除登录验证，允许直接添加工作站
router.post('/', asyncHandler(async (req: any, res: any) => {
  const { 
    name, 
    status,
    building,
    floor,
    x_position,
    y_position,
    width,
    height,
    equipment,
    notes,
    department_id,
    employee_id,
    ip_address,
    mac_address,
    department
  } = req.body;
  
  // 验证必填字段
  if (!name) {
    return res.status(400).json({ 
      error: '缺少必要参数',
      required: ['name']
    });
  }
  
  try {
    const newWorkstation = await db.createWorkstation({
      name,
      ipAddress: ip_address || '',
      macAddress: mac_address || '',
      status: status || 'available',
      location: {
        floor: floor || 1,
        room: 'Room A',
        seat: 'Seat 1',
        position: { x: x_position || 0, y: y_position || 0 }
      },
      specifications: {
        cpu: equipment ? 'Intel i5' : undefined,
        memory: equipment ? '8GB' : undefined,
        storage: equipment ? '256GB SSD' : undefined,
        os: equipment ? 'Windows 10' : undefined
      },
      department: department || 'IT',
      assignedUser: employee_id ? `Employee-${employee_id}` : null
    });

    res.status(201).json({
      message: '工作站创建成功',
      workstation: newWorkstation
    });
  } catch (error) {
    console.error('创建工作站失败:', error);
    res.status(500).json({ error: '创建工作站失败' });
  }
}));

// 更新工作站 - 已移除登录验证
router.put('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const updates = req.body;
  
  // 如果更新IP地址，检查是否重复
  if (updates.ipAddress) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(updates.ipAddress)) {
      return res.status(400).json({ error: 'IP地址格式不正确' });
    }
    
    const existingWorkstations = await db.getWorkstations();
    const ipExists = existingWorkstations.some(ws => ws.ipAddress === updates.ipAddress && ws.id !== id);
    if (ipExists) {
      return res.status(409).json({ error: 'IP地址已被使用' });
    }
  }
  
  const updatedWorkstation = await db.updateWorkstation(id, updates);
  
  if (!updatedWorkstation) {
    return res.status(404).json({ error: '工作站不存在' });
  }
  
  res.json({
    message: '工作站更新成功',
    workstation: updatedWorkstation
  });
}));

// 删除工作站 - 已移除登录验证
router.delete('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const deleted = await db.deleteWorkstation(id);
  
  if (!deleted) {
    return res.status(404).json({ error: '工作站不存在' });
  }
  
  res.json({ message: '工作站删除成功' });
}));

// 批量操作 - 已移除登录验证
router.post('/batch', asyncHandler(async (req: any, res: any) => {
  const { action, ids } = req.body;
  
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '缺少操作类型或工作站ID列表' });
  }
  
  const results = [];
  
  for (const id of ids) {
    try {
      switch (action) {
        case 'delete':
          const deleted = await db.deleteWorkstation(id);
          results.push({ id, success: deleted, action: 'delete' });
          break;
        case 'offline':
          const offlineWs = await db.updateWorkstation(id, { status: 'offline' });
          results.push({ id, success: !!offlineWs, action: 'offline' });
          break;
        case 'online':
          const onlineWs = await db.updateWorkstation(id, { status: 'online' });
          results.push({ id, success: !!onlineWs, action: 'online' });
          break;
        case 'maintenance':
          const maintenanceWs = await db.updateWorkstation(id, { status: 'maintenance' });
          results.push({ id, success: !!maintenanceWs, action: 'maintenance' });
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

// 工作站状态统计 - 已移除登录验证
router.get('/stats/status', asyncHandler(async (req: any, res: any) => {
  const workstations = await db.getWorkstations();
  
  const stats = {
    total: workstations.length,
    online: workstations.filter(ws => ws.status === 'online').length,
    offline: workstations.filter(ws => ws.status === 'offline').length,
    maintenance: workstations.filter(ws => ws.status === 'maintenance').length,
    assigned: workstations.filter(ws => ws.assignedUser).length,
    unassigned: workstations.filter(ws => !ws.assignedUser).length
  };
  
  res.json(stats);
}));

// 按部门统计
router.get('/stats/department', asyncHandler(async (req: any, res: any) => {
  const workstations = await db.getWorkstations();
  
  const departmentStats = workstations.reduce((acc: any, ws) => {
    if (!acc[ws.department]) {
      acc[ws.department] = {
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0
      };
    }
    
    acc[ws.department].total++;
    acc[ws.department][ws.status]++;
    
    return acc;
  }, {});
  
  res.json(departmentStats);
}));

export default router;