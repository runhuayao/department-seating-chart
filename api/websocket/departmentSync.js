/**
 * 部门信息WebSocket同步服务
 * 实现前后端部门数据实时同步
 */
import { WebSocketServer } from 'ws';
import { DepartmentDAO } from '../database/dao.js';

/**
 * 部门同步WebSocket服务器
 */
export class DepartmentSyncServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws/department-sync' });
    this.clients = new Set();
    this.setupWebSocketServer();
  }

  /**
   * 设置WebSocket服务器
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('部门同步客户端连接:', req.socket.remoteAddress);
      
      // 添加客户端到集合
      this.clients.add(ws);
      
      // 发送连接确认
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: '部门同步服务已连接',
        timestamp: new Date().toISOString()
      }));

      // 处理客户端消息
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('处理WebSocket消息错误:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: '消息处理失败',
            error: error.message
          }));
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        console.log('部门同步客户端断开连接');
        this.clients.delete(ws);
      });

      // 处理连接错误
      ws.on('error', (error) => {
        console.error('WebSocket连接错误:', error);
        this.clients.delete(ws);
      });
    });

    console.log('部门同步WebSocket服务器已启动');
  }

  /**
   * 处理客户端消息
   */
  async handleClientMessage(ws, message) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      case 'subscribe':
        // 客户端订阅部门更新
        ws.send(JSON.stringify({
          type: 'subscribed',
          message: '已订阅部门更新通知'
        }));
        break;

      case 'get_departments':
        // 获取所有部门数据
        try {
          const departments = await DepartmentDAO.findAll();
          ws.send(JSON.stringify({
            type: 'departments_data',
            data: departments,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '获取部门数据失败',
            error: error.message
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `未知消息类型: ${type}`
        }));
    }
  }

  /**
   * 广播部门更新消息
   */
  broadcastDepartmentUpdate(department, action = 'update') {
    const message = JSON.stringify({
      type: 'department_updated',
      action, // 'create', 'update', 'delete'
      data: department,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('发送WebSocket消息失败:', error);
          this.clients.delete(client);
        }
      }
    });

    console.log(`广播部门${action}消息:`, department.name);
  }

  /**
   * 广播部门映射更新消息
   */
  broadcastMappingUpdate(mappingData) {
    const message = JSON.stringify({
      type: 'mapping_updated',
      data: mappingData,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('发送映射更新消息失败:', error);
          this.clients.delete(client);
        }
      }
    });

    console.log('广播部门映射更新消息');
  }

  /**
   * 获取连接的客户端数量
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 关闭WebSocket服务器
   */
  close() {
    this.clients.forEach(client => {
      client.close();
    });
    this.wss.close();
    console.log('部门同步WebSocket服务器已关闭');
  }
}

// 导出单例实例
let departmentSyncServer = null;

export function initializeDepartmentSync(server) {
  if (!departmentSyncServer) {
    departmentSyncServer = new DepartmentSyncServer(server);
  }
  return departmentSyncServer;
}

export function getDepartmentSyncServer() {
  return departmentSyncServer;
}

export default DepartmentSyncServer;