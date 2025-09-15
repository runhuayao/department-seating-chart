/**
 * 部门管理API路由
 * 处理部门信息、员工、工位等相关接口
 */
import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireUserOrAdmin, rateLimit } from '../middleware/auth.js';
import { db } from '../database/index.js';
import { DepartmentDAO } from '../database/dao.js';
import { getDepartmentSyncServer } from '../websocket/departmentSync.js';

const router = Router();

// 应用频率限制和认证
router.use(rateLimit(30, 15 * 60 * 1000)); // 每15分钟最多30次请求
router.use(authenticateToken); // 所有部门API都需要认证

/**
 * 获取部门配置信息
 * GET /api/departments/:department
 */
router.get('/:department', async (req: Request, res: Response): Promise<void> => {
  try {
    const { department } = req.params;
    
    // TODO: 从数据库获取部门配置
    // 临时返回模拟数据
    const mockConfig = {
      name: department,
      displayName: department,
      color: '#3B82F6',
      layout: {
        rows: 10,
        cols: 10,
        cellSize: 40
      },
      mapImage: `/images/${department.toLowerCase()}-map.png`
    };
    
    res.json({
      success: true,
      data: mockConfig
    });
  } catch (error) {
    console.error('获取部门配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department config'
    });
  }
});

/**
 * 获取所有部门列表
 * GET /api/departments
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await db.getDepartments();
    
    res.json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('获取部门列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
});

/**
 * 获取部门云数据（包含员工、工位等详细信息）
 * GET /api/departments/:department/cloud-data
 */
router.get('/:department/cloud-data', async (req: Request, res: Response): Promise<void> => {
  try {
    const { department } = req.params;
    
    // 获取部门基本信息
    const departments = await db.getDepartments();
    const deptInfo = departments.find(d => d.name === department || d.display_name === department);
    
    if (!deptInfo) {
      res.status(404).json({
        success: false,
        error: 'Department not found'
      });
      return;
    }
    
    // 获取部门员工
    const employees = await db.getEmployees();
    const deptEmployees = employees.filter(emp => emp.department === department);
    
    // 获取部门工位
    const workstations = await db.getWorkstations();
    const deptWorkstations = workstations.filter(ws => ws.department === department);
    
    // 统计信息
    const stats = {
      totalEmployees: deptEmployees.length,
      onlineEmployees: deptEmployees.filter(emp => emp.status === 'active').length,
      totalWorkstations: deptWorkstations.length,
      occupiedWorkstations: deptWorkstations.filter(ws => ws.employee_id).length,
      availableWorkstations: deptWorkstations.filter(ws => !ws.employee_id).length
    };
    
    res.json({
      success: true,
      data: {
        department: deptInfo,
        employees: deptEmployees,
        workstations: deptWorkstations,
        statistics: stats,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取部门云数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department cloud data'
    });
  }
});

/**
 * 更新部门信息
 * PUT /api/departments/:department
 */
router.put('/:department', requireUserOrAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { department } = req.params;
    const { display_name, description, building, floor, area } = req.body;
    
    // 验证输入
    if (!display_name) {
      res.status(400).json({
        success: false,
        error: 'Display name is required'
      });
      return;
    }
    
    // 获取部门ID
    const departments = await db.getDepartments();
    const deptInfo = departments.find(d => d.name === department || d.display_name === department);
    
    if (!deptInfo) {
      res.status(404).json({
        success: false,
        error: 'Department not found'
      });
      return;
    }
    
    // 调用数据库更新方法
      const updatedDepartment = await DepartmentDAO.update(deptInfo.id, {
        name: display_name,
        description,
        location: `${building || ''}-${floor || ''}-${area || ''}`
      });
    
    if (!updatedDepartment) {
      res.status(404).json({
        success: false,
        error: 'Department not found or update failed'
      });
      return;
    }
    
    // 通过WebSocket广播部门更新
    const syncServer = getDepartmentSyncServer();
    if (syncServer) {
      syncServer.broadcastDepartmentUpdate(updatedDepartment, 'update');
    }
    
    res.json({
      success: true,
      data: updatedDepartment,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('更新部门信息失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update department'
    });
  }
});

/**
 * 获取部门配置历史
 * GET /api/departments/:department/history
 */
router.get('/:department/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { department } = req.params;
    const { limit = 10 } = req.query;
    
    // TODO: 实现配置历史记录功能
    // 暂时返回模拟数据
    const mockHistory = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        action: 'update',
        field: 'display_name',
        old_value: '工程部',
        new_value: '技术部',
        user_id: 1,
        user_name: 'admin'
      }
    ];
    
    res.json({
      success: true,
      data: mockHistory.slice(0, Number(limit))
    });
  } catch (error) {
    console.error('获取部门配置历史失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department history'
    });
  }
});

export default router;