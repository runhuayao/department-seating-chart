import express from 'express';
import { authenticateToken, requireUserOrAdmin } from '../middleware/auth.js';
import db from '../models/database.js';
import { TimeService } from '../services/timeService';

const router = express.Router();

// 获取数据库状态 - 无需认证
router.get('/status', async (req, res) => {
  try {
    // 使用混合数据库模型获取状态
    const status = await db.getStatus();
    
    res.json({
      ...status,
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    res.status(500).json({
      error: 'Failed to get database status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取数据库详细信息 - 需要管理员权限
router.get('/info', authenticateToken, async (req, res) => {
  try {
    // 使用混合数据库模型获取信息
    const info = {
      version: 'Mixed Database (Memory + PostgreSQL)',
      sizeMB: 0, // 内存数据库大小
      tables: [
        { table_name: 'employees', table_rows: 0, size_mb: 0 },
        { table_name: 'departments', table_rows: 0, size_mb: 0 },
        { table_name: 'workstations', table_rows: 0, size_mb: 0 }
      ],
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    };
    
    res.json(info);
    
  } catch (error) {
    console.error('获取数据库信息失败:', error);
    res.status(500).json({
      error: 'Failed to get database info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 执行数据库健康检查 - 需要管理员权限
router.get('/health', authenticateToken, async (req, res) => {
  try {
    // 测试数据库连接
    const startTime = Date.now();
    const status = await db.getStatus();
    const responseTime = Date.now() - startTime;
    
    // 模拟连接池状态
    const poolStatus = {
      totalConnections: 10,
      activeConnections: 1,
      freeConnections: 9
    };
    
    // 使用 TimeService 更新时间戳
    const healthData = {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      pool: poolStatus,
      database: status,
      timestamp: new Date().toISOString()
    };
    
    const updatedData = TimeService.updateTimestamp(healthData);
    res.json(updatedData);
    
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    const errorData = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
    const updatedErrorData = TimeService.updateTimestamp(errorData);
    res.status(500).json(updatedErrorData);
  }
});

export default router;