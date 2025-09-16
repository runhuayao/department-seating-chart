/**
 * 连接管理器 - 系统架构关联逻辑核心组件
 * 负责管理多系统间的连接状态和通信协调
 */

import { EventEmitter } from 'events';
import { Pool, PoolClient } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { Server as SocketIOServer } from 'socket.io';

interface ConnectionConfig {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis: {
    url: string;
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
  };
  websocket: {
    cors: {
      origin: string[];
      methods: string[];
    };
  };
}

interface SystemConnection {
  id: string;
  type: 'department-map' | 'server-management' | 'api-monitor';
  port: number;
  status: 'connected' | 'disconnected' | 'error';
  lastHeartbeat: Date;
  metadata: Record<string, any>;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  dbPoolSize: number;
  dbActiveConnections: number;
  redisConnections: number;
  websocketConnections: number;
  systemConnections: Map<string, SystemConnection>;
}

export class ConnectionManager extends EventEmitter {
  private dbPool: Pool;
  private redisClient: RedisClientType;
  private io: SocketIOServer | null = null;
  private systemConnections: Map<string, SystemConnection> = new Map();
  private config: ConnectionConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.initializeConnections();
  }

  /**
   * 初始化所有连接
   */
  private async initializeConnections(): Promise<void> {
    try {
      // 初始化PostgreSQL连接池
      await this.initializeDatabase();
      
      // 初始化Redis连接
      await this.initializeRedis();
      
      // 启动心跳检测
      this.startHeartbeat();
      
      // 启动指标收集
      this.startMetricsCollection();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ ConnectionManager initialized successfully');
    } catch (error) {
      console.error('❌ ConnectionManager initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 初始化数据库连接池
   */
  private async initializeDatabase(): Promise<void> {
    this.dbPool = new Pool({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      user: this.config.database.user,
      password: this.config.database.password,
      max: this.config.database.max,
      idleTimeoutMillis: this.config.database.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.database.connectionTimeoutMillis,
    });

    // 测试数据库连接
    const client = await this.dbPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // 监听数据库事件
    this.dbPool.on('connect', () => {
      this.emit('database:connected');
    });

    this.dbPool.on('error', (err) => {
      console.error('Database pool error:', err);
      this.emit('database:error', err);
    });

    console.log('✅ Database connection pool initialized');
  }

  /**
   * 初始化Redis连接
   */
  private async initializeRedis(): Promise<void> {
    this.redisClient = createClient({
      url: this.config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Redis connection failed');
          return Math.min(retries * 50, 1000);
        }
      }
    });

    this.redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      this.emit('redis:connected');
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis error:', err);
      this.emit('redis:error', err);
    });

    await this.redisClient.connect();
  }

  /**
   * 设置WebSocket服务器
   */
  public setWebSocketServer(io: SocketIOServer): void {
    this.io = io;
    
    // 监听WebSocket连接事件
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);
      
      // 注册系统连接
      socket.on('register_system', (data: { type: string; port: number; metadata?: any }) => {
        this.registerSystemConnection(socket.id, data.type as any, data.port, data.metadata);
      });
      
      // 处理断开连接
      socket.on('disconnect', () => {
        console.log(`WebSocket client disconnected: ${socket.id}`);
        this.unregisterSystemConnection(socket.id);
      });
      
      // 处理心跳
      socket.on('heartbeat', () => {
        this.updateHeartbeat(socket.id);
      });
    });
    
    console.log('✅ WebSocket server configured');
  }

  /**
   * 注册系统连接
   */
  public registerSystemConnection(
    id: string, 
    type: 'department-map' | 'server-management' | 'api-monitor', 
    port: number, 
    metadata: Record<string, any> = {}
  ): void {
    const connection: SystemConnection = {
      id,
      type,
      port,
      status: 'connected',
      lastHeartbeat: new Date(),
      metadata
    };
    
    this.systemConnections.set(id, connection);
    this.emit('system:connected', connection);
    
    console.log(`✅ System registered: ${type} (${id}) on port ${port}`);
  }

  /**
   * 注销系统连接
   */
  public unregisterSystemConnection(id: string): void {
    const connection = this.systemConnections.get(id);
    if (connection) {
      this.systemConnections.delete(id);
      this.emit('system:disconnected', connection);
      console.log(`❌ System unregistered: ${connection.type} (${id})`);
    }
  }

  /**
   * 更新心跳时间
   */
  private updateHeartbeat(id: string): void {
    const connection = this.systemConnections.get(id);
    if (connection) {
      connection.lastHeartbeat = new Date();
      connection.status = 'connected';
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30秒超时
      
      for (const [id, connection] of this.systemConnections) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > timeout) {
          connection.status = 'error';
          this.emit('system:timeout', connection);
          console.warn(`⚠️ System timeout: ${connection.type} (${id})`);
        }
      }
    }, 10000); // 每10秒检查一次
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getConnectionMetrics();
        this.emit('metrics:updated', metrics);
        
        // 缓存指标到Redis
        if (this.redisClient.isReady) {
          await this.redisClient.setEx('connection:metrics', 60, JSON.stringify(metrics));
        }
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, 5000); // 每5秒收集一次
  }

  /**
   * 获取连接指标
   */
  public async getConnectionMetrics(): Promise<ConnectionMetrics> {
    const dbStats = this.dbPool.totalCount;
    const activeDbConnections = this.dbPool.idleCount;
    const websocketConnections = this.io ? this.io.sockets.sockets.size : 0;
    
    return {
      totalConnections: this.systemConnections.size,
      activeConnections: Array.from(this.systemConnections.values())
        .filter(conn => conn.status === 'connected').length,
      dbPoolSize: dbStats,
      dbActiveConnections: activeDbConnections,
      redisConnections: this.redisClient.isReady ? 1 : 0,
      websocketConnections,
      systemConnections: new Map(this.systemConnections)
    };
  }

  /**
   * 获取数据库客户端
   */
  public async getDatabaseClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      throw new Error('ConnectionManager not initialized');
    }
    return await this.dbPool.connect();
  }

  /**
   * 获取Redis客户端
   */
  public getRedisClient(): RedisClientType {
    if (!this.isInitialized) {
      throw new Error('ConnectionManager not initialized');
    }
    return this.redisClient;
  }

  /**
   * 广播消息到所有系统
   */
  public broadcastToSystems(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
      console.log(`📡 Broadcast: ${event}`, data);
    }
  }

  /**
   * 发送消息到特定系统
   */
  public sendToSystem(systemId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(systemId).emit(event, data);
      console.log(`📤 Send to ${systemId}: ${event}`, data);
    }
  }

  /**
   * 关闭所有连接
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing ConnectionManager...');
    
    // 清理定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // 关闭数据库连接池
    if (this.dbPool) {
      await this.dbPool.end();
    }
    
    // 关闭Redis连接
    if (this.redisClient && this.redisClient.isReady) {
      await this.redisClient.quit();
    }
    
    // 清理系统连接
    this.systemConnections.clear();
    
    console.log('✅ ConnectionManager closed');
  }

  /**
   * 获取系统健康状态
   */
  public getHealthStatus(): { status: string; details: any } {
    const dbHealthy = this.dbPool && this.dbPool.totalCount > 0;
    const redisHealthy = this.redisClient && this.redisClient.isReady;
    const systemsHealthy = Array.from(this.systemConnections.values())
      .filter(conn => conn.status === 'connected').length > 0;
    
    const overall = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
    
    return {
      status: overall,
      details: {
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        systems: systemsHealthy ? 'active' : 'inactive',
        totalSystems: this.systemConnections.size,
        activeSystems: Array.from(this.systemConnections.values())
          .filter(conn => conn.status === 'connected').length
      }
    };
  }
}