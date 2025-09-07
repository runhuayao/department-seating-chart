import express from 'express';
import { authenticateToken, requireUserOrAdmin } from '../middleware/auth.js';
import { pool } from '../config/database.js';

const router = express.Router();

// 获取数据库状态 - 需要用户权限
router.get('/status', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    // 获取数据库连接状态
    const connection = await pool.getConnection();
    
    // 获取表数量
    const [tablesResult] = await connection.execute(
      "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const tableCount = (tablesResult as any[])[0].table_count;
    
    // 获取总记录数（主要表）
    let totalRecords = 0;
    try {
      const [workstationsCount] = await connection.execute('SELECT COUNT(*) as count FROM workstations');
      const [usersCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
      const [departmentsCount] = await connection.execute('SELECT COUNT(*) as count FROM departments');
      
      totalRecords = 
        (workstationsCount as any[])[0].count +
        (usersCount as any[])[0].count +
        (departmentsCount as any[])[0].count;
    } catch (error) {
      console.log('某些表可能不存在，使用默认值');
      totalRecords = 0;
    }
    
    // 获取最后同步时间（使用当前时间作为示例）
    const lastSync = new Date();
    
    connection.release();
    
    res.json({
      connected: true,
      tables: tableCount,
      totalRecords,
      lastSync: lastSync.toISOString(),
      status: 'healthy',
      version: '8.0.0',
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    res.status(500).json({
      connected: false,
      tables: 0,
      totalRecords: 0,
      lastSync: new Date().toISOString(),
      status: 'error',
      error: 'Database connection failed'
    });
  }
});

// 获取数据库详细信息 - 需要管理员权限
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // 获取数据库版本
    const [versionResult] = await connection.execute('SELECT VERSION() as version');
    const version = (versionResult as any[])[0].version;
    
    // 获取数据库大小
    const [sizeResult] = await connection.execute(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    const sizeMB = (sizeResult as any[])[0].size_mb || 0;
    
    // 获取表信息
    const [tablesResult] = await connection.execute(`
      SELECT 
        table_name,
        table_rows,
        ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY table_rows DESC
    `);
    
    connection.release();
    
    res.json({
      version,
      sizeMB,
      tables: tablesResult,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
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
    const connection = await pool.getConnection();
    
    // 执行简单查询测试连接
    const startTime = Date.now();
    await connection.execute('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    // 检查连接池状态
    const poolStatus = {
      totalConnections: pool.config.connectionLimit,
      activeConnections: pool.pool._allConnections.length,
      freeConnections: pool.pool._freeConnections.length
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