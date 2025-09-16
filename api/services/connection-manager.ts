/**
 * WebSocket连接管理器
 * 基于WebSocket与PostgreSQL组件关联技术文档实现
 */

import { WebSocket } from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

// 连接指标接口
export interface ConnectionMetrics {
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
  clientIP?: string;
  userAgent?: string;
  userId?: string;
}

// 连接状态枚举
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

// 连接信息接口
export interface ConnectionInfo {
  id: string;
  ws: WebSocket;
  status: ConnectionStatus;
  metrics: ConnectionMetrics;
  subscriptions: Set<string>;
}

/**
 * WebSocket连接管理器
 */
export class WebSocketConnectionManager extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private ipConnectionCount: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private pool: Pool;
  private redis: Redis;
  
  // 配置参数
  private readonly maxConnections: number = 1000;
  private readonly maxConnectionsPerIP: number = 10;
  private readonly healthCheckIntervalMs: number = 60000; // 1分钟
  private readonly inactivityTimeoutMs: number = 300000; // 5分钟
  
  constructor(pool: Pool, redis: Redis) {
    super();
    this.pool = pool;
    this.redis = redis;
    this.startHealthCheck();
  }
  
  /**
   * 添加新连接
   */
  public addConnection(
    connectionId: string, 
    ws: WebSocket, 
    clientIP: string,
    userAgent?: string,
    userId?: string
  ): boolean {
    // 检查连接限制
    if (!this.canAcceptConnection(clientIP)) {
      return false;
    }
    
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      ws,
      status: ConnectionStatus.CONNECTED,
      metrics: {
        connectedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        isActive: true,
        clientIP,
        userAgent,
        userId
      },
      subscriptions: new Set()
    };
    
    this.connections.set(connectionId, connectionInfo);
    this.incrementIPConnection(clientIP);
    
    // 设置连接事件监听
    this.setupConnectionHandlers(connectionId, ws);
    
    // 发送连接确认
    this.sendMessage(connectionId, {
      type: 'connection_ack',
      data: {
        connectionId,
        timestamp: new Date().toISOString()
      }
    });
    
    this.emit('connection_added', connectionInfo);
    console.log(`WebSocket connection added: ${connectionId} from ${clientIP}`);
    
    return true;
  }
  
  /**
   * 移除连接
   */
  public removeConnection(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }
    
    const { ws, metrics } = connectionInfo;
    
    // 更新连接状态
    connectionInfo.status = ConnectionStatus.DISCONNECTING;
    
    // 关闭WebSocket连接
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    
    // 清理IP连接计数
    if (metrics.clientIP) {
      this.decrementIPConnection(metrics.clientIP);
    }
    
    // 清理订阅
    connectionInfo.subscriptions.clear();
    
    // 从连接映射中移除
    this.connections.delete(connectionId);
    
    this.emit('connection_removed', connectionInfo);
    console.log(`WebSocket connection removed: ${connectionId}`);
  }
  
  /**
   * 设置连接事件处理器
   */
  private setupConnectionHandlers(connectionId: string, ws: WebSocket): void {
    ws.on('message', (data) => {
      this.handleMessage(connectionId, data);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${connectionId}, code: ${code}, reason: ${reason}`);
      this.removeConnection(connectionId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket connection error: ${connectionId}`, error);
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo) {
        connectionInfo.status = ConnectionStatus.ERROR;
      }
      this.emit('connection_error', { connectionId, error });
    });
    
    ws.on('pong', () => {
      this.updateLastActivity(connectionId);
    });
  }
  
  /**
   * 处理接收到的消息
   */
  private handleMessage(connectionId: string, data: any): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }
    
    // 更新活动时间和消息计数
    connectionInfo.metrics.lastActivity = new Date();
    connectionInfo.metrics.messageCount++;
    
    try {
      const message = JSON.parse(data.toString());
      this.emit('message_received', { connectionId, message });
      
      // 处理特殊消息类型
      switch (message.type) {
        case 'heartbeat':
          this.sendMessage(connectionId, {
            type: 'heartbeat_ack',
            data: { timestamp: new Date().toISOString() }
          });
          break;
        case 'subscribe':
          this.handleSubscription(connectionId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(connectionId, message.data);
          break;
      }
    } catch (error) {
      console.error(`Error parsing message from ${connectionId}:`, error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }
  
  /**
   * 处理订阅
   */
  private handleSubscription(connectionId: string, data: any): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }
    
    const { channel } = data;
    if (channel) {
      connectionInfo.subscriptions.add(channel);
      this.sendMessage(connectionId, {
        type: 'subscription_ack',
        data: { channel, status: 'subscribed' }
      });
      console.log(`Connection ${connectionId} subscribed to ${channel}`);
    }
  }
  
  /**
   * 处理取消订阅
   */
  private handleUnsubscription(connectionId: string, data: any): void {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }
    
    const { channel } = data;
    if (channel) {
      connectionInfo.subscriptions.delete(channel);
      this.sendMessage(connectionId, {
        type: 'unsubscription_ack',
        data: { channel, status: 'unsubscribed' }
      });
      console.log(`Connection ${connectionId} unsubscribed from ${channel}`);
    }
  }
  
  /**
   * 发送消息给指定连接
   */
  public sendMessage(connectionId: string, message: any): boolean {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo || connectionInfo.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      const messageStr = JSON.stringify({
        ...message,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString()
      });
      
      connectionInfo.ws.send(messageStr);
      return true;
    } catch (error) {
      console.error(`Error sending message to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }
  
  /**
   * 发送错误消息
   */
  public sendError(connectionId: string, errorMessage: string): void {
    this.sendMessage(connectionId, {
      type: 'error',
      data: {
        message: errorMessage,
        code: 'WEBSOCKET_ERROR'
      }
    });
  }
  
  /**
   * 广播消息给所有连接
   */
  public broadcast(message: any, filter?: (connectionInfo: ConnectionInfo) => boolean): number {
    let sentCount = 0;
    
    for (const [connectionId, connectionInfo] of this.connections) {
      if (filter && !filter(connectionInfo)) {
        continue;
      }
      
      if (this.sendMessage(connectionId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  /**
   * 广播消息给订阅了特定频道的连接
   */
  public broadcastToChannel(channel: string, message: any): number {
    return this.broadcast(message, (connectionInfo) => {
      return connectionInfo.subscriptions.has(channel);
    });
  }
  
  /**
   * 检查是否可以接受新连接
   */
  private canAcceptConnection(clientIP: string): boolean {
    const totalConnections = this.connections.size;
    const ipConnections = this.ipConnectionCount.get(clientIP) || 0;
    
    return totalConnections < this.maxConnections && 
           ipConnections < this.maxConnectionsPerIP;
  }
  
  /**
   * 增加IP连接计数
   */
  private incrementIPConnection(clientIP: string): void {
    const current = this.ipConnectionCount.get(clientIP) || 0;
    this.ipConnectionCount.set(clientIP, current + 1);
  }
  
  /**
   * 减少IP连接计数
   */
  private decrementIPConnection(clientIP: string): void {
    const current = this.ipConnectionCount.get(clientIP) || 0;
    if (current > 0) {
      this.ipConnectionCount.set(clientIP, current - 1);
      if (current === 1) {
        this.ipConnectionCount.delete(clientIP);
      }
    }
  }
  
  /**
   * 更新连接最后活动时间
   */
  private updateLastActivity(connectionId: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo) {
      connectionInfo.metrics.lastActivity = new Date();
    }
  }
  
  /**
   * 开始健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }
  
  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const now = new Date();
    const connectionsToRemove: string[] = [];
    
    for (const [connectionId, connectionInfo] of this.connections) {
      const { metrics, ws } = connectionInfo;
      const timeSinceLastActivity = now.getTime() - metrics.lastActivity.getTime();
      
      // 检查非活跃连接
      if (timeSinceLastActivity > this.inactivityTimeoutMs) {
        console.log(`Removing inactive connection: ${connectionId}`);
        connectionsToRemove.push(connectionId);
        continue;
      }
      
      // 发送心跳检查
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          console.error(`Error sending ping to ${connectionId}:`, error);
          connectionsToRemove.push(connectionId);
        }
      } else {
        connectionsToRemove.push(connectionId);
      }
    }
    
    // 移除问题连接
    connectionsToRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });
    
    // 记录健康检查结果
    if (connectionsToRemove.length > 0) {
      console.log(`Health check completed. Removed ${connectionsToRemove.length} connections.`);
    }
  }
  
  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取连接统计信息
   */
  public getStats(): any {
    const activeConnections = Array.from(this.connections.values()).filter(
      conn => conn.status === ConnectionStatus.CONNECTED
    );
    
    const totalMessages = Array.from(this.connections.values()).reduce(
      (sum, conn) => sum + conn.metrics.messageCount, 0
    );
    
    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      totalMessages,
      ipConnectionCounts: Object.fromEntries(this.ipConnectionCount),
      connectionsByStatus: {
        connected: activeConnections.length,
        connecting: Array.from(this.connections.values()).filter(
          conn => conn.status === ConnectionStatus.CONNECTING
        ).length,
        disconnecting: Array.from(this.connections.values()).filter(
          conn => conn.status === ConnectionStatus.DISCONNECTING
        ).length,
        error: Array.from(this.connections.values()).filter(
          conn => conn.status === ConnectionStatus.ERROR
        ).length
      }
    };
  }
  
  /**
   * 获取所有活跃连接
   */
  public getActiveConnections(): Map<string, WebSocket> {
    const activeConnections = new Map<string, WebSocket>();
    
    for (const [connectionId, connectionInfo] of this.connections) {
      if (connectionInfo.status === ConnectionStatus.CONNECTED && 
          connectionInfo.ws.readyState === WebSocket.OPEN) {
        activeConnections.set(connectionId, connectionInfo.ws);
      }
    }
    
    return activeConnections;
  }
  
  /**
   * 获取连接信息
   */
  public getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }
  
  /**
   * 获取所有连接信息
   */
  public getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }
  
  /**
   * 关闭所有连接
   */
  public closeAllConnections(): void {
    console.log('Closing all WebSocket connections...');
    
    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    console.log('All WebSocket connections closed');
  }
}