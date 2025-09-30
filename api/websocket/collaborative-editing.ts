import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

interface EditingSession {
  sessionId: string;
  chartId: string;
  userId: string;
  department: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  cursor?: { x: number; y: number };
  selectedSeats: string[];
}

interface SeatOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'select';
  seatId: string;
  data: any;
  userId: string;
  timestamp: string;
  sessionId: string;
}

interface CollaborativeState {
  chartId: string;
  activeSessions: Map<string, EditingSession>;
  pendingOperations: SeatOperation[];
  lastSyncTime: string;
}

class CollaborativeEditingManager {
  private io: SocketIOServer;
  private redis: Redis;
  private collaborativeStates: Map<string, CollaborativeState> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(server: HttpServer, redis: Redis) {
    this.redis = redis;
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://your-domain.com'] 
          : ['http://localhost:5173', 'http://localhost:5174'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/ws/collaborative-editing'
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    
    console.log('🤝 协同编辑WebSocket服务已启动');
  }

  // 设置事件处理器
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 新的协同编辑连接: ${socket.id}`);

      // 加入编辑会话
      socket.on('join-editing-session', async (data) => {
        await this.handleJoinSession(socket, data);
      });

      // 离开编辑会话
      socket.on('leave-editing-session', async (data) => {
        await this.handleLeaveSession(socket, data);
      });

      // 座位操作
      socket.on('seat-operation', async (operation) => {
        await this.handleSeatOperation(socket, operation);
      });

      // 光标移动
      socket.on('cursor-move', async (data) => {
        await this.handleCursorMove(socket, data);
      });

      // 座位选择
      socket.on('seat-select', async (data) => {
        await this.handleSeatSelect(socket, data);
      });

      // 心跳
      socket.on('heartbeat', async (data) => {
        await this.handleHeartbeat(socket, data);
      });

      // 断开连接
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // 处理加入编辑会话
  private async handleJoinSession(socket: any, data: any) {
    try {
      const { chartId, userId, token } = data;
      
      // 验证JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      
      const sessionId = `session-${socket.id}`;
      const session: EditingSession = {
        sessionId,
        chartId,
        userId,
        department: data.department,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isActive: true,
        selectedSeats: []
      };

      // 加入房间
      socket.join(`chart-${chartId}`);
      
      // 获取或创建协同状态
      let state = this.collaborativeStates.get(chartId);
      if (!state) {
        state = {
          chartId,
          activeSessions: new Map(),
          pendingOperations: [],
          lastSyncTime: new Date().toISOString()
        };
        this.collaborativeStates.set(chartId, state);
      }

      // 添加会话
      state.activeSessions.set(sessionId, session);

      // 缓存会话信息到Redis
      await this.cacheSession(session);

      // 通知其他用户
      socket.to(`chart-${chartId}`).emit('user-joined', {
        userId,
        sessionId,
        timestamp: new Date().toISOString()
      });

      // 发送当前状态给新用户
      socket.emit('session-joined', {
        sessionId,
        activeSessions: Array.from(state.activeSessions.values()),
        pendingOperations: state.pendingOperations
      });

      console.log(`👥 用户加入编辑会话 - 图表: ${chartId}, 用户: ${userId}`);
    } catch (error) {
      console.error('加入编辑会话失败:', error);
      socket.emit('error', { message: '加入编辑会话失败', error: error.message });
    }
  }

  // 处理离开编辑会话
  private async handleLeaveSession(socket: any, data: any) {
    try {
      const { chartId, sessionId } = data;
      
      const state = this.collaborativeStates.get(chartId);
      if (state && state.activeSessions.has(sessionId)) {
        const session = state.activeSessions.get(sessionId);
        session!.isActive = false;
        
        // 移除会话
        state.activeSessions.delete(sessionId);
        
        // 删除Redis缓存
        await this.redis.del(`session:${sessionId}`);
        
        // 离开房间
        socket.leave(`chart-${chartId}`);
        
        // 通知其他用户
        socket.to(`chart-${chartId}`).emit('user-left', {
          userId: session!.userId,
          sessionId,
          timestamp: new Date().toISOString()
        });

        console.log(`👋 用户离开编辑会话 - 图表: ${chartId}, 会话: ${sessionId}`);
      }
    } catch (error) {
      console.error('离开编辑会话失败:', error);
    }
  }

  // 处理座位操作
  private async handleSeatOperation(socket: any, operation: SeatOperation) {
    try {
      const { chartId } = operation;
      const state = this.collaborativeStates.get(chartId);
      
      if (!state) {
        socket.emit('error', { message: '编辑会话不存在' });
        return;
      }

      // 验证操作权限
      const session = Array.from(state.activeSessions.values())
        .find(s => s.sessionId === operation.sessionId);
      
      if (!session) {
        socket.emit('error', { message: '会话无效' });
        return;
      }

      // 添加到待处理操作队列
      state.pendingOperations.push(operation);
      
      // 缓存操作到Redis
      await this.cacheOperation(operation);

      // 广播操作给其他用户
      socket.to(`chart-${chartId}`).emit('seat-operation', operation);

      // 更新会话活动时间
      session.lastActivity = new Date().toISOString();

      console.log(`🔧 座位操作 - 类型: ${operation.type}, 座位: ${operation.seatId}`);
    } catch (error) {
      console.error('处理座位操作失败:', error);
      socket.emit('error', { message: '座位操作失败', error: error.message });
    }
  }

  // 处理光标移动
  private async handleCursorMove(socket: any, data: any) {
    try {
      const { chartId, sessionId, cursor } = data;
      const state = this.collaborativeStates.get(chartId);
      
      if (state && state.activeSessions.has(sessionId)) {
        const session = state.activeSessions.get(sessionId);
        session!.cursor = cursor;
        session!.lastActivity = new Date().toISOString();

        // 广播光标位置给其他用户
        socket.to(`chart-${chartId}`).emit('cursor-move', {
          userId: session!.userId,
          cursor,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('处理光标移动失败:', error);
    }
  }

  // 处理座位选择
  private async handleSeatSelect(socket: any, data: any) {
    try {
      const { chartId, sessionId, seatIds } = data;
      const state = this.collaborativeStates.get(chartId);
      
      if (state && state.activeSessions.has(sessionId)) {
        const session = state.activeSessions.get(sessionId);
        session!.selectedSeats = seatIds;
        session!.lastActivity = new Date().toISOString();

        // 广播选择状态给其他用户
        socket.to(`chart-${chartId}`).emit('seat-select', {
          userId: session!.userId,
          seatIds,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('处理座位选择失败:', error);
    }
  }

  // 处理心跳
  private async handleHeartbeat(socket: any, data: any) {
    try {
      const { sessionId } = data;
      
      // 更新Redis中的会话活动时间
      await this.redis.hset(`session:${sessionId}`, 'lastActivity', new Date().toISOString());
      
      socket.emit('heartbeat-ack', { timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('处理心跳失败:', error);
    }
  }

  // 处理断开连接
  private handleDisconnect(socket: any) {
    console.log(`🔌 协同编辑连接断开: ${socket.id}`);
    
    // 清理相关会话
    for (const [chartId, state] of this.collaborativeStates) {
      for (const [sessionId, session] of state.activeSessions) {
        if (session.sessionId.includes(socket.id)) {
          session.isActive = false;
          state.activeSessions.delete(sessionId);
          
          // 通知其他用户
          socket.to(`chart-${chartId}`).emit('user-disconnected', {
            userId: session.userId,
            sessionId,
            timestamp: new Date().toISOString()
          });
          
          break;
        }
      }
    }
  }

  // 缓存会话信息
  private async cacheSession(session: EditingSession) {
    const key = `session:${session.sessionId}`;
    await this.redis.hset(key, {
      chartId: session.chartId,
      userId: session.userId,
      department: session.department,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      isActive: session.isActive.toString()
    });
    
    // 设置过期时间 (2小时)
    await this.redis.expire(key, 7200);
  }

  // 缓存操作
  private async cacheOperation(operation: SeatOperation) {
    const key = `operation:${operation.sessionId}:${Date.now()}`;
    await this.redis.set(key, JSON.stringify(operation), 'EX', 3600); // 1小时过期
  }

  // 启动心跳检查
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      await this.checkSessionHealth();
    }, 30000); // 30秒检查一次
  }

  // 检查会话健康状态
  private async checkSessionHealth() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟超时

    for (const [chartId, state] of this.collaborativeStates) {
      const expiredSessions: string[] = [];
      
      for (const [sessionId, session] of state.activeSessions) {
        const lastActivity = new Date(session.lastActivity).getTime();
        if (now - lastActivity > timeout) {
          expiredSessions.push(sessionId);
        }
      }

      // 清理过期会话
      for (const sessionId of expiredSessions) {
        const session = state.activeSessions.get(sessionId);
        if (session) {
          state.activeSessions.delete(sessionId);
          await this.redis.del(`session:${sessionId}`);
          
          // 通知其他用户
          this.io.to(`chart-${chartId}`).emit('user-timeout', {
            userId: session.userId,
            sessionId,
            timestamp: new Date().toISOString()
          });
          
          console.log(`⏰ 会话超时清理 - 图表: ${chartId}, 会话: ${sessionId}`);
        }
      }
    }
  }

  // 获取协同编辑状态
  public getCollaborativeState(chartId: string): CollaborativeState | null {
    return this.collaborativeStates.get(chartId) || null;
  }

  // 获取活跃会话统计
  public getActiveSessionsStats() {
    const stats = {
      totalCharts: this.collaborativeStates.size,
      totalSessions: 0,
      sessionsByChart: new Map<string, number>()
    };

    for (const [chartId, state] of this.collaborativeStates) {
      const activeCount = state.activeSessions.size;
      stats.totalSessions += activeCount;
      stats.sessionsByChart.set(chartId, activeCount);
    }

    return stats;
  }

  // 强制同步所有待处理操作
  public async forceSyncPendingOperations(chartId: string) {
    const state = this.collaborativeStates.get(chartId);
    if (!state || state.pendingOperations.length === 0) {
      return;
    }

    try {
      console.log(`🔄 强制同步待处理操作 - 图表: ${chartId}, 操作数: ${state.pendingOperations.length}`);

      // 批量处理操作
      const operations = [...state.pendingOperations];
      state.pendingOperations = [];

      // 应用操作到数据库
      for (const operation of operations) {
        await this.applyOperationToDB(operation);
      }

      // 更新同步时间
      state.lastSyncTime = new Date().toISOString();

      // 通知所有用户同步完成
      this.io.to(`chart-${chartId}`).emit('sync-completed', {
        operationCount: operations.length,
        syncTime: state.lastSyncTime
      });

      console.log(`✅ 操作同步完成 - 图表: ${chartId}`);
    } catch (error) {
      console.error('强制同步操作失败:', error);
      
      // 通知用户同步失败
      this.io.to(`chart-${chartId}`).emit('sync-failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 应用操作到数据库
  private async applyOperationToDB(operation: SeatOperation) {
    try {
      switch (operation.type) {
        case 'create':
          await this.createSeatInDB(operation);
          break;
        case 'update':
          await this.updateSeatInDB(operation);
          break;
        case 'delete':
          await this.deleteSeatInDB(operation);
          break;
        case 'move':
          await this.moveSeatInDB(operation);
          break;
        default:
          console.warn(`未知操作类型: ${operation.type}`);
      }
    } catch (error) {
      console.error(`应用操作到数据库失败 - 操作: ${operation.type}, 座位: ${operation.seatId}`, error);
      throw error;
    }
  }

  // 在数据库中创建座位
  private async createSeatInDB(operation: SeatOperation) {
    // 这里应该调用座位图API来创建座位
    console.log(`📝 创建座位 - ID: ${operation.seatId}`);
  }

  // 在数据库中更新座位
  private async updateSeatInDB(operation: SeatOperation) {
    // 这里应该调用座位图API来更新座位
    console.log(`📝 更新座位 - ID: ${operation.seatId}`);
  }

  // 在数据库中删除座位
  private async deleteSeatInDB(operation: SeatOperation) {
    // 这里应该调用座位图API来删除座位
    console.log(`📝 删除座位 - ID: ${operation.seatId}`);
  }

  // 在数据库中移动座位
  private async moveSeatInDB(operation: SeatOperation) {
    // 这里应该调用座位图API来移动座位
    console.log(`📝 移动座位 - ID: ${operation.seatId}`);
  }

  // 销毁服务
  public destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.collaborativeStates.clear();
    this.io.close();
    
    console.log('🔚 协同编辑服务已销毁');
  }
}

export default CollaborativeEditingManager;