import { Namespace } from 'socket.io';
import db from '../models/database.js';

interface DataSyncEvent {
  type: 'create' | 'update' | 'delete';
  table: 'workstations' | 'employees' | 'departments';
  data: any;
  timestamp: string;
  userId?: string;
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: string;
  pendingChanges: number;
  syncInProgress: boolean;
}

/**
 * 数据同步WebSocket服务
 * 处理实时数据同步和广播
 */
export class DataSyncWebSocket {
  private io: Namespace;
  private connectedClients = new Set<string>();
  private activeConnection: string | null = null; // 单实例连接控制
  private connectionLog: Array<{timestamp: string, event: string, socketId: string, details?: any}> = [];
  private syncQueue: any[] = [];
  private isProcessingSync = false;
  private syncStatus: SyncStatus = {
    isOnline: true,
    lastSync: new Date().toISOString(),
    pendingChanges: 0,
    syncInProgress: false
  };

  constructor(namespace: Namespace) {
    this.io = namespace;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      // 单实例连接控制：新连接时终止现有连接
      if (this.activeConnection && this.activeConnection !== socket.id) {
        const previousSocket = this.io.sockets.get(this.activeConnection);
        if (previousSocket) {
          this.logConnectionEvent('connection_terminated', this.activeConnection, {
            reason: 'new_connection_established',
            newSocketId: socket.id
          });
          previousSocket.emit('connection-terminated', {
            reason: '新连接已建立，当前连接将被终止',
            timestamp: new Date().toISOString()
          });
          previousSocket.disconnect(true);
        }
        this.connectedClients.delete(this.activeConnection);
      }

      // 设置新的活跃连接
      this.activeConnection = socket.id;
      this.connectedClients.add(socket.id);
      
      this.logConnectionEvent('connection_established', socket.id, {
        clientsCount: this.connectedClients.size
      });
      
      if (process.env.LOG_LEVEL !== 'error') {
        console.log(`数据同步客户端连接: ${socket.id} (活跃连接)`);
      }

      // 发送当前同步状态
      socket.emit('sync-status', this.syncStatus);

      // 处理数据变更事件
      socket.on('data-change', (event: DataSyncEvent) => {
        this.handleDataChange(event, socket.id);
      });

      // 处理同步请求
      socket.on('request-sync', () => {
        this.handleSyncRequest(socket.id);
      });

      // 处理强制同步
      socket.on('force-sync', () => {
        this.handleForceSync(socket.id);
      });

      // 处理一致性检查请求
      socket.on('consistency-check', () => {
        this.handleConsistencyCheck(socket.id);
      });

      // 处理断开连接
      socket.on('disconnect', (reason) => {
        this.logConnectionEvent('connection_disconnected', socket.id, {
          reason: reason,
          clientsCount: this.connectedClients.size - 1
        });
        
        if (process.env.LOG_LEVEL !== 'error') {
          console.log(`数据同步客户端断开: ${socket.id}, 原因: ${reason}`);
        }
        
        this.connectedClients.delete(socket.id);
        
        // 如果断开的是活跃连接，清除活跃连接状态
        if (this.activeConnection === socket.id) {
          this.activeConnection = null;
          this.logConnectionEvent('active_connection_cleared', socket.id);
        }
      });
    });
  }

  /**
   * 处理数据变更事件
   */
  private handleDataChange(event: DataSyncEvent, socketId: string): void {
    if (process.env.LOG_LEVEL !== 'error') {
      console.log(`收到数据变更事件:`, event);
    }
    
    // 广播数据变更给其他客户端
    this.broadcastToOthers('data-changed', event, socketId);
    
    // 更新同步状态
    this.syncStatus.lastSync = new Date().toISOString();
    this.broadcastSyncStatus();
  }

  /**
   * 处理同步请求
   */
  private async handleSyncRequest(socketId: string): Promise<void> {
    try {
      this.syncStatus.syncInProgress = true;
      this.broadcastSyncStatus();

      // 模拟同步过程
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.syncStatus.syncInProgress = false;
      this.syncStatus.lastSync = new Date().toISOString();
      this.syncStatus.pendingChanges = 0;
      
      this.io.to(socketId).emit('sync-complete', {
        success: true,
        timestamp: this.syncStatus.lastSync
      });
      
      this.broadcastSyncStatus();
    } catch (error) {
      this.syncStatus.syncInProgress = false;
      this.io.to(socketId).emit('sync-error', {
        error: error instanceof Error ? error.message : '同步失败'
      });
      this.broadcastSyncStatus();
    }
  }

  /**
   * 处理强制同步
   */
  private async handleForceSync(socketId: string): Promise<void> {
    try {
      this.syncStatus.syncInProgress = true;
      this.broadcastSyncStatus();

      // 模拟强制同步过程
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.syncStatus.syncInProgress = false;
      this.syncStatus.lastSync = new Date().toISOString();
      this.syncStatus.pendingChanges = 0;
      
      this.io.to(socketId).emit('force-sync-complete', {
        success: true,
        timestamp: this.syncStatus.lastSync,
        message: '强制同步完成'
      });
      
      this.broadcastSyncStatus();
    } catch (error) {
      this.syncStatus.syncInProgress = false;
      this.io.to(socketId).emit('sync-error', {
        error: error instanceof Error ? error.message : '强制同步失败'
      });
      this.broadcastSyncStatus();
    }
  }

  /**
   * 处理一致性检查
   */
  private async handleConsistencyCheck(socketId: string): Promise<void> {
    try {
      // 模拟一致性检查
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const consistencyResult = {
        workstations: {
          local: Math.floor(Math.random() * 100) + 50,
          remote: Math.floor(Math.random() * 100) + 50,
          consistent: Math.random() > 0.3
        },
        employees: {
          local: Math.floor(Math.random() * 200) + 100,
          remote: Math.floor(Math.random() * 200) + 100,
          consistent: Math.random() > 0.3
        },
        departments: {
          local: Math.floor(Math.random() * 20) + 10,
          remote: Math.floor(Math.random() * 20) + 10,
          consistent: Math.random() > 0.3
        }
      };
      
      this.io.to(socketId).emit('consistency-result', consistencyResult);
    } catch (error) {
      this.io.to(socketId).emit('consistency-error', {
        error: error instanceof Error ? error.message : '一致性检查失败'
      });
    }
  }

  /**
   * 广播同步状态给所有客户端
   */
  private broadcastSyncStatus(): void {
    this.io.emit('sync-status', this.syncStatus);
  }

  /**
   * 广播消息给除了指定socket之外的所有客户端
   */
  private broadcastToOthers(event: string, data: any, excludeSocketId: string): void {
    this.connectedClients.forEach(clientId => {
      if (clientId !== excludeSocketId) {
        this.io.to(clientId).emit(event, data);
      }
    });
  }

  /**
   * 通知数据变更
   */
  public notifyDataChange(event: DataSyncEvent): void {
    this.io.emit('data-changed', event);
    this.syncStatus.lastSync = new Date().toISOString();
    this.broadcastSyncStatus();
  }

  /**
   * 设置在线状态
   */
  public setOnlineStatus(isOnline: boolean): void {
    this.syncStatus.isOnline = isOnline;
    this.broadcastSyncStatus();
  }

  /**
   * 更新待同步变更数量
   */
  public updatePendingChanges(count: number): void {
    this.syncStatus.pendingChanges = count;
    this.broadcastSyncStatus();
  }

  /**
   * 记录连接状态变更日志
   */
  private logConnectionEvent(event: string, socketId: string, details?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      socketId,
      details
    };
    
    this.connectionLog.push(logEntry);
    
    // 保持日志数量在合理范围内（最多保留100条）
    if (this.connectionLog.length > 100) {
      this.connectionLog = this.connectionLog.slice(-100);
    }
    
    if (process.env.LOG_LEVEL !== 'error') {
      console.log(`WebSocket连接日志: ${event} - ${socketId}`, details || '');
    }
  }

  /**
   * 获取连接的客户端数量
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * 获取活跃连接ID
   */
  public getActiveConnection(): string | null {
    return this.activeConnection;
  }

  /**
   * 获取连接状态变更日志
   */
  public getConnectionLog(): Array<{timestamp: string, event: string, socketId: string, details?: any}> {
    return [...this.connectionLog]; // 返回副本
  }

  /**
   * 清除连接日志
   */
  public clearConnectionLog(): void {
    this.connectionLog = [];
    console.log('WebSocket连接日志已清除');
  }

  /**
   * 销毁WebSocket服务
   */
  public destroy(): void {
    // Namespace doesn't have close method, just disconnect all sockets
    this.io.disconnectSockets();
    this.connectedClients.clear();
    console.log('数据同步WebSocket服务已关闭');
  }
}

export default DataSyncWebSocket;
export type { DataSyncEvent, SyncStatus };