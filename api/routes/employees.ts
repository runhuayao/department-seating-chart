/**
 * 员工管理API路由
 * 处理员工信息查询、搜索等相关接口
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * 根据员工ID获取员工信息
 * GET /api/employees/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id);
    
    if (isNaN(employeeId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid employee ID'
      });
      return;
    }
    
    // TODO: 从数据库获取员工信息
    // 临时返回模拟数据
    const mockEmployee = {
      id: employeeId,
      name: `Employee ${employeeId}`,
      department_id: 1,
      position: 'Software Engineer',
      email: `employee${employeeId}@company.com`,
      phone: '123-456-7890',
      status: 'online',
      avatar: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockEmployee
    });
  } catch (error) {
    console.error('获取员工信息失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee'
    });
  }
});

/**
 * 根据部门ID获取员工列表
 * GET /api/employees/by-dept/:deptId
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
    
    // TODO: 从数据库获取部门员工列表
    // 临时返回模拟数据
    const mockEmployees = [
      {
        id: 1,
        name: 'John Doe',
        department_id: deptId,
        position: 'Senior Engineer',
        email: 'john.doe@company.com',
        phone: '123-456-7890',
        status: 'online',
        avatar: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Jane Smith',
        department_id: deptId,
        position: 'Product Manager',
        email: 'jane.smith@company.com',
        phone: '123-456-7891',
        status: 'offline',
        avatar: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: mockEmployees
    });
  } catch (error) {
    console.error('获取部门员工列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees by department'
    });
  }
});

/**
 * 搜索员工
 * GET /api/employees/search?q=keyword&dept=deptId
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q: query, dept: deptId } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
      return;
    }
    
    // TODO: 实现数据库搜索逻辑
    // 临时返回模拟搜索结果
    const mockResults = [
      {
        id: 1,
        name: 'John Doe',
        department_id: deptId ? parseInt(deptId as string) : 1,
        position: 'Senior Engineer',
        email: 'john.doe@company.com',
        phone: '123-456-7890',
        status: 'online',
        avatar: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ].filter(emp => 
      emp.name.toLowerCase().includes(query.toLowerCase()) ||
      emp.position.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json({
      success: true,
      data: mockResults
    });
  } catch (error) {
    console.error('搜索员工失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search employees'
    });
  }
});

/**
 * 获取所有员工列表（分页）
 * GET /api/employees?page=1&limit=10
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    // TODO: 从数据库获取分页员工列表
    // 临时返回模拟数据
    const mockEmployees = Array.from({ length: limit }, (_, index) => ({
      id: offset + index + 1,
      name: `Employee ${offset + index + 1}`,
      department_id: Math.floor(Math.random() * 4) + 1,
      position: 'Software Engineer',
      email: `employee${offset + index + 1}@company.com`,
      phone: '123-456-7890',
      status: Math.random() > 0.5 ? 'online' : 'offline',
      avatar: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    res.json({
      success: true,
      data: {
        employees: mockEmployees,
        pagination: {
          page,
          limit,
          total: 100, // 模拟总数
          totalPages: Math.ceil(100 / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取员工列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees'
    });
  }
});

export default router;