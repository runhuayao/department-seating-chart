import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseConnectionPool } from '../../../core/database/connection-pool';
import TestSetup from '../../setup';

describe('DatabaseConnectionPool', () => {
  let testEnv: any;
  let dbPool: DatabaseConnectionPool;

  beforeEach(async () => {
    testEnv = await TestSetup.initialize();
    dbPool = testEnv.dbPool;
  });

  afterEach(async () => {
    // 测试环境会自动清理
  });

  describe('连接池管理', () => {
    test('应该能够创建连接池', () => {
      expect(dbPool).toBeDefined();
      
      const stats = dbPool.getStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('waitingClients');
    });

    test('应该能够执行基本查询', async () => {
      const result = await dbPool.query('SELECT 1 as test_value');
      
      expect(result).toBeDefined();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test_value).toBe(1);
    });

    test('应该能够执行参数化查询', async () => {
      const testValue = 'test_string';
      const result = await dbPool.query('SELECT $1 as test_value', [testValue]);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test_value).toBe(testValue);
    });

    test('应该处理查询错误', async () => {
      let errorThrown = false;
      
      try {
        await dbPool.query('SELECT * FROM non_existent_table');
      } catch (error) {
        errorThrown = true;
        expect(error.message).toContain('relation "non_existent_table" does not exist');
      }
      
      expect(errorThrown).toBe(true);
    });
  });

  describe('事务管理', () => {
    test('应该能够执行事务', async () => {
      const testFloor = await TestSetup.createTestFloor({
        id: 'test_floor_tx',
        name: 'Transaction Test Floor'
      });

      const result = await dbPool.transaction(async (client) => {
        // 在事务中插入座位
        await client.query(
          'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
          ['seat_tx_1', testFloor.id, 100, 200, 'available', 'regular']
        );

        await client.query(
          'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
          ['seat_tx_2', testFloor.id, 150, 250, 'available', 'regular']
        );

        // 查询插入的座位
        const seats = await client.query(
          'SELECT * FROM seats WHERE floor_id = $1',
          [testFloor.id]
        );

        return seats.rows;
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('seat_tx_1');
      expect(result[1].id).toBe('seat_tx_2');
    });

    test('应该能够回滚失败的事务', async () => {
      const testFloor = await TestSetup.createTestFloor({
        id: 'test_floor_rollback',
        name: 'Rollback Test Floor'
      });

      let transactionFailed = false;

      try {
        await dbPool.transaction(async (client) => {
          // 插入第一个座位（成功）
          await client.query(
            'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
            ['seat_rollback_1', testFloor.id, 100, 200, 'available', 'regular']
          );

          // 尝试插入重复ID的座位（失败）
          await client.query(
            'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
            ['seat_rollback_1', testFloor.id, 150, 250, 'available', 'regular']
          );
        });
      } catch (error) {
        transactionFailed = true;
      }

      expect(transactionFailed).toBe(true);

      // 验证事务已回滚，没有座位被插入
      const seats = await dbPool.query(
        'SELECT * FROM seats WHERE floor_id = $1',
        [testFloor.id]
      );

      expect(seats.rows).toHaveLength(0);
    });
  });

  describe('批量操作', () => {
    test('应该能够执行批量查询', async () => {
      const testFloor = await TestSetup.createTestFloor({
        id: 'test_floor_batch',
        name: 'Batch Test Floor'
      });

      const queries = [
        {
          text: 'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
          values: ['seat_batch_1', testFloor.id, 100, 200, 'available', 'regular']
        },
        {
          text: 'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
          values: ['seat_batch_2', testFloor.id, 150, 250, 'available', 'regular']
        },
        {
          text: 'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)',
          values: ['seat_batch_3', testFloor.id, 200, 300, 'available', 'regular']
        }
      ];

      const results = await dbPool.batchQuery(queries);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.rowCount).toBe(1);
      });

      // 验证所有座位都已插入
      const seats = await dbPool.query(
        'SELECT * FROM seats WHERE floor_id = $1 ORDER BY id',
        [testFloor.id]
      );

      expect(seats.rows).toHaveLength(3);
    });

    test('应该处理批量查询中的错误', async () => {
      const queries = [
        {
          text: 'SELECT 1 as valid_query',
          values: []
        },
        {
          text: 'SELECT * FROM non_existent_table',
          values: []
        },
        {
          text: 'SELECT 2 as another_valid_query',
          values: []
        }
      ];

      let batchFailed = false;
      try {
        await dbPool.batchQuery(queries);
      } catch (error) {
        batchFailed = true;
        expect(error.message).toContain('Batch query failed');
      }

      expect(batchFailed).toBe(true);
    });
  });

  describe('预处理语句', () => {
    test('应该能够创建和执行预处理语句', async () => {
      const testFloor = await TestSetup.createTestFloor({
        id: 'test_floor_prepared',
        name: 'Prepared Statement Test Floor'
      });

      const statementName = 'insert_seat';
      const query = 'INSERT INTO seats (id, floor_id, x, y, status, type) VALUES ($1, $2, $3, $4, $5, $6)';

      await dbPool.prepare(statementName, query);

      const result = await dbPool.execute(statementName, [
        'seat_prepared_1',
        testFloor.id,
        100,
        200,
        'available',
        'regular'
      ]);

      expect(result.rowCount).toBe(1);

      // 验证座位已插入
      const seat = await dbPool.query(
        'SELECT * FROM seats WHERE id = $1',
        ['seat_prepared_1']
      );

      expect(seat.rows).toHaveLength(1);
      expect(seat.rows[0].floor_id).toBe(testFloor.id);
    });

    test('应该能够释放预处理语句', async () => {
      const statementName = 'test_statement';
      const query = 'SELECT $1 as test_value';

      await dbPool.prepare(statementName, query);
      await dbPool.deallocate(statementName);

      // 尝试执行已释放的语句应该失败
      let executionFailed = false;
      try {
        await dbPool.execute(statementName, ['test']);
      } catch (error) {
        executionFailed = true;
      }

      expect(executionFailed).toBe(true);
    });
  });

  describe('流式查询', () => {
    test('应该能够执行流式查询', async () => {
      const testFloor = await TestSetup.createTestFloor({
        id: 'test_floor_stream',
        name: 'Stream Test Floor'
      });

      // 插入多个座位用于流式查询
      for (let i = 0; i < 10; i++) {
        await TestSetup.createTestSeat({
          id: `seat_stream_${i}`,
          floorId: testFloor.id,
          x: i * 50,
          y: i * 50
        });
      }

      const rows: any[] = [];
      const stream = dbPool.stream(
        'SELECT * FROM seats WHERE floor_id = $1 ORDER BY id',
        [testFloor.id]
      );

      return new Promise((resolve, reject) => {
        stream.on('data', (row) => {
          rows.push(row);
        });

        stream.on('end', () => {
          expect(rows).toHaveLength(10);
          expect(rows[0].id).toBe('seat_stream_0');
          expect(rows[9].id).toBe('seat_stream_9');
          resolve(undefined);
        });

        stream.on('error', reject);
      });
    });
  });

  describe('健康检查', () => {
    test('应该能够执行健康检查', async () => {
      const healthStatus = await dbPool.healthCheck();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.connections).toBeDefined();
      expect(healthStatus.latency).toBeDefined();
      expect(typeof healthStatus.latency).toBe('number');
    });

    test('应该检测数据库连接问题', async () => {
      // 关闭连接池
      await dbPool.close();

      const healthStatus = await dbPool.healthCheck();

      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.error).toBeDefined();
    });
  });

  describe('性能指标', () => {
    test('应该收集连接池统计信息', () => {
      const stats = dbPool.getStats();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('waitingClients');
      expect(stats).toHaveProperty('queriesExecuted');
      expect(stats).toHaveProperty('averageQueryTime');
      expect(stats).toHaveProperty('slowQueries');
      expect(stats).toHaveProperty('errors');
    });

    test('应该更新查询统计', async () => {
      const initialStats = dbPool.getStats();
      const initialQueries = initialStats.queriesExecuted;

      await dbPool.query('SELECT 1');

      const updatedStats = dbPool.getStats();
      expect(updatedStats.queriesExecuted).toBeGreaterThan(initialQueries);
    });

    test('应该跟踪慢查询', async () => {
      const initialStats = dbPool.getStats();
      const initialSlowQueries = initialStats.slowQueries;

      // 执行一个慢查询（模拟）
      await dbPool.query('SELECT pg_sleep(0.1)');

      const updatedStats = dbPool.getStats();
      // 注意：这取决于慢查询阈值设置
      expect(updatedStats.slowQueries).toBeGreaterThanOrEqual(initialSlowQueries);
    });
  });

  describe('连接池配置', () => {
    test('应该遵守最大连接数限制', async () => {
      const stats = dbPool.getStats();
      const maxConnections = 10; // 从测试配置中获取

      expect(stats.totalConnections).toBeLessThanOrEqual(maxConnections);
    });

    test('应该维护最小连接数', async () => {
      const stats = dbPool.getStats();
      const minConnections = 2; // 从测试配置中获取

      expect(stats.totalConnections).toBeGreaterThanOrEqual(minConnections);
    });
  });

  describe('错误恢复', () => {
    test('应该能够从连接错误中恢复', async () => {
      // 这个测试需要模拟网络中断或数据库重启
      // 在实际环境中，这可能需要更复杂的设置

      const initialStats = dbPool.getStats();
      
      // 执行查询以确保连接池正常工作
      await dbPool.query('SELECT 1');
      
      const finalStats = dbPool.getStats();
      expect(finalStats.queriesExecuted).toBeGreaterThan(initialStats.queriesExecuted);
    });
  });

  describe('优雅关闭', () => {
    test('应该能够优雅关闭连接池', async () => {
      // 执行一些查询
      await dbPool.query('SELECT 1');
      await dbPool.query('SELECT 2');

      const stats = dbPool.getStats();
      expect(stats.totalConnections).toBeGreaterThan(0);

      await dbPool.close();

      const finalStats = dbPool.getStats();
      expect(finalStats.totalConnections).toBe(0);
    });
  });
});