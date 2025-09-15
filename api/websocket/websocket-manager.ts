import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ServerMonitorWebSocket } from './server-monitor';
import { DataSyncWebSocket } from './data-sync';

/**
 * 统一的WebSocket管理器
 * 管理所有Socket.IO命名空间和服务
 */
export class WebSocketManager {
  private io: SocketIOServer;
  private serverMonitor: ServerMonitorWebSocket;
  private dataSync: DataSyncWebSocket;

  constructor(server: HttpServer) {
    // 创建单一的Socket.IO服务器实例
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/'
    });

    // 初始化各个服务的命名空间
    this.initializeNamespaces();
  }

  private initializeNamespaces(): void {
    // 服务器监控命名空间
    const monitorNamespace = this.io.of('/monitor');
    this.serverMonitor = new ServerMonitorWebSocket(monitorNamespace);

    // 数据同步命名空间
    const dataSyncNamespace = this.io.of('/data-sync');
    this.dataSync = new DataSyncWebSocket(dataSyncNamespace);

    console.log('✅ WebSocket命名空间初始化完成:');
    console.log('   📊 监控服务: /monitor');
    console.log('   🔄 数据同步: /data-sync');
  }

  /**
   * 获取数据同步WebSocket实例
   */
  public getDataSyncWebSocket(): DataSyncWebSocket {
    return this.dataSync;
  }

  /**
   * 获取服务器监控WebSocket实例
   */
  public getServerMonitorWebSocket(): ServerMonitorWebSocket {
    return this.serverMonitor;
  }

  /**
   * 关闭所有WebSocket连接
   */
  public close(): void {
    if (this.serverMonitor) {
      this.serverMonitor.close();
    }
    if (this.dataSync) {
      this.dataSync.destroy();
    }
    if (this.io) {
      this.io.close();
    }
    console.log('✅ WebSocket管理器已关闭');
  }
}