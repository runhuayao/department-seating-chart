import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import TestSetup from '../setup';
import { performance } from 'perf_hooks';

describe('Performance and Load Tests', () => {
  let testEnv: any;
  const performanceMetrics: any = {};

  beforeAll(async () => {
    testEnv = await TestSetup.initialize();
  });

  afterAll(async () => {
    // 输出性能报告
    console.log('\n=== Performance Test Report ===');
    Object.entries(performanceMetrics).forEach(([testName, metrics]: [string, any]) => {
      console.log(`\n${testName}:`);
      console.log(`  - Duration: ${metrics.duration}ms`);
      console.log(`  - Operations: ${metrics.operations}`);
      console.log(`  - Ops/sec: ${metrics.opsPerSecond}`);
      console.log(`  - Memory: ${metrics.memoryUsage}MB`);
      if (metrics.additional) {
        Object.entries(metrics.additional).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }
    });
  });

  const measurePerformance = async (
    testName: string,
    testFunction: () => Promise<any>,
    operations: number = 1
  ) => {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    const result = await testFunction();

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    const duration = endTime - startTime;
    const memoryUsage = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
    const opsPerSecond = operations / (duration / 1000);

    performanceMetrics[testName] = {
      duration: Math.round(duration),
      operations,
      opsPerSecond: Math.round(opsPerSecond),
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      result
    };

    return result;
  };

  describe('数据库连接池性能', () => {
    test('大量并发查询性能', async () => {
      const concurrentQueries = 100;
      const queriesPerConnection = 10;

      await measurePerformance(
        'Database Concurrent Queries',
        async () => {
          const promises = [];
          
          for (let i = 0; i < concurrentQueries; i++) {
            const queryPromises = [];
            for (let j = 0; j < queriesPerConnection; j++) {
              queryPromises.push(
                testEnv.dbPool.query('SELECT $1 as query_id, $2 as connection_id', [j, i])
              );
            }
            promises.push(Promise.all(queryPromises));
          }

          const results = await Promise.all(promises);
          return results.flat();
        },
        concurrentQueries * queriesPerConnection
      );

      const metrics = performanceMetrics['Database Concurrent Queries'];
      expect(metrics.opsPerSecond).toBeGreaterThan(100); // 至少100 ops/sec
      expect(metrics.duration).toBeLessThan(30000); // 少于30秒
    });

    test('事务处理性能', async () => {
      const transactionCount = 50;

      // 创建测试楼层
      const testFloor = await TestSetup.createTestFloor({
        id: 'perf_test_floor',
        name: 'Performance Test Floor'
      });

      await measurePerformance(
        'Database Transactions',
        async () => {
          const promises = [];
          
          for (let i = 0; i < transactionCount; i++) {
            promises.push(
              testEnv.dbPool.transaction(async (client) => {
                // 在事务中执行多个操作
                await client.query(
                  'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
                  [`perf_seat_${i}`, testFloor.id, i * 10, i * 10, 'available', 'regular']
                );

                await client.query(
                  'UPDATE seats SET status = $1 WHERE id = $2',
                  ['occupied', `perf_seat_${i}`]
                );

                await client.query(
                  'SELECT * FROM seats WHERE id = $1',
                  [`perf_seat_${i}`]
                );

                return i;
              })
            );
          }

          return Promise.all(promises);
        },
        transactionCount
      );

      const metrics = performanceMetrics['Database Transactions'];
      expect(metrics.opsPerSecond).toBeGreaterThan(10); // 至少10 transactions/sec
    });

    test('批量操作性能', async () => {
      const batchSize = 1000;
      const testFloor = await TestSetup.createTestFloor({
        id: 'batch_perf_floor',
        name: 'Batch Performance Floor'
      });

      await measurePerformance(
        'Database Batch Operations',
        async () => {
          const queries = [];
          
          for (let i = 0; i < batchSize; i++) {
            queries.push({
              text: 'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
              values: [`batch_seat_${i}`, testFloor.id, i % 100, Math.floor(i / 100), 'available', 'regular']
            });
          }

          return testEnv.dbPool.batchQuery(queries);
        },
        batchSize
      );

      const metrics = performanceMetrics['Database Batch Operations'];
      expect(metrics.opsPerSecond).toBeGreaterThan(500); // 至少500 ops/sec
    });
  });

  describe('WebSocket连接性能', () => {
    test('大量并发连接性能', async () => {
      const connectionCount = 200;

      await measurePerformance(
        'WebSocket Concurrent Connections',
        async () => {
          const connections = [];
          
          for (let i = 0; i < connectionCount; i++) {
            const ws = TestSetup.createMockWebSocket();
            const mockRequest = {
              headers: {
                'user-agent': 'perf-test-client',
                'x-forwarded-for': '127.0.0.1'
              },
              url: `/ws?token=perf_token_${i}`
            };

            const connectionId = await testEnv.wsManager.handleConnection(ws, mockRequest);
            connections.push({ ws, connectionId });
          }

          return connections;
        },
        connectionCount
      );

      const metrics = performanceMetrics['WebSocket Concurrent Connections'];
      expect(metrics.opsPerSecond).toBeGreaterThan(50); // 至少50 connections/sec
      
      // 验证连接统计
      const stats = testEnv.wsManager.getConnectionStats();
      expect(stats.activeConnections).toBe(connectionCount);
    });

    test('消息广播性能', async () => {
      const connectionCount = 100;
      const messageCount = 50;

      // 创建连接
      const connections = [];
      for (let i = 0; i < connectionCount; i++) {
        const ws = TestSetup.createMockWebSocket();
        const mockRequest = {
          headers: {
            'user-agent': 'broadcast-test-client',
            'x-forwarded-for': '127.0.0.1'
          },
          url: `/ws?token=broadcast_token_${i}`
        };

        const connectionId = await testEnv.wsManager.handleConnection(ws, mockRequest);
        connections.push({ ws, connectionId });
      }

      await measurePerformance(
        'WebSocket Message Broadcast',
        async () => {
          const promises = [];
          
          for (let i = 0; i < messageCount; i++) {
            const message = {
              type: 'broadcast_test',
              data: {
                messageId: i,
                content: `Test message ${i}`,
                timestamp: Date.now()
              }
            };

            promises.push(testEnv.wsManager.broadcast(message));
          }

          await Promise.all(promises);
          return messageCount * connectionCount; // 总消息数
        },
        messageCount * connectionCount
      );

      const metrics = performanceMetrics['WebSocket Message Broadcast'];
      expect(metrics.opsPerSecond).toBeGreaterThan(1000); // 至少1000 messages/sec
    });

    test('心跳机制性能', async () => {
      const connectionCount = 50;
      const heartbeatRounds = 10;

      // 创建连接
      const connections = [];
      for (let i = 0; i < connectionCount; i++) {
        const ws = TestSetup.createMockWebSocket();
        const mockRequest = {
          headers: {
            'user-agent': 'heartbeat-test-client',
            'x-forwarded-for': '127.0.0.1'
          },
          url: `/ws?token=heartbeat_token_${i}`
        };

        const connectionId = await testEnv.wsManager.handleConnection(ws, mockRequest);
        connections.push({ ws, connectionId });
      }

      await measurePerformance(
        'WebSocket Heartbeat Performance',
        async () => {
          for (let round = 0; round < heartbeatRounds; round++) {
            await testEnv.wsManager.sendHeartbeat();
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待100ms
          }
          
          return heartbeatRounds * connectionCount;
        },
        heartbeatRounds * connectionCount
      );

      const metrics = performanceMetrics['WebSocket Heartbeat Performance'];
      expect(metrics.duration).toBeLessThan(5000); // 少于5秒
    });
  });

  describe('实时数据同步性能', () => {
    test('座位操作处理性能', async () => {
      const operationCount = 500;
      const userCount = 50;

      // 创建测试数据
      const testFloor = await TestSetup.createTestFloor({
        id: 'sync_perf_floor',
        name: 'Sync Performance Floor'
      });

      const users = [];
      for (let i = 0; i < userCount; i++) {
        const user = await TestSetup.createTestUser({
          username: `sync_perf_user_${i}`,
          email: `syncperf${i}@test.com`,
          password: 'password123'
        });
        users.push(user);
      }

      const seats = [];
      for (let i = 0; i < operationCount; i++) {
        const seat = await TestSetup.createTestSeat({
          id: `sync_perf_seat_${i}`,
          floorId: testFloor.id,
          x: i % 50 * 20,
          y: Math.floor(i / 50) * 20,
          status: 'available',
          type: 'regular'
        });
        seats.push(seat);
      }

      // 创建同步服务
      const { RealTimeDataSyncService } = require('../../core/sync/sync-service');
      const syncService = new RealTimeDataSyncService(
        testEnv.dbPool,
        testEnv.wsManager,
        testEnv.redisClient,
        testEnv.logger,
        {
          batchSize: 20,
          flushInterval: 500,
          maxRetries: 3,
          enableCompression: true,
          enableDeduplication: true,
          maxQueueSize: 10000,
          processingTimeout: 30000,
          deadLetterThreshold: 5
        }
      );

      await syncService.start();

      try {
        await measurePerformance(
          'Seat Operation Processing',
          async () => {
            const promises = [];
            
            for (let i = 0; i < operationCount; i++) {
              const user = users[i % userCount];
              const seat = seats[i];
              
              const message = {
                type: 'seat_select',
                data: {
                  seatId: seat.id,
                  floorId: testFloor.id,
                  userId: user.userId,
                  timestamp: Date.now() + i
                },
                userId: user.userId,
                connectionId: `perf_conn_${i}`
              };

              promises.push(syncService.handleClientMessage(message));
            }

            await Promise.all(promises);
            return operationCount;
          },
          operationCount
        );

        const metrics = performanceMetrics['Seat Operation Processing'];
        expect(metrics.opsPerSecond).toBeGreaterThan(50); // 至少50 ops/sec
        expect(metrics.duration).toBeLessThan(20000); // 少于20秒

      } finally {
        await syncService.shutdown();
      }
    });

    test('消息批处理性能', async () => {
      const messageCount = 1000;
      const batchSize = 50;

      const { MessageBatchProcessor } = require('../../core/messaging/batch-processor');
      const batchProcessor = new MessageBatchProcessor(
        testEnv.redisClient,
        testEnv.logger,
        {
          batchSize,
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

      await batchProcessor.start();

      try {
        await measurePerformance(
          'Message Batch Processing',
          async () => {
            const promises = [];
            
            for (let i = 0; i < messageCount; i++) {
              const message = {
                type: 'test_message',
                data: {
                  messageId: i,
                  content: `Batch test message ${i}`,
                  timestamp: Date.now()
                },
                priority: i % 3, // 0-2 优先级
                userId: `batch_user_${i % 10}`,
                connectionId: `batch_conn_${i % 10}`
              };

              promises.push(batchProcessor.addMessage(message));
            }

            await Promise.all(promises);
            
            // 等待所有批次处理完成
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return messageCount;
          },
          messageCount
        );

        const metrics = performanceMetrics['Message Batch Processing'];
        expect(metrics.opsPerSecond).toBeGreaterThan(200); // 至少200 messages/sec

        // 验证批处理统计
        const stats = batchProcessor.getStats();
        expect(stats.totalMessages).toBe(messageCount);
        expect(stats.batchesProcessed).toBeGreaterThan(0);

      } finally {
        await batchProcessor.shutdown();
      }
    });
  });

  describe('Redis缓存性能', () => {
    test('大量键值操作性能', async () => {
      const operationCount = 1000;

      await measurePerformance(
        'Redis Key-Value Operations',
        async () => {
          const promises = [];
          
          // 写入操作
          for (let i = 0; i < operationCount; i++) {
            promises.push(
              testEnv.redisClient.set(`perf_key_${i}`, JSON.stringify({
                id: i,
                data: `Performance test data ${i}`,
                timestamp: Date.now()
              }))
            );
          }

          await Promise.all(promises);

          // 读取操作
          const readPromises = [];
          for (let i = 0; i < operationCount; i++) {
            readPromises.push(testEnv.redisClient.get(`perf_key_${i}`));
          }

          await Promise.all(readPromises);

          return operationCount * 2; // 读写各一次
        },
        operationCount * 2
      );

      const metrics = performanceMetrics['Redis Key-Value Operations'];
      expect(metrics.opsPerSecond).toBeGreaterThan(1000); // 至少1000 ops/sec
    });

    test('Redis发布订阅性能', async () => {
      const channelCount = 10;
      const messagesPerChannel = 100;

      await measurePerformance(
        'Redis Pub/Sub Performance',
        async () => {
          const subscribers = [];
          const messagePromises = [];

          // 创建订阅者
          for (let i = 0; i < channelCount; i++) {
            const subscriber = testEnv.redisClient.duplicate();
            await subscriber.connect();
            await subscriber.subscribe(`perf_channel_${i}`, (message) => {
              // 处理消息
            });
            subscribers.push(subscriber);
          }

          // 发布消息
          for (let i = 0; i < channelCount; i++) {
            for (let j = 0; j < messagesPerChannel; j++) {
              messagePromises.push(
                testEnv.redisClient.publish(`perf_channel_${i}`, JSON.stringify({
                  messageId: j,
                  channelId: i,
                  content: `Performance test message ${j}`,
                  timestamp: Date.now()
                }))
              );
            }
          }

          await Promise.all(messagePromises);

          // 清理订阅者
          for (const subscriber of subscribers) {
            await subscriber.quit();
          }

          return channelCount * messagesPerChannel;
        },
        channelCount * messagesPerChannel
      );

      const metrics = performanceMetrics['Redis Pub/Sub Performance'];
      expect(metrics.opsPerSecond).toBeGreaterThan(500); // 至少500 messages/sec
    });
  });

  describe('内存使用和垃圾回收', () => {
    test('内存泄漏检测', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();

      await measurePerformance(
        'Memory Leak Detection',
        async () => {
          for (let i = 0; i < iterations; i++) {
            // 创建临时连接
            const ws = TestSetup.createMockWebSocket();
            const connectionId = await testEnv.wsManager.handleConnection(ws, {
              headers: { 'user-agent': 'memory-test', 'x-forwarded-for': '127.0.0.1' },
              url: `/ws?token=memory_token_${i}`
            });

            // 发送消息
            await testEnv.wsManager.broadcast({
              type: 'memory_test',
              data: { iteration: i },
              timestamp: Date.now()
            });

            // 关闭连接
            ws.emit('close', 1000, 'Normal closure');

            // 执行数据库操作
            await testEnv.dbPool.query('SELECT $1 as iteration', [i]);

            // 强制垃圾回收（如果可用）
            if (global.gc) {
              global.gc();
            }
          }

          return iterations;
        },
        iterations
      );

      const finalMemory = process.memoryUsage();
      const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      performanceMetrics['Memory Leak Detection'].additional = {
        'Memory Growth': `${Math.round(memoryGrowth * 100) / 100}MB`,
        'Initial Heap': `${Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100}MB`,
        'Final Heap': `${Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100}MB`
      };

      // 内存增长应该在合理范围内
      expect(memoryGrowth).toBeLessThan(100); // 少于100MB增长
    });
  });

  describe('端到端性能测试', () => {
    test('完整座位预订流程性能', async () => {
      const userCount = 20;
      const operationsPerUser = 10;

      // 创建测试数据
      const testFloor = await TestSetup.createTestFloor({
        id: 'e2e_perf_floor',
        name: 'E2E Performance Floor'
      });

      const users = [];
      const seats = [];
      const connections = [];

      // 创建用户
      for (let i = 0; i < userCount; i++) {
        const user = await TestSetup.createTestUser({
          username: `e2e_user_${i}`,
          email: `e2e${i}@test.com`,
          password: 'password123'
        });
        users.push(user);
      }

      // 创建座位
      for (let i = 0; i < userCount * operationsPerUser; i++) {
        const seat = await TestSetup.createTestSeat({
          id: `e2e_seat_${i}`,
          floorId: testFloor.id,
          x: (i % 10) * 50,
          y: Math.floor(i / 10) * 50,
          status: 'available',
          type: 'regular'
        });
        seats.push(seat);
      }

      // 创建WebSocket连接
      for (let i = 0; i < userCount; i++) {
        const ws = TestSetup.createMockWebSocket();
        const connectionId = await testEnv.wsManager.handleConnection(ws, {
          headers: { 'user-agent': 'e2e-test', 'x-forwarded-for': '127.0.0.1' },
          url: `/ws?token=e2e_token_${i}&userId=${users[i].userId}`
        });
        connections.push({ ws, connectionId, user: users[i] });
      }

      // 创建同步服务
      const { RealTimeDataSyncService } = require('../../core/sync/sync-service');
      const syncService = new RealTimeDataSyncService(
        testEnv.dbPool,
        testEnv.wsManager,
        testEnv.redisClient,
        testEnv.logger,
        {
          batchSize: 10,
          flushInterval: 500,
          maxRetries: 3,
          enableCompression: true,
          enableDeduplication: true,
          maxQueueSize: 10000,
          processingTimeout: 30000,
          deadLetterThreshold: 5
        }
      );

      await syncService.start();

      try {
        await measurePerformance(
          'End-to-End Seat Booking Flow',
          async () => {
            const promises = [];
            
            // 每个用户执行多个操作
            for (let i = 0; i < userCount; i++) {
              const connection = connections[i];
              
              for (let j = 0; j < operationsPerUser; j++) {
                const seatIndex = i * operationsPerUser + j;
                const seat = seats[seatIndex];
                
                // 座位选择
                const selectMessage = {
                  type: 'seat_select',
                  data: {
                    seatId: seat.id,
                    floorId: testFloor.id,
                    userId: connection.user.userId,
                    timestamp: Date.now() + seatIndex
                  },
                  userId: connection.user.userId,
                  connectionId: connection.connectionId
                };

                promises.push(syncService.handleClientMessage(selectMessage));
              }
            }

            await Promise.all(promises);
            return userCount * operationsPerUser;
          },
          userCount * operationsPerUser
        );

        const metrics = performanceMetrics['End-to-End Seat Booking Flow'];
        expect(metrics.opsPerSecond).toBeGreaterThan(20); // 至少20 bookings/sec
        expect(metrics.duration).toBeLessThan(30000); // 少于30秒

        performanceMetrics['End-to-End Seat Booking Flow'].additional = {
          'Users': userCount,
          'Operations per User': operationsPerUser,
          'Total Operations': userCount * operationsPerUser,
          'Avg Time per Operation': `${Math.round(metrics.duration / (userCount * operationsPerUser))}ms`
        };

      } finally {
        await syncService.shutdown();
      }
    });
  });
});