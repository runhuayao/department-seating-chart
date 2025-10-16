import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { RedisClient } from 'redis';

export interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyGenerator?: (identifier: string) => string; // 自定义键生成器
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean; // 是否跳过失败请求
  enableHeaders?: boolean; // 是否启用响应头
  message?: string; // 限制消息
  standardHeaders?: boolean; // 是否使用标准头
  legacyHeaders?: boolean; // 是否使用传统头
}

export interface RateLimitRule {
  name: string;
  pattern: string | RegExp; // 匹配模式
  config: RateLimitConfig;
  priority: number; // 优先级，数字越小优先级越高
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
  retryAfter?: number;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  activeWindows: number;
  topBlockedIPs: Array<{ ip: string; count: number }>;
  ruleStats: Map<string, { requests: number; blocks: number }>;
}

/**
 * 速率限制器
 * 实现多层级的API速率限制和DDoS防护
 */
export class RateLimiter extends EventEmitter {
  private logger: Logger;
  private redisClient: RedisClient;
  private rules: Map<string, RateLimitRule> = new Map();
  private stats: RateLimitStats;
  
  // 内存缓存（用于高频访问的快速检查）
  private memoryCache: Map<string, {
    count: number;
    resetTime: number;
    lastAccess: number;
  }> = new Map();
  
  // 黑名单和白名单
  private blacklist: Set<string> = new Set();
  private whitelist: Set<string> = new Set();
  
  // 自适应限制
  private adaptiveThresholds: Map<string, {
    baseLimit: number;
    currentLimit: number;
    errorRate: number;
    lastAdjustment: number;
  }> = new Map();

  constructor(
    redisClient: RedisClient,
    logger: Logger
  ) {
    super();
    this.redisClient = redisClient;
    this.logger = logger;
    
    this.initializeStats();
    this.startCleanupTimer();
    this.loadDefaultRules();
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      activeWindows: 0,
      topBlockedIPs: [],
      ruleStats: new Map()
    };
  }

  /**
   * 加载默认规则
   */
  private loadDefaultRules(): void {
    // 全局API限制
    this.addRule({
      name: 'global_api',
      pattern: '/api/*',
      config: {
        windowMs: 60 * 1000, // 1分钟
        maxRequests: 1000,
        message: 'Too many API requests'
      },
      priority: 100
    });

    // WebSocket连接限制
    this.addRule({
      name: 'websocket_connect',
      pattern: '/ws/connect',
      config: {
        windowMs: 60 * 1000, // 1分钟
        maxRequests: 10,
        message: 'Too many WebSocket connection attempts'
      },
      priority: 10
    });

    // 登录限制
    this.addRule({
      name: 'auth_login',
      pattern: '/api/auth/login',
      config: {
        windowMs: 15 * 60 * 1000, // 15分钟
        maxRequests: 5,
        message: 'Too many login attempts'
      },
      priority: 1
    });

    // 座位操作限制
    this.addRule({
      name: 'seat_operations',
      pattern: /^\/api\/seats\/(book|release|select)/,
      config: {
        windowMs: 60 * 1000, // 1分钟
        maxRequests: 30,
        message: 'Too many seat operations'
      },
      priority: 20
    });

    // 数据查询限制
    this.addRule({
      name: 'data_query',
      pattern: /^\/api\/(floors|seats|users)$/,
      config: {
        windowMs: 60 * 1000, // 1分钟
        maxRequests: 100,
        message: 'Too many data queries'
      },
      priority: 50
    });
  }

  /**
   * 添加限制规则
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.name, rule);
    this.stats.ruleStats.set(rule.name, { requests: 0, blocks: 0 });
    
    this.logger.info('Rate limit rule added', {
      name: rule.name,
      pattern: rule.pattern.toString(),
      maxRequests: rule.config.maxRequests,
      windowMs: rule.config.windowMs
    });
  }

  /**
   * 移除限制规则
   */
  removeRule(name: string): void {
    this.rules.delete(name);
    this.stats.ruleStats.delete(name);
    
    this.logger.info('Rate limit rule removed', { name });
  }

  /**
   * 检查速率限制
   */
  async checkLimit(
    identifier: string,
    path: string,
    userAgent?: string
  ): Promise<RateLimitResult> {
    this.stats.totalRequests++;

    // 检查白名单
    if (this.whitelist.has(identifier)) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now() + 60000,
        totalHits: 0
      };
    }

    // 检查黑名单
    if (this.blacklist.has(identifier)) {
      this.stats.blockedRequests++;
      this.emit('rate_limit_exceeded', {
        identifier,
        path,
        reason: 'blacklisted',
        timestamp: Date.now()
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 24 * 60 * 60 * 1000, // 24小时
        totalHits: 0,
        retryAfter: 24 * 60 * 60
      };
    }

    // 查找匹配的规则
    const matchedRule = this.findMatchingRule(path);
    if (!matchedRule) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now() + 60000,
        totalHits: 0
      };
    }

    // 检查限制
    const result = await this.checkRuleLimit(identifier, matchedRule, userAgent);
    
    // 更新统计
    const ruleStats = this.stats.ruleStats.get(matchedRule.name);
    if (ruleStats) {
      ruleStats.requests++;
      if (!result.allowed) {
        ruleStats.blocks++;
      }
    }

    // 如果被限制，触发事件
    if (!result.allowed) {
      this.stats.blockedRequests++;
      this.emit('rate_limit_exceeded', {
        identifier,
        path,
        rule: matchedRule.name,
        remaining: result.remaining,
        resetTime: result.resetTime,
        timestamp: Date.now()
      });

      // 检查是否需要自动加入黑名单
      await this.checkAutoBlacklist(identifier, matchedRule);
    }

    return result;
  }

  /**
   * 检查规则限制
   */
  private async checkRuleLimit(
    identifier: string,
    rule: RateLimitRule,
    userAgent?: string
  ): Promise<RateLimitResult> {
    const key = this.generateKey(identifier, rule.name);
    const now = Date.now();
    const windowStart = now - rule.config.windowMs;

    try {
      // 首先检查内存缓存
      const cached = this.memoryCache.get(key);
      if (cached && cached.resetTime > now) {
        if (cached.count >= rule.config.maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetTime: cached.resetTime,
            totalHits: cached.count,
            retryAfter: Math.ceil((cached.resetTime - now) / 1000)
          };
        }
      }

      // 使用Redis进行精确计数
      const result = await this.redisCheckLimit(key, rule.config, now);
      
      // 更新内存缓存
      this.memoryCache.set(key, {
        count: result.totalHits,
        resetTime: result.resetTime,
        lastAccess: now
      });

      // 应用自适应限制
      const adaptiveResult = this.applyAdaptiveLimit(
        identifier,
        rule,
        result,
        userAgent
      );

      return adaptiveResult;

    } catch (error) {
      this.logger.error('Rate limit check failed', {
        identifier,
        rule: rule.name,
        error: (error as Error).message
      });

      // 降级到内存检查
      return this.memoryFallbackCheck(key, rule.config, now);
    }
  }

  /**
   * Redis速率限制检查
   */
  private async redisCheckLimit(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = now - config.windowMs;
    const resetTime = now + config.windowMs;

    // 使用Redis的滑动窗口算法
    const pipeline = this.redisClient.multi();
    
    // 移除过期的记录
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // 添加当前请求
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // 获取当前窗口内的请求数
    pipeline.zcard(key);
    
    // 设置过期时间
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    const totalHits = results[2][1] as number;

    const allowed = totalHits <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - totalHits);

    return {
      allowed,
      remaining,
      resetTime,
      totalHits,
      retryAfter: allowed ? undefined : Math.ceil(config.windowMs / 1000)
    };
  }

  /**
   * 内存降级检查
   */
  private memoryFallbackCheck(
    key: string,
    config: RateLimitConfig,
    now: number
  ): RateLimitResult {
    const cached = this.memoryCache.get(key);
    const resetTime = now + config.windowMs;

    if (!cached || cached.resetTime <= now) {
      // 新窗口
      this.memoryCache.set(key, {
        count: 1,
        resetTime,
        lastAccess: now
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        totalHits: 1
      };
    }

    // 现有窗口
    cached.count++;
    cached.lastAccess = now;

    const allowed = cached.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - cached.count);

    return {
      allowed,
      remaining,
      resetTime: cached.resetTime,
      totalHits: cached.count,
      retryAfter: allowed ? undefined : Math.ceil((cached.resetTime - now) / 1000)
    };
  }

  /**
   * 应用自适应限制
   */
  private applyAdaptiveLimit(
    identifier: string,
    rule: RateLimitRule,
    result: RateLimitResult,
    userAgent?: string
  ): RateLimitResult {
    const adaptiveKey = `${identifier}:${rule.name}`;
    let adaptive = this.adaptiveThresholds.get(adaptiveKey);

    if (!adaptive) {
      adaptive = {
        baseLimit: rule.config.maxRequests,
        currentLimit: rule.config.maxRequests,
        errorRate: 0,
        lastAdjustment: Date.now()
      };
      this.adaptiveThresholds.set(adaptiveKey, adaptive);
    }

    // 检测可疑行为模式
    const suspiciousScore = this.calculateSuspiciousScore(
      identifier,
      rule,
      userAgent
    );

    if (suspiciousScore > 0.7) {
      // 降低限制
      adaptive.currentLimit = Math.max(
        Math.floor(adaptive.baseLimit * 0.5),
        1
      );
      
      this.logger.warn('Adaptive rate limit applied', {
        identifier,
        rule: rule.name,
        suspiciousScore,
        newLimit: adaptive.currentLimit
      });
    } else if (suspiciousScore < 0.3 && adaptive.currentLimit < adaptive.baseLimit) {
      // 恢复限制
      adaptive.currentLimit = Math.min(
        adaptive.currentLimit + 1,
        adaptive.baseLimit
      );
    }

    // 应用调整后的限制
    if (result.totalHits > adaptive.currentLimit) {
      return {
        ...result,
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      };
    }

    return {
      ...result,
      remaining: Math.max(0, adaptive.currentLimit - result.totalHits)
    };
  }

  /**
   * 计算可疑行为评分
   */
  private calculateSuspiciousScore(
    identifier: string,
    rule: RateLimitRule,
    userAgent?: string
  ): number {
    let score = 0;

    // 检查请求频率
    const recentRequests = this.getRecentRequestCount(identifier, 60000); // 1分钟内
    if (recentRequests > rule.config.maxRequests * 2) {
      score += 0.3;
    }

    // 检查User-Agent
    if (!userAgent || this.isSuspiciousUserAgent(userAgent)) {
      score += 0.2;
    }

    // 检查IP地理位置变化（需要额外实现）
    // score += this.checkGeolocationChanges(identifier);

    // 检查请求模式
    if (this.hasUniformRequestPattern(identifier)) {
      score += 0.2;
    }

    // 检查错误率
    const errorRate = this.getErrorRate(identifier);
    if (errorRate > 0.5) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 检查是否需要自动加入黑名单
   */
  private async checkAutoBlacklist(
    identifier: string,
    rule: RateLimitRule
  ): Promise<void> {
    const key = `blacklist_check:${identifier}`;
    
    try {
      // 增加违规计数
      const violations = await this.redisClient.incr(key);
      await this.redisClient.expire(key, 3600); // 1小时过期

      // 如果违规次数过多，加入黑名单
      if (violations >= 10) {
        await this.addToBlacklist(identifier, 24 * 60 * 60 * 1000); // 24小时
        
        this.logger.warn('IP automatically blacklisted', {
          identifier,
          violations,
          rule: rule.name
        });

        this.emit('auto_blacklist', {
          identifier,
          violations,
          rule: rule.name,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error('Auto blacklist check failed', {
        identifier,
        error: (error as Error).message
      });
    }
  }

  /**
   * 查找匹配的规则
   */
  private findMatchingRule(path: string): RateLimitRule | null {
    const matchedRules: RateLimitRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.matchesPattern(path, rule.pattern)) {
        matchedRules.push(rule);
      }
    }

    // 按优先级排序，返回优先级最高的规则
    matchedRules.sort((a, b) => a.priority - b.priority);
    return matchedRules[0] || null;
  }

  /**
   * 检查路径是否匹配模式
   */
  private matchesPattern(path: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      // 支持通配符
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}$`).test(path);
    } else {
      return pattern.test(path);
    }
  }

  /**
   * 生成缓存键
   */
  private generateKey(identifier: string, ruleName: string): string {
    return `rate_limit:${ruleName}:${identifier}`;
  }

  /**
   * 添加到白名单
   */
  addToWhitelist(identifier: string): void {
    this.whitelist.add(identifier);
    this.logger.info('Added to whitelist', { identifier });
  }

  /**
   * 从白名单移除
   */
  removeFromWhitelist(identifier: string): void {
    this.whitelist.delete(identifier);
    this.logger.info('Removed from whitelist', { identifier });
  }

  /**
   * 添加到黑名单
   */
  async addToBlacklist(identifier: string, duration?: number): Promise<void> {
    this.blacklist.add(identifier);
    
    if (duration) {
      // 设置自动移除
      setTimeout(() => {
        this.blacklist.delete(identifier);
        this.logger.info('Automatically removed from blacklist', { identifier });
      }, duration);
    }

    // 同步到Redis
    try {
      await this.redisClient.sadd('rate_limit:blacklist', identifier);
      if (duration) {
        await this.redisClient.expire('rate_limit:blacklist', Math.ceil(duration / 1000));
      }
    } catch (error) {
      this.logger.error('Failed to sync blacklist to Redis', {
        identifier,
        error: (error as Error).message
      });
    }

    this.logger.warn('Added to blacklist', { identifier, duration });
  }

  /**
   * 从黑名单移除
   */
  async removeFromBlacklist(identifier: string): Promise<void> {
    this.blacklist.delete(identifier);
    
    try {
      await this.redisClient.srem('rate_limit:blacklist', identifier);
    } catch (error) {
      this.logger.error('Failed to remove from blacklist in Redis', {
        identifier,
        error: (error as Error).message
      });
    }

    this.logger.info('Removed from blacklist', { identifier });
  }

  /**
   * 获取最近请求数量
   */
  private getRecentRequestCount(identifier: string, timeWindow: number): number {
    // 这里应该查询Redis或内存缓存
    // 简化实现
    return 0;
  }

  /**
   * 检查是否为可疑User-Agent
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * 检查是否有统一的请求模式
   */
  private hasUniformRequestPattern(identifier: string): boolean {
    // 这里应该分析请求时间间隔的一致性
    // 简化实现
    return false;
  }

  /**
   * 获取错误率
   */
  private getErrorRate(identifier: string): number {
    // 这里应该计算最近的错误率
    // 简化实现
    return 0;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupMemoryCache();
      this.updateTopBlockedIPs();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 清理内存缓存
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.resetTime <= now || (now - cached.lastAccess) > 300000) { // 5分钟未访问
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
    }

    this.stats.activeWindows = this.memoryCache.size;
  }

  /**
   * 更新被阻止IP的排行榜
   */
  private updateTopBlockedIPs(): void {
    // 这里应该从Redis或数据库查询统计数据
    // 简化实现
    this.stats.topBlockedIPs = [];
  }

  /**
   * 获取统计信息
   */
  getStats(): RateLimitStats {
    return {
      ...this.stats,
      activeWindows: this.memoryCache.size
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.initializeStats();
    this.logger.info('Rate limiter stats reset');
  }

  /**
   * 获取规则列表
   */
  getRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down rate limiter');
    
    // 清理缓存
    this.memoryCache.clear();
    this.adaptiveThresholds.clear();
    this.blacklist.clear();
    this.whitelist.clear();
    
    this.logger.info('Rate limiter shutdown completed');
  }
}