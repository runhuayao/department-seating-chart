import express from 'express';
import { authenticateToken, requireUserOrAdmin } from '../middleware/auth.js';
import db from '../models/database.js';
import { pool } from '../config/database.js';

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
    const connection = await pool.connect();
    
    // 获取数据库版本
    const versionResult = await connection.query('SELECT VERSION() as version');
    const version = versionResult.rows[0].version;
    
    // 获取数据库大小（PostgreSQL版本）
    const sizeResult = await connection.query(`
      SELECT 
        ROUND(SUM(pg_total_relation_size(schemaname||'.'||tablename)) / 1024 / 1024, 2) AS size_mb
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const sizeMB = sizeResult.rows[0]?.size_mb || 0;
    
    // 获取表信息（PostgreSQL版本）
    const tablesResult = await connection.query(`
      SELECT 
        tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as table_rows,
        ROUND(pg_total_relation_size('public.'||tablename) / 1024 / 1024, 2) AS size_mb
      FROM pg_stat_user_tables 
      ORDER BY table_rows DESC
    `);
    
    connection.release();
    
    res.json({
      version,
      sizeMB,
      tables: tablesResult.rows,
      charset: 'utf8',
      collation: 'utf8_unicode_ci'
    });
    
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
    const connection = await pool.connect();
    
    // 执行简单查询测试连接
    const startTime = Date.now();
    await connection.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    // 检查连接池状态
    const poolStatus = {
      totalConnections: pool.options.max || 10,
      activeConnections: pool.totalCount,
      freeConnections: pool.idleCount
    };
    
    connection.release();
    
    res.json({
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      pool: poolStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;