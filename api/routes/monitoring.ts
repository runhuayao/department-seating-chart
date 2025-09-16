import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SystemMonitor } from '../services/system-monitor';
import { ConnectionRecoveryManager, DatabaseRecoveryManager } from '../services/recovery-manager';
import { WebSocketConnectionManager } from '../services/connection-manager';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

let systemMonitor: SystemMonitor;
let connectionRecovery: ConnectionRecoveryManager;
let databaseRecovery: DatabaseRecoveryManager;
let connectionManager: WebSocketConnectionManager;

/**
 * 初始化监控路由
 */
export function initializeMonitoringRoutes(
  monitor: SystemMonitor,
  connRecovery: ConnectionRecoveryManager,
  dbRecovery: DatabaseRecoveryManager,
  connManager: WebSocketConnectionManager
): void {
  systemMonitor = monitor;
  connectionRecovery = connRecovery;
  databaseRecovery = dbRecovery;
  connectionManager = connManager;
}

/**
 * 获取系统状态概览
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const systemStatus = systemMonitor.getSystemStatus();
    const databaseStatus = databaseRecovery.getDatabaseStatus();
    const connectionStats = connectionManager.getStats();
    const recoveryStats = connectionRecovery.getRecoveryStats();
    
    res.json({
      success: true,
      data: {
        system: systemStatus,
        database: databaseStatus,
        connections: connectionStats,
        recovery: recoveryStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统状态失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统指标
 */
router.get('/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { timeRange = '1h', granularity = '5m' } = req.query;
    
    const metrics = await systemMonitor.getMetrics(
      timeRange as string,
      granularity as string
    );
    
    res.json({
      success: true,
      data: {
        metrics,
        timeRange,
        granularity,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取系统指标失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统指标失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取活跃告警
 */
router.get('/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { level, limit = 50, offset = 0 } = req.query;
    
    const alerts = systemMonitor.getActiveAlerts()
      .filter(alert => !level || alert.level === level)
      .slice(Number(offset), Number(offset) + Number(limit));
    
    const totalCount = systemMonitor.getActiveAlerts()
      .filter(alert => !level || alert.level === level).length;
    
    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < totalCount
        },
        summary: {
          critical: alerts.filter(a => a.level === 'critical').length,
          warning: alerts.filter(a => a.level === 'warning').length,
          info: alerts.filter(a => a.level === 'info').length
        }
      }
    });
  } catch (error) {
    console.error('获取告警信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取告警信息失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取性能报告
 */
router.get('/performance', authenticateToken, requirePermission('system:monitor'), async (req: Request, res: Response) => {
  try {
    const { period = 'daily', format = 'json' } = req.query;
    
    const report = await systemMonitor.generatePerformanceReport(
      period as string,
      format as string
    );
    
    if (format === 'json') {
      res.json({
        success: true,
        data: report
      });
    } else {
      // 其他格式（如CSV、PDF）的处理
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="performance-report-${period}.${format}"`);
      res.send(report);
    }
  } catch (error) {
    console.error('生成性能报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成性能报告失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取连接统计信息
 */
router.get('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = connectionManager.getStats();
    const recoveryStats = connectionRecovery.getRecoveryStats();
    
    res.json({
      success: true,
      data: {
        current: stats,
        recovery: recoveryStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取连接统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取连接统计失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取数据库健康状态
 */
router.get('/database', authenticateToken, async (req: Request, res: Response) => {
  try {
    const status = databaseRecovery.getDatabaseStatus();
    const connectionPool = await systemMonitor.getDatabaseMetrics();
    
    res.json({
      success: true,
      data: {
        status,
        connectionPool,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库状态失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 触发手动健康检查
 */
router.post('/health-check', authenticateToken, requirePermission('system:admin'), async (req: Request, res: Response) => {
  try {
    const { component } = req.body;
    
    let result;
    if (component === 'database') {
      result = await databaseRecovery.performHealthCheck();
    } else if (component === 'connections') {
      result = await connectionRecovery.performHealthCheck();
    } else {
      // 全面健康检查
      result = {
        database: await databaseRecovery.performHealthCheck(),
        connections: await connectionRecovery.performHealthCheck(),
        system: systemMonitor.getSystemStatus()
      };
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(500).json({
      success: false,
      message: '健康检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 清除已解决的告警
 */
router.delete('/alerts/:alertId', authenticateToken, requirePermission('system:admin'), async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    
    const success = await systemMonitor.resolveAlert(alertId, reason);
    
    if (success) {
      res.json({
        success: true,
        message: '告警已解决'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '告警不存在或已解决'
      });
    }
  } catch (error) {
    console.error('解决告警失败:', error);
    res.status(500).json({
      success: false,
      message: '解决告警失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统配置
 */
router.get('/config', authenticateToken, requirePermission('system:admin'), async (req: Request, res: Response) => {
  try {
    const config = systemMonitor.getMonitoringConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取监控配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取监控配置失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 更新系统配置
 */
router.put('/config', authenticateToken, requirePermission('system:admin'), async (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    
    await systemMonitor.updateMonitoringConfig(config);
    
    res.json({
      success: true,
      message: '监控配置已更新'
    });
  } catch (error) {
    console.error('更新监控配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新监控配置失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 导出监控数据
 */
router.get('/export', authenticateToken, requirePermission('system:admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format = 'json', components } = req.query;
    
    const exportData = await systemMonitor.exportMonitoringData({
      startDate: startDate as string,
      endDate: endDate as string,
      format: format as string,
      components: components ? (components as string).split(',') : undefined
    });
    
    if (format === 'json') {
      res.json({
        success: true,
        data: exportData
      });
    } else {
      const filename = `monitoring-export-${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    }
  } catch (error) {
    console.error('导出监控数据失败:', error);
    res.status(500).json({
      success: false,
      message: '导出监控数据失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
export { initializeMonitoringRoutes };