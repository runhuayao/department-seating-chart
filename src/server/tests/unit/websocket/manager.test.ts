import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocketPoolManager } from '../../../core/websocket/manager';
import { WebSocketConnection } from '../../../core/websocket/connection';
import TestSetup from '../../setup';

describe('WebSocketPoolManager', () => {
  let testEnv: any;
  let wsManager: WebSocketPoolManager;
  let mockWebSocket: any;

  beforeEach(async () => {
    testEnv = await TestSetup.initialize();
    wsManager = testEnv.wsManager;
    mockWebSocket = TestSetup.createMockWebSocket();
  });

  afterEach(async () => {
    await wsManager.shutdown();
  });

  describe('连接管理', () => {
    test('应该能够处理新的WebSocket连接', async () => {
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      const connectionId = await wsManager.handleConnection(mockWebSocket, mockRequest);
      
      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe('string');
      
      const stats = wsManager.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });

    test('应该能够移除连接', async () => {
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      const connectionId = await wsManager.handleConnection(mockWebSocket, mockRequest);
      
      // 模拟连接关闭
      mockWebSocket.emit('close', 1000, 'Normal closure');
      
      await TestSetup.waitFor(() => {
        const stats = wsManager.getConnectionStats();
        return stats.activeConnections === 0;
      });

      const stats = wsManager.getConnectionStats();
      expect(stats.activeConnections).toBe(0);
    });

    test('应该拒绝超过最大连接数的连接', async () => {
      // 创建多个连接直到达到限制
      const maxConnections = 100; // 从配置中获取
      const connections = [];

      for (let i = 0; i < maxConnections; i++) {
        const ws = TestSetup.createMockWebSocket();
        const mockRequest = {
          headers: {
            'user-agent': 'test-client',
            'x-forwarded-for': '127.0.0.1'
          },
          url: `/ws?token=test_token_${i}`
        };
        
        const connectionId = await wsManager.handleConnection(ws, mockRequest);
        connections.push({ ws, connectionId });
      }

      // 尝试创建超出限制的连接
      const extraWs = TestSetup.createMockWebSocket();
      const extraRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=extra_token'
      };

      let connectionRejected = false;
      try {
        await wsManager.handleConnection(extraWs, extraRequest);
      } catch (error) {
        connectionRejected = true;
        expect(error.message).toContain('Maximum connections exceeded');
      }

      expect(connectionRejected).toBe(true);
    });
  });

  describe('消息广播', () => {
    test('应该能够向所有连接广播消息', async () => {
      const connections = [];
      const receivedMessages = [];

      // 创建多个连接
      for (let i = 0; i < 3; i++) {
        const ws = TestSetup.createMockWebSocket();
        const mockRequest = {
          headers: {
            'user-agent': 'test-client',
            'x-forwarded-for': '127.0.0.1'
          },
          url: `/ws?token=test_token_${i}`
        };

        ws.on('message', (data: string) => {
          receivedMessages.push(JSON.parse(data));
        });

        const connectionId = await wsManager.handleConnection(ws, mockRequest);
        connections.push({ ws, connectionId });
      }

      const testMessage = {
        type: 'broadcast_test',
        data: { message: 'Hello everyone!' },
        timestamp: Date.now()
      };

      await wsManager.broadcast(testMessage);

      await TestSetup.waitFor(() => receivedMessages.length === 3);

      expect(receivedMessages).toHaveLength(3);
      receivedMessages.forEach(msg => {
        expect(msg.type).toBe('broadcast_test');
        expect(msg.data.message).toBe('Hello everyone!');
      });
    });

    test('应该能够向特定用户发送消息', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      };

      let receivedMessage: any = null;
      ws.on('message', (data: string) => {
        receivedMessage = JSON.parse(data);
      });

      const connectionId = await wsManager.handleConnection(ws, mockRequest);

      const testMessage = {
        type: 'private_message',
        data: { message: 'Hello specific user!' },
        timestamp: Date.now()
      };

      await wsManager.sendToUser(testUser.userId, testMessage);

      await TestSetup.waitFor(() => receivedMessage !== null);

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.type).toBe('private_message');
      expect(receivedMessage.data.message).toBe('Hello specific user!');
    });
  });

  describe('健康检查', () => {
    test('应该能够执行健康检查', async () => {
      const healthStatus = await wsManager.healthCheck();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.connections).toBeDefined();
      expect(healthStatus.memory).toBeDefined();
      expect(healthStatus.uptime).toBeDefined();
    });

    test('应该检测不健康的连接', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      const connectionId = await wsManager.handleConnection(ws, mockRequest);

      // 模拟连接变为不健康状态
      ws.readyState = ws.CLOSED;

      const healthStatus = await wsManager.healthCheck();
      
      expect(healthStatus.connections.unhealthy).toBeGreaterThan(0);
    });
  });

  describe('心跳机制', () => {
    test('应该发送心跳消息', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      let heartbeatReceived = false;
      ws.on('message', (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          heartbeatReceived = true;
        }
      });

      await wsManager.handleConnection(ws, mockRequest);

      // 手动触发心跳
      await wsManager.sendHeartbeat();

      await TestSetup.waitFor(() => heartbeatReceived);

      expect(heartbeatReceived).toBe(true);
    });

    test('应该处理心跳响应', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      const connectionId = await wsManager.handleConnection(ws, mockRequest);

      // 模拟客户端发送pong响应
      ws.emit('message', JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }));

      const stats = wsManager.getConnectionStats();
      expect(stats.activeConnections).toBe(1);
    });
  });

  describe('错误处理', () => {
    test('应该处理WebSocket错误', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      const connectionId = await wsManager.handleConnection(ws, mockRequest);

      // 模拟WebSocket错误
      const testError = new Error('Connection error');
      ws.emit('error', testError);

      await TestSetup.waitFor(() => {
        const stats = wsManager.getConnectionStats();
        return stats.activeConnections === 0;
      });

      const stats = wsManager.getConnectionStats();
      expect(stats.activeConnections).toBe(0);
    });

    test('应该处理无效的消息格式', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      let errorReceived = false;
      ws.on('message', (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'error') {
          errorReceived = true;
        }
      });

      await wsManager.handleConnection(ws, mockRequest);

      // 发送无效的JSON消息
      ws.emit('message', 'invalid json');

      await TestSetup.waitFor(() => errorReceived);

      expect(errorReceived).toBe(true);
    });
  });

  describe('性能指标', () => {
    test('应该收集连接统计信息', () => {
      const stats = wsManager.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('messagesSent');
      expect(stats).toHaveProperty('messagesReceived');
      expect(stats).toHaveProperty('bytesTransferred');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('peakConnections');
      expect(stats).toHaveProperty('uptime');
    });

    test('应该更新消息统计', async () => {
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: '/ws?token=test_token'
      };

      await wsManager.handleConnection(ws, mockRequest);

      const initialStats = wsManager.getConnectionStats();
      const initialMessagesSent = initialStats.messagesSent;

      await wsManager.broadcast({
        type: 'test_message',
        data: { test: true },
        timestamp: Date.now()
      });

      const updatedStats = wsManager.getConnectionStats();
      expect(updatedStats.messagesSent).toBeGreaterThan(initialMessagesSent);
    });
  });

  describe('优雅关闭', () => {
    test('应该能够优雅关闭所有连接', async () => {
      const connections = [];

      // 创建多个连接
      for (let i = 0; i < 3; i++) {
        const ws = TestSetup.createMockWebSocket();
        const mockRequest = {
          headers: {
            'user-agent': 'test-client',
            'x-forwarded-for': '127.0.0.1'
          },
          url: `/ws?token=test_token_${i}`
        };

        const connectionId = await wsManager.handleConnection(ws, mockRequest);
        connections.push({ ws, connectionId });
      }

      const initialStats = wsManager.getConnectionStats();
      expect(initialStats.activeConnections).toBe(3);

      await wsManager.shutdown();

      const finalStats = wsManager.getConnectionStats();
      expect(finalStats.activeConnections).toBe(0);
    });
  });
});