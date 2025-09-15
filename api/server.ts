/**
 * local server entry file, for local development
 */
import dotenv from 'dotenv';
// 加载环境变量
dotenv.config();

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { initializeDatabase, closeDatabaseConnections } from './database/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './database/index.js';
import { createServer } from 'http';
import { initializeDepartmentSync } from './websocket/departmentSync.js';
import { WebSocketManager } from './websocket/websocket-manager.js';
import authRoutes from './routes/auth.js';
import workstationRoutes from './routes/workstations.js';
import databaseRoutes from './routes/database.js';
import searchRoutes from './routes/search.js';
import employeesRoutes from './routes/employees.js';
import departmentsRoutes from './routes/departments.js';
import overviewRoutes from './routes/overview.js';
import dataSyncRoutes, { setDataSyncWebSocket } from './routes/data-sync.js';
import crossSystemQueryRoutes from './routes/crossSystemQuery.js';
import searchCacheRoutes from './routes/search-cache.js';
import websocketRoutes, { setWebSocketInstance } from './routes/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 安全中间件配置
// CORS配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] // 生产环境只允许特定域名
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'], // 开发环境允许本地端口
  credentials: true, // 允许携带认证信息
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 预检请求缓存时间（24小时）
  optionsSuccessStatus: 200 // 支持旧版浏览器
};

app.use(cors(corsOptions));

// 处理预检请求
app.options('*', cors(corsOptions));

// 安全头配置
app.use((req, res, next) => {
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS保护
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 强制HTTPS（生产环境）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // 内容安全策略
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
  next();
});

// 请求体大小限制
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf.length > 10 * 1024 * 1024) {
      const error = new Error('请求体过大');
      (error as any).status = 413;
      throw error;
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf.length > 10 * 1024 * 1024) {
      const error = new Error('请求体过大');
      (error as any).status = 413;
      throw error;
    }
  }
}));
app.use(express.static(join(__dirname, '../dist')));

// 错误处理中间件
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/workstations', workstationRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/data-sync', dataSyncRoutes);
app.use('/api/cross-system', crossSystemQueryRoutes);
app.use('/api/search-cache', searchCacheRoutes);
app.use('/api/websocket', websocketRoutes);

// API 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 数据库状态
app.get('/api/database/status', asyncHandler(async (req: any, res: any) => {
  const status = await db.getStatus();
  res.json(status);
}));

// 数据同步
app.post('/api/database/sync', asyncHandler(async (req: any, res: any) => {
  const success = await db.syncData();
  if (success) {
    res.json({ message: '数据同步成功', timestamp: new Date().toISOString() });
  } else {
    res.status(500).json({ error: '数据同步失败' });
  }
}));

// 统计信息 API
app.get('/api/stats', asyncHandler(async (req: any, res: any) => {
  const [workstations, employees, departments] = await Promise.all([
    db.getWorkstations(),
    db.getEmployees(),
    db.getDepartments()
  ]);
  
  const stats = {
    workstations: {
      total: workstations.length,
      online: workstations.filter(ws => ws.status === 'online').length,
      offline: workstations.filter(ws => ws.status === 'offline').length,
      maintenance: workstations.filter(ws => ws.status === 'maintenance').length
    },
    employees: {
      total: employees.length,
      active: employees.filter(emp => emp.status === 'active').length,
      inactive: employees.filter(emp => emp.status === 'inactive').length
    },
    departments: {
      total: departments.length,
      totalWorkstations: departments.reduce((sum, dept) => sum + dept.workstationCount, 0),
      totalEmployees: departments.reduce((sum, dept) => sum + dept.employeeCount, 0)
    }
  };
  
  res.json(stats);
}));

// 错误处理中间件
app.use((error: any, req: any, res: any, next: any) => {
  console.error('API Error:', error);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? error.message : '请稍后重试'
  });
});

// 服务静态文件
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

/**
 * start server with port
 */
const PORT = process.env.PORT || 8080;

// 全局server变量
let server: any = null;
let wsManager: WebSocketManager | null = null;

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initializeDatabase();
    
    // Create HTTP server
    server = createServer(app);

    // Initialize unified WebSocket manager
    wsManager = new WebSocketManager(server);
    
    // 初始化部门同步WebSocket服务
    const departmentSyncServer = initializeDepartmentSync(server);
    
    // 设置数据同步WebSocket实例到路由
    setDataSyncWebSocket(wsManager.getDataSyncWebSocket());
    
    // 设置WebSocket实例到WebSocket路由
    setWebSocketInstance(wsManager.getDataSyncWebSocket());

    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在端口 ${PORT}`);
      console.log(`📍 API地址: http://localhost:${PORT}/api`);
      console.log(`🔒 认证系统已启用`);
      console.log(`🔄 数据同步WebSocket已启动`);
      console.log(`🔌 部门同步WebSocket: ws://localhost:${PORT}/ws/department-sync`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

/**
 * close server
 */
// 优雅关闭处理
const gracefulShutdown = async (signal: string) => {
  console.log(`🔄 收到${signal}信号，正在关闭服务器...`);
  
  if (server) {
    // 关闭HTTP服务器
    server.close(async () => {
      console.log('✅ HTTP服务器已关闭');
      
      // 关闭WebSocket管理器
      if (wsManager) {
        wsManager.close();
      }
      
      // 关闭数据库连接
      await closeDatabaseConnections();
      
      console.log('✅ 所有服务已安全关闭');
      process.exit(0);
    });
  } else {
    console.log('✅ 服务器未启动，直接退出');
    process.exit(0);
  }
  
  // 强制关闭超时
  setTimeout(() => {
    console.error('❌ 强制关闭服务器（超时）');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason, 'at:', promise);
  gracefulShutdown('unhandledRejection');
});

export default app;
