import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../infrastructure/logging/logger';
import { WebSocketConnection } from './connection';
import { WebSocketEvents } from './events';

export interface PoolConfig {
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  cleanupInterval: number;
  port: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  memoryUsage: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: number;
  responseTime: number;
  errors: string[];
}

/**
 * WebSocket连接池管理器
 * 负责管理WebSocket连接的生命周期、负载均衡和健康检查
 */
export class WebSocketPoolManager extends EventEmitter {
  private server: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, string> = new Map(); // userId -> connectionId
  private config: PoolConfig;
  private logger: Logger;
  private events: WebSocketEvents;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    failedConnections: 0,
    averageResponseTime: 0,
    memoryUsage: 0
  };

  constructor(config: PoolConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.events = new WebSocketEvents(this.logger);
    
    // 绑定事件处理器
    this.setupEventHandlers();
  }

  /**
   * 初始化连接池
   */
  async initializePool(): Promise<void> {
    try {
      this.logger.info('Initializing WebSocket pool', { config: this.config });

      // 创建WebSocket服务器
      this.server = new WebSocketServer({
        port: this.config.port,
        perMessageDeflate: {
          zlibDeflateOptions: {
            threshold: 1024,
            concurrencyLimit: 10,
          },
        },
      });

      // 设置连接处理器
      this.server.on('connection', this.handleConnection.bind(this));
      this.server.on('error', this.handleServerError.bind(this));

      // 启动定时器
      this.startHeartbeat();
      this.startCleanup();

      this.logger.info('WebSocket pool initialized successfully', {
        port: this.config.port,
        maxConnections: this.config.maxConnections
      });

      this.emit('poolInitialized');
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket pool', { error });
      throw error;
    }
  }

  /**
   * 处理新的WebSocket连接
   */
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const connectionId = uuidv4();
    const startTime = Date.now();

    try {
      // 检查连接数限制
      if (this.connections.size >= this.config.maxConnections) {
        this.logger.warn('Connection limit reached', {
          current: this.connections.size,
          max: this.config.maxConnections
        });
        ws.close(1013, 'Server overloaded');
        this.stats.failedConnections++;
        return;
      }

      // 创建连接对象
      const connection = new WebSocketConnection(
        connectionId,
        ws,
        request,
        this.config,
        this.logger
      );

      // 注册连接
      this.connections.set(connectionId, connection);
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      // 设置连接事件处理器
      this.setupConnectionHandlers(connection);

      // 触发连接建立事件
      this.events.emitConnectionEstablished(connection);

      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      this.logger.info('New WebSocket connection established', {
        connectionId,
        responseTime,
        totalConnections: this.connections.size
      });

    } catch (error) {
      this.logger.error('Failed to handle WebSocket connection', {
        connectionId,
        error
      });
      this.stats.failedConnections++;
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * 设置连接事件处理器
   */
  private setupConnectionHandlers(connection: WebSocketConnection): void {
    // 连接关闭
    connection.on('close', (code: number, reason: string) => {
      this.handleConnectionClose(connection.getId(), code, reason);
    });

    // 连接错误
    connection.on('error', (error: Error) => {
      this.handleConnectionError(connection.getId(), error);
    });

    // 用户认证
    connection.on('authenticated', (userId: string) => {
      this.handleUserAuthentication(connection.getId(), userId);
    });

    // 消息接收
    connection.on('message', (data: any) => {
      this.events.emitMessageReceived(connection, data);
    });

    // 心跳响应
    connection.on('pong', () => {
      connection.updateLastActivity();
    });
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 移除用户映射
    const userId = connection.getUserId();
    if (userId) {
      this.userConnections.delete(userId);
    }

    // 移除连接
    this.connections.delete(connectionId);
    this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);

    // 触发连接关闭事件
    this.events.emitConnectionClosed(connection, code, reason);

    this.logger.info('WebSocket connection closed', {
      connectionId,
      userId,
      code,
      reason,
      remainingConnections: this.connections.size
    });
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.stats.failedConnections++;
    this.events.emitConnectionError(connection, error);

    this.logger.error('WebSocket connection error', {
      connectionId,
      userId: connection.getUserId(),
      error: error.message
    });
  }

  /**
   * 处理用户认证
   */
  private handleUserAuthentication(connectionId: string, userId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 检查是否已有连接
    const existingConnectionId = this.userConnections.get(userId);
    if (existingConnectionId && existingConnectionId !== connectionId) {
      const existingConnection = this.connections.get(existingConnectionId);
      if (existingConnection) {
        existingConnection.close(1000, 'New connection established');
      }
    }

    // 更新用户映射
    this.userConnections.set(userId, connectionId);
    connection.setUserId(userId);

    this.events.emitUserAuthenticated(connection, userId);

    this.logger.info('User authenticated', {
      connectionId,
      userId
    });
  }

  /**
   * 获取用户连接
   */
  getConnection(userId: string): WebSocketConnection | null {
    const connectionId = this.userConnections.get(userId);
    if (!connectionId) return null;

    return this.connections.get(connectionId) || null;
  }

  /**
   * 释放连接
   */
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.close(1000, 'Connection released');
  }

  /**
   * 负载均衡 - 分发连接到不同的处理器
   */
  distributeLoad(): void {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(conn => conn.isActive());
    
    // 按连接活跃度排序
    activeConnections.sort((a, b) => {
      const aActivity = a.getLastActivity();
      const bActivity = b.getLastActivity();
      return bActivity - aActivity;
    });

    // 更新统计信息
    this.stats.activeConnections = activeConnections.length;
    this.stats.idleConnections = connections.length - activeConnections.length;

    this.logger.debug('Load distribution completed', {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      idleConnections: this.stats.idleConnections
    });
  }

  /**
   * 获取连接池统计信息
   */
  getPoolStats(): PoolStats {
    this.stats.memoryUsage = process.memoryUsage().heapUsed;
    return { ...this.stats };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      const stats = this.getPoolStats();
      const connectionRatio = stats.activeConnections / this.config.maxConnections;

      // 检查连接数
      if (connectionRatio > 0.9) {
        errors.push('High connection usage');
        status = 'degraded';
      }

      // 检查响应时间
      if (stats.averageResponseTime > 1000) {
        errors.push('High response time');
        status = 'degraded';
      }

      // 检查错误率
      const errorRate = stats.failedConnections / Math.max(stats.totalConnections, 1);
      if (errorRate > 0.1) {
        errors.push('High error rate');
        status = 'unhealthy';
      }

      // 检查服务器状态
      if (!this.server || this.server.readyState !== this.server.OPEN) {
        errors.push('WebSocket server not running');
        status = 'unhealthy';
      }

      return {
        status,
        connections: stats.activeConnections,
        responseTime: stats.averageResponseTime,
        errors
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        connections: 0,
        responseTime: 0,
        errors: [`Health check failed: ${error.message}`]
      };
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    const now = Date.now();
    let closedConnections = 0;

    for (const [connectionId, connection] of this.connections) {
      const lastActivity = connection.getLastActivity();
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > this.config.connectionTimeout) {
        // 连接超时，关闭连接
        connection.close(1001, 'Connection timeout');
        closedConnections++;
      } else if (connection.isActive()) {
        // 发送心跳
        connection.ping();
      }
    }

    if (closedConnections > 0) {
      this.logger.info('Closed inactive connections', { count: closedConnections });
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      // 清理已关闭的连接
      const closedConnections: string[] = [];
      
      for (const [connectionId, connection] of this.connections) {
        if (!connection.isActive()) {
          closedConnections.push(connectionId);
        }
      }

      for (const connectionId of closedConnections) {
        this.connections.delete(connectionId);
      }

      // 更新统计信息
      this.distributeLoad();

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      this.logger.debug('Cleanup completed', {
        removedConnections: closedConnections.length,
        activeConnections: this.stats.activeConnections
      });

    } catch (error) {
      this.logger.error('Cleanup failed', { error });
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 处理进程退出
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * 更新平均响应时间
   */
  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1; // 指数移动平均的平滑因子
    this.stats.averageResponseTime = 
      this.stats.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  /**
   * 处理服务器错误
   */
  private handleServerError(error: Error): void {
    this.logger.error('WebSocket server error', { error });
    this.emit('serverError', error);
  }

  /**
   * 关闭连接池
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket pool');

    try {
      // 停止定时器
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // 关闭所有连接
      const closePromises: Promise<void>[] = [];
      for (const connection of this.connections.values()) {
        closePromises.push(
          new Promise<void>((resolve) => {
            connection.once('close', () => resolve());
            connection.close(1001, 'Server shutdown');
          })
        );
      }

      // 等待所有连接关闭
      await Promise.all(closePromises);

      // 关闭服务器
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      this.logger.info('WebSocket pool shutdown completed');
      this.emit('poolShutdown');

    } catch (error) {
      this.logger.error('Error during WebSocket pool shutdown', { error });
      throw error;
    }
  }

  /**
   * 广播消息给所有连接
   */
  broadcast(message: any, excludeUserId?: string): void {
    const serializedMessage = JSON.stringify(message);
    let sentCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.isActive() && 
          (!excludeUserId || connection.getUserId() !== excludeUserId)) {
        try {
          connection.send(serializedMessage);
          sentCount++;
        } catch (error) {
          this.logger.error('Failed to broadcast message', {
            connectionId: connection.getId(),
            error
          });
        }
      }
    }

    this.logger.debug('Message broadcasted', {
      sentCount,
      totalConnections: this.connections.size
    });
  }

  /**
   * 发送消息给特定用户
   */
  sendToUser(userId: string, message: any): boolean {
    const connection = this.getConnection(userId);
    if (!connection || !connection.isActive()) {
      return false;
    }

    try {
      connection.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.logger.error('Failed to send message to user', {
        userId,
        connectionId: connection.getId(),
        error
      });
      return false;
    }
  }
}