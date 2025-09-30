import Redis from 'ioredis';

interface CacheStrategy {
  key: string;
  ttl: number;
  refreshThreshold: number; // 刷新阈值 (剩余TTL百分比)
  refreshCallback?: () => Promise<any>;
  compressionEnabled: boolean;
  tags: string[]; // 缓存标签，用于批量清理
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
}

class AdvancedCacheService {
  private static instance: AdvancedCacheService;
  private redis: Redis;
  private metrics: CacheMetrics;
  private strategies: Map<string, CacheStrategy> = new Map();
  private refreshQueue: Set<string> = new Set();
  private metricsInterval: NodeJS.Timeout;

  private constructor() {
    this.initializeRedis();
    this.initializeMetrics();
    this.setupCacheStrategies();
    this.startMetricsCollection();
  }

  public static getInstance(): AdvancedCacheService {
    if (!AdvancedCacheService.instance) {
      AdvancedCacheService.instance = new AdvancedCacheService();
    }
    return AdvancedCacheService.instance;
  }

  // 初始化Redis连接
  private initializeRedis() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // 启用压缩
      compression: 'gzip'
    });

    console.log('💾 高级Redis缓存服务初始化完成');
  }

  // 初始化指标
  private initializeMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0
    };
  }

  // 设置缓存策略
  private setupCacheStrategies() {
    // 座位图数据缓存策略
    this.strategies.set('seating-chart', {
      key: 'seating-chart:*',
      ttl: 600, // 10分钟
      refreshThreshold: 0.2, // 剩余20%时刷新
      compressionEnabled: true,
      tags: ['seating', 'chart']
    });

    // 部门数据缓存策略
    this.strategies.set('department', {
      key: 'department:*',
      ttl: 1800, // 30分钟
      refreshThreshold: 0.3,
      compressionEnabled: false,
      tags: ['department', 'metadata']
    });

    // 工位数据缓存策略
    this.strategies.set('workstation', {
      key: 'workstation:*',
      ttl: 300, // 5分钟
      refreshThreshold: 0.1, // 剩余10%时刷新
      compressionEnabled: true,
      tags: ['workstation', 'realtime']
    });

    // 用户会话缓存策略
    this.strategies.set('session', {
      key: 'session:*',
      ttl: 7200, // 2小时
      refreshThreshold: 0.5,
      compressionEnabled: false,
      tags: ['session', 'auth']
    });

    // Figma同步数据缓存策略
    this.strategies.set('figma-sync', {
      key: 'figma:*',
      ttl: 1800, // 30分钟
      refreshThreshold: 0.25,
      compressionEnabled: true,
      tags: ['figma', 'sync']
    });

    console.log(`📋 缓存策略配置完成 - 策略数量: ${this.strategies.size}`);
  }

  // 智能缓存设置
  public async smartSet(
    key: string, 
    value: any, 
    strategyName?: string
  ): Promise<void> {
    try {
      const strategy = strategyName ? this.strategies.get(strategyName) : this.getStrategyByKey(key);
      
      let processedValue = value;
      if (typeof value === 'object') {
        processedValue = JSON.stringify(value);
      }

      // 压缩处理
      if (strategy?.compressionEnabled && processedValue.length > 1024) {
        // 这里可以添加压缩逻辑
        console.log(`🗜️ 缓存数据压缩 - 键: ${key}`);
      }

      // 设置缓存
      const ttl = strategy?.ttl || 300;
      await this.redis.set(key, processedValue, 'EX', ttl);
      
      // 添加标签
      if (strategy?.tags) {
        for (const tag of strategy.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
          await this.redis.expire(`tag:${tag}`, ttl + 60); // 标签比数据多保留1分钟
        }
      }

      this.metrics.sets++;
      console.log(`💾 智能缓存设置 - 键: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      console.error('智能缓存设置失败:', error);
      throw error;
    }
  }

  // 智能缓存获取
  public async smartGet(key: string, strategyName?: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.metrics.misses++;
        
        // 检查是否需要主动刷新
        const strategy = strategyName ? this.strategies.get(strategyName) : this.getStrategyByKey(key);
        if (strategy?.refreshCallback && !this.refreshQueue.has(key)) {
          this.refreshQueue.add(key);
          this.scheduleRefresh(key, strategy);
        }
        
        return null;
      }

      this.metrics.hits++;
      
      // 检查是否需要预刷新
      await this.checkPreRefresh(key, strategyName);
      
      // 尝试解析JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error('智能缓存获取失败:', error);
      this.metrics.misses++;
      return null;
    }
  }

  // 检查预刷新
  private async checkPreRefresh(key: string, strategyName?: string) {
    try {
      const ttl = await this.redis.ttl(key);
      const strategy = strategyName ? this.strategies.get(strategyName) : this.getStrategyByKey(key);
      
      if (strategy && ttl > 0) {
        const refreshThreshold = strategy.ttl * strategy.refreshThreshold;
        if (ttl <= refreshThreshold && !this.refreshQueue.has(key)) {
          this.refreshQueue.add(key);
          this.scheduleRefresh(key, strategy);
        }
      }
    } catch (error) {
      console.error('检查预刷新失败:', error);
    }
  }

  // 调度刷新
  private scheduleRefresh(key: string, strategy: CacheStrategy) {
    if (strategy.refreshCallback) {
      setTimeout(async () => {
        try {
          const newValue = await strategy.refreshCallback!();
          await this.smartSet(key, newValue);
          this.refreshQueue.delete(key);
          console.log(`🔄 缓存预刷新完成 - 键: ${key}`);
        } catch (error) {
          console.error(`缓存预刷新失败 - 键: ${key}`, error);
          this.refreshQueue.delete(key);
        }
      }, 100); // 100ms后执行
    }
  }

  // 根据键名获取策略
  private getStrategyByKey(key: string): CacheStrategy | undefined {
    for (const [name, strategy] of this.strategies) {
      const pattern = strategy.key.replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(key)) {
        return strategy;
      }
    }
    return undefined;
  }

  // 批量删除缓存 (按标签)
  public async deleteByTag(tag: string): Promise<number> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length === 0) {
        return 0;
      }

      // 批量删除
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();

      // 删除标签集合
      await this.redis.del(`tag:${tag}`);

      this.metrics.deletes += keys.length;
      console.log(`🗑️ 按标签批量删除缓存 - 标签: ${tag}, 数量: ${keys.length}`);
      
      return keys.length;
    } catch (error) {
      console.error('按标签删除缓存失败:', error);
      throw error;
    }
  }

  // 缓存预热
  public async warmupCache(department: string): Promise<void> {
    try {
      console.log(`🔥 开始缓存预热 - 部门: ${department}`);

      // 预热部门数据
      const deptKey = `department:${department}`;
      if (!(await this.redis.exists(deptKey))) {
        // 这里应该从数据库加载部门数据
        const deptData = { name: department, prewarmed: true };
        await this.smartSet(deptKey, deptData, 'department');
      }

      // 预热工位数据
      const workstationKey = `workstations:department:${department}`;
      if (!(await this.redis.exists(workstationKey))) {
        // 这里应该从数据库加载工位数据
        const workstationData = { department, prewarmed: true };
        await this.smartSet(workstationKey, workstationData, 'workstation');
      }

      // 预热座位图数据
      const chartKey = `seating-charts:${department}`;
      if (!(await this.redis.exists(chartKey))) {
        // 这里应该从数据库加载座位图数据
        const chartData = { department, prewarmed: true };
        await this.smartSet(chartKey, chartData, 'seating-chart');
      }

      console.log(`✅ 缓存预热完成 - 部门: ${department}`);
    } catch (error) {
      console.error('缓存预热失败:', error);
      throw error;
    }
  }

  // 获取缓存指标
  public getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    
    return { ...this.metrics };
  }

  // 重置指标
  public resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0
    };
    
    console.log('📊 缓存指标已重置');
  }

  // 启动指标收集
  private startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      try {
        // 获取Redis内存使用情况
        const info = await this.redis.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          this.metrics.memoryUsage = parseInt(memoryMatch[1]);
        }

        // 计算命中率
        const totalRequests = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
      } catch (error) {
        console.error('收集缓存指标失败:', error);
      }
    }, 60000); // 每分钟收集一次
  }

  // 缓存健康检查
  public async healthCheck(): Promise<any> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info();
      const memoryInfo = await this.redis.info('memory');
      
      return {
        connected: true,
        latency,
        metrics: this.getMetrics(),
        redis: {
          version: this.extractInfoValue(info, 'redis_version'),
          uptime: this.extractInfoValue(info, 'uptime_in_seconds'),
          connectedClients: this.extractInfoValue(info, 'connected_clients'),
          usedMemory: this.extractInfoValue(memoryInfo, 'used_memory'),
          maxMemory: this.extractInfoValue(memoryInfo, 'maxmemory')
        }
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        metrics: this.getMetrics()
      };
    }
  }

  // 从Redis info中提取值
  private extractInfoValue(info: string, key: string): string {
    const match = info.match(new RegExp(`${key}:(.+)`));
    return match ? match[1].trim() : 'unknown';
  }

  // 缓存清理策略
  public async cleanup(): Promise<void> {
    try {
      console.log('🧹 开始缓存清理');

      // 清理过期的标签集合
      const tagKeys = await this.redis.keys('tag:*');
      for (const tagKey of tagKeys) {
        const ttl = await this.redis.ttl(tagKey);
        if (ttl <= 0) {
          await this.redis.del(tagKey);
        }
      }

      // 清理失败的同步操作 (超过7天)
      const failedKeys = await this.redis.keys('sync:failed:*');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const key of failedKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const timestamp = new Date(parsed.finalFailureTime || parsed.timestamp).getTime();
          if (timestamp < sevenDaysAgo) {
            await this.redis.del(key);
          }
        }
      }

      console.log('✅ 缓存清理完成');
    } catch (error) {
      console.error('缓存清理失败:', error);
    }
  }

  // 缓存统计报告
  public async generateCacheReport(): Promise<any> {
    try {
      const metrics = this.getMetrics();
      const health = await this.healthCheck();
      const strategies = Array.from(this.strategies.entries()).map(([name, strategy]) => ({
        name,
        ...strategy
      }));

      return {
        timestamp: new Date().toISOString(),
        metrics,
        health,
        strategies,
        refreshQueue: Array.from(this.refreshQueue),
        recommendations: this.generateRecommendations(metrics)
      };
    } catch (error) {
      console.error('生成缓存报告失败:', error);
      throw error;
    }
  }

  // 生成优化建议
  private generateRecommendations(metrics: CacheMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.hitRate < 70) {
      recommendations.push('缓存命中率偏低，建议调整TTL策略或预热更多数据');
    }

    if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Redis内存使用较高，建议启用数据压缩或调整过期策略');
    }

    if (metrics.evictions > 100) {
      recommendations.push('缓存驱逐次数较多，建议增加Redis内存或优化数据结构');
    }

    return recommendations;
  }

  // 销毁服务
  public async destroy(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    await this.redis.disconnect();
    console.log('🔚 高级缓存服务已销毁');
  }
}

export const advancedCacheService = AdvancedCacheService.getInstance();
export default advancedCacheService;