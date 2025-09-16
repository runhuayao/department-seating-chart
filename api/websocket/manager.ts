// WebSocket连接管理器
// 基于WebSocket与PostgreSQL组件关联技术文档

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { EventEmitter } from 'events';
import { RealtimeService, SyncEventType, createDatabaseTriggers } from '../services/realtime';
import Redis from 'ioredis';
import { WebSocketConnectionManager } from '../services/connection-manager';
import { ConnectionRecoveryManager, DatabaseRecoveryManager } from '../services/recovery-manager';
import { SystemMonitor } from '../services/system-monitor';

// 连接状态枚举
enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

// 消息类型枚举
enum MessageType {
  AUTH = 'auth',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  DATA_UPDATE = 'data_update',
  DATA_SYNC = 'data_sync',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  SUCCESS = 'success',
  SYSTEM_METRICS = 'system_metrics',
  CONNECTION_RECOVERY = 'connection_recovery'
}

// 用户连接信息接口
interface UserConnection {
  id: string;
  ws: WebSocket;
  userId: number;
  username: string;
  role: string;
  departmentId?: number;
  subscriptions: Set<string>;
  lastActivity: Date;
  state: ConnectionState;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
  };
}

// WebSocket消息接口
interface WSMessage {
  type: MessageType;
  payload?: any;
  timestamp?: number;
  requestId?: string;
}

// 订阅频道接口
interface SubscriptionChannel {
  name: string;
  connections: Set<string>;
  lastUpdate: Date;
  dataCache?: any;
}

class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, UserConnection> = new Map();
  private channels: Map<string, SubscriptionChannel> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private realtimeService: RealtimeService;
  private redis: Redis;
  private connectionManager: WebSocketConnectionManager;
  private connectionRecovery: ConnectionRecoveryManager;
  private databaseRecovery: DatabaseRecoveryManager;
  private systemMonitor: SystemMonitor;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly CONNECTION_TIMEOUT = 60000; // 60秒
  private readonly MAX_CONNECTIONS_PER_USER = 5;

  constructor(server: any) {
    super();
    
    // 初始化WebSocket服务器
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    // 初始化Redis连接
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    // 初始化实时服务
    this.realtimeService = new RealtimeService(pool, this.redis);
    this.connectionManager = new WebSocketConnectionManager(pool, this.redis);
    this.connectionRecovery = new ConnectionRecoveryManager(this.connectionManager);
    this.databaseRecovery = new DatabaseRecoveryManager(pool, this.redis);
    this.systemMonitor = new SystemMonitor(
      pool,
      this.redis,
      this.connectionManager,
      this.connectionRecovery,
      this.databaseRecovery
    );

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // 设置实时服务事件处理器
    this.setupRealtimeHandlers();
    
    // 设置监控事件处理器
    this.setupMonitoringHandlers();
    
    // 启动心跳检测
    this.startHeartbeat();
    
    // 启动清理任务
    this.startCleanup();
    
    // 初始化数据库触发器
    this.initializeDatabaseTriggers();
    
    console.log('WebSocket管理器已启动');
  }

  // 验证客户端连接
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    // 可以在这里添加更多的验证逻辑
    return true;
  }

  /**
   * 设置实时服务事件处理器
   */
  private setupRealtimeHandlers(): void {
    // 监听广播事件
    this.realtimeService.on('broadcast', (connectionId: string, data: any) => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connectionId, {
          type: MessageType.DATA_SYNC,
          payload: data
        });
      }
    });
  }

  /**
   * 设置监控事件处理器
   */
  private setupMonitoringHandlers(): void {
    // 监听系统监控事件
    this.systemMonitor.on('alert_created', (alert) => {
      this.broadcastToChannel('system_alerts', alert);
    });
    
    this.systemMonitor.on('metrics_collected', (metrics) => {
      this.broadcastToChannel('system_metrics', metrics);
    });
    
    // 监听连接恢复事件
    this.connectionRecovery.on('recovery_success', (data) => {
      console.log(`Connection recovery successful: ${data.connectionId}`);
    });
    
    this.connectionRecovery.on('recovery_failed', (data) => {
      console.log(`Connection recovery failed: ${data.connectionId}`);
    });
    
    // 监听数据库恢复事件
    this.databaseRecovery.on('database_recovered', () => {
      console.log('Database connection recovered');
      this.broadcastToChannel('system_alerts', {
        type: 'database_recovered',
        message: 'Database connection has been restored',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 初始化数据库触发器
   */
  private async initializeDatabaseTriggers(): Promise<void> {
    try {
      await createDatabaseTriggers(pool);
      console.log('Database triggers initialized');
    } catch (error) {
      console.error('Error initializing database triggers:', error);
    }
  }

  // 处理新连接
  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const connectionId = this.generateConnectionId();
    const ip = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log(`新WebSocket连接: ${connectionId} from ${ip}`);

    // 使用连接管理器添加连接
    const accepted = this.connectionManager.addConnection(
      connectionId,
      ws,
      ip,
      userAgent
    );

    if (!accepted) {
      console.log(`Connection rejected: ${connectionId} from ${ip}`);
      ws.close(1008, 'Connection limit exceeded');
      return;
    }

    // 创建连接对象（未认证状态）
    const connection: Partial<UserConnection> = {
      id: connectionId,
      ws,
      subscriptions: new Set(),
      lastActivity: new Date(),
      state: ConnectionState.CONNECTING,
      metadata: {
        userAgent,
        ip,
        connectedAt: new Date()
      }
    };

    // 记录网络流量
    this.systemMonitor.recordNetworkTraffic(0, 0, 1, 0);

    // 设置连接事件处理
    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleDisconnection(connectionId));
    ws.on('error', (error) => this.handleError(connectionId, error));
    ws.on('pong', () => this.handlePong(connectionId));

    // 临时存储连接（等待认证）
    this.connections.set(connectionId, connection as UserConnection);

    // 发送认证请求
    this.sendMessage(connectionId, {
      type: MessageType.AUTH,
      payload: { message: '请提供认证令牌' },
      timestamp: Date.now()
    });

    // 设置认证超时
    setTimeout(() => {
      const conn = this.connections.get(connectionId);
      if (conn && conn.state === ConnectionState.CONNECTING) {
        this.sendMessage(connectionId, {
          type: MessageType.ERROR,
          payload: { message: '认证超时' }
        });
        ws.close(1008, '认证超时');
      }
    }, 10000); // 10秒认证超时
  }

  // 处理消息
  private async handleMessage(connectionId: string, data: any) {
    const startTime = Date.now();
    
    try {
      const message: WSMessage = JSON.parse(data.toString());
      const connection = this.connections.get(connectionId);
      
      if (!connection) {
        console.error(`连接不存在: ${connectionId}`);
        return;
      }

      // 更新最后活动时间
      connection.lastActivity = new Date();
      
      // 记录网络流量
      this.systemMonitor.recordNetworkTraffic(data.toString().length, 0, 1, 0);

      switch (message.type) {
        case MessageType.AUTH:
          await this.handleAuth(connectionId, message.payload);
          break;
        case MessageType.SUBSCRIBE:
          await this.handleSubscribe(connectionId, message.payload);
          break;
        case MessageType.UNSUBSCRIBE:
          await this.handleUnsubscribe(connectionId, message.payload);
          break;
        case MessageType.HEARTBEAT:
          this.handleHeartbeat(connectionId);
          break;
        default:
          this.sendMessage(connectionId, {
            type: MessageType.ERROR,
            payload: { message: '未知消息类型' },
            requestId: message.requestId
          });
      }
      
      // 记录消息处理时间
      const processingTime = Date.now() - startTime;
      if (processingTime > 100) { // 超过100ms记录为慢处理
        console.warn(`Slow message processing: ${processingTime}ms for ${message.type}`);
      }
    } catch (error) {
      console.error(`处理消息错误 ${connectionId}:`, error);
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: '消息格式错误' }
      });
    }
  }

  // 处理认证
  private async handleAuth(connectionId: string, payload: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const { token } = payload;
      if (!token) {
        throw new Error('缺少认证令牌');
      }

      // 验证JWT令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      
      // 查询用户信息
      const userResult = await pool.query(
        'SELECT id, username, role, department_id FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('用户不存在或已被禁用');
      }

      const user = userResult.rows[0];

      // 检查用户连接数限制
      const userConnections = Array.from(this.connections.values())
        .filter(conn => conn.userId === user.id && conn.state === ConnectionState.CONNECTED);
      
      if (userConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
        throw new Error('超过最大连接数限制');
      }

      // 更新连接信息
      connection.userId = user.id;
      connection.username = user.username;
      connection.role = user.role;
      connection.departmentId = user.department_id;
      connection.state = ConnectionState.CONNECTED;

      // 发送认证成功消息
      this.sendMessage(connectionId, {
        type: MessageType.SUCCESS,
        payload: {
          message: '认证成功',
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            departmentId: user.department_id
          }
        }
      });

      // 触发连接事件
      this.emit('userConnected', {
        connectionId,
        userId: user.id,
        username: user.username,
        role: user.role
      });

      console.log(`用户认证成功: ${user.username} (${connectionId})`);
    } catch (error) {
      console.error(`认证失败 ${connectionId}:`, error);
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: error.message || '认证失败' }
      });
      connection.ws.close(1008, '认证失败');
    }
  }

  // 处理订阅
  private async handleSubscribe(connectionId: string, payload: any) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== ConnectionState.CONNECTED) {
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: '未认证或连接已断开' }
      });
      return;
    }

    try {
      const { channels, syncEvents } = payload;
      
      // 处理传统频道订阅
      const subscribedChannels: string[] = [];
      if (Array.isArray(channels)) {
        for (const channelName of channels) {
          // 验证用户是否有权限订阅该频道
          if (await this.canSubscribeChannel(connection, channelName)) {
            this.subscribeToChannel(connectionId, channelName);
            subscribedChannels.push(channelName);
          }
        }
      }

      // 处理实时数据同步订阅
      if (Array.isArray(syncEvents) && connection.userId) {
        try {
          const validEvents = syncEvents.filter(event => 
            Object.values(SyncEventType).includes(event)
          );
          
          await this.realtimeService.createUserSubscription(
            connectionId,
            connection.userId,
            validEvents
          );
          
          console.log(`用户 ${connection.username} 订阅了 ${validEvents.length} 个同步事件`);
        } catch (error) {
          console.error('Error creating realtime subscription:', error);
        }
      }

      this.sendMessage(connectionId, {
        type: MessageType.SUCCESS,
        payload: {
          message: '订阅成功',
          subscribedChannels
        }
      });
    } catch (error) {
      console.error(`订阅失败 ${connectionId}:`, error);
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: error.message || '订阅失败' }
      });
    }
  }

  // 处理取消订阅
  private async handleUnsubscribe(connectionId: string, payload: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const { channels, syncEvents } = payload;
      
      // 处理传统频道取消订阅
      const unsubscribedChannels: string[] = [];
      if (Array.isArray(channels)) {
        for (const channelName of channels) {
          if (connection.subscriptions.has(channelName)) {
            this.unsubscribeFromChannel(connectionId, channelName);
            unsubscribedChannels.push(channelName);
          }
        }
      }

      // 处理实时数据同步取消订阅
      if (Array.isArray(syncEvents) || syncEvents === 'all') {
        this.realtimeService.removeSubscription(connectionId);
      }

      this.sendMessage(connectionId, {
        type: MessageType.SUCCESS,
        payload: {
          message: '取消订阅成功',
          unsubscribedChannels
        }
      });
    } catch (error) {
      console.error(`取消订阅失败 ${connectionId}:`, error);
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: error.message || '取消订阅失败' }
      });
    }
  }

  // 处理心跳
  private handleHeartbeat(connectionId: string) {
    this.sendMessage(connectionId, {
      type: MessageType.HEARTBEAT,
      payload: { timestamp: Date.now() }
    });
  }

  // 处理Pong响应
  private handlePong(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  // 处理断开连接
  private handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`WebSocket连接断开: ${connection.username || 'Unknown'} (${connectionId})`);

    // 使用连接管理器移除连接
    this.connectionManager.removeConnection(connectionId);

    // 移除实时服务订阅
    this.realtimeService.removeSubscription(connectionId);

    // 从所有频道取消订阅
    for (const channelName of connection.subscriptions) {
      this.unsubscribeFromChannel(connectionId, channelName);
    }

    // 移除连接
    this.connections.delete(connectionId);
    
    // 记录网络流量
    this.systemMonitor.recordNetworkTraffic(0, 0, 0, 1);

    // 触发断开连接事件
    if (connection.userId) {
      this.emit('userDisconnected', {
        connectionId,
        userId: connection.userId,
        username: connection.username
      });
    }
  }

  // 处理错误
  private handleError(connectionId: string, error: Error) {
    console.error(`WebSocket错误 ${connectionId}:`, error);
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendMessage(connectionId, {
        type: MessageType.ERROR,
        payload: { message: '连接错误' }
      });
    }
  }

  // 订阅频道
  private subscribeToChannel(connectionId: string, channelName: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 添加到连接的订阅列表
    connection.subscriptions.add(channelName);

    // 获取或创建频道
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = {
        name: channelName,
        connections: new Set(),
        lastUpdate: new Date()
      };
      this.channels.set(channelName, channel);
    }

    // 添加连接到频道
    channel.connections.add(connectionId);

    console.log(`用户 ${connection.username} 订阅频道: ${channelName}`);
  }

  // 取消订阅频道
  private unsubscribeFromChannel(connectionId: string, channelName: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 从连接的订阅列表移除
    connection.subscriptions.delete(channelName);

    // 从频道移除连接
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.connections.delete(connectionId);
      
      // 如果频道没有订阅者，删除频道
      if (channel.connections.size === 0) {
        this.channels.delete(channelName);
      }
    }

    console.log(`用户 ${connection.username} 取消订阅频道: ${channelName}`);
  }

  // 检查用户是否可以订阅频道
  private async canSubscribeChannel(connection: UserConnection, channelName: string): Promise<boolean> {
    // 基础频道权限检查
    const publicChannels = ['system_status', 'announcements'];
    if (publicChannels.includes(channelName)) {
      return true;
    }

    // 部门频道权限检查
    if (channelName.startsWith('department_')) {
      const departmentId = channelName.split('_')[1];
      return connection.departmentId?.toString() === departmentId || connection.role === 'admin';
    }

    // 管理员频道权限检查
    if (channelName.startsWith('admin_')) {
      return connection.role === 'admin';
    }

    // 用户个人频道权限检查
    if (channelName.startsWith('user_')) {
      const userId = channelName.split('_')[1];
      return connection.userId.toString() === userId;
    }

    return false;
  }

  // 发送消息到连接
  private sendMessage(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now()
      }));
      return true;
    } catch (error) {
      console.error(`发送消息失败 ${connectionId}:`, error);
      return false;
    }
  }

  // 广播消息到频道
  public broadcastToChannel(channelName: string, message: any) {
    const channel = this.channels.get(channelName);
    if (!channel) {
      console.warn(`频道不存在: ${channelName}`);
      return 0;
    }

    let sentCount = 0;
    for (const connectionId of channel.connections) {
      if (this.sendMessage(connectionId, {
        type: MessageType.DATA_UPDATE,
        payload: {
          channel: channelName,
          data: message
        }
      })) {
        sentCount++;
      }
    }

    channel.lastUpdate = new Date();
    console.log(`广播消息到频道 ${channelName}: ${sentCount}/${channel.connections.size} 连接`);
    return sentCount;
  }

  // 发送消息给特定用户的所有连接
  public sendToUser(userId: number, message: any) {
    const userConnections = Array.from(this.connections.values())
      .filter(conn => conn.userId === userId && conn.state === ConnectionState.CONNECTED);
    
    let sentCount = 0;
    for (const connection of userConnections) {
      if (this.sendMessage(connection.id, {
        type: MessageType.DATA_UPDATE,
        payload: message
      })) {
        sentCount++;
      }
    }

    return sentCount;
  }

  // 启动心跳检测
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // 启动清理任务
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const toRemove: string[] = [];

      for (const [connectionId, connection] of this.connections) {
        const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
        
        if (timeSinceLastActivity > this.CONNECTION_TIMEOUT) {
          console.log(`清理超时连接: ${connection.username || 'Unknown'} (${connectionId})`);
          connection.ws.close(1000, '连接超时');
          toRemove.push(connectionId);
        }
      }

      // 移除超时连接
      for (const connectionId of toRemove) {
        this.handleDisconnection(connectionId);
      }
    }, this.CONNECTION_TIMEOUT / 2); // 每30秒检查一次
  }

  // 生成连接ID
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取连接统计信息
  public getStats() {
    const totalConnections = this.connections.size;
    const authenticatedConnections = Array.from(this.connections.values())
      .filter(conn => conn.state === ConnectionState.CONNECTED).length;
    const totalChannels = this.channels.size;
    
    const userStats = new Map<number, number>();
    for (const connection of this.connections.values()) {
      if (connection.userId) {
        userStats.set(connection.userId, (userStats.get(connection.userId) || 0) + 1);
      }
    }

    const channelStats = new Map<string, number>();
    for (const [name, channel] of this.channels) {
      channelStats.set(name, channel.connections.size);
    }

    const connectionManagerStats = this.connectionManager.getStats();
    const systemStatus = this.systemMonitor.getSystemStatus();
    const databaseStatus = this.databaseRecovery.getDatabaseStatus();

    return {
      totalConnections,
      authenticatedConnections,
      totalChannels,
      userStats: Object.fromEntries(userStats),
      channelStats: Object.fromEntries(channelStats),
      realtime: this.realtimeService.getStats(),
      connectionManager: connectionManagerStats,
      systemHealth: systemStatus,
      databaseHealth: databaseStatus,
      performance: {
        alerts: this.systemMonitor.getActiveAlerts().length,
        metrics: systemStatus.metrics
      },
      uptime: process.uptime()
    };
  }

  /**
   * 发布数据变更事件
   */
  public async publishDataChange(
    type: SyncEventType,
    data: any,
    options?: {
      userId?: number;
      departmentId?: number;
      source?: string;
    }
  ): Promise<void> {
    await this.realtimeService.publishDataChange(type, data, options);
  }

  /**
   * 获取实时服务实例
   */
  public getRealtimeService(): RealtimeService {
    return this.realtimeService;
  }

  // 关闭WebSocket管理器
  public async close() {
    console.log('关闭WebSocket管理器...');
    
    // 关闭系统监控
    this.systemMonitor.shutdown();
    
    // 关闭恢复管理器
    this.connectionRecovery.shutdown();
    this.databaseRecovery.shutdown();
    
    // 关闭连接管理器
    this.connectionManager.closeAllConnections();
    
    // 清理定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 关闭实时服务
    await this.realtimeService.close();
    
    // 关闭Redis连接
    await this.redis.quit();

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, '服务器关闭');
    }

    // 关闭WebSocket服务器
    this.wss.close();
    
    console.log('WebSocket管理器已关闭');
  }
}

export default WebSocketManager;
export { MessageType, ConnectionState, UserConnection, WSMessage };