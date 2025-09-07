/**
 * 工位管理API路由
 * 处理工位信息、分配关系等相关接口
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * 根据部门ID获取工位列表（包含分配信息）
 * GET /api/desks/by-dept/:deptId
 */
router.get('/by-dept/:deptId', async (req: Request, res: Response): Promise<void> => {
  try {
    const deptId = parseInt(req.params.deptId);
    
    if (isNaN(deptId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid department ID'
      });
      return;
    }
    
    // TODO: 从数据库获取工位和分配信息
    // 临时返回模拟数据
    const mockDesksWithAssignments = [
      {
        desk: {
          id: 1,
          desk_number: 'A001',
          department_id: deptId,
          position_x: 100,
          position_y: 100,
          width: 80,
          height: 60,
          status: 'occupied',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        assignment: {
          id: 1,
          desk_id: 1,
          employee_id: 1,
          assigned_at: new Date().toISOString(),
          status: 'active'
        }
      },
      {
        desk: {
          id: 2,
          desk_number: 'A002',
          department_id: deptId,
          position_x: 200,
          position_y: 100,
          width: 80,
          height: 60,
          status: 'available',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        assignment: null
      },
      {
        desk: {
          id: 3,
          desk_number: 'A003',
          department_id: deptId,
          position_x: 300,
          position_y: 100,
          width: 80,
          height: 60,
          status: 'occupied',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        assignment: {
          id: 2,
          desk_id: 3,
          employee_id: 2,
          assigned_at: new Date().toISOString(),
          status: 'active'
        }
      }
    ];
    
    res.json({
      success: true,
      data: mockDesksWithAssignments
    });
  } catch (error) {
    console.error('获取部门工位列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch desks by department'
    });
  }
});

/**
 * 根据工位ID获取工位详情
 * GET /api/desks/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deskId = parseInt(req.params.id);
    
    if (isNaN(deskId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid desk ID'
      });
      return;
    }
    
    // TODO: 从数据库获取工位详情
    const mockDesk = {
      id: deskId,
      desk_number: `A${String(deskId).padStart(3, '0')}`,
      department_id: 1,
      position_x: 100 + (deskId - 1) * 100,
      position_y: 100,
      width: 80,
      height: 60,
      status: deskId % 2 === 0 ? 'available' : 'occupied',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockDesk
    });
  } catch (error) {
    console.error('获取工位详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch desk details'
    });
  }
});

/**
 * 分配工位给员工
 * POST /api/desks/:id/assign
 */
router.post('/:id/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const deskId = parseInt(req.params.id);
    const { employee_id } = req.body;
    
    if (isNaN(deskId) || !employee_id) {
      res.status(400).json({
        success: false,
        error: 'Invalid desk ID or employee ID'
      });
      return;
    }
    
    // TODO: 实现工位分配逻辑
    // 1. 检查工位是否可用
    // 2. 检查员工是否已有工位
    // 3. 创建分配记录
    // 4. 更新工位状态
    
    const mockAssignment = {
      id: Date.now(), // 临时ID
      desk_id: deskId,
      employee_id: employee_id,
      assigned_at: new Date().toISOString(),
      status: 'active'
    };
    
    res.json({
      success: true,
      data: mockAssignment,
      message: 'Desk assigned successfully'
    });
  } catch (error) {
    console.error('分配工位失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign desk'
    });
  }
});

/**
 * 释放工位
 * POST /api/desks/:id/release
 */
router.post('/:id/release', async (req: Request, res: Response): Promise<void> => {
  try {
    const deskId = parseInt(req.params.id);
    
    if (isNaN(deskId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid desk ID'
      });
      return;
    }
    
    // TODO: 实现工位释放逻辑
    // 1. 查找当前分配记录
    // 2. 更新分配状态为inactive
    // 3. 更新工位状态为available
    
    res.json({
      success: true,
      message: 'Desk released successfully'
    });
  } catch (error) {
    console.error('释放工位失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release desk'
    });
  }
});

/**
 * 获取所有工位列表（分页）
 * GET /api/desks?page=1&limit=10&status=available
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;
    
    // TODO: 从数据库获取分页工位列表
    let mockDesks = Array.from({ length: limit }, (_, index) => ({
      id: offset + index + 1,
      desk_number: `A${String(offset + index + 1).padStart(3, '0')}`,
      department_id: Math.floor(Math.random() * 4) + 1,
      position_x: 100 + (index % 5) * 100,
      position_y: 100 + Math.floor(index / 5) * 80,
      width: 80,
      height: 60,
      status: Math.random() > 0.5 ? 'available' : 'occupied',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    // 根据状态过滤
    if (status) {
      mockDesks = mockDesks.filter(desk => desk.status === status);
    }
    
    res.json({
      success: true,
      data: {
        desks: mockDesks,
        pagination: {
          page,
          limit,
          total: status ? mockDesks.length : 200, // 模拟总数
          totalPages: Math.ceil((status ? mockDesks.length : 200) / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取工位列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch desks'
    });
  }
});

export default router;