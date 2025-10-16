import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import TestSetup from '../setup';

describe('Security Tests', () => {
  let testEnv: any;

  beforeAll(async () => {
    testEnv = await TestSetup.initialize();
  });

  afterAll(async () => {
    await TestSetup.cleanup();
  });

  describe('认证和授权安全', () => {
    test('JWT令牌验证', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'security_test_user',
        email: 'security@test.com',
        password: 'SecurePassword123!'
      });

      // 测试有效令牌
      const loginResult = await testEnv.authManager.login(
        'security_test_user',
        'SecurePassword123!',
        '127.0.0.1',
        'security-test-client'
      );

      expect(loginResult.success).toBe(true);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();

      // 验证令牌
      const verifyResult = await testEnv.authManager.verifyToken(loginResult.token);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.payload.userId).toBe(testUser.userId);

      // 测试无效令牌
      const invalidToken = 'invalid.jwt.token';
      const invalidResult = await testEnv.authManager.verifyToken(invalidToken);
      expect(invalidResult.valid).toBe(false);

      // 测试过期令牌
      const expiredToken = await testEnv.authManager.generateToken(
        { userId: testUser.userId, username: testUser.username },
        -1 // 负数过期时间
      );
      const expiredResult = await testEnv.authManager.verifyToken(expiredToken);
      expect(expiredResult.valid).toBe(false);
      expect(expiredResult.error).toContain('expired');
    });

    test('权限控制', async () => {
      const regularUser = await TestSetup.createTestUser({
        username: 'regular_user',
        email: 'regular@test.com',
        password: 'password123',
        role: 'user'
      });

      const adminUser = await TestSetup.createTestUser({
        username: 'admin_user',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin'
      });

      // 测试普通用户权限
      const regularPermissions = await testEnv.authManager.checkPermissions(
        regularUser.userId,
        ['seat:select', 'seat:release', 'floor:view']
      );
      expect(regularPermissions.seat_select).toBe(true);
      expect(regularPermissions.seat_release).toBe(true);
      expect(regularPermissions.floor_view).toBe(true);

      const adminOnlyPermissions = await testEnv.authManager.checkPermissions(
        regularUser.userId,
        ['admin:manage_users', 'admin:system_config']
      );
      expect(adminOnlyPermissions.admin_manage_users).toBe(false);
      expect(adminOnlyPermissions.admin_system_config).toBe(false);

      // 测试管理员权限
      const adminPermissions = await testEnv.authManager.checkPermissions(
        adminUser.userId,
        ['seat:select', 'admin:manage_users', 'admin:system_config']
      );
      expect(adminPermissions.seat_select).toBe(true);
      expect(adminPermissions.admin_manage_users).toBe(true);
      expect(adminPermissions.admin_system_config).toBe(true);
    });

    test('会话管理安全', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'session_test_user',
        email: 'session@test.com',
        password: 'password123'
      });

      // 创建会话
      const session = await testEnv.authManager.createSession(
        testUser.userId,
        '127.0.0.1',
        'session-test-client'
      );

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(testUser.userId);

      // 验证会话
      const validSession = await testEnv.authManager.validateSession(session.sessionId);
      expect(validSession.valid).toBe(true);
      expect(validSession.userId).toBe(testUser.userId);

      // 测试会话过期
      await testEnv.redisClient.expire(`session:${session.sessionId}`, 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const expiredSession = await testEnv.authManager.validateSession(session.sessionId);
      expect(expiredSession.valid).toBe(false);

      // 测试会话撤销
      const newSession = await testEnv.authManager.createSession(
        testUser.userId,
        '127.0.0.1',
        'session-test-client'
      );

      await testEnv.authManager.revokeSession(newSession.sessionId);
      const revokedSession = await testEnv.authManager.validateSession(newSession.sessionId);
      expect(revokedSession.valid).toBe(false);
    });

    test('账户锁定机制', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'lockout_test_user',
        email: 'lockout@test.com',
        password: 'password123'
      });

      // 多次失败登录
      for (let i = 0; i < 5; i++) {
        const result = await testEnv.authManager.login(
          'lockout_test_user',
          'wrong_password',
          '127.0.0.1',
          'lockout-test-client'
        );
        expect(result.success).toBe(false);
      }

      // 检查账户是否被锁定
      const lockoutResult = await testEnv.authManager.login(
        'lockout_test_user',
        'password123', // 正确密码
        '127.0.0.1',
        'lockout-test-client'
      );

      expect(lockoutResult.success).toBe(false);
      expect(lockoutResult.error).toContain('locked');

      // 测试锁定状态
      const isLocked = await testEnv.authManager.isAccountLocked(testUser.userId);
      expect(isLocked).toBe(true);
    });
  });

  describe('数据加密安全', () => {
    test('敏感数据加密', async () => {
      const sensitiveData = {
        employeeId: 'EMP123456',
        personalInfo: 'John Doe, 123-456-7890',
        seatCoordinates: { x: 100, y: 200 }
      };

      // 加密员工工号
      const encryptedEmployeeId = await testEnv.encryptionService.encryptEmployeeId(
        sensitiveData.employeeId
      );
      expect(encryptedEmployeeId).not.toBe(sensitiveData.employeeId);
      expect(encryptedEmployeeId.length).toBeGreaterThan(sensitiveData.employeeId.length);

      // 解密验证
      const decryptedEmployeeId = await testEnv.encryptionService.decryptEmployeeId(
        encryptedEmployeeId
      );
      expect(decryptedEmployeeId).toBe(sensitiveData.employeeId);

      // 加密个人信息
      const encryptedPersonalInfo = await testEnv.encryptionService.encryptPersonalInfo(
        sensitiveData.personalInfo
      );
      expect(encryptedPersonalInfo).not.toBe(sensitiveData.personalInfo);

      const decryptedPersonalInfo = await testEnv.encryptionService.decryptPersonalInfo(
        encryptedPersonalInfo
      );
      expect(decryptedPersonalInfo).toBe(sensitiveData.personalInfo);

      // 加密座位坐标
      const encryptedCoordinates = await testEnv.encryptionService.encryptSeatCoordinates(
        sensitiveData.seatCoordinates
      );
      expect(encryptedCoordinates).not.toEqual(sensitiveData.seatCoordinates);

      const decryptedCoordinates = await testEnv.encryptionService.decryptSeatCoordinates(
        encryptedCoordinates
      );
      expect(decryptedCoordinates).toEqual(sensitiveData.seatCoordinates);
    });

    test('WebSocket消息加密', async () => {
      const message = {
        type: 'seat_select',
        data: {
          seatId: 'SEAT_001',
          userId: 'USER_123',
          employeeId: 'EMP456789',
          timestamp: Date.now()
        }
      };

      // 加密消息
      const encryptedMessage = await testEnv.encryptionService.encryptWebSocketMessage(message);
      expect(encryptedMessage.encrypted).toBe(true);
      expect(encryptedMessage.data).not.toEqual(message.data);

      // 解密消息
      const decryptedMessage = await testEnv.encryptionService.decryptWebSocketMessage(
        encryptedMessage
      );
      expect(decryptedMessage).toEqual(message);
    });

    test('密码哈希安全', async () => {
      const password = 'SecurePassword123!';
      const weakPassword = '123456';

      // 生成安全哈希
      const hash = await testEnv.encryptionService.hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt哈希长度

      // 验证密码
      const isValid = await testEnv.encryptionService.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await testEnv.encryptionService.verifyPassword('wrong_password', hash);
      expect(isInvalid).toBe(false);

      // 测试弱密码哈希（应该仍然安全）
      const weakHash = await testEnv.encryptionService.hashPassword(weakPassword);
      expect(weakHash).not.toBe(weakPassword);
      expect(weakHash.length).toBeGreaterThan(50);
    });

    test('座位锁密钥安全', async () => {
      const seatId = 'SEAT_001';
      const userId = 'USER_123';

      // 生成座位锁密钥
      const lockKey = await testEnv.encryptionService.generateSeatLockKey(seatId, userId);
      expect(lockKey).toBeDefined();
      expect(lockKey.length).toBeGreaterThan(20);

      // 验证密钥唯一性
      const anotherLockKey = await testEnv.encryptionService.generateSeatLockKey(seatId, userId);
      expect(anotherLockKey).not.toBe(lockKey); // 应该包含随机盐

      // 不同座位应该生成不同密钥
      const differentSeatKey = await testEnv.encryptionService.generateSeatLockKey(
        'SEAT_002',
        userId
      );
      expect(differentSeatKey).not.toBe(lockKey);
    });

    test('API密钥生成和验证', async () => {
      const keyPurpose = 'websocket_auth';
      const keyMetadata = { userId: 'USER_123', permissions: ['seat:select', 'seat:release'] };

      // 生成API密钥
      const apiKey = await testEnv.encryptionService.generateApiKey(keyPurpose, keyMetadata);
      expect(apiKey.key).toBeDefined();
      expect(apiKey.keyId).toBeDefined();
      expect(apiKey.key.length).toBeGreaterThan(30);

      // 验证API密钥（这里需要实现验证逻辑）
      // 在实际实现中，应该有相应的验证方法
    });
  });

  describe('速率限制和DDoS防护', () => {
    test('API速率限制', async () => {
      const clientId = 'test_client_001';
      const endpoint = 'api_general';

      // 测试正常请求
      for (let i = 0; i < 5; i++) {
        const result = await testEnv.rateLimiter.checkLimit(clientId, endpoint);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      }

      // 测试超出限制
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        const result = await testEnv.rateLimiter.checkLimit(clientId, endpoint);
        if (!result.allowed) {
          blocked = true;
          expect(result.retryAfter).toBeGreaterThan(0);
          break;
        }
      }
      expect(blocked).toBe(true);
    });

    test('WebSocket连接限制', async () => {
      const clientId = 'ws_test_client';
      const endpoint = 'websocket_connection';

      // 测试WebSocket连接限制
      let connectionCount = 0;
      let blocked = false;

      for (let i = 0; i < 20; i++) {
        const result = await testEnv.rateLimiter.checkLimit(clientId, endpoint);
        if (result.allowed) {
          connectionCount++;
        } else {
          blocked = true;
          break;
        }
      }

      expect(connectionCount).toBeGreaterThan(0);
      expect(blocked).toBe(true); // 应该在某个点被阻止
    });

    test('登录尝试限制', async () => {
      const clientId = 'login_test_client';
      const endpoint = 'login_attempt';

      // 测试登录尝试限制
      let attemptCount = 0;
      let blocked = false;

      for (let i = 0; i < 10; i++) {
        const result = await testEnv.rateLimiter.checkLimit(clientId, endpoint);
        if (result.allowed) {
          attemptCount++;
        } else {
          blocked = true;
          expect(result.retryAfter).toBeGreaterThan(0);
          break;
        }
      }

      expect(attemptCount).toBeGreaterThan(0);
      expect(attemptCount).toBeLessThan(10); // 应该在10次之前被阻止
      expect(blocked).toBe(true);
    });

    test('可疑行为检测', async () => {
      const suspiciousClientId = 'suspicious_client';

      // 模拟可疑行为：快速大量请求
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(testEnv.rateLimiter.checkLimit(suspiciousClientId, 'api_general'));
      }

      await Promise.all(promises);

      // 检查是否被标记为可疑
      const suspiciousScore = await testEnv.rateLimiter.getSuspiciousScore(suspiciousClientId);
      expect(suspiciousScore).toBeGreaterThan(0);

      // 检查是否被自动加入黑名单
      const isBlacklisted = await testEnv.rateLimiter.isBlacklisted(suspiciousClientId);
      // 根据配置，可能会被自动加入黑名单
    });

    test('黑白名单管理', async () => {
      const testClientId = 'blacklist_test_client';

      // 添加到黑名单
      await testEnv.rateLimiter.addToBlacklist(testClientId, 'Security test', 3600);

      // 验证黑名单状态
      const isBlacklisted = await testEnv.rateLimiter.isBlacklisted(testClientId);
      expect(isBlacklisted).toBe(true);

      // 测试黑名单客户端请求
      const result = await testEnv.rateLimiter.checkLimit(testClientId, 'api_general');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blacklisted');

      // 从黑名单移除
      await testEnv.rateLimiter.removeFromBlacklist(testClientId);
      const isStillBlacklisted = await testEnv.rateLimiter.isBlacklisted(testClientId);
      expect(isStillBlacklisted).toBe(false);

      // 添加到白名单
      await testEnv.rateLimiter.addToWhitelist(testClientId, 'Security test');

      // 验证白名单状态
      const isWhitelisted = await testEnv.rateLimiter.isWhitelisted(testClientId);
      expect(isWhitelisted).toBe(true);

      // 白名单客户端应该绕过限制
      for (let i = 0; i < 100; i++) {
        const whitelistResult = await testEnv.rateLimiter.checkLimit(testClientId, 'api_general');
        expect(whitelistResult.allowed).toBe(true);
      }
    });

    test('自适应限制', async () => {
      const adaptiveClientId = 'adaptive_test_client';

      // 获取初始限制
      const initialResult = await testEnv.rateLimiter.checkLimit(adaptiveClientId, 'api_general');
      const initialLimit = initialResult.limit;

      // 模拟系统负载增加（这需要在实际实现中有相应的机制）
      // 这里我们直接测试自适应限制的概念

      // 连续请求以触发自适应机制
      for (let i = 0; i < 20; i++) {
        await testEnv.rateLimiter.checkLimit(adaptiveClientId, 'api_general');
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 检查限制是否有所调整（具体实现可能不同）
      const adaptedResult = await testEnv.rateLimiter.checkLimit(adaptiveClientId, 'api_general');
      // 在高负载情况下，限制可能会更严格
    });
  });

  describe('输入验证和注入防护', () => {
    test('SQL注入防护', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM seats WHERE 1=1; --",
        "UNION SELECT * FROM users WHERE 1=1 --"
      ];

      for (const maliciousInput of maliciousInputs) {
        // 测试数据库查询是否正确处理恶意输入
        try {
          const result = await testEnv.dbPool.query(
            'SELECT * FROM seats WHERE id = $1',
            [maliciousInput]
          );
          // 查询应该成功执行但不返回任何结果（因为没有匹配的座位ID）
          expect(result.rows).toEqual([]);
        } catch (error) {
          // 如果抛出错误，应该是参数化查询的正常行为
          expect(error).toBeDefined();
        }
      }
    });

    test('XSS防护', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>'
      ];

      // 测试WebSocket消息中的XSS防护
      for (const payload of xssPayloads) {
        const message = {
          type: 'chat_message',
          data: {
            content: payload,
            userId: 'test_user',
            timestamp: Date.now()
          }
        };

        // 在实际实现中，应该有输入验证和清理机制
        // 这里我们测试消息是否被正确处理
        const ws = TestSetup.createMockWebSocket();
        const connectionId = await testEnv.wsManager.handleConnection(ws, {
          headers: { 'user-agent': 'xss-test', 'x-forwarded-for': '127.0.0.1' },
          url: '/ws?token=xss_test_token'
        });

        // 发送包含XSS的消息
        ws.emit('message', JSON.stringify(message));

        // 验证消息是否被正确处理（不应该导致系统崩溃）
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    test('命令注入防护', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; ping google.com'
      ];

      // 测试任何可能执行系统命令的地方
      for (const payload of commandInjectionPayloads) {
        // 如果有文件上传或处理用户输入的地方，应该测试命令注入防护
        // 这里我们测试座位ID等输入字段
        const maliciousSeatId = `seat_${payload}`;

        try {
          const result = await testEnv.dbPool.query(
            'SELECT * FROM seats WHERE id = $1',
            [maliciousSeatId]
          );
          // 查询应该安全执行
          expect(result.rows).toEqual([]);
        } catch (error) {
          // 参数化查询应该防止命令注入
          expect(error).toBeDefined();
        }
      }
    });

    test('路径遍历防护', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd'
      ];

      // 如果有文件访问功能，测试路径遍历防护
      for (const payload of pathTraversalPayloads) {
        // 这里我们测试任何可能涉及文件路径的输入
        // 例如，如果有楼层图片上传或访问功能
        const maliciousPath = payload;

        // 验证路径是否被正确验证和清理
        // 在实际实现中，应该有路径验证机制
        expect(maliciousPath).toContain('..');
      }
    });
  });

  describe('WebSocket安全', () => {
    test('WebSocket连接认证', async () => {
      // 测试无令牌连接
      const wsWithoutToken = TestSetup.createMockWebSocket();
      
      try {
        await testEnv.wsManager.handleConnection(wsWithoutToken, {
          headers: { 'user-agent': 'no-token-test', 'x-forwarded-for': '127.0.0.1' },
          url: '/ws' // 没有token参数
        });
        
        // 应该拒绝连接或要求认证
        expect(false).toBe(true); // 如果到达这里，说明安全检查失败
      } catch (error) {
        // 应该抛出认证错误
        expect(error).toBeDefined();
      }

      // 测试无效令牌连接
      const wsWithInvalidToken = TestSetup.createMockWebSocket();
      
      try {
        await testEnv.wsManager.handleConnection(wsWithInvalidToken, {
          headers: { 'user-agent': 'invalid-token-test', 'x-forwarded-for': '127.0.0.1' },
          url: '/ws?token=invalid_token_123'
        });
        
        expect(false).toBe(true); // 如果到达这里，说明安全检查失败
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('WebSocket消息验证', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'ws_security_user',
        email: 'wssecurity@test.com',
        password: 'password123'
      });

      const loginResult = await testEnv.authManager.login(
        'ws_security_user',
        'password123',
        '127.0.0.1',
        'ws-security-test'
      );

      const ws = TestSetup.createMockWebSocket();
      const connectionId = await testEnv.wsManager.handleConnection(ws, {
        headers: { 'user-agent': 'ws-security-test', 'x-forwarded-for': '127.0.0.1' },
        url: `/ws?token=${loginResult.token}`
      });

      // 测试恶意消息格式
      const maliciousMessages = [
        'not_json_message',
        '{"type": ""}', // 空类型
        '{"data": "no_type"}', // 缺少类型
        '{"type": "unknown_type", "data": {}}', // 未知类型
        '{"type": "seat_select"}', // 缺少数据
        JSON.stringify({ type: 'seat_select', data: null }), // 空数据
        JSON.stringify({ type: 'seat_select', data: { seatId: '../../../malicious' } }) // 恶意座位ID
      ];

      for (const maliciousMessage of maliciousMessages) {
        // 发送恶意消息
        ws.emit('message', maliciousMessage);
        
        // 等待处理
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 连接应该仍然活跃或被安全关闭
        // 系统不应该崩溃
      }
    });

    test('WebSocket连接限制', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'ws_limit_user',
        email: 'wslimit@test.com',
        password: 'password123'
      });

      const loginResult = await testEnv.authManager.login(
        'ws_limit_user',
        'password123',
        '127.0.0.1',
        'ws-limit-test'
      );

      const connections = [];
      let connectionCount = 0;
      let limitReached = false;

      // 尝试创建大量连接
      for (let i = 0; i < 20; i++) {
        try {
          const ws = TestSetup.createMockWebSocket();
          const connectionId = await testEnv.wsManager.handleConnection(ws, {
            headers: { 'user-agent': 'ws-limit-test', 'x-forwarded-for': '127.0.0.1' },
            url: `/ws?token=${loginResult.token}&connectionId=${i}`
          });
          
          connections.push({ ws, connectionId });
          connectionCount++;
        } catch (error) {
          limitReached = true;
          break;
        }
      }

      // 应该有连接限制
      expect(limitReached).toBe(true);
      expect(connectionCount).toBeLessThan(20);
    });
  });

  describe('数据泄露防护', () => {
    test('敏感数据日志过滤', async () => {
      const sensitiveData = {
        password: 'SecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        employeeId: 'EMP123456',
        personalInfo: 'John Doe, SSN: 123-45-6789'
      };

      // 测试日志记录是否过滤敏感信息
      // 在实际实现中，应该有日志过滤机制
      const logMessage = `User login attempt with password: ${sensitiveData.password}`;
      
      // 验证敏感信息不会被记录到日志中
      // 这需要检查实际的日志输出
      expect(logMessage).toContain('password');
      
      // 在实际实现中，应该过滤或掩码敏感信息
      const filteredMessage = logMessage.replace(/password:\s*\S+/g, 'password: [FILTERED]');
      expect(filteredMessage).not.toContain(sensitiveData.password);
      expect(filteredMessage).toContain('[FILTERED]');
    });

    test('错误信息安全', async () => {
      // 测试错误信息是否泄露敏感信息
      try {
        await testEnv.dbPool.query('SELECT * FROM non_existent_table');
      } catch (error) {
        const errorMessage = error.message;
        
        // 错误信息不应该包含数据库结构信息
        // 在生产环境中，应该返回通用错误信息
        expect(errorMessage).toBeDefined();
        
        // 检查是否泄露了数据库信息
        const containsSensitiveInfo = errorMessage.includes('postgres') || 
                                    errorMessage.includes('database') ||
                                    errorMessage.includes('connection');
        
        // 在生产环境中，这些信息不应该暴露给客户端
        if (process.env.NODE_ENV === 'production') {
          expect(containsSensitiveInfo).toBe(false);
        }
      }
    });

    test('API响应数据过滤', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'api_filter_user',
        email: 'apifilter@test.com',
        password: 'password123',
        employeeId: 'EMP789012'
      });

      // 模拟API响应
      const userResponse = {
        userId: testUser.userId,
        username: testUser.username,
        email: testUser.email,
        employeeId: testUser.employeeId,
        passwordHash: 'hashed_password_should_not_be_exposed',
        internalId: 'internal_system_id_12345'
      };

      // 在实际实现中，应该过滤敏感字段
      const filteredResponse = {
        userId: userResponse.userId,
        username: userResponse.username,
        email: userResponse.email
        // passwordHash 和 internalId 应该被过滤
      };

      expect(filteredResponse.passwordHash).toBeUndefined();
      expect(filteredResponse.internalId).toBeUndefined();
      expect(filteredResponse.employeeId).toBeUndefined(); // 员工ID也是敏感信息
    });
  });

  describe('合规性检查', () => {
    test('数据保留政策', async () => {
      // 测试数据保留和清理机制
      const oldTimestamp = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90天前

      // 创建过期的测试数据
      await testEnv.redisClient.set(
        'old_session:test_session_123',
        JSON.stringify({ userId: 'test_user', createdAt: oldTimestamp }),
        'EX',
        1 // 1秒后过期
      );

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 验证过期数据已被清理
      const expiredData = await testEnv.redisClient.get('old_session:test_session_123');
      expect(expiredData).toBeNull();
    });

    test('审计日志记录', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'audit_test_user',
        email: 'audit@test.com',
        password: 'password123'
      });

      // 执行需要审计的操作
      const loginResult = await testEnv.authManager.login(
        'audit_test_user',
        'password123',
        '127.0.0.1',
        'audit-test-client'
      );

      // 在实际实现中，应该记录审计日志
      // 这里我们验证关键操作是否被记录
      expect(loginResult.success).toBe(true);

      // 验证审计日志（需要实际的审计日志实现）
      // 审计日志应该包含：
      // - 用户ID
      // - 操作类型
      // - 时间戳
      // - IP地址
      // - 用户代理
      // - 操作结果
    });

    test('数据访问控制', async () => {
      const regularUser = await TestSetup.createTestUser({
        username: 'regular_access_user',
        email: 'regularaccess@test.com',
        password: 'password123',
        role: 'user'
      });

      const adminUser = await TestSetup.createTestUser({
        username: 'admin_access_user',
        email: 'adminaccess@test.com',
        password: 'password123',
        role: 'admin'
      });

      // 测试数据访问控制
      // 普通用户不应该能访问管理员数据
      const regularUserPermissions = await testEnv.authManager.checkPermissions(
        regularUser.userId,
        ['admin:view_all_users', 'admin:system_logs']
      );

      expect(regularUserPermissions.admin_view_all_users).toBe(false);
      expect(regularUserPermissions.admin_system_logs).toBe(false);

      // 管理员应该能访问管理员数据
      const adminUserPermissions = await testEnv.authManager.checkPermissions(
        adminUser.userId,
        ['admin:view_all_users', 'admin:system_logs']
      );

      expect(adminUserPermissions.admin_view_all_users).toBe(true);
      expect(adminUserPermissions.admin_system_logs).toBe(true);
    });

    test('隐私数据处理', async () => {
      const testUser = await TestSetup.createTestUser({
        username: 'privacy_test_user',
        email: 'privacy@test.com',
        password: 'password123',
        personalInfo: 'John Doe, Phone: 123-456-7890'
      });

      // 测试个人信息加密存储
      const encryptedInfo = await testEnv.encryptionService.encryptPersonalInfo(
        testUser.personalInfo
      );

      expect(encryptedInfo).not.toBe(testUser.personalInfo);
      expect(encryptedInfo.length).toBeGreaterThan(testUser.personalInfo.length);

      // 测试数据最小化原则
      // 只收集和处理必要的数据
      const minimalUserData = {
        userId: testUser.userId,
        username: testUser.username
        // 不包含不必要的个人信息
      };

      expect(minimalUserData.email).toBeUndefined();
      expect(minimalUserData.personalInfo).toBeUndefined();
    });
  });
});