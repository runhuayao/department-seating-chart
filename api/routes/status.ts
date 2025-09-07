/**
 * 状态管理API路由
 * 处理员工状态心跳、概览数据等相关接口
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * 员工状态心跳上报
 * POST /api/status/heartbeat
 */
router.post('/heartbeat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, status } = req.body;
    
    if (!employeeId || !status || !['online', 'offline'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid employee ID or status'
      });
      return;
    }
    
    // TODO: 更新员工状态到数据库
    // 1. 验证员工ID是否存在
    // 2. 更新员工状态
    // 3. 记录状态变更日志
    
    console.log(`Employee ${employeeId} status updated to: ${status}`);
    
    res.json({
      success: true,
      data: {
        success: true,
        employeeId,
        status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('状态心跳上报失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update employee status'
    });
  }
});

/**
 * 获取员工状态
 * GET /api/status/employee/:id
 */
router.get('/employee/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id);
    
    if (isNaN(employeeId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid employee ID'
      });
      return;
    }
    
    // TODO: 从数据库获取员工状态
    const mockStatus = {
      employeeId,
      status: Math.random() > 0.5 ? 'online' : 'offline',
      lastSeen: new Date().toISOString(),
      location: {
        deskId: Math.floor(Math.random() * 10) + 1,
        deskNumber: `A${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`
      }
    };
    
    res.json({
      success: true,
      data: mockStatus
    });
  } catch (error) {
    console.error('获取员工状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee status'
    });
  }
});

/**
 * 获取部门状态概览
 * GET /api/status/department/:deptId
 */
router.get('/department/:deptId', async (req: Request, res: Response): Promise<void> => {
  try {
    const deptId = parseInt(req.params.deptId);
    
    if (isNaN(deptId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid department ID'
      });
      return;
    }
    
    // TODO: 从数据库统计部门状态数据
    const mockOverview = {
      departmentId: deptId,
      totalEmployees: Math.floor(Math.random() * 50) + 20,
      onlineEmployees: Math.floor(Math.random() * 30) + 10,
      offlineEmployees: Math.floor(Math.random() * 20) + 5,
      totalDesks: Math.floor(Math.random() * 60) + 30,
      occupiedDesks: Math.floor(Math.random() * 40) + 15,
      availableDesks: Math.floor(Math.random() * 20) + 10,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockOverview
    });
  } catch (error) {
    console.error('获取部门状态概览失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department status overview'
    });
  }
});

export default router;