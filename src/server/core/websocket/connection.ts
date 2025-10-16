import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { Logger } from '../../infrastructure/logging/logger';
import { PoolConfig } from './manager';

export interface ConnectionMetrics {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  lastActivity: number;
  connectionTime: number;
  errors: number;
}

export interface UserSession {
  userId: string;
  roles: string[];
  permissions: string[];
  authenticatedAt: number;
  lastActivity: number;
}

/**
 * WebSocket连接包装器
 * 管理单个WebSocket连接的生命周期、认证和消息处理
 */
export class WebSocketConnection extends EventEmitter {
  private id: string;
  private ws: WebSocket;
  private request: IncomingMessage;
  private config: PoolConfig;
  private logger: Logger;
  private session: UserSession | null = null;
  private metrics: ConnectionMetrics;
  private isAuthenticated: boolean = false;
  private lastPingTime: number = 0;
  private pingTimeout: NodeJS.Timeout | null = null;

  constructor(
    id: string,
    ws: WebSocket,
    request: IncomingMessage,
    config: PoolConfig,
    logger: Logger
  ) {
    super();
    
    this.id = id;
    this.ws = ws;
    this.request = request;
    this.config = config;
    this.logger = logger;
    
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      lastActivity: Date.now(),
      connectionTime: Date.now(),
      errors: 0
    };

    this.setupWebSocketHandlers();
    this.startPingTimeout();
  }

  /**
   * 设置WebSocket事件处理器
   */
  private setupWebSocketHandlers(): void {
    // 消息处理
    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    // 连接关闭
    this.ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(code, reason.toString());
    });

    // 连接错误
    this.ws.on('error', (error: Error) => {
      this.handleError(error);
    });

    // Pong响应
    this.ws.on('pong', (data: Buffer) => {
      this.handlePong(data);
    });

    // 意外响应
    this.ws.on('unexpected-response', (request, response) => {
      this.logger.warn('Unexpected WebSocket response', {
        connectionId: this.id,
        statusCode: response.statusCode
      });
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: Buffer): void {
    try {
      this.updateActivity();
      this.metrics.messagesReceived++;
      this.metrics.bytesReceived += data.length;

      // 解析消息
      const message = JSON.parse(data.toString());
      
      // 验证消息格式
      if (!this.validateMessage(message)) {
        this.sendError('Invalid message format');
        return;
      }

      // 处理认证消息
      if (message.type === 'auth' && !this.isAuthenticated) {
        this.handleAuthentication(message);
        return;
      }

      // 检查认证状态
      if (!this.isAuthenticated && message.type !== 'auth') {
        this.sendError('Authentication required');
        return;
      }

      // 处理心跳消息
      if (message.type === 'ping') {
        this.sendPong();
        return;
      }

      // 触发消息事件
      this.emit('message', message);

    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to handle message', {
        connectionId: this.id,
        error: error.message
      });
      this.sendError('Message processing failed');
    }
  }

  /**
   * 处理用户认证
   */
  private async handleAuthentication(message: any): Promise<void> {
    try {
      const { token, userId } = message.payload;
      
      if (!token || !userId) {
        this.sendError('Missing authentication credentials');
        return;
      }

      // TODO: 验证JWT token
      // const isValid = await this.validateToken(token);
      // if (!isValid) {
      //   this.sendError('Invalid token');
      //   return;
      // }

      // 临时认证逻辑（生产环境需要实现JWT验证）
      this.session = {
        userId,
        roles: ['user'], // 从token中解析
        permissions: ['read', 'write'], // 从角色中获取
        authenticatedAt: Date.now(),
        lastActivity: Date.now()
      };

      this.isAuthenticated = true;
      
      // 发送认证成功响应
      this.send({
        type: 'auth_success',
        payload: {
          userId,
          sessionId: this.id,
          permissions: this.session.permissions
        }
      });

      // 触发认证事件
      this.emit('authenticated', userId);

      this.logger.info('User authenticated successfully', {
        connectionId: this.id,
        userId
      });

    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Authentication failed', {
        connectionId: this.id,
        error: error.message
      });
      this.sendError('Authentication failed');
    }
  }

  /**
   * 验证消息格式
   */
  private validateMessage(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.type === 'string' &&
      message.payload !== undefined
    );
  }

  /**
   * 处理连接关闭
   */
  private handleClose(code: number, reason: string): void {
    this.cleanup();
    this.emit('close', code, reason);
    
    this.logger.info('WebSocket connection closed', {
      connectionId: this.id,
      userId: this.session?.userId,
      code,
      reason,
      duration: Date.now() - this.metrics.connectionTime
    });
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Error): void {
    this.metrics.errors++;
    this.emit('error', error);
    
    this.logger.error('WebSocket connection error', {
      connectionId: this.id,
      userId: this.session?.userId,
      error: error.message
    });
  }

  /**
   * 处理Pong响应
   */
  private handlePong(data: Buffer): void {
    const now = Date.now();
    const latency = now - this.lastPingTime;
    
    this.updateActivity();
    this.clearPingTimeout();
    this.startPingTimeout();
    
    this.emit('pong', latency);
    
    this.logger.debug('Received pong', {
      connectionId: this.id,
      latency
    });
  }

  /**
   * 发送消息
   */
  send(message: any): void {
    if (!this.isActive()) {
      throw new Error('Connection is not active');
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(data);
      
      this.metrics.messagesSent++;
      this.metrics.bytesSent += Buffer.byteLength(data);
      this.updateActivity();
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to send message', {
        connectionId: this.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(message: string): void {
    try {
      this.send({
        type: 'error',
        payload: {
          message,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      this.logger.error('Failed to send error message', {
        connectionId: this.id,
        error: error.message
      });
    }
  }

  /**
   * 发送Pong响应
   */
  private sendPong(): void {
    try {
      this.send({
        type: 'pong',
        payload: {
          timestamp: Date.now()
        }
      });
    } catch (error) {
      this.logger.error('Failed to send pong', {
        connectionId: this.id,
        error: error.message
      });
    }
  }

  /**
   * 发送Ping
   */
  ping(): void {
    if (!this.isActive()) return;

    try {
      this.lastPingTime = Date.now();
      this.ws.ping();
      
      this.logger.debug('Sent ping', {
        connectionId: this.id
      });
      
    } catch (error) {
      this.logger.error('Failed to send ping', {
        connectionId: this.id,
        error: error.message
      });
    }
  }

  /**
   * 关闭连接
   */
  close(code: number = 1000, reason: string = 'Normal closure'): void {
    try {
      this.cleanup();
      this.ws.close(code, reason);
      
      this.logger.info('Closing WebSocket connection', {
        connectionId: this.id,
        code,
        reason
      });
      
    } catch (error) {
      this.logger.error('Failed to close connection', {
        connectionId: this.id,
        error: error.message
      });
    }
  }

  /**
   * 强制终止连接
   */
  terminate(): void {
    try {
      this.cleanup();
      this.ws.terminate();
      
      this.logger.warn('Terminating WebSocket connection', {
        connectionId: this.id
      });
      
    } catch (error) {
      this.logger.error('Failed to terminate connection', {
        connectionId: this.id,
        error: error.message
      });
    }
  }

  /**
   * 检查连接是否活跃
   */
  isActive(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 检查是否已认证
   */
  isAuthenticatedUser(): boolean {
    return this.isAuthenticated && this.session !== null;
  }

  /**
   * 获取连接ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 获取用户ID
   */
  getUserId(): string | null {
    return this.session?.userId || null;
  }

  /**
   * 设置用户ID（用于外部认证）
   */
  setUserId(userId: string): void {
    if (this.session) {
      this.session.userId = userId;
    } else {
      this.session = {
        userId,
        roles: ['user'],
        permissions: ['read', 'write'],
        authenticatedAt: Date.now(),
        lastActivity: Date.now()
      };
    }
    this.isAuthenticated = true;
  }

  /**
   * 获取用户会话
   */
  getSession(): UserSession | null {
    return this.session;
  }

  /**
   * 获取连接指标
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取最后活动时间
   */
  getLastActivity(): number {
    return this.metrics.lastActivity;
  }

  /**
   * 更新活动时间
   */
  updateLastActivity(): void {
    this.updateActivity();
  }

  /**
   * 获取客户端IP
   */
  getClientIP(): string {
    const forwarded = this.request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return this.request.socket.remoteAddress || 'unknown';
  }

  /**
   * 获取用户代理
   */
  getUserAgent(): string {
    return this.request.headers['user-agent'] || 'unknown';
  }

  /**
   * 检查权限
   */
  hasPermission(permission: string): boolean {
    return this.session?.permissions.includes(permission) || false;
  }

  /**
   * 检查角色
   */
  hasRole(role: string): boolean {
    return this.session?.roles.includes(role) || false;
  }

  /**
   * 更新活动时间
   */
  private updateActivity(): void {
    this.metrics.lastActivity = Date.now();
    if (this.session) {
      this.session.lastActivity = this.metrics.lastActivity;
    }
  }

  /**
   * 启动Ping超时
   */
  private startPingTimeout(): void {
    this.clearPingTimeout();
    this.pingTimeout = setTimeout(() => {
      this.logger.warn('Ping timeout, closing connection', {
        connectionId: this.id
      });
      this.close(1001, 'Ping timeout');
    }, this.config.connectionTimeout);
  }

  /**
   * 清除Ping超时
   */
  private clearPingTimeout(): void {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.clearPingTimeout();
    this.removeAllListeners();
  }

  /**
   * 获取连接状态信息
   */
  getStatus(): {
    id: string;
    userId: string | null;
    isActive: boolean;
    isAuthenticated: boolean;
    connectionTime: number;
    lastActivity: number;
    metrics: ConnectionMetrics;
  } {
    return {
      id: this.id,
      userId: this.getUserId(),
      isActive: this.isActive(),
      isAuthenticated: this.isAuthenticated,
      connectionTime: this.metrics.connectionTime,
      lastActivity: this.metrics.lastActivity,
      metrics: this.getMetrics()
    };
  }
}