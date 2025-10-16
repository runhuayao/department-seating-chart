import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Logger } from '../infrastructure/logging/logger';
import { DatabaseConnectionPool } from '../core/database/connection-pool';
import { WebSocketPoolManager } from '../core/websocket/manager';
import { AuthenticationManager } from '../core/security/auth-manager';
import { EncryptionService } from '../core/security/encryption';
import { RateLimiter } from '../core/security/rate-limiter';
import { createClient } from 'redis';
import { Pool } from 'pg';

export interface TestEnvironment {
  logger: Logger;
  dbPool: DatabaseConnectionPool;
  wsManager: WebSocketPoolManager;
  authManager: AuthenticationManager;
  encryptionService: EncryptionService;
  rateLimiter: RateLimiter;
  redisClient: any;
  cleanup: () => Promise<void>;
}

/**
 * 测试环境配置
 */
export class TestSetup {
  private static instance: TestEnvironment | null = null;
  
  /**
   * 初始化测试环境
   */
  static async initialize(): Promise<TestEnvironment> {
    if (TestSetup.instance) {
      return TestSetup.instance;
    }

    // 创建测试日志器
    const logger = new Logger({
      level: 'debug',
      format: 'json',
      transports: ['console'],
      enableFileLogging: false
    });

    // 创建测试Redis客户端
    const redisClient = createClient({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: parseInt(process.env.TEST_REDIS_DB || '1') // 使用测试数据库
    });

    await redisClient.connect();

    // 创建测试数据库连接池
    const dbPool = new DatabaseConnectionPool(
      {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: process.env.TEST_DB_NAME || 'seating_chart_test',
        user: process.env.TEST_DB_USER || 'test_user',
        password: process.env.TEST_DB_PASSWORD || 'test_password',
        ssl: false
      },
      {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 10000
      },
      logger
    );

    // 创建加密服务
    const encryptionService = new EncryptionService(
      logger,
      {
        algorithm: 'aes-256-gcm',
        keyDerivationAlgorithm: 'pbkdf2',
        keyDerivationIterations: 10000,
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        saltLength: 32,
        masterKey: 'test_master_key_32_characters_long!'
      },
      {
        algorithm: 'sha256',
        saltLength: 32,
        iterations: 10000
      }
    );

    // 创建认证管理器
    const authManager = new AuthenticationManager(
      redisClient,
      logger,
      {
        jwtSecret: 'test_jwt_secret_key',
        jwtRefreshSecret: 'test_jwt_refresh_secret_key',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15分钟
        sessionTimeout: 60 * 60 * 1000, // 1小时
        maxSessionsPerUser: 3,
        enableRateLimit: true,
        rateLimitWindow: 60 * 1000, // 1分钟
        rateLimitMaxRequests: 10
      }
    );

    // 创建速率限制器
    const rateLimiter = new RateLimiter(redisClient, logger);

    // 创建WebSocket管理器
    const wsManager = new WebSocketPoolManager(
      {
        port: 0, // 测试时使用随机端口
        maxConnections: 100,
        heartbeatInterval: 30000,
        connectionTimeout: 60000,
        enableCompression: true,
        enableCors: true,
        corsOrigins: ['http://localhost:3000']
      },
      logger,
      authManager,
      rateLimiter
    );

    const cleanup = async () => {
      await wsManager.shutdown();
      await authManager.shutdown();
      await encryptionService.shutdown();
      await rateLimiter.shutdown();
      await dbPool.close();
      await redisClient.quit();
    };

    TestSetup.instance = {
      logger,
      dbPool,
      wsManager,
      authManager,
      encryptionService,
      rateLimiter,
      redisClient,
      cleanup
    };

    return TestSetup.instance;
  }

  /**
   * 清理测试环境
   */
  static async cleanup(): Promise<void> {
    if (TestSetup.instance) {
      await TestSetup.instance.cleanup();
      TestSetup.instance = null;
    }
  }

  /**
   * 重置测试数据
   */
  static async resetTestData(): Promise<void> {
    if (!TestSetup.instance) {
      throw new Error('Test environment not initialized');
    }

    const { redisClient, dbPool } = TestSetup.instance;

    // 清理Redis测试数据
    await redisClient.flushdb();

    // 清理数据库测试数据
    await dbPool.query('TRUNCATE TABLE seats, floors, users, sessions CASCADE');
  }

  /**
   * 创建测试用户
   */
  static async createTestUser(userData: {
    username: string;
    email: string;
    password: string;
    roles?: string[];
    permissions?: string[];
  }): Promise<any> {
    if (!TestSetup.instance) {
      throw new Error('Test environment not initialized');
    }

    const { dbPool, encryptionService } = TestSetup.instance;
    const bcrypt = require('bcrypt');

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const userId = `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const user = {
      userId,
      username: userData.username,
      email: userData.email,
      passwordHash,
      roles: userData.roles || ['employee'],
      permissions: userData.permissions || ['seat.view', 'seat.book'],
      isActive: true,
      failedAttempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 插入到数据库
    await dbPool.query(
      `INSERT INTO users (id, username, email, password_hash, roles, permissions, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.userId,
        user.username,
        user.email,
        user.passwordHash,
        JSON.stringify(user.roles),
        JSON.stringify(user.permissions),
        user.isActive,
        new Date(user.createdAt),
        new Date(user.updatedAt)
      ]
    );

    return user;
  }

  /**
   * 创建测试座位
   */
  static async createTestSeat(seatData: {
    id: string;
    floorId: string;
    x: number;
    y: number;
    status?: string;
    type?: string;
  }): Promise<any> {
    if (!TestSetup.instance) {
      throw new Error('Test environment not initialized');
    }

    const { dbPool } = TestSetup.instance;

    const seat = {
      id: seatData.id,
      floorId: seatData.floorId,
      x: seatData.x,
      y: seatData.y,
      status: seatData.status || 'available',
      type: seatData.type || 'regular',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await dbPool.query(
      `INSERT INTO seats (id, floor_id, x, y, status, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        seat.id,
        seat.floorId,
        seat.x,
        seat.y,
        seat.status,
        seat.type,
        seat.createdAt,
        seat.updatedAt
      ]
    );

    return seat;
  }

  /**
   * 创建测试楼层
   */
  static async createTestFloor(floorData: {
    id: string;
    name: string;
    building?: string;
    level?: number;
  }): Promise<any> {
    if (!TestSetup.instance) {
      throw new Error('Test environment not initialized');
    }

    const { dbPool } = TestSetup.instance;

    const floor = {
      id: floorData.id,
      name: floorData.name,
      building: floorData.building || 'Test Building',
      level: floorData.level || 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await dbPool.query(
      `INSERT INTO floors (id, name, building, level, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        floor.id,
        floor.name,
        floor.building,
        floor.level,
        floor.createdAt,
        floor.updatedAt
      ]
    );

    return floor;
  }

  /**
   * 模拟WebSocket连接
   */
  static createMockWebSocket(): any {
    const EventEmitter = require('events');
    
    class MockWebSocket extends EventEmitter {
      public readyState = 1; // OPEN
      public CONNECTING = 0;
      public OPEN = 1;
      public CLOSING = 2;
      public CLOSED = 3;

      send(data: string): void {
        // 模拟发送数据
        setTimeout(() => {
          this.emit('message', data);
        }, 0);
      }

      close(code?: number, reason?: string): void {
        this.readyState = this.CLOSED;
        this.emit('close', code, reason);
      }

      ping(): void {
        this.emit('ping');
      }

      pong(): void {
        this.emit('pong');
      }
    }

    return new MockWebSocket();
  }

  /**
   * 等待异步操作完成
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * 生成测试数据
   */
  static generateTestData(): {
    randomString: (length?: number) => string;
    randomNumber: (min?: number, max?: number) => number;
    randomEmail: () => string;
    randomCoordinates: () => { x: number; y: number };
  } {
    return {
      randomString: (length = 10) => {
        return Math.random().toString(36).substring(2, 2 + length);
      },
      
      randomNumber: (min = 0, max = 100) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      
      randomEmail: () => {
        const username = Math.random().toString(36).substring(2, 10);
        const domain = Math.random().toString(36).substring(2, 8);
        return `${username}@${domain}.test`;
      },
      
      randomCoordinates: () => ({
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000)
      })
    };
  }
}

// Jest全局设置
beforeAll(async () => {
  await TestSetup.initialize();
});

afterAll(async () => {
  await TestSetup.cleanup();
});

beforeEach(async () => {
  await TestSetup.resetTestData();
});

afterEach(async () => {
  // 清理每个测试后的状态
});

export default TestSetup;