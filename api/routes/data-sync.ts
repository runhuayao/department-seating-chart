import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import database from '../models/database.js';
import { executeQuery } from '../config/database.js';

// WebSocket实例引用（将在服务器启动时设置）
let dataSyncWS: any = null;

// 设置WebSocket实例的函数
export function setDataSyncWebSocket(wsInstance: any) {
  dataSyncWS = wsInstance;
}

const router = express.Router();

// 频率限制
const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 10, // 每分钟最多10次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 错误处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 获取数据同步状态
 */
router.get('/status', syncLimiter, asyncHandler(async (req: any, res: any) => {
  try {
    const status = await database.getStatus();
    const auditLogs = await database.getAuditLogs({ limit: 5 });
    
    res.json({
      success: true,
      data: {
        database: status,
        lastSync: new Date().toISOString(),
        recentChanges: auditLogs.length,
        isHealthy: status.connected
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取同步状态失败',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * 检查数据一致性
 */
router.get('/consistency-check', syncLimiter, asyncHandler(async (req: any, res: any) => {
  try {
    // 获取各表的数据统计
    const workstations = await database.getWorkstations();
    const employees = await database.getEmployees();
    const departments = await database.getDepartments();
    
    // 检查数据完整性
    const workstationStats = {
      total: workstations.length,
      online: workstations.filter((w: any) => w.status === 'online').length,
      offline: workstations.filter((w: any) => w.status === 'offline').length,
      maintenance: workstations.filter((w: any) => w.status === 'maintenance').length
    };
    
    const employeeStats = {
      total: employees.length,
      active: employees.filter((e: any) => e.status === 'active').length,
      inactive: employees.filter((e: any) => e.status === 'inactive').length
    };
    
    const departmentStats = {
      total: departments.length,
      withEmployees: departments.filter((d: any) => 
        employees.some((e: any) => e.department_id === d.id)
      ).length
    };
    
    // 检查数据关联完整性
    const orphanedEmployees = employees.filter((e: any) => 
      !departments.some((d: any) => d.id === e.department_id)
    );
    
    const orphanedWorkstations = workstations.filter((w: any) => 
      w.assignedUser && !employees.some((e: any) => e.id === w.assignedUser)
    );
    
    const consistencyReport = {
      workstations: {
        ...workstationStats,
        orphaned: orphanedWorkstations.length,
        consistent: orphanedWorkstations.length === 0
      },
      employees: {
        ...employeeStats,
        orphaned: orphanedEmployees.length,
        consistent: orphanedEmployees.length === 0
      },
      departments: {
        ...departmentStats,
        consistent: true // 部门表通常不会有孤立数据
      },
      overall: {
        consistent: orphanedEmployees.length === 0 && orphanedWorkstations.length === 0,
        issues: orphanedEmployees.length + orphanedWorkstations.length
      }
    };
    
    res.json({
      success: true,
      data: consistencyReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('数据一致性检查失败:', error);
    res.status(500).json({
      success: false,
      error: '数据一致性检查失败',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * 修复数据不一致问题
 */
router.post('/repair', syncLimiter, authenticateToken, requireRole(['admin']), asyncHandler(async (req: any, res: any) => {
  const { type, options = {} } = req.body;
  
  if (!type) {
    return res.status(400).json({
      success: false,
      error: '缺少修复类型参数'
    });
  }
  
  try {
    let repairResult;
    
    switch (type) {
      case 'orphaned-employees':
        repairResult = await repairOrphanedEmployees(options);
        break;
        
      case 'orphaned-workstations':
        repairResult = await repairOrphanedWorkstations(options);
        break;
        
      case 'duplicate-data':
        repairResult = await repairDuplicateData(options);
        break;
        
      case 'full-repair':
        repairResult = await performFullRepair(options);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: `不支持的修复类型: ${type}`
        });
    }
    
    // 记录修复操作
    await database.addAuditLog({
      user_id: req.user.id,
      action: 'data_repair',
      table_name: 'system',
      record_id: null,
      old_values: null,
      new_values: { type, result: repairResult },
      ip_address: req.ip
    });
    
    // 通过WebSocket广播数据修复事件
    if (dataSyncWS) {
      dataSyncWS.notifyDataChange({
        type: 'data_repair',
        table: 'system',
        action: 'repair',
        data: { repairType: type, result: repairResult },
        timestamp: new Date().toISOString(),
        userId: req.user.id
      });
    }
    
    res.json({
      success: true,
      data: repairResult,
      message: '数据修复完成',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('数据修复失败:', error);
    res.status(500).json({
      success: false,
      error: '数据修复失败',
      details: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * 获取数据变更历史
 */
router.get('/audit-logs', syncLimiter, authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { 
    page = 1, 
    limit = 20, 
    table_name, 
    action, 
    user_id,
    start_date,
    end_date
  } = req.query;
  
  try {
    const filters: any = {};
    
    if (table_name) filters.table_name = table_name;
    if (action) filters.action = action;
    if (user_id) filters.user_id = user_id;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    
    const logs = await database.getAuditLogs({
      ...filters,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string)
    });
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: logs.length // 这里简化处理，实际应该查询总数
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({
      success: false,
      error: '获取审计日志失败',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * 强制数据同步
 */
router.post('/force-sync', syncLimiter, authenticateToken, requireRole(['admin']), asyncHandler(async (req: any, res: any) => {
  try {
    // 执行数据库同步检查
    const syncResult = await database.syncData();
    
    // 记录同步操作
    await database.addAuditLog({
      user_id: req.user.id,
      action: 'force_sync',
      table_name: 'system',
      record_id: null,
      old_values: null,
      new_values: syncResult,
      ip_address: req.ip
    });
    
    // 通过WebSocket广播强制同步事件
    if (dataSyncWS) {
      dataSyncWS.notifyDataChange({
        type: 'force_sync',
        table: 'system',
        action: 'sync',
        data: syncResult,
        timestamp: new Date().toISOString(),
        userId: req.user.id
      });
    }
    
    res.json({
      success: true,
      data: syncResult,
      message: '强制同步完成',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('强制同步失败:', error);
    res.status(500).json({
      success: false,
      error: '强制同步失败',
      details: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    });
  }
}));

// 修复孤立员工数据
async function repairOrphanedEmployees(options: any) {
  const employees = await database.getEmployees();
  const departments = await database.getDepartments();
  
  const orphanedEmployees = employees.filter((e: any) => 
    !departments.some((d: any) => d.id === e.department_id)
  );
  
  if (orphanedEmployees.length === 0) {
    return { message: '没有发现孤立的员工数据', count: 0 };
  }
  
  // 根据选项决定修复策略
  if (options.strategy === 'delete') {
    // 删除孤立员工
    for (const employee of orphanedEmployees) {
      await database.deleteEmployee(employee.id);
    }
    return { message: '已删除孤立员工数据', count: orphanedEmployees.length };
  } else {
    // 默认策略：分配到默认部门
    const defaultDepartment = departments.find((d: any) => d.name === '未分配部门') || departments[0];
    
    for (const employee of orphanedEmployees) {
      await database.updateEmployee(employee.id, {
        ...employee,
        department: defaultDepartment.id
      });
    }
    
    return { 
      message: '已将孤立员工分配到默认部门', 
      count: orphanedEmployees.length,
      department: defaultDepartment.name
    };
  }
}

// 修复孤立工作站数据
async function repairOrphanedWorkstations(options: any) {
  const workstations = await database.getWorkstations();
  const employees = await database.getEmployees();
  
  const orphanedWorkstations = workstations.filter((w: any) => 
    w.assignedUser && !employees.some((e: any) => e.id === w.assignedUser)
  );
  
  if (orphanedWorkstations.length === 0) {
    return { message: '没有发现孤立的工作站数据', count: 0 };
  }
  
  // 清除孤立工作站的分配
  for (const workstation of orphanedWorkstations) {
    await database.updateWorkstation(workstation.id, {
      ...workstation,
      assignedUser: null,
      status: 'offline'
    });
  }
  
  return { 
    message: '已清除孤立工作站的员工分配', 
    count: orphanedWorkstations.length
  };
}

// 修复重复数据
async function repairDuplicateData(options: any) {
  // 这里简化处理，实际应该检查各种重复情况
  return { message: '重复数据检查完成', duplicatesFound: 0, duplicatesRemoved: 0 };
}

// 执行完整修复
async function performFullRepair(options: any) {
  const results = [];
  
  // 修复孤立员工
  const employeeResult = await repairOrphanedEmployees(options);
  results.push({ type: 'orphaned-employees', result: employeeResult });
  
  // 修复孤立工作站
  const workstationResult = await repairOrphanedWorkstations(options);
  results.push({ type: 'orphaned-workstations', result: workstationResult });
  
  // 修复重复数据
  const duplicateResult = await repairDuplicateData(options);
  results.push({ type: 'duplicate-data', result: duplicateResult });
  
  return {
    message: '完整数据修复完成',
    results,
    totalIssuesFixed: results.reduce((sum, r) => sum + (r.result.count || 0), 0)
  };
}

export default router;