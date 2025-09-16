import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Pool } from 'pg';
import Redis from 'ioredis';

// WebSocket连接指标接口
interface ConnectionMetrics {
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
}

// WebSocket消息协议
interface WebSocketMessage {
  type: MessageType;
  data: any;
  timestamp: string;
  messageId: string;
  version?: string;
}

enum MessageType {
  // 系统消息
  SYSTEM_STATUS = 'system_status',
  CONNECTION_ACK = 'connection_ack',
  HEARTBEAT = 'heartbeat',
  
  // 数据更新消息
  EMPLOYEE_UPDATE = 'employee_update',
  DEPARTMENT_UPDATE = 'department_update',
  WORKSTATION_UPDATE = 'workstation_update',
  
  // 监控数据消息
  SERVER_METRICS = 'server_metrics',
  DATABASE_METRICS = 'database_metrics',
  
  // 错误消息
  ERROR = 'error',
  WARNING = 'warning'
}

// WebSocket连接管理器
class WebSocketConnectionManager {
  private connections: Map<string, any> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private readonly maxConnections: number = 1000;
  private readonly maxConnectionsPerIP: number = 10;
  private ipConnectionCount: Map<string, number> = new Map();

  // 连接建立
  public addConnection(connectionId: string, socket: any, clientIP: string): boolean {
    if (!this.canAcceptConnection(clientIP)) {
      return false;
    }

    this.connections.set(connectionId, socket);
    this.connectionMetrics.set(connectionId, {
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      isActive: true
    });

    this.incrementIPConnection(clientIP);
    this.setupConnectionHandlers(connectionId, socket);
    return true;
  }

  // 连接清理
  public removeConnection(connectionId: string, clientIP?: string): void {
    const socket = this.connections.get(connectionId);
    if (socket) {
      socket.disconnect();
      this.connections.delete(connectionId);
      this.connectionMetrics.delete(connectionId);
      
      if (clientIP) {
        this.decrementIPConnection(clientIP);
      }
    }
  }

  // 设置连接事件处理器
  private setupConnectionHandlers(connectionId: string, socket: any): void {
    socket.on('message', (data: any) => {
      this.updateLastActivity(connectionId);
      this.handleMessage(connectionId, data);
    });

    socket.on('disconnect', () => {
      this.removeConnection(connectionId);
    });

    socket.on('error', (error: Error) => {
      console.error(`Socket error for connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
    });
  }

  // 更新连接活动时间
  private updateLastActivity(connectionId: string): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.lastActivity = new Date();
      metrics.messageCount++;
    }
  }

  // 处理消息
  private handleMessage(connectionId: string, data: any): void {
    try {
      const message = JSON.parse(data);
      console.log(`Received message from ${connectionId}:`, message.type);
    } catch (error) {
      console.error(`Error parsing message from ${connectionId}:`, error);
    }
  }

  // 检查是否可以接受新连接
  private canAcceptConnection(clientIP: string): boolean {
    const totalConnections = this.connections.size;
    const ipConnections = this.ipConnectionCount.get(clientIP) || 0;
    
    return totalConnections < this.maxConnections && 
           ipConnections < this.maxConnectionsPerIP;
  }

  // 增加IP连接计数
  private incrementIPConnection(clientIP: string): void {
    const current = this.ipConnectionCount.get(clientIP) || 0;
    this.ipConnectionCount.set(clientIP, current + 1);
  }

  // 减少IP连接计数
  private decrementIPConnection(clientIP: string): void {
    const current = this.ipConnectionCount.get(clientIP) || 0;
    if (current > 0) {
      this.ipConnectionCount.set(clientIP, current - 1);
    }
  }

  // 健康检查
  public performHealthCheck(): void {
    const now = new Date();
    for (const [connectionId, metrics] of this.connectionMetrics) {
      const timeSinceLastActivity = now.getTime() - metrics.lastActivity.getTime();
      
      // 超过5分钟无活动的连接标记为不活跃
      if (timeSinceLastActivity > 300000) {
        metrics.isActive = false;
        this.removeConnection(connectionId);
      }
    }
  }

  // 获取活跃连接
  public getActiveConnections(): Map<string, any> {
    return new Map([...this.connections].filter(([id]) => {
      const metrics = this.connectionMetrics.get(id);
      return metrics?.isActive;
    }));
  }

  // 获取连接统计
  public getConnectionStats(): any {
    return {
      totalConnections: this.connections.size,
      activeConnections: this.getActiveConnections().size,
      connectionsByIP: Object.fromEntries(this.ipConnectionCount)
    };
  }

  // 广播消息给所有客户端
  public broadcastMessage(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    this.getActiveConnections().forEach((socket, connectionId) => {
      try {
        socket.emit('message', messageStr);
      } catch (error) {
        console.error(`Error sending message to connection ${connectionId}:`, error);
        this.removeConnection(connectionId);
      }
    });
  }
}

// 数据库变更监听器
class DatabaseChangeListener {
  private pool: Pool;
  private listeners: Map<string, Function[]> = new Map();
  private client: any;

  constructor(pool: Pool) {
    this.pool = pool;
    this.setupChangeNotifications();
  }

  private async setupChangeNotifications(): Promise<void> {
    try {
      this.client = await this.pool.connect();
      
      // 监听数据库通知
      this.client.on('notification', (msg: any) => {
        this.handleDatabaseNotification(msg);
      });
      
      // 订阅特定表的变更通知
      await this.client.query('LISTEN employee_changes');
      await this.client.query('LISTEN department_changes');
      await this.client.query('LISTEN workstation_changes');
      
      console.log('Database change notifications setup completed');
    } catch (error) {
      console.error('Error setting up database notifications:', error);
    }
  }

  private handleDatabaseNotification(msg: any): void {
    const { channel, payload } = msg;
    const listeners = this.listeners.get(channel) || [];
    
    try {
      const data = JSON.parse(payload);
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in notification listener:', error);
        }
      });
    } catch (error) {
      console.error('Error parsing notification payload:', error);
    }
  }

  public subscribe(channel: string, callback: Function): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel)!.push(callback);
  }

  public async cleanup(): Promise<void> {
    if (this.client) {
      this.client.release();
    }
  }
}

// 实时数据推送服务
class RealTimeDataService {
  private wsManager: WebSocketConnectionManager;
  private dbListener: DatabaseChangeListener;
  private dataCache: Map<string, any> = new Map();
  private redis: Redis;

  constructor(
    wsManager: WebSocketConnectionManager, 
    dbListener: DatabaseChangeListener,
    redis: Redis
  ) {
    this.wsManager = wsManager;
    this.dbListener = dbListener;
    this.redis = redis;
    this.setupDataSubscriptions();
  }

  private setupDataSubscriptions(): void {
    // 订阅员工数据变更
    this.dbListener.subscribe('employee_changes', (data: any) => {
      this.handleEmployeeChange(data);
    });
    
    // 订阅部门数据变更
    this.dbListener.subscribe('department_changes', (data: any) => {
      this.handleDepartmentChange(data);
    });
    
    // 订阅工位数据变更
    this.dbListener.subscribe('workstation_changes', (data: any) => {
      this.handleWorkstationChange(data);
    });
  }

  private handleEmployeeChange(data: any): void {
    const message: WebSocketMessage = {
      type: MessageType.EMPLOYEE_UPDATE,
      data: data,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    };
    
    // 更新缓存
    this.updateCache('employees', data);
    
    // 广播给所有连接的客户端
    this.wsManager.broadcastMessage(message);
  }

  private handleDepartmentChange(data: any): void {
    const message: WebSocketMessage = {
      type: MessageType.DEPARTMENT_UPDATE,
      data: data,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    };
    
    this.updateCache('departments', data);
    this.wsManager.broadcastMessage(message);
  }

  private handleWorkstationChange(data: any): void {
    const message: WebSocketMessage = {
      type: MessageType.WORKSTATION_UPDATE,
      data: data,
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    };
    
    this.updateCache('workstations', data);
    this.wsManager.broadcastMessage(message);
  }

  private updateCache(key: string, data: any): void {
    const cacheData = {
      data: data,
      timestamp: new Date(),
      version: (this.dataCache.get(key)?.version || 0) + 1
    };
    
    this.dataCache.set(key, cacheData);
    
    // 同步到Redis
    this.redis.setex(`cache:${key}`, 3600, JSON.stringify(cacheData));
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getCachedData(key: string): any {
    return this.dataCache.get(key);
  }
}

// WebSocket服务器主类
export class WebSocketServer {
  private io: SocketIOServer;
  private wsManager: WebSocketConnectionManager;
  private dbListener: DatabaseChangeListener;
  private realTimeService: RealTimeDataService;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    httpServer: HttpServer, 
    pool: Pool, 
    redis: Redis
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.wsManager = new WebSocketConnectionManager();
    this.dbListener = new DatabaseChangeListener(pool);
    this.realTimeService = new RealTimeDataService(
      this.wsManager, 
      this.dbListener, 
      redis
    );

    this.setupSocketHandlers();
    this.startHealthCheck();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      const connectionId = socket.id;
      const clientIP = socket.handshake.address;
      
      console.log(`New WebSocket connection: ${connectionId} from ${clientIP}`);
      
      // 尝试添加连接
      const accepted = this.wsManager.addConnection(connectionId, socket, clientIP);
      
      if (!accepted) {
        console.log(`Connection rejected: ${connectionId}`);
        socket.emit('error', { message: 'Connection limit exceeded' });
        socket.disconnect();
        return;
      }

      // 发送连接确认
      socket.emit('message', JSON.stringify({
        type: MessageType.CONNECTION_ACK,
        data: { connectionId },
        timestamp: new Date().toISOString(),
        messageId: `ack_${connectionId}`
      }));

      // 设置心跳
      const heartbeatInterval = setInterval(() => {
        socket.emit('message', JSON.stringify({
          type: MessageType.HEARTBEAT,
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          messageId: `heartbeat_${Date.now()}`
        }));
      }, 30000); // 每30秒发送心跳

      socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
        this.wsManager.removeConnection(connectionId, clientIP);
        console.log(`WebSocket connection closed: ${connectionId}`);
      });
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.wsManager.performHealthCheck();
    }, 60000); // 每分钟执行健康检查
  }

  public getConnectionStats(): any {
    return this.wsManager.getConnectionStats();
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.dbListener.cleanup();
    this.io.close();
    console.log('WebSocket server shutdown completed');
  }
}

export { MessageType, WebSocketMessage };