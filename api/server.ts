/**
 * local server entry file, for local development
 */
import dotenv from 'dotenv';
// 加载环境变量
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import db from './models/database.js';
import dbManager from './config/database.js';
import cacheService from './services/cache.js';
import { createServer } from 'http';
import ServerMonitorWebSocket from './websocket/server-monitor.js';
import DatabaseSyncWebSocket from './websocket/database-sync.js';
import authRoutes from './routes/auth.js';
import workstationRoutes from './routes/workstations.js';
import databaseRoutes from './routes/database.js';
import searchRoutes from './routes/search.js';
import employeesRoutes from './routes/employees.js';
import departmentsRoutes from './routes/departments.js';
import overviewRoutes from './routes/overview.js';

// 扩展Error接口以支持status属性
declare global {
  namespace NodeJS {
    interface Error {
      status?: number;
    }
  }
}

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
      const error = new Error('请求体过大') as any;
      error.status = 413;
      throw error;
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf.length > 10 * 1024 * 1024) {
      const error = new Error('请求体过大') as any;
      error.status = 413;
      throw error;
    }
  }
}));
app.use(express.static(join(__dirname, '../dist-server-management')));

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

// API 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 数据库状态
app.get('/api/database/status', asyncHandler(async (req: any, res: any) => {
  const status = await db.getStatus();
  res.json(status);
}));

// WebSocket状态
app.get('/api/websocket/status', asyncHandler(async (req: any, res: any) => {
  const status = {
    serverMonitor: {
      connected: serverMonitorWS ? true : false,
      clients: serverMonitorWS ? serverMonitorWS.getConnectedClientsCount() : 0,
      health: serverMonitorWS ? 'healthy' : 'disconnected'
    },
    databaseSync: {
      connected: databaseSyncWS ? true : false,
      clients: databaseSyncWS ? databaseSyncWS.getConnectedClientsCount() : 0,
      health: databaseSyncWS ? 'healthy' : 'disconnected'
    },
    uptime: process.uptime(),
    lastUpdate: new Date().toISOString()
  };
  res.json(status);
}));

// 地图API - 获取部门地图信息
app.get('/api/map', asyncHandler(async (req: any, res: any) => {
  const { dept } = req.query;
  if (!dept) {
    return res.status(400).json({ error: 'Department parameter is required' });
  }
  
  // 模拟地图数据
  const mapData = {
    map_id: `${dept.toLowerCase()}-floor-plan`,
    type: 'svg',
    url: `/images/${dept.toLowerCase()}-map.svg`
  };
  
  res.json(mapData);
}));

// 工位API - 获取部门工位信息
app.get('/api/desks', asyncHandler(async (req: any, res: any) => {
  const { dept } = req.query;
  if (!dept) {
    return res.status(400).json({ error: 'Department parameter is required' });
  }
  
  // 模拟工位数据
  const mockDesks = [
    {
      desk_id: `${dept}-001`,
      x: 100,
      y: 100,
      w: 80,
      h: 60,
      label: '001',
      employee: '张三',
      employee_id: 'emp001',
      status: 'occupied'
    },
    {
      desk_id: `${dept}-002`,
      x: 200,
      y: 100,
      w: 80,
      h: 60,
      label: '002',
      employee: '李四',
      employee_id: 'emp002',
      status: 'occupied'
    },
    {
      desk_id: `${dept}-003`,
      x: 300,
      y: 100,
      w: 80,
      h: 60,
      label: '003',
      employee: null,
      employee_id: null,
      status: 'available'
    }
  ];
  
  res.json(mockDesks);
}));

// 用户查找API
app.get('/api/findUser', asyncHandler(async (req: any, res: any) => {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Name parameter is required' });
  }
  
  // 模拟用户查找数据
  const mockUsers = [
    {
      dept: 'Engineering',
      map_id: 'engineering-floor-plan',
      desk_id: 'Engineering-001',
      x: 100,
      y: 100,
      status: 'occupied',
      employee: '张三',
      employee_id: 'emp001'
    }
  ];
  
  // 模糊匹配
  const results = mockUsers.filter(user => 
    user.employee && user.employee.includes(name as string)
  );
  
  if (results.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // 如果只有一个结果，返回单个对象；否则返回数组
  res.json(results.length === 1 ? results[0] : results);
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

// 添加API根路径处理
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Department Map API Server',
    version: '3.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      workstations: '/api/workstations',
      employees: '/api/employees',
      departments: '/api/departments',
      database: '/api/database',
      search: '/api/search',
      overview: '/api/overview',
      stats: '/api/stats'
    },
    timestamp: new Date().toISOString()
  });
});

// 处理未匹配的API路径
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// 服务静态文件（只处理非API路径）
app.get('*', (req, res) => {
  // 确保不处理API路径
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(__dirname, '../dist-server-management/server-management.html'));
});

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

// 全局server变量
let server: any = null;
let serverMonitorWS: any = null;
let databaseSyncWS: any = null;

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库连接
    await dbManager.testConnection();
    
    // 初始化Redis缓存连接
    await cacheService.connect();
    
    // Create HTTP server
    server = createServer(app);

    // Initialize WebSocket for server monitoring (简化初始化)
    // serverMonitorWS = new ServerMonitorWebSocket(server, dbManager, null);
    
    // Initialize WebSocket for database synchronization
    // databaseSyncWS = new DatabaseSyncWebSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在端口 ${PORT}`);
      console.log(`📍 API地址: http://localhost:${PORT}/api`);
      console.log(`🔒 认证系统已启用`);
      console.log(`💾 Redis缓存已启用`);
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
      
      // 关闭WebSocket
      if (serverMonitorWS) {
        serverMonitorWS.close();
      }
      if (databaseSyncWS) {
        databaseSyncWS.close();
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
