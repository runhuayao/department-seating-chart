/**
 * 部门管理API路由
 * 处理部门信息、员工、工位等相关接口
 */
import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireUserOrAdmin, rateLimiter } from '../middleware/auth.js';
import db from '../models/database.js';

const router = Router();

// 应用频率限制（移除认证要求以支持无登录访问）
router.use(rateLimiter(30, 15 * 60 * 1000)); // 每15分钟最多30次请求
// 移除认证要求，允许无登录访问部门信息
// router.use(authenticateToken); // 所有部门API都需要认证

/**
 * 获取所有部门列表
 * GET /api/departments
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // 从数据库获取部门列表，支持Redis缓存
    const departments = await db.getDepartments();
    
    res.json({
      success: true,
      data: departments,
      message: '部门列表获取成功'
    });
  } catch (error) {
    console.error('获取部门列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments',
      message: '获取部门列表失败'
    });
  }
});

export default router;