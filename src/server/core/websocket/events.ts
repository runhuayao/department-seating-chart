import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { WebSocketConnection } from './connection';

export interface WebSocketEvent {
  type: string;
  connectionId: string;
  userId?: string;
  timestamp: number;
  data?: any;
}

export interface MessageEvent extends WebSocketEvent {
  type: 'message';
  messageType: string;
  payload: any;
}

export interface ConnectionEvent extends WebSocketEvent {
  type: 'connection_established' | 'connection_closed' | 'connection_error';
  clientIP: string;
  userAgent: string;
}

export interface AuthenticationEvent extends WebSocketEvent {
  type: 'user_authenticated' | 'authentication_failed';
  userId: string;
  roles?: string[];
}

/**
 * WebSocket事件处理器
 * 负责处理和分发WebSocket相关的事件
 */
export class WebSocketEvents extends EventEmitter {
  private logger: Logger;
  private eventHistory: WebSocketEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听所有事件并记录日志
    this.on('*', (event: WebSocketEvent) => {
      this.logEvent(event);
      this.addToHistory(event);
    });

    // 连接建立事件
    this.on('connection_established', (event: ConnectionEvent) => {
      this.handleConnectionEstablished(event);
    });

    // 连接关闭事件
    this.on('connection_closed', (event: ConnectionEvent) => {
      this.handleConnectionClosed(event);
    });

    // 连接错误事件
    this.on('connection_error', (event: ConnectionEvent) => {
      this.handleConnectionError(event);
    });

    // 用户认证事件
    this.on('user_authenticated', (event: AuthenticationEvent) => {
      this.handleUserAuthenticated(event);
    });

    // 消息接收事件
    this.on('message_received', (event: MessageEvent) => {
      this.handleMessageReceived(event);
    });
  }

  /**
   * 触发连接建立事件
   */
  emitConnectionEstablished(connection: WebSocketConnection): void {
    const event: ConnectionEvent = {
      type: 'connection_established',
      connectionId: connection.getId(),
      userId: connection.getUserId() || undefined,
      timestamp: Date.now(),
      clientIP: connection.getClientIP(),
      userAgent: connection.getUserAgent()
    };

    this.emit('connection_established', event);
    this.emit('*', event);
  }

  /**
   * 触发连接关闭事件
   */
  emitConnectionClosed(connection: WebSocketConnection, code: number, reason: string): void {
    const event: ConnectionEvent = {
      type: 'connection_closed',
      connectionId: connection.getId(),
      userId: connection.getUserId() || undefined,
      timestamp: Date.now(),
      clientIP: connection.getClientIP(),
      userAgent: connection.getUserAgent(),
      data: { code, reason }
    };

    this.emit('connection_closed', event);
    this.emit('*', event);
  }

  /**
   * 触发连接错误事件
   */
  emitConnectionError(connection: WebSocketConnection, error: Error): void {
    const event: ConnectionEvent = {
      type: 'connection_error',
      connectionId: connection.getId(),
      userId: connection.getUserId() || undefined,
      timestamp: Date.now(),
      clientIP: connection.getClientIP(),
      userAgent: connection.getUserAgent(),
      data: { 
        error: error.message,
        stack: error.stack
      }
    };

    this.emit('connection_error', event);
    this.emit('*', event);
  }

  /**
   * 触发用户认证事件
   */
  emitUserAuthenticated(connection: WebSocketConnection, userId: string): void {
    const session = connection.getSession();
    const event: AuthenticationEvent = {
      type: 'user_authenticated',
      connectionId: connection.getId(),
      userId,
      timestamp: Date.now(),
      roles: session?.roles,
      data: {
        authenticatedAt: session?.authenticatedAt,
        permissions: session?.permissions
      }
    };

    this.emit('user_authenticated', event);
    this.emit('*', event);
  }

  /**
   * 触发认证失败事件
   */
  emitAuthenticationFailed(connection: WebSocketConnection, reason: string): void {
    const event: AuthenticationEvent = {
      type: 'authentication_failed',
      connectionId: connection.getId(),
      userId: 'unknown',
      timestamp: Date.now(),
      data: { reason }
    };

    this.emit('authentication_failed', event);
    this.emit('*', event);
  }

  /**
   * 触发消息接收事件
   */
  emitMessageReceived(connection: WebSocketConnection, message: any): void {
    const event: MessageEvent = {
      type: 'message',
      connectionId: connection.getId(),
      userId: connection.getUserId() || undefined,
      timestamp: Date.now(),
      messageType: message.type || 'unknown',
      payload: message.payload,
      data: message
    };

    this.emit('message_received', event);
    this.emit('*', event);

    // 根据消息类型触发特定事件
    if (message.type) {
      this.emit(`message_${message.type}`, event);
    }
  }

  /**
   * 处理连接建立事件
   */
  private handleConnectionEstablished(event: ConnectionEvent): void {
    this.logger.info('WebSocket connection established', {
      connectionId: event.connectionId,
      clientIP: event.clientIP,
      userAgent: event.userAgent,
      timestamp: event.timestamp
    });

    // 可以在这里添加连接建立后的业务逻辑
    // 例如：发送欢迎消息、初始化用户状态等
  }

  /**
   * 处理连接关闭事件
   */
  private handleConnectionClosed(event: ConnectionEvent): void {
    this.logger.info('WebSocket connection closed', {
      connectionId: event.connectionId,
      userId: event.userId,
      code: event.data?.code,
      reason: event.data?.reason,
      timestamp: event.timestamp
    });

    // 可以在这里添加连接关闭后的清理逻辑
    // 例如：清理用户状态、通知其他用户等
  }

  /**
   * 处理连接错误事件
   */
  private handleConnectionError(event: ConnectionEvent): void {
    this.logger.error('WebSocket connection error', {
      connectionId: event.connectionId,
      userId: event.userId,
      error: event.data?.error,
      timestamp: event.timestamp
    });

    // 可以在这里添加错误处理逻辑
    // 例如：错误统计、告警通知等
  }

  /**
   * 处理用户认证事件
   */
  private handleUserAuthenticated(event: AuthenticationEvent): void {
    this.logger.info('User authenticated', {
      connectionId: event.connectionId,
      userId: event.userId,
      roles: event.roles,
      timestamp: event.timestamp
    });

    // 可以在这里添加认证后的业务逻辑
    // 例如：加载用户数据、发送初始状态等
  }

  /**
   * 处理消息接收事件
   */
  private handleMessageReceived(event: MessageEvent): void {
    this.logger.debug('Message received', {
      connectionId: event.connectionId,
      userId: event.userId,
      messageType: event.messageType,
      timestamp: event.timestamp
    });

    // 根据消息类型进行路由处理
    this.routeMessage(event);
  }

  /**
   * 消息路由处理
   */
  private routeMessage(event: MessageEvent): void {
    switch (event.messageType) {
      case 'seat_select':
        this.handleSeatSelectMessage(event);
        break;
      
      case 'seat_release':
        this.handleSeatReleaseMessage(event);
        break;
      
      case 'floor_change':
        this.handleFloorChangeMessage(event);
        break;
      
      case 'user_status':
        this.handleUserStatusMessage(event);
        break;
      
      case 'chat_message':
        this.handleChatMessage(event);
        break;
      
      default:
        this.logger.warn('Unknown message type', {
          messageType: event.messageType,
          connectionId: event.connectionId
        });
    }
  }

  /**
   * 处理座位选择消息
   */
  private handleSeatSelectMessage(event: MessageEvent): void {
    const { seatId, floorId } = event.payload;
    
    this.logger.info('Seat selection request', {
      userId: event.userId,
      seatId,
      floorId,
      timestamp: event.timestamp
    });

    // 触发座位选择事件
    this.emit('seat_select_request', {
      ...event,
      seatId,
      floorId
    });
  }

  /**
   * 处理座位释放消息
   */
  private handleSeatReleaseMessage(event: MessageEvent): void {
    const { seatId } = event.payload;
    
    this.logger.info('Seat release request', {
      userId: event.userId,
      seatId,
      timestamp: event.timestamp
    });

    // 触发座位释放事件
    this.emit('seat_release_request', {
      ...event,
      seatId
    });
  }

  /**
   * 处理楼层切换消息
   */
  private handleFloorChangeMessage(event: MessageEvent): void {
    const { floorId } = event.payload;
    
    this.logger.info('Floor change request', {
      userId: event.userId,
      floorId,
      timestamp: event.timestamp
    });

    // 触发楼层切换事件
    this.emit('floor_change_request', {
      ...event,
      floorId
    });
  }

  /**
   * 处理用户状态消息
   */
  private handleUserStatusMessage(event: MessageEvent): void {
    const { status } = event.payload;
    
    this.logger.info('User status update', {
      userId: event.userId,
      status,
      timestamp: event.timestamp
    });

    // 触发用户状态更新事件
    this.emit('user_status_update', {
      ...event,
      status
    });
  }

  /**
   * 处理聊天消息
   */
  private handleChatMessage(event: MessageEvent): void {
    const { message, targetUserId } = event.payload;
    
    this.logger.info('Chat message', {
      fromUserId: event.userId,
      targetUserId,
      messageLength: message?.length || 0,
      timestamp: event.timestamp
    });

    // 触发聊天消息事件
    this.emit('chat_message', {
      ...event,
      message,
      targetUserId
    });
  }

  /**
   * 记录事件日志
   */
  private logEvent(event: WebSocketEvent): void {
    const logLevel = this.getLogLevel(event.type);
    const logData = {
      eventType: event.type,
      connectionId: event.connectionId,
      userId: event.userId,
      timestamp: event.timestamp
    };

    switch (logLevel) {
      case 'error':
        this.logger.error('WebSocket event', logData);
        break;
      case 'warn':
        this.logger.warn('WebSocket event', logData);
        break;
      case 'info':
        this.logger.info('WebSocket event', logData);
        break;
      case 'debug':
      default:
        this.logger.debug('WebSocket event', logData);
        break;
    }
  }

  /**
   * 获取事件的日志级别
   */
  private getLogLevel(eventType: string): 'error' | 'warn' | 'info' | 'debug' {
    const errorEvents = ['connection_error', 'authentication_failed'];
    const warnEvents = ['connection_closed'];
    const infoEvents = ['connection_established', 'user_authenticated'];

    if (errorEvents.includes(eventType)) return 'error';
    if (warnEvents.includes(eventType)) return 'warn';
    if (infoEvents.includes(eventType)) return 'info';
    return 'debug';
  }

  /**
   * 添加事件到历史记录
   */
  private addToHistory(event: WebSocketEvent): void {
    this.eventHistory.push(event);
    
    // 保持历史记录大小限制
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取事件历史记录
   */
  getEventHistory(limit?: number): WebSocketEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * 获取特定类型的事件历史
   */
  getEventsByType(eventType: string, limit?: number): WebSocketEvent[] {
    const filteredEvents = this.eventHistory.filter(event => event.type === eventType);
    if (limit) {
      return filteredEvents.slice(-limit);
    }
    return filteredEvents;
  }

  /**
   * 获取特定用户的事件历史
   */
  getEventsByUser(userId: string, limit?: number): WebSocketEvent[] {
    const filteredEvents = this.eventHistory.filter(event => event.userId === userId);
    if (limit) {
      return filteredEvents.slice(-limit);
    }
    return filteredEvents;
  }

  /**
   * 清理事件历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.logger.info('Event history cleared');
  }

  /**
   * 获取事件统计信息
   */
  getEventStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const eventsByType: Record<string, number> = {};
    let recentEvents = 0;

    for (const event of this.eventHistory) {
      // 统计事件类型
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // 统计最近一小时的事件
      if (event.timestamp > oneHourAgo) {
        recentEvents++;
      }
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      recentEvents
    };
  }

  /**
   * 设置最大历史记录大小
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    
    // 如果当前历史记录超过新的限制，进行裁剪
    if (this.eventHistory.length > size) {
      this.eventHistory = this.eventHistory.slice(-size);
    }
  }
}