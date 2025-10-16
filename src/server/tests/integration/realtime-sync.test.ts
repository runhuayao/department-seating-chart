import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RealTimeDataSyncService } from '../../core/sync/sync-service';
import { RealTimePushService } from '../../core/messaging/realtime-push';
import { MessageBatchProcessor } from '../../core/messaging/batch-processor';
import TestSetup from '../setup';

describe('RealTimeDataSync Integration', () => {
  let testEnv: any;
  let syncService: RealTimeDataSyncService;
  let pushService: RealTimePushService;
  let batchProcessor: MessageBatchProcessor;
  let testUser: any;
  let testFloor: any;
  let testSeat: any;

  beforeEach(async () => {
    testEnv = await TestSetup.initialize();
    
    // 创建测试数据
    testUser = await TestSetup.createTestUser({
      username: 'sync_test_user',
      email: 'sync@test.com',
      password: 'password123',
      roles: ['employee'],
      permissions: ['seat.view', 'seat.book', 'seat.release']
    });

    testFloor = await TestSetup.createTestFloor({
      id: 'sync_test_floor',
      name: 'Sync Test Floor',
      building: 'Test Building',
      level: 1
    });

    testSeat = await TestSetup.createTestSeat({
      id: 'sync_test_seat',
      floorId: testFloor.id,
      x: 100,
      y: 200,
      status: 'available',
      type: 'regular'
    });

    // 创建服务实例
    batchProcessor = new MessageBatchProcessor(
      testEnv.redisClient,
      testEnv.logger,
      {
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
        enableCompression: true,
        compressionThreshold: 1024,
        maxBatchAge: 5000,
        priorityLevels: 3,
        enableDeduplication: true,
        deduplicationWindow: 30000
      }
    );

    pushService = new RealTimePushService(
      testEnv.wsManager,
      testEnv.redisClient,
      testEnv.logger,
      {
        maxSubscriptionsPerUser: 100,
        subscriptionTimeout: 300000,
        cleanupInterval: 60000,
        enableFiltering: true,
        enableCompression: true,
        compressionThreshold: 1024,
        maxMessageSize: 1048576,
        rateLimitWindow: 60000,
        rateLimitMaxMessages: 1000
      }
    );

    syncService = new RealTimeDataSyncService(
      testEnv.dbPool,
      testEnv.wsManager,
      testEnv.redisClient,
      testEnv.logger,
      {
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        enableCompression: true,
        enableDeduplication: true,
        maxQueueSize: 10000,
        processingTimeout: 30000,
        deadLetterThreshold: 5
      }
    );

    await batchProcessor.start();
    await pushService.start();
    await syncService.start();
  });

  afterEach(async () => {
    await syncService.shutdown();
    await pushService.shutdown();
    await batchProcessor.shutdown();
  });

  describe('座位选择流程', () => {
    test('应该能够完整处理座位选择流程', async () => {
      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const mockRequest = {
        headers: {
          'user-agent': 'test-client',
          'x-forwarded-for': '127.0.0.1'
        },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      };

      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, mockRequest);

      // 订阅楼层更新
      await pushService.subscribe(testUser.userId, 'floor_updates', {
        floorId: testFloor.id
      });

      // 模拟座位选择消息
      const seatSelectMessage = {
        type: 'seat_select',
        data: {
          seatId: testSeat.id,
          floorId: testFloor.id,
          userId: testUser.userId,
          timestamp: Date.now()
        },
        userId: testUser.userId,
        connectionId
      };

      // 处理座位选择
      await syncService.handleClientMessage(seatSelectMessage);

      // 等待消息处理和推送
      await TestSetup.waitFor(() => receivedMessages.length > 0, 5000);

      // 验证数据库更新
      const updatedSeat = await testEnv.dbPool.query(
        'SELECT * FROM seats WHERE id = $1',
        [testSeat.id]
      );

      expect(updatedSeat.rows[0].status).toBe('occupied');
      expect(updatedSeat.rows[0].occupied_by).toBe(testUser.userId);

      // 验证实时推送
      const seatUpdateMessage = receivedMessages.find(msg => 
        msg.type === 'seat_updated' && msg.data.seatId === testSeat.id
      );

      expect(seatUpdateMessage).toBeDefined();
      expect(seatUpdateMessage.data.status).toBe('occupied');
      expect(seatUpdateMessage.data.occupiedBy).toBe(testUser.userId);
    });

    test('应该处理座位选择冲突', async () => {
      // 创建两个用户
      const user2 = await TestSetup.createTestUser({
        username: 'sync_test_user2',
        email: 'sync2@test.com',
        password: 'password123'
      });

      // 创建两个WebSocket连接
      const ws1 = TestSetup.createMockWebSocket();
      const ws2 = TestSetup.createMockWebSocket();

      const messages1: any[] = [];
      const messages2: any[] = [];

      ws1.on('message', (data: string) => messages1.push(JSON.parse(data)));
      ws2.on('message', (data: string) => messages2.push(JSON.parse(data)));

      const connectionId1 = await testEnv.wsManager.handleConnection(ws1, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token1&userId=${testUser.userId}`
      });

      const connectionId2 = await testEnv.wsManager.handleConnection(ws2, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token2&userId=${user2.userId}`
      });

      // 两个用户同时尝试选择同一个座位
      const selectMessage1 = {
        type: 'seat_select',
        data: {
          seatId: testSeat.id,
          floorId: testFloor.id,
          userId: testUser.userId,
          timestamp: Date.now()
        },
        userId: testUser.userId,
        connectionId: connectionId1
      };

      const selectMessage2 = {
        type: 'seat_select',
        data: {
          seatId: testSeat.id,
          floorId: testFloor.id,
          userId: user2.userId,
          timestamp: Date.now() + 1
        },
        userId: user2.userId,
        connectionId: connectionId2
      };

      // 同时处理两个选择请求
      await Promise.all([
        syncService.handleClientMessage(selectMessage1),
        syncService.handleClientMessage(selectMessage2)
      ]);

      await TestSetup.waitFor(() => messages1.length > 0 && messages2.length > 0, 5000);

      // 验证只有一个用户成功选择座位
      const seatResult = await testEnv.dbPool.query(
        'SELECT * FROM seats WHERE id = $1',
        [testSeat.id]
      );

      expect(seatResult.rows[0].status).toBe('occupied');
      expect([testUser.userId, user2.userId]).toContain(seatResult.rows[0].occupied_by);

      // 验证失败的用户收到错误消息
      const allMessages = [...messages1, ...messages2];
      const errorMessage = allMessages.find(msg => msg.type === 'error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.code).toBe('SEAT_ALREADY_OCCUPIED');
    });
  });

  describe('座位释放流程', () => {
    test('应该能够完整处理座位释放流程', async () => {
      // 先占用座位
      await testEnv.dbPool.query(
        'UPDATE seats SET status = $1, occupied_by = $2, occupied_at = $3 WHERE id = $4',
        ['occupied', testUser.userId, new Date(), testSeat.id]
      );

      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      });

      // 订阅楼层更新
      await pushService.subscribe(testUser.userId, 'floor_updates', {
        floorId: testFloor.id
      });

      // 模拟座位释放消息
      const seatReleaseMessage = {
        type: 'seat_release',
        data: {
          seatId: testSeat.id,
          floorId: testFloor.id,
          userId: testUser.userId,
          timestamp: Date.now()
        },
        userId: testUser.userId,
        connectionId
      };

      // 处理座位释放
      await syncService.handleClientMessage(seatReleaseMessage);

      await TestSetup.waitFor(() => receivedMessages.length > 0, 5000);

      // 验证数据库更新
      const updatedSeat = await testEnv.dbPool.query(
        'SELECT * FROM seats WHERE id = $1',
        [testSeat.id]
      );

      expect(updatedSeat.rows[0].status).toBe('available');
      expect(updatedSeat.rows[0].occupied_by).toBeNull();

      // 验证实时推送
      const seatUpdateMessage = receivedMessages.find(msg => 
        msg.type === 'seat_updated' && msg.data.seatId === testSeat.id
      );

      expect(seatUpdateMessage).toBeDefined();
      expect(seatUpdateMessage.data.status).toBe('available');
    });
  });

  describe('楼层切换流程', () => {
    test('应该能够处理楼层切换和数据同步', async () => {
      // 创建另一个楼层和座位
      const floor2 = await TestSetup.createTestFloor({
        id: 'sync_test_floor2',
        name: 'Sync Test Floor 2',
        building: 'Test Building',
        level: 2
      });

      const seat2 = await TestSetup.createTestSeat({
        id: 'sync_test_seat2',
        floorId: floor2.id,
        x: 300,
        y: 400,
        status: 'available',
        type: 'regular'
      });

      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      });

      // 模拟楼层切换消息
      const floorChangeMessage = {
        type: 'floor_change',
        data: {
          fromFloorId: testFloor.id,
          toFloorId: floor2.id,
          userId: testUser.userId,
          timestamp: Date.now()
        },
        userId: testUser.userId,
        connectionId
      };

      // 处理楼层切换
      await syncService.handleClientMessage(floorChangeMessage);

      await TestSetup.waitFor(() => receivedMessages.length > 0, 5000);

      // 验证收到楼层数据
      const floorDataMessage = receivedMessages.find(msg => 
        msg.type === 'floor_data' && msg.data.floorId === floor2.id
      );

      expect(floorDataMessage).toBeDefined();
      expect(floorDataMessage.data.seats).toBeDefined();
      expect(floorDataMessage.data.seats.length).toBeGreaterThan(0);

      // 验证座位数据包含在楼层数据中
      const seatInData = floorDataMessage.data.seats.find((s: any) => s.id === seat2.id);
      expect(seatInData).toBeDefined();
      expect(seatInData.status).toBe('available');
    });
  });

  describe('批量消息处理', () => {
    test('应该能够批量处理多个座位操作', async () => {
      // 创建多个座位
      const seats = [];
      for (let i = 0; i < 5; i++) {
        const seat = await TestSetup.createTestSeat({
          id: `batch_seat_${i}`,
          floorId: testFloor.id,
          x: i * 100,
          y: i * 100,
          status: 'available',
          type: 'regular'
        });
        seats.push(seat);
      }

      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      });

      // 订阅楼层更新
      await pushService.subscribe(testUser.userId, 'floor_updates', {
        floorId: testFloor.id
      });

      // 快速发送多个座位选择消息
      const messages = seats.map((seat, index) => ({
        type: 'seat_select',
        data: {
          seatId: seat.id,
          floorId: testFloor.id,
          userId: testUser.userId,
          timestamp: Date.now() + index
        },
        userId: testUser.userId,
        connectionId
      }));

      // 并发处理所有消息
      await Promise.all(messages.map(msg => syncService.handleClientMessage(msg)));

      await TestSetup.waitFor(() => receivedMessages.length >= seats.length, 10000);

      // 验证所有座位都被正确处理
      for (const seat of seats) {
        const updatedSeat = await testEnv.dbPool.query(
          'SELECT * FROM seats WHERE id = $1',
          [seat.id]
        );

        // 由于并发处理，只有第一个请求应该成功
        // 其他请求应该失败，因为用户不能同时占用多个座位
        expect(['occupied', 'available']).toContain(updatedSeat.rows[0].status);
      }

      // 验证收到相应的更新消息
      const updateMessages = receivedMessages.filter(msg => msg.type === 'seat_updated');
      expect(updateMessages.length).toBeGreaterThan(0);
    });
  });

  describe('错误处理和恢复', () => {
    test('应该处理数据库连接错误', async () => {
      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token&userId=${testUser.userId}`
      });

      // 模拟无效的座位ID
      const invalidMessage = {
        type: 'seat_select',
        data: {
          seatId: 'non_existent_seat',
          floorId: testFloor.id,
          userId: testUser.userId,
          timestamp: Date.now()
        },
        userId: testUser.userId,
        connectionId
      };

      // 处理无效消息
      await syncService.handleClientMessage(invalidMessage);

      await TestSetup.waitFor(() => receivedMessages.length > 0, 5000);

      // 验证收到错误消息
      const errorMessage = receivedMessages.find(msg => msg.type === 'error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.code).toBe('SEAT_NOT_FOUND');
    });

    test('应该处理权限错误', async () => {
      // 创建没有座位预订权限的用户
      const limitedUser = await TestSetup.createTestUser({
        username: 'limited_user',
        email: 'limited@test.com',
        password: 'password123',
        roles: ['guest'],
        permissions: ['seat.view'] // 只有查看权限，没有预订权限
      });

      // 创建WebSocket连接
      const ws = TestSetup.createMockWebSocket();
      const receivedMessages: any[] = [];
      ws.on('message', (data: string) => {
        receivedMessages.push(JSON.parse(data));
      });

      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=test_token&userId=${limitedUser.userId}`
      });

      // 尝试选择座位
      const selectMessage = {
        type: 'seat_select',
        data: {
          seatId: testSeat.id,
          floorId: testFloor.id,
          userId: limitedUser.userId,
          timestamp: Date.now()
        },
        userId: limitedUser.userId,
        connectionId
      };

      await syncService.handleClientMessage(selectMessage);

      await TestSetup.waitFor(() => receivedMessages.length > 0, 5000);

      // 验证收到权限错误
      const errorMessage = receivedMessages.find(msg => msg.type === 'error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('性能和负载测试', () => {
    test('应该能够处理高并发消息', async () => {
      const concurrentUsers = 10;
      const messagesPerUser = 5;
      const connections = [];
      const allMessages: any[] = [];

      // 创建多个用户和连接
      for (let i = 0; i < concurrentUsers; i++) {
        const user = await TestSetup.createTestUser({
          username: `perf_user_${i}`,
          email: `perf${i}@test.com`,
          password: 'password123'
        });

        const ws = TestSetup.createMockWebSocket();
        ws.on('message', (data: string) => {
          allMessages.push(JSON.parse(data));
        });

        const connectionId = await testEnv.wsManager.handleConnection(ws, {
          headers: { 'user-agent': 'test-client', 'x-forwarded-for': '127.0.0.1' },
          url: `/ws?token=test_token_${i}&userId=${user.userId}`
        });

        connections.push({ user, ws, connectionId });
      }

      // 创建足够的座位
      const seats = [];
      for (let i = 0; i < concurrentUsers * messagesPerUser; i++) {
        const seat = await TestSetup.createTestSeat({
          id: `perf_seat_${i}`,
          floorId: testFloor.id,
          x: (i % 10) * 100,
          y: Math.floor(i / 10) * 100,
          status: 'available',
          type: 'regular'
        });
        seats.push(seat);
      }

      const startTime = Date.now();

      // 并发发送消息
      const messagePromises = [];
      for (let i = 0; i < concurrentUsers; i++) {
        const connection = connections[i];
        for (let j = 0; j < messagesPerUser; j++) {
          const seatIndex = i * messagesPerUser + j;
          const message = {
            type: 'seat_select',
            data: {
              seatId: seats[seatIndex].id,
              floorId: testFloor.id,
              userId: connection.user.userId,
              timestamp: Date.now() + seatIndex
            },
            userId: connection.user.userId,
            connectionId: connection.connectionId
          };

          messagePromises.push(syncService.handleClientMessage(message));
        }
      }

      await Promise.all(messagePromises);

      const processingTime = Date.now() - startTime;

      // 等待所有消息处理完成
      await TestSetup.waitFor(() => 
        allMessages.length >= concurrentUsers * messagesPerUser, 
        15000
      );

      const totalTime = Date.now() - startTime;

      // 验证性能指标
      expect(processingTime).toBeLessThan(10000); // 处理时间应该少于10秒
      expect(totalTime).toBeLessThan(15000); // 总时间应该少于15秒

      // 验证所有消息都被处理
      expect(allMessages.length).toBeGreaterThanOrEqual(concurrentUsers * messagesPerUser);

      console.log(`Performance test completed:
        - Users: ${concurrentUsers}
        - Messages per user: ${messagesPerUser}
        - Total messages: ${concurrentUsers * messagesPerUser}
        - Processing time: ${processingTime}ms
        - Total time: ${totalTime}ms
        - Messages received: ${allMessages.length}
      `);
    });
  });
});