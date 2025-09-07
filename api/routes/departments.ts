/**
 * 部门管理API路由
 * 处理部门信息、员工、工位等相关接口
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

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
    // TODO: 从数据库获取部门列表
    const mockDepartments = [
      { id: 1, name: 'Engineering', displayName: '工程部' },
      { id: 2, name: 'Marketing', displayName: '市场部' },
      { id: 3, name: 'Sales', displayName: '销售部' },
      { id: 4, name: 'HR', displayName: '人力资源部' }
    ];
    
    res.json({
      success: true,
      data: mockDepartments
    });
  } catch (error) {
    console.error('获取部门列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments'
    });
  }
});

export default router;