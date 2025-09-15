import { Router } from 'express';
import { DataSyncWebSocket } from '../websocket/data-sync.js';

const router = Router();

// 全局WebSocket实例引用（需要在服务器启动时设置）
let dataSyncWebSocket: DataSyncWebSocket | null = null;

/**
 * 设置WebSocket实例引用
 */
export function setDataSyncWebSocket(instance: DataSyncWebSocket): void {
  dataSyncWebSocket = instance;
}

// 导出设置函数
export { setDataSyncWebSocket as setWebSocketInstance };

/**
 * 获取WebSocket连接状态
 */
router.get('/status', (req, res) => {
  try {
    if (!dataSyncWebSocket) {
      return res.status(503).json({
        error: 'WebSocket服务未初始化',
        connected: false,
        activeConnection: null,
        clientsCount: 0
      });
    }

    const status = {
      connected: true,
      activeConnection: dataSyncWebSocket.getActiveConnection(),
      clientsCount: dataSyncWebSocket.getConnectedClientsCount(),
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    console.error('获取WebSocket状态失败:', error);
    res.status(500).json({
      error: '获取WebSocket状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 获取WebSocket连接日志
 */
router.get('/logs', (req, res) => {
  try {
    if (!dataSyncWebSocket) {
      return res.status(503).json({
        error: 'WebSocket服务未初始化',
        logs: []
      });
    }

    const logs = dataSyncWebSocket.getConnectionLog();
    const limit = parseInt(req.query.limit as string) || 50;
    const limitedLogs = logs.slice(-limit);

    res.json({
      logs: limitedLogs,
      total: logs.length,
      limit: limit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取WebSocket日志失败:', error);
    res.status(500).json({
      error: '获取WebSocket日志失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 清除WebSocket连接日志
 */
router.delete('/logs', (req, res) => {
  try {
    if (!dataSyncWebSocket) {
      return res.status(503).json({
        error: 'WebSocket服务未初始化'
      });
    }

    dataSyncWebSocket.clearConnectionLog();
    
    res.json({
      success: true,
      message: 'WebSocket连接日志已清除',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('清除WebSocket日志失败:', error);
    res.status(500).json({
      error: '清除WebSocket日志失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 强制断开当前活跃连接
 */
router.post('/disconnect', (req, res) => {
  try {
    if (!dataSyncWebSocket) {
      return res.status(503).json({
        error: 'WebSocket服务未初始化'
      });
    }

    const activeConnection = dataSyncWebSocket.getActiveConnection();
    if (!activeConnection) {
      return res.json({
        success: false,
        message: '当前没有活跃连接',
        timestamp: new Date().toISOString()
      });
    }

    // 通过销毁并重新创建来强制断开所有连接
    dataSyncWebSocket.destroy();
    
    res.json({
      success: true,
      message: `已强制断开连接: ${activeConnection}`,
      disconnectedConnection: activeConnection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('强制断开连接失败:', error);
    res.status(500).json({
      error: '强制断开连接失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;