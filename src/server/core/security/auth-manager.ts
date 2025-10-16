import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { RedisClient } from 'redis';

export interface UserCredentials {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  lastLogin?: number;
  failedAttempts: number;
  lockedUntil?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope: string[];
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  connectionId?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string; // '15m'
  refreshTokenExpiry: string; // '7d'
  maxFailedAttempts: number;
  lockoutDuration: number; // milliseconds
  sessionTimeout: number; // milliseconds
  maxSessionsPerUser: number;
  enableRateLimit: boolean;
  rateLimitWindow: number; // milliseconds
  rateLimitMaxRequests: number;
}

export interface AuthMetrics {
  totalLogins: number;
  failedLogins: number;
  activeSessions: number;
  lockedAccounts: number;
  tokenRefreshes: number;
  rateLimitHits: number;
}

/**
 * 认证管理器
 * 负责用户认证、授权、会话管理和安全控制
 */
export class AuthenticationManager extends EventEmitter {
  private logger: Logger;
  private redisClient: RedisClient;
  private config: AuthConfig;
  private metrics: AuthMetrics;
  
  // 会话存储
  private sessions: Map<string, AuthSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  
  // 速率限制
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  
  // 黑名单令牌
  private blacklistedTokens: Set<string> = new Set();

  constructor(
    redisClient: RedisClient,
    logger: Logger,
    config: AuthConfig
  ) {
    super();
    this.redisClient = redisClient;
    this.logger = logger;
    this.config = config;
    
    this.initializeMetrics();
    this.startCleanupTimer();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalLogins: 0,
      failedLogins: 0,
      activeSessions: 0,
      lockedAccounts: 0,
      tokenRefreshes: 0,
      rateLimitHits: 0
    };
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupRateLimit();
      this.cleanupBlacklistedTokens();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 用户登录
   */
  async login(
    username: string,
    password: string,
    ipAddress: string,
    userAgent: string,
    connectionId?: string
  ): Promise<{ token: AuthToken; session: AuthSession }> {
    // 速率限制检查
    if (this.config.enableRateLimit && !this.checkRateLimit(ipAddress)) {
      this.metrics.rateLimitHits++;
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // 获取用户凭据
      const credentials = await this.getUserCredentials(username);
      if (!credentials) {
        this.metrics.failedLogins++;
        this.logger.warn('Login attempt with invalid username', { username, ipAddress });
        throw new Error('Invalid credentials');
      }

      // 检查账户状态
      this.checkAccountStatus(credentials);

      // 验证密码
      const isValidPassword = await this.verifyPassword(password, credentials.passwordHash);
      if (!isValidPassword) {
        await this.handleFailedLogin(credentials, ipAddress);
        throw new Error('Invalid credentials');
      }

      // 重置失败尝试计数
      await this.resetFailedAttempts(credentials.userId);

      // 生成令牌
      const token = await this.generateTokens(credentials);

      // 创建会话
      const session = await this.createSession(
        credentials.userId,
        ipAddress,
        userAgent,
        connectionId
      );

      // 更新最后登录时间
      await this.updateLastLogin(credentials.userId);

      this.metrics.totalLogins++;
      this.logger.info('User logged in successfully', {
        userId: credentials.userId,
        username: credentials.username,
        ipAddress,
        sessionId: session.sessionId
      });

      this.emit('user_login', {
        userId: credentials.userId,
        username: credentials.username,
        sessionId: session.sessionId,
        ipAddress
      });

      return { token, session };

    } catch (error) {
      this.logger.error('Login failed', {
        username,
        ipAddress,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 用户登出
   */
  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn('Logout attempt with invalid session', { sessionId });
      return;
    }

    // 移除会话
    await this.removeSession(sessionId);

    // 将访问令牌加入黑名单
    const accessToken = await this.getSessionToken(sessionId);
    if (accessToken) {
      this.blacklistToken(accessToken);
    }

    this.logger.info('User logged out', {
      userId: session.userId,
      sessionId,
      ipAddress: session.ipAddress
    });

    this.emit('user_logout', {
      userId: session.userId,
      sessionId,
      ipAddress: session.ipAddress
    });
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, this.config.jwtRefreshSecret) as any;
      
      // 检查令牌是否在黑名单中
      if (this.blacklistedTokens.has(refreshToken)) {
        throw new Error('Token has been revoked');
      }

      // 获取用户凭据
      const credentials = await this.getUserCredentials(decoded.username);
      if (!credentials || !credentials.isActive) {
        throw new Error('User not found or inactive');
      }

      // 生成新的令牌
      const newToken = await this.generateTokens(credentials);

      // 将旧的刷新令牌加入黑名单
      this.blacklistToken(refreshToken);

      this.metrics.tokenRefreshes++;
      this.logger.debug('Token refreshed successfully', {
        userId: credentials.userId
      });

      return newToken;

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: (error as Error).message
      });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<UserCredentials> {
    try {
      // 检查令牌是否在黑名单中
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      // 验证令牌
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;

      // 获取用户凭据
      const credentials = await this.getUserCredentials(decoded.username);
      if (!credentials || !credentials.isActive) {
        throw new Error('User not found or inactive');
      }

      return credentials;

    } catch (error) {
      this.logger.debug('Token verification failed', {
        error: (error as Error).message
      });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 检查权限
   */
  hasPermission(credentials: UserCredentials, permission: string): boolean {
    // 检查直接权限
    if (credentials.permissions.includes(permission)) {
      return true;
    }

    // 检查角色权限
    for (const role of credentials.roles) {
      if (this.getRolePermissions(role).includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查角色
   */
  hasRole(credentials: UserCredentials, role: string): boolean {
    return credentials.roles.includes(role);
  }

  /**
   * 创建会话
   */
  private async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    connectionId?: string
  ): Promise<AuthSession> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: AuthSession = {
      sessionId,
      userId,
      connectionId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.config.sessionTimeout,
      isActive: true
    };

    // 检查用户会话数量限制
    await this.enforceSessionLimit(userId);

    // 存储会话
    this.sessions.set(sessionId, session);
    
    // 更新用户会话索引
    let userSessions = this.userSessions.get(userId);
    if (!userSessions) {
      userSessions = new Set();
      this.userSessions.set(userId, userSessions);
    }
    userSessions.add(sessionId);

    // 缓存到Redis
    await this.cacheSession(session);

    this.metrics.activeSessions++;
    return session;
  }

  /**
   * 移除会话
   */
  private async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 从内存中移除
    this.sessions.delete(sessionId);

    // 更新用户会话索引
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // 从Redis中移除
    await this.removeCachedSession(sessionId);

    this.metrics.activeSessions = Math.max(0, this.metrics.activeSessions - 1);
  }

  /**
   * 强制执行会话数量限制
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions || userSessions.size < this.config.maxSessionsPerUser) {
      return;
    }

    // 获取最旧的会话并移除
    const sessions = Array.from(userSessions)
      .map(id => this.sessions.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.lastActivity - b!.lastActivity);

    const sessionsToRemove = sessions.slice(0, sessions.length - this.config.maxSessionsPerUser + 1);
    
    for (const session of sessionsToRemove) {
      await this.removeSession(session!.sessionId);
    }

    this.logger.info('Enforced session limit for user', {
      userId,
      removedSessions: sessionsToRemove.length
    });
  }

  /**
   * 生成令牌
   */
  private async generateTokens(credentials: UserCredentials): Promise<AuthToken> {
    const payload = {
      userId: credentials.userId,
      username: credentials.username,
      email: credentials.email,
      roles: credentials.roles,
      permissions: credentials.permissions
    };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry,
      issuer: 'seating-chart-system',
      audience: 'seating-chart-client'
    });

    const refreshToken = jwt.sign(
      { userId: credentials.userId, username: credentials.username },
      this.config.jwtRefreshSecret,
      {
        expiresIn: this.config.refreshTokenExpiry,
        issuer: 'seating-chart-system',
        audience: 'seating-chart-client'
      }
    );

    // 解析过期时间
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      scope: credentials.permissions
    };
  }

  /**
   * 验证密码
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      this.logger.error('Password verification failed', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 检查账户状态
   */
  private checkAccountStatus(credentials: UserCredentials): void {
    if (!credentials.isActive) {
      throw new Error('Account is disabled');
    }

    if (credentials.lockedUntil && credentials.lockedUntil > Date.now()) {
      const unlockTime = new Date(credentials.lockedUntil).toISOString();
      throw new Error(`Account is locked until ${unlockTime}`);
    }
  }

  /**
   * 处理登录失败
   */
  private async handleFailedLogin(credentials: UserCredentials, ipAddress: string): Promise<void> {
    credentials.failedAttempts++;
    this.metrics.failedLogins++;

    // 检查是否需要锁定账户
    if (credentials.failedAttempts >= this.config.maxFailedAttempts) {
      credentials.lockedUntil = Date.now() + this.config.lockoutDuration;
      this.metrics.lockedAccounts++;
      
      this.logger.warn('Account locked due to failed login attempts', {
        userId: credentials.userId,
        username: credentials.username,
        failedAttempts: credentials.failedAttempts,
        ipAddress
      });

      this.emit('account_locked', {
        userId: credentials.userId,
        username: credentials.username,
        ipAddress,
        lockoutDuration: this.config.lockoutDuration
      });
    }

    // 更新用户凭据
    await this.updateUserCredentials(credentials);

    this.logger.warn('Failed login attempt', {
      userId: credentials.userId,
      username: credentials.username,
      failedAttempts: credentials.failedAttempts,
      ipAddress
    });
  }

  /**
   * 重置失败尝试计数
   */
  private async resetFailedAttempts(userId: string): Promise<void> {
    try {
      // 这里应该更新数据库中的用户记录
      // 暂时使用Redis缓存
      await this.redisClient.hdel(`user:${userId}`, 'failedAttempts', 'lockedUntil');
    } catch (error) {
      this.logger.error('Failed to reset failed attempts', {
        userId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 更新最后登录时间
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      const now = Date.now();
      await this.redisClient.hset(`user:${userId}`, 'lastLogin', now.toString());
    } catch (error) {
      this.logger.error('Failed to update last login', {
        userId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const limit = this.rateLimitMap.get(identifier);

    if (!limit || now > limit.resetTime) {
      // 重置或创建新的限制记录
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimitWindow
      });
      return true;
    }

    if (limit.count >= this.config.rateLimitMaxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * 将令牌加入黑名单
   */
  private blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);
    
    // 设置过期时间（基于令牌的过期时间）
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const expiryTime = decoded.exp * 1000 - Date.now();
        if (expiryTime > 0) {
          setTimeout(() => {
            this.blacklistedTokens.delete(token);
          }, expiryTime);
        }
      }
    } catch (error) {
      // 如果无法解析令牌，设置默认过期时间
      setTimeout(() => {
        this.blacklistedTokens.delete(token);
      }, 24 * 60 * 60 * 1000); // 24小时
    }
  }

  /**
   * 获取用户凭据
   */
  private async getUserCredentials(username: string): Promise<UserCredentials | null> {
    try {
      // 首先尝试从Redis缓存获取
      const cached = await this.redisClient.hgetall(`user:${username}`);
      if (cached && Object.keys(cached).length > 0) {
        return this.parseUserCredentials(cached);
      }

      // 如果缓存中没有，这里应该从数据库查询
      // 暂时返回null，实际应用中需要实现数据库查询
      return null;

    } catch (error) {
      this.logger.error('Failed to get user credentials', {
        username,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * 解析用户凭据
   */
  private parseUserCredentials(data: Record<string, string>): UserCredentials {
    return {
      userId: data.userId,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      roles: JSON.parse(data.roles || '[]'),
      permissions: JSON.parse(data.permissions || '[]'),
      isActive: data.isActive === 'true',
      lastLogin: data.lastLogin ? parseInt(data.lastLogin) : undefined,
      failedAttempts: parseInt(data.failedAttempts || '0'),
      lockedUntil: data.lockedUntil ? parseInt(data.lockedUntil) : undefined,
      createdAt: parseInt(data.createdAt),
      updatedAt: parseInt(data.updatedAt)
    };
  }

  /**
   * 更新用户凭据
   */
  private async updateUserCredentials(credentials: UserCredentials): Promise<void> {
    try {
      const data = {
        userId: credentials.userId,
        username: credentials.username,
        email: credentials.email,
        passwordHash: credentials.passwordHash,
        roles: JSON.stringify(credentials.roles),
        permissions: JSON.stringify(credentials.permissions),
        isActive: credentials.isActive.toString(),
        lastLogin: credentials.lastLogin?.toString() || '',
        failedAttempts: credentials.failedAttempts.toString(),
        lockedUntil: credentials.lockedUntil?.toString() || '',
        createdAt: credentials.createdAt.toString(),
        updatedAt: Date.now().toString()
      };

      await this.redisClient.hmset(`user:${credentials.username}`, data);
    } catch (error) {
      this.logger.error('Failed to update user credentials', {
        userId: credentials.userId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 获取角色权限
   */
  private getRolePermissions(role: string): string[] {
    // 角色权限映射
    const rolePermissions: Record<string, string[]> = {
      'admin': ['*'], // 管理员拥有所有权限
      'manager': [
        'seat.view', 'seat.book', 'seat.release', 'seat.manage',
        'floor.view', 'floor.manage',
        'user.view', 'user.manage',
        'report.view'
      ],
      'employee': [
        'seat.view', 'seat.book', 'seat.release',
        'floor.view',
        'profile.view', 'profile.edit'
      ],
      'guest': [
        'seat.view',
        'floor.view'
      ]
    };

    return rolePermissions[role] || [];
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * 获取会话令牌
   */
  private async getSessionToken(sessionId: string): Promise<string | null> {
    try {
      return await this.redisClient.get(`session_token:${sessionId}`);
    } catch (error) {
      return null;
    }
  }

  /**
   * 缓存会话
   */
  private async cacheSession(session: AuthSession): Promise<void> {
    try {
      const key = `session:${session.sessionId}`;
      const value = JSON.stringify(session);
      const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
      
      if (ttl > 0) {
        await this.redisClient.setex(key, ttl, value);
      }
    } catch (error) {
      this.logger.error('Failed to cache session', {
        sessionId: session.sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 移除缓存的会话
   */
  private async removeCachedSession(sessionId: string): Promise<void> {
    try {
      await this.redisClient.del(`session:${sessionId}`);
      await this.redisClient.del(`session_token:${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to remove cached session', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.removeSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.debug('Cleaned up expired sessions', {
        count: expiredSessions.length
      });
    }
  }

  /**
   * 清理速率限制记录
   */
  private cleanupRateLimit(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, limit] of this.rateLimitMap.entries()) {
      if (now > limit.resetTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.rateLimitMap.delete(key);
    }
  }

  /**
   * 清理黑名单令牌
   */
  private cleanupBlacklistedTokens(): void {
    // 黑名单令牌会通过setTimeout自动清理
    // 这里可以添加额外的清理逻辑
  }

  /**
   * 获取认证指标
   */
  getMetrics(): AuthMetrics {
    this.metrics.activeSessions = this.sessions.size;
    return { ...this.metrics };
  }

  /**
   * 获取用户会话
   */
  getUserSessions(userId: string): AuthSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(Boolean) as AuthSession[];
  }

  /**
   * 强制用户下线
   */
  async forceLogoutUser(userId: string): Promise<void> {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return;
    }

    const sessions = Array.from(sessionIds);
    for (const sessionId of sessions) {
      await this.logout(sessionId);
    }

    this.logger.info('User forcefully logged out', {
      userId,
      sessionCount: sessions.length
    });

    this.emit('user_force_logout', { userId });
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down authentication manager');

    // 清理所有会话
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.removeSession(sessionId);
    }

    // 清理缓存
    this.sessions.clear();
    this.userSessions.clear();
    this.rateLimitMap.clear();
    this.blacklistedTokens.clear();

    this.logger.info('Authentication manager shutdown completed');
  }
}