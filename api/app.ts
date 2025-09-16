/**
 * This is a API server
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { pool } from './config/database';
import WebSocketManager from './websocket/manager';
import { ArchitectureService } from './services/architecture';
import { SystemMonitor } from './services/system-monitor';
import { ConnectionRecoveryManager, DatabaseRecoveryManager } from './services/recovery-manager';
import authRoutes from './routes/auth';
import architectureRoutes, { initializeArchitectureRoutes } from './routes/architecture';
import monitoringRoutes, { initializeMonitoringRoutes } from './routes/monitoring';
import path from 'path';
import { fileURLToPath } from 'url';

// ES模块中获取__filename和__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

// 导入系统架构关联逻辑组件
import { ConnectionManager } from './core/ConnectionManager.js';
import { DataSyncService } from './core/DataSyncService.js';
import { SystemIntegrationService } from './core/SystemIntegrationService.js';
import { WebSocketServer } from './websocket/server-monitor';
import { ComprehensiveRecoveryManager } from './websocket/recovery-manager';

import authRoutes from './routes/auth.js';
import departmentsRoutes from './routes/departments.js';
import employeesRoutes from './routes/employees.js';
import desksRoutes from './routes/desks.js';
import statusRoutes from './routes/status.js';
import overviewRoutes from './routes/overview.js';
import serverMonitorRoutes from './routes/server-monitor.js';
import searchRoutes from './routes/search.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// 初始化WebSocket管理器
const wsManager = new WebSocketManager(server);

// 初始化架构服务
const architectureService = new ArchitectureService(pool, wsManager);

// 初始化系统监控和恢复管理器
const connectionRecovery = new ConnectionRecoveryManager(wsManager as any);
const databaseRecovery = new DatabaseRecoveryManager(pool);
const systemMonitor = new SystemMonitor(
  pool,
  undefined, // Redis实例由WebSocketManager管理
  wsManager as any,
  connectionRecovery,
  databaseRecovery
);

// 初始化架构服务路由
initializeArchitectureRoutes(architectureService);

// 初始化监控路由
initializeMonitoringRoutes(
  systemMonitor,
  connectionRecovery,
  databaseRecovery,
  wsManager as any // 临时类型转换，实际应该传入connectionManager
);

// 初始化WebSocket服务器和恢复管理器
const wsServer = new WebSocketServer(server, connectionManager.getPool(), connectionManager.getRedis());
const recoveryManager = new ComprehensiveRecoveryManager(wsServer, connectionManager.getPool());

// 设置优雅关闭
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  
  // 关闭系统监控
  systemMonitor.shutdown();
  
  // 关闭恢复管理器
  connectionRecovery.shutdown();
  databaseRecovery.shutdown();
  
  // 关闭架构服务
  architectureService.close();
  
  await wsServer.shutdown();
  recoveryManager.shutdown();
  await connectionManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  // 关闭系统监控
  systemMonitor.shutdown();
  
  // 关闭恢复管理器
  connectionRecovery.shutdown();
  databaseRecovery.shutdown();
  
  await wsServer.shutdown();
  recoveryManager.shutdown();
  await connectionManager.close();
  process.exit(0);
});

// 初始化系统架构关联逻辑服务
const connectionConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'department_map',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  },
  websocket: {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  }
};

const connectionManager = new ConnectionManager(connectionConfig);
const dataSyncService = new DataSyncService(connectionManager);
const systemIntegrationService = new SystemIntegrationService(connectionManager, dataSyncService);

// 设置WebSocket服务器
connectionManager.setWebSocketServer(io);

// 中间件配置
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// 系统架构关联逻辑中间件
app.use((req: any, res: any, next: any) => {
  req.connectionManager = connectionManager;
  req.dataSyncService = dataSyncService;
  req.systemIntegrationService = systemIntegrationService;
  next();
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/architecture', architectureRoutes);
app.use('/api/monitoring', monitoringRoutes);

/**
 * API Routes
 */
app.use('/api/departments', departmentsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/desks', desksRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/server-monitor', serverMonitorRoutes);
app.use('/api/search', searchRoutes);

/**
 * Health Check
 */
app.get('/api/health', async (req: any, res: any): Promise<void> => {
  try {
    // 获取系统健康状态
    const systemHealth = await architectureService.getSystemHealth();
    
    // 检查数据库连接
    const dbHealth = await pool.healthCheck();
    const wsStats = wsManager.getStats();
    const connectionHealth = req.connectionManager.getHealthStatus();
    const syncStatus = req.dataSyncService.getSyncStatus();
    const integrationHealth = req.systemIntegrationService.getSystemsHealth();
    
    res.status(200).json({
      success: true,
      data: {
        status: systemHealth.overall === 'healthy' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '3.1.0',
        uptime: process.uptime(),
        components: systemHealth.components.map((comp: any) => ({
          name: comp.name,
          type: comp.type,
          status: comp.status,
          metrics: comp.metrics,
          lastCheck: comp.lastCheck
        })),
        issues: systemHealth.issues,
        database: dbHealth,
        websocket: {
          status: 'active',
          connections: wsStats.totalConnections,
          authenticatedConnections: wsStats.authenticatedConnections,
          channels: wsStats.totalChannels
        },
        services: {
          database: connectionHealth.details.database,
          redis: connectionHealth.details.redis,
          websocket: connectionHealth.details.systems,
          sync: {
            queueSize: syncStatus.queueSize,
            processing: syncStatus.processing
          },
          integration: {
            overall: integrationHealth.overall,
            onlineSystems: integrationHealth.systems.filter((s: any) => s.status === 'online').length,
            totalSystems: integrationHealth.systems.length
          }
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      },
      message: 'API server is healthy'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      version: '3.1.0'
    });
  }
});

// 系统架构关联逻辑API路由
app.get('/api/system/status', async (req, res) => {
  try {
    const connectionStatus = await connectionManager.getStatus();
    const syncStatus = await dataSyncService.getSyncStatus();
    const integrationStatus = await systemIntegrationService.getSystemStatus();
    const wsStats = wsServer.getConnectionStats();
    const systemStatus = recoveryManager.getSystemStatus();
    
    res.json({
      success: true,
      data: {
        connections: connectionStatus,
        sync: syncStatus,
        integration: integrationStatus,
        websocket: wsStats,
        system: systemStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

// WebSocket连接统计API
app.get('/api/websocket/stats', async (req, res) => {
  try {
    const stats = wsServer.getConnectionStats();
    const systemStatus = recoveryManager.getSystemStatus();
    
    res.json({
      success: true,
      data: {
        connections: stats,
        health: systemStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket statistics'
    });
  }
});

// 系统监控指标API
app.get('/api/system/metrics', async (req, res) => {
  try {
    const systemStatus = recoveryManager.getSystemStatus();
    
    res.json({
      success: true,
      data: systemStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

app.get('/api/system/sync-status', (req: any, res: any) => {
  const syncStatus = req.dataSyncService.getSyncStatus();
  res.json(syncStatus);
});

app.post('/api/system/trigger-sync', (req: any, res: any) => {
  const { table, operation, data } = req.body;
  
  if (!table || !operation || !data) {
    return res.status(400).json({ error: 'Missing required fields: table, operation, data' });
  }
  
  try {
    req.dataSyncService.triggerSync(table, operation, data);
    res.json({ success: true, message: 'Sync triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/system/restart-integration/:systemType', (req: any, res: any) => {
  const { systemType } = req.params;
  
  try {
    req.systemIntegrationService.restartIntegration(systemType);
    res.json({ success: true, message: `Integration restart initiated for ${systemType}` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/system/broadcast', (req: any, res: any) => {
  const { event, data, excludeSystem } = req.body;
  
  if (!event || !data) {
    return res.status(400).json({ error: 'Missing required fields: event, data' });
  }
  
  try {
    req.systemIntegrationService.broadcastEvent(event, data, excludeSystem);
    res.json({ success: true, message: 'Event broadcasted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error'
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;