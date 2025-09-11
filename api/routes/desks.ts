/**
 * 工位管理API路由
 * 处理工位信息、分配关系等相关接口
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DeskDAO, EmployeeDAO, SystemLogDAO } from '../database/dao.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * 根据部门ID获取工位列表
 * GET /api/desks/department/:departmentId
 */
router.get('/department/:departmentId', async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.departmentId);
    
    if (isNaN(departmentId)) {
      return res.status(400).json({
        success: false,
        message: '无效的部门ID'
      });
    }

    const desks = await DeskDAO.findByDepartmentId(departmentId);
    
    res.json({
      success: true,
      data: desks,
      message: '获取工位列表成功'
    });
  } catch (error) {
    console.error('获取工位列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 根据工位ID获取工位详情
 * GET /api/desks/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deskId = parseInt(req.params.id);
    
    if (isNaN(deskId)) {
      return res.status(400).json({
        success: false,
        message: '无效的工位ID'
      });
    }

    // 通过部门获取所有工位，然后找到指定工位
    // 这里需要先获取工位所属部门，简化处理，我们可以添加一个直接查询工位的方法
    // 暂时返回错误，提示需要通过部门查询
    return res.status(400).json({
      success: false,
      message: '请通过部门ID查询工位列表获取工位详情'
    });
  } catch (error) {
    console.error('获取工位详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});


// 验证工位分配请求的数据结构
const assignDeskSchema = z.object({
  employee_id: z.number().int().positive('员工ID必须是正整数')
});

/**
 * 分配工位给员工
 * POST /api/desks/:id/assign
 */
router.post('/:id/assign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const deskId = parseInt(req.params.id);
    
    if (isNaN(deskId)) {
      return res.status(400).json({
        success: false,
        message: '无效的工位ID'
      });
    }

    // 验证请求数据
    const validation = assignDeskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求数据格式错误',
        errors: validation.error.errors
      });
    }

    const { employee_id } = validation.data;
    const userId = (req as any).user?.id;

    // 检查员工是否存在
    const employee = await EmployeeDAO.findById(employee_id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: '员工不存在'
      });
    }

    // 分配工位
    const assignment = await DeskDAO.assignDesk(deskId, employee_id, userId);
    
    // 记录操作日志
    await SystemLogDAO.log({
      user_id: userId,
      action: 'assign_desk',
      resource_type: 'desk',
      resource_id: deskId.toString(),
      details: { employee_id, assignment_id: assignment.id },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: assignment,
      message: '工位分配成功'
    });
  } catch (error) {
    console.error('工位分配失败:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 释放工位
 * POST /api/desks/:id/release
 */
router.post('/:id/release', authenticateToken, async (req: Request, res: Response) => {
  try {
    const deskId = parseInt(req.params.id);
    
    if (isNaN(deskId)) {
      return res.status(400).json({
        success: false,
        message: '无效的工位ID'
      });
    }

    const userId = (req as any).user?.id;
    
    // 释放工位
    const success = await DeskDAO.releaseDesk(deskId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '工位未分配或已释放'
      });
    }
    
    // 记录操作日志
    await SystemLogDAO.log({
      user_id: userId,
      action: 'release_desk',
      resource_type: 'desk',
      resource_id: deskId.toString(),
      details: { released_at: new Date().toISOString() },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: {
        desk_id: deskId,
        released_at: new Date().toISOString(),
        status: 'released'
      },
      message: '工位释放成功'
    });
  } catch (error) {
    console.error('工位释放失败:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 搜索工位
 * GET /api/desks/search
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const keyword = req.query.keyword as string;
    
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }
    
    const desks = await DeskDAO.search(keyword.trim());
    
    res.json({
      success: true,
      data: desks,
      message: '搜索工位成功'
    });
  } catch (error) {
    console.error('搜索工位失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 验证创建工位请求的数据结构
const createDeskSchema = z.object({
  desk_number: z.string().min(1, '工位编号不能为空'),
  department_id: z.number().int().positive('部门ID必须是正整数'),
  position_x: z.number().min(0, 'X坐标不能为负数'),
  position_y: z.number().min(0, 'Y坐标不能为负数'),
  width: z.number().positive('宽度必须大于0'),
  height: z.number().positive('高度必须大于0'),
  ip_address: z.string().optional(),
  computer_name: z.string().optional(),
  equipment_info: z.any().optional()
});

/**
 * 创建新工位
 * POST /api/desks
 * 注意：已移除登录验证，允许直接添加工位
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 验证请求数据
    const validation = createDeskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求数据格式错误',
        errors: validation.error.errors
      });
    }

    const deskData = validation.data;
    
    // 创建工位
    const newDesk = await DeskDAO.create({
      ...deskData,
      status: 'available'
    });
    
    // 记录操作日志（无需用户认证）
    await SystemLogDAO.log({
      user_id: null, // 无需登录验证
      action: 'create_desk',
      resource_type: 'desk',
      resource_id: newDesk.id.toString(),
      details: { desk_number: newDesk.desk_number, department_id: newDesk.department_id },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      data: newDesk,
      message: '工位创建成功'
    });
  } catch (error) {
    console.error('创建工位失败:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
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