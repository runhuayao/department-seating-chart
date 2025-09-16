import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import db from '../config/database.js';

interface DatabaseChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: string;
  userId?: string;
}

interface SyncRequest {
  tables: string[];
  lastSync?: string;
}

class DatabaseSyncWebSocket extends EventEmitter {
  private io: SocketIOServer;
  private connectedClients = new Map<string, {
    userId?: string;
    subscribedTables: Set<string>;
    lastActivity: Date;
  }>();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    super();
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/database'
    });

    this.setupEventHandlers();
    this.startPeriodicSync();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Database sync client connected: ${socket.id}`);
      
      // 初始化客户端信息
      this.connectedClients.set(socket.id, {
        subscribedTables: new Set(),
        lastActivity: new Date()
      });

      // 处理用户认证
      socket.on('authenticate', (data: { userId: string, token: string }) => {
        // TODO: 验证JWT token
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.userId = data.userId;
          client.lastActivity = new Date();
          socket.emit('authenticated', { success: true });
          console.log(`Client ${socket.id} authenticated as user ${data.userId}`);
        }
      });

      // 处理表订阅
      socket.on('subscribe-tables', (tables: string[]) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          tables.forEach(table => client.subscribedTables.add(table));
          client.lastActivity = new Date();
          socket.emit('subscription-confirmed', { tables });
          console.log(`Client ${socket.id} subscribed to tables:`, tables);
        }
      });

      // 处理取消订阅
      socket.on('unsubscribe-tables', (tables: string[]) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          tables.forEach(table => client.subscribedTables.delete(table));
          client.lastActivity = new Date();
          socket.emit('unsubscription-confirmed', { tables });
        }
      });

      // 处理数据同步请求
      socket.on('request-sync', async (request: SyncRequest) => {
        await this.handleSyncRequest(socket.id, request);
      });

      // 处理实时数据请求
      socket.on('request-realtime-data', async (table: string) => {
        await this.sendRealtimeData(socket.id, table);
      });

      // 处理数据变更通知
      socket.on('data-changed', (change: DatabaseChangeEvent) => {
        this.broadcastDataChange(change, socket.id);
      });

      // 处理断开连接
      socket.on('disconnect', () => {
        console.log(`Database sync client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // 心跳检测
      socket.on('ping', () => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.lastActivity = new Date();
          socket.emit('pong');
        }
      });
    });
  }

  private async handleSyncRequest(socketId: string, request: SyncRequest): Promise<void> {
    try {
      const client = this.connectedClients.get(socketId);
      if (!client) return;

      const syncData: any = {};
      
      for (const table of request.tables) {
        try {
          let query = `SELECT * FROM ${table}`;
          const params: any[] = [];
          
          // 如果提供了最后同步时间，只获取更新的数据
          if (request.lastSync) {
            query += ` WHERE updated_at > $1 ORDER BY updated_at ASC`;
            params.push(request.lastSync);
          }
          
          const result = await db.query(query, params);
          syncData[table] = {
            data: result.rows,
            count: result.rows.length,
            lastSync: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Error syncing table ${table}:`, error);
          syncData[table] = {
            error: `Failed to sync table ${table}`,
            count: 0
          };
        }
      }

      this.io.to(socketId).emit('sync-response', {
        success: true,
        data: syncData,
        timestamp: new Date().toISOString()
      });

      client.lastActivity = new Date();
    } catch (error) {
      console.error('Error handling sync request:', error);
      this.io.to(socketId).emit('sync-response', {
        success: false,
        error: 'Failed to process sync request',
        timestamp: new Date().toISOString()
      });
    }
  }

  private async sendRealtimeData(socketId: string, table: string): Promise<void> {
    try {
      // 获取表的最新数据
      const result = await db.query(`
        SELECT * FROM ${table} 
        ORDER BY updated_at DESC 
        LIMIT 100
      `);

      this.io.to(socketId).emit('realtime-data', {
        table,
        data: result.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error sending realtime data for table ${table}:`, error);
      this.io.to(socketId).emit('realtime-error', {
        table,
        error: 'Failed to fetch realtime data',
        timestamp: new Date().toISOString()
      });
    }
  }

  private broadcastDataChange(change: DatabaseChangeEvent, excludeSocketId?: string): void {
    // 广播数据变更到所有订阅了该表的客户端
    this.connectedClients.forEach((client, socketId) => {
      if (socketId === excludeSocketId) return;
      if (client.subscribedTables.has(change.table)) {
        this.io.to(socketId).emit('data-change', change);
      }
    });
  }

  private startPeriodicSync(): void {
    // 每30秒检查一次连接状态并清理不活跃的连接
    this.syncInterval = setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5分钟超时
      
      this.connectedClients.forEach((client, socketId) => {
        if (now.getTime() - client.lastActivity.getTime() > timeout) {
          console.log(`Cleaning up inactive client: ${socketId}`);
          this.connectedClients.delete(socketId);
          this.io.to(socketId).disconnect();
        }
      });
    }, 30000);
  }

  // 公共方法：通知数据变更
  public notifyDataChange(change: DatabaseChangeEvent): void {
    this.broadcastDataChange(change);
  }

  // 公共方法：获取连接的客户端数量
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // 公共方法：获取订阅特定表的客户端数量
  public getTableSubscribersCount(table: string): number {
    let count = 0;
    this.connectedClients.forEach(client => {
      if (client.subscribedTables.has(table)) {
        count++;
      }
    });
    return count;
  }

  public close(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.io.close();
  }
}

export default DatabaseSyncWebSocket;