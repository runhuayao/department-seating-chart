import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { WebSocketPoolManager } from '../websocket/manager';
import { MessageBatchProcessor } from './batch-processor';
import { DatabaseConnectionPool } from '../database/connection-pool';
import { RedisClient } from 'redis';

export interface PushSubscription {
  id: string;
  userId: string;
  connectionId: string;
  topics: string[];
  filters: Record<string, any>;
  createdAt: number;
  lastActivity: number;
  isActive: boolean;
}

export interface PushMessage {
  topic: string;
  event: string;
  data: any;
  timestamp: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface PushFilter {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  value: any;
}

export interface PushMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  messagesSent: number;
  messagesFiltered: number;
  subscriptionsByTopic: Record<string, number>;
  averageLatency: number;
  errorRate: number;
}

/**
 * 实时数据推送服务
 * 负责管理订阅和实时推送数据变更
 */
export class RealTimePushService extends EventEmitter {
  private logger: Logger;
  private wsManager: WebSocketPoolManager;
  private batchProcessor: MessageBatchProcessor;
  private dbPool: DatabaseConnectionPool;
  private redisClient: RedisClient;
  
  // 订阅管理
  private subscriptions: Map<string, PushSubscription> = new Map();
  private topicSubscriptions: Map<string, Set<string>> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map();
  
  // 推送指标
  private metrics: PushMetrics;
  private latencyHistory: number[] = [];
  private errorCount: number = 0;
  private totalMessages: number = 0;
  
  // 配置
  private config = {
    maxSubscriptionsPerUser: 50,
    subscriptionTimeoutMs: 300000, // 5分钟
    batchSize: 100,
    maxLatencyHistory: 1000,
    enableFiltering: true,
    enableCompression: true
  };

  constructor(
    wsManager: WebSocketPoolManager,
    batchProcessor: MessageBatchProcessor,
    dbPool: DatabaseConnectionPool,
    redisClient: RedisClient,
    logger: Logger
  ) {
    super();
    this.wsManager = wsManager;
    this.batchProcessor = batchProcessor;
    this.dbPool = dbPool;
    this.redisClient = redisClient;
    this.logger = logger;
    
    this.initializeMetrics();
    this.setupEventHandlers();
    this.startCleanupTimer();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      messagesSent: 0,
      messagesFiltered: 0,
      subscriptionsByTopic: {},
      averageLatency: 0,
      errorRate: 0
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听WebSocket连接事件
    this.wsManager.on('connection_closed', (connectionId: string) => {
      this.handleConnectionClosed(connectionId);
    });

    // 监听数据库变更事件
    this.dbPool.on('data_change', (change: any) => {
      this.handleDataChange(change);
    });

    // 监听批处理器事件
    this.batchProcessor.on('message_failed', (message: any) => {
      this.handleMessageFailed(message);
    });
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupInactiveSubscriptions();
      this.updateMetrics();
    }, 60000); // 每分钟执行一次
  }

  /**
   * 创建订阅
   */
  async subscribe(
    userId: string,
    connectionId: string,
    topics: string[],
    filters?: Record<string, PushFilter[]>
  ): Promise<string> {
    // 检查用户订阅数量限制
    const userSubs = this.userSubscriptions.get(userId) || new Set();
    if (userSubs.size >= this.config.maxSubscriptionsPerUser) {
      throw new Error(`User ${userId} has reached maximum subscription limit`);
    }

    const subscription: PushSubscription = {
      id: this.generateSubscriptionId(),
      userId,
      connectionId,
      topics,
      filters: filters || {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true
    };

    // 存储订阅
    this.subscriptions.set(subscription.id, subscription);
    
    // 更新索引
    this.updateSubscriptionIndexes(subscription, 'add');
    
    // 缓存到Redis
    await this.cacheSubscription(subscription);

    this.logger.info('Subscription created', {
      subscriptionId: subscription.id,
      userId,
      connectionId,
      topics
    });

    this.emit('subscription_created', subscription);
    return subscription.id;
  }

  /**
   * 取消订阅
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn('Subscription not found for unsubscribe', { subscriptionId });
      return;
    }

    // 更新索引
    this.updateSubscriptionIndexes(subscription, 'remove');
    
    // 删除订阅
    this.subscriptions.delete(subscriptionId);
    
    // 从Redis删除
    await this.removeCachedSubscription(subscriptionId);

    this.logger.info('Subscription removed', {
      subscriptionId,
      userId: subscription.userId,
      topics: subscription.topics
    });

    this.emit('subscription_removed', subscription);
  }

  /**
   * 更新订阅索引
   */
  private updateSubscriptionIndexes(subscription: PushSubscription, action: 'add' | 'remove'): void {
    // 更新主题索引
    for (const topic of subscription.topics) {
      let topicSubs = this.topicSubscriptions.get(topic);
      if (!topicSubs) {
        topicSubs = new Set();
        this.topicSubscriptions.set(topic, topicSubs);
      }

      if (action === 'add') {
        topicSubs.add(subscription.id);
      } else {
        topicSubs.delete(subscription.id);
        if (topicSubs.size === 0) {
          this.topicSubscriptions.delete(topic);
        }
      }
    }

    // 更新用户索引
    let userSubs = this.userSubscriptions.get(subscription.userId);
    if (!userSubs) {
      userSubs = new Set();
      this.userSubscriptions.set(subscription.userId, userSubs);
    }

    if (action === 'add') {
      userSubs.add(subscription.id);
    } else {
      userSubs.delete(subscription.id);
      if (userSubs.size === 0) {
        this.userSubscriptions.delete(subscription.userId);
      }
    }
  }

  /**
   * 推送消息到主题
   */
  async pushToTopic(topic: string, message: Omit<PushMessage, 'topic' | 'timestamp'>): Promise<void> {
    const pushMessage: PushMessage = {
      topic,
      timestamp: Date.now(),
      ...message
    };

    const startTime = Date.now();

    try {
      // 获取主题订阅
      const subscriptionIds = this.topicSubscriptions.get(topic);
      if (!subscriptionIds || subscriptionIds.size === 0) {
        this.logger.debug('No subscriptions found for topic', { topic });
        return;
      }

      // 获取匹配的订阅
      const matchingSubscriptions = await this.getMatchingSubscriptions(
        Array.from(subscriptionIds),
        pushMessage
      );

      if (matchingSubscriptions.length === 0) {
        this.metrics.messagesFiltered++;
        this.logger.debug('No matching subscriptions after filtering', { topic });
        return;
      }

      // 批量发送消息
      await this.sendToSubscriptions(matchingSubscriptions, pushMessage);

      // 更新指标
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.metrics.messagesSent++;
      this.totalMessages++;

      this.logger.debug('Message pushed to topic', {
        topic,
        subscriptionCount: matchingSubscriptions.length,
        latency
      });

    } catch (error) {
      this.errorCount++;
      this.logger.error('Failed to push message to topic', {
        topic,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 推送消息给特定用户
   */
  async pushToUser(userId: string, message: Omit<PushMessage, 'timestamp'>): Promise<void> {
    const pushMessage: PushMessage = {
      timestamp: Date.now(),
      ...message
    };

    const startTime = Date.now();

    try {
      // 获取用户订阅
      const subscriptionIds = this.userSubscriptions.get(userId);
      if (!subscriptionIds || subscriptionIds.size === 0) {
        this.logger.debug('No subscriptions found for user', { userId });
        return;
      }

      // 过滤匹配主题的订阅
      const matchingSubscriptions = Array.from(subscriptionIds)
        .map(id => this.subscriptions.get(id))
        .filter(sub => sub && sub.isActive && sub.topics.includes(pushMessage.topic))
        .filter(Boolean) as PushSubscription[];

      if (matchingSubscriptions.length === 0) {
        this.logger.debug('No matching subscriptions for user', { userId, topic: pushMessage.topic });
        return;
      }

      // 应用过滤器
      const filteredSubscriptions = await this.applyFilters(matchingSubscriptions, pushMessage);

      // 发送消息
      await this.sendToSubscriptions(filteredSubscriptions, pushMessage);

      // 更新指标
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      this.metrics.messagesSent++;

      this.logger.debug('Message pushed to user', {
        userId,
        topic: pushMessage.topic,
        subscriptionCount: filteredSubscriptions.length,
        latency
      });

    } catch (error) {
      this.errorCount++;
      this.logger.error('Failed to push message to user', {
        userId,
        topic: pushMessage.topic,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 获取匹配的订阅
   */
  private async getMatchingSubscriptions(
    subscriptionIds: string[],
    message: PushMessage
  ): Promise<PushSubscription[]> {
    const subscriptions = subscriptionIds
      .map(id => this.subscriptions.get(id))
      .filter(sub => sub && sub.isActive)
      .filter(Boolean) as PushSubscription[];

    if (!this.config.enableFiltering) {
      return subscriptions;
    }

    return this.applyFilters(subscriptions, message);
  }

  /**
   * 应用过滤器
   */
  private async applyFilters(
    subscriptions: PushSubscription[],
    message: PushMessage
  ): Promise<PushSubscription[]> {
    const filtered: PushSubscription[] = [];

    for (const subscription of subscriptions) {
      try {
        if (await this.matchesFilters(subscription, message)) {
          filtered.push(subscription);
        } else {
          this.metrics.messagesFiltered++;
        }
      } catch (error) {
        this.logger.error('Error applying filters', {
          subscriptionId: subscription.id,
          error: (error as Error).message
        });
      }
    }

    return filtered;
  }

  /**
   * 检查消息是否匹配过滤器
   */
  private async matchesFilters(subscription: PushSubscription, message: PushMessage): Promise<boolean> {
    const filters = subscription.filters[message.topic];
    if (!filters || filters.length === 0) {
      return true;
    }

    for (const filter of filters) {
      if (!this.evaluateFilter(filter, message.data)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 评估单个过滤器
   */
  private evaluateFilter(filter: PushFilter, data: any): boolean {
    const fieldValue = this.getFieldValue(data, filter.field);
    
    switch (filter.operator) {
      case 'eq':
        return fieldValue === filter.value;
      case 'ne':
        return fieldValue !== filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'nin':
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      case 'gt':
        return fieldValue > filter.value;
      case 'gte':
        return fieldValue >= filter.value;
      case 'lt':
        return fieldValue < filter.value;
      case 'lte':
        return fieldValue <= filter.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(filter.value);
      case 'regex':
        return typeof fieldValue === 'string' && new RegExp(filter.value).test(fieldValue);
      default:
        return true;
    }
  }

  /**
   * 获取字段值（支持嵌套字段）
   */
  private getFieldValue(data: any, field: string): any {
    const parts = field.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 发送消息到订阅
   */
  private async sendToSubscriptions(
    subscriptions: PushSubscription[],
    message: PushMessage
  ): Promise<void> {
    // 按连接分组
    const connectionGroups = new Map<string, PushSubscription[]>();
    
    for (const subscription of subscriptions) {
      const connectionId = subscription.connectionId;
      if (!connectionGroups.has(connectionId)) {
        connectionGroups.set(connectionId, []);
      }
      connectionGroups.get(connectionId)!.push(subscription);
    }

    // 批量发送
    const sendPromises: Promise<void>[] = [];

    for (const [connectionId, subs] of connectionGroups.entries()) {
      const promise = this.sendToConnection(connectionId, subs, message);
      sendPromises.push(promise);
    }

    await Promise.all(sendPromises);

    // 更新订阅活动时间
    for (const subscription of subscriptions) {
      subscription.lastActivity = Date.now();
    }
  }

  /**
   * 发送消息到连接
   */
  private async sendToConnection(
    connectionId: string,
    subscriptions: PushSubscription[],
    message: PushMessage
  ): Promise<void> {
    try {
      // 构造消息载荷
      const payload = {
        type: 'push',
        topic: message.topic,
        event: message.event,
        data: message.data,
        timestamp: message.timestamp,
        source: message.source,
        subscriptions: subscriptions.map(sub => sub.id),
        metadata: message.metadata
      };

      // 通过批处理器发送
      await this.batchProcessor.addMessage({
        type: 'push_message',
        priority: 'normal',
        targetType: 'connection',
        targets: [connectionId],
        payload,
        maxRetries: 3
      });

    } catch (error) {
      this.logger.error('Failed to send message to connection', {
        connectionId,
        subscriptionCount: subscriptions.length,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 处理连接关闭
   */
  private async handleConnectionClosed(connectionId: string): Promise<void> {
    const subscriptionsToRemove: string[] = [];

    // 找到该连接的所有订阅
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.connectionId === connectionId) {
        subscriptionsToRemove.push(id);
      }
    }

    // 移除订阅
    for (const subscriptionId of subscriptionsToRemove) {
      await this.unsubscribe(subscriptionId);
    }

    this.logger.info('Removed subscriptions for closed connection', {
      connectionId,
      removedCount: subscriptionsToRemove.length
    });
  }

  /**
   * 处理数据变更
   */
  private async handleDataChange(change: any): Promise<void> {
    try {
      // 根据变更类型确定主题
      const topic = this.getTopicFromChange(change);
      if (!topic) {
        return;
      }

      // 构造推送消息
      const message: Omit<PushMessage, 'topic' | 'timestamp'> = {
        event: change.operation || 'change',
        data: change.data || change,
        source: 'database',
        metadata: {
          table: change.table,
          operation: change.operation,
          timestamp: change.timestamp
        }
      };

      // 推送到主题
      await this.pushToTopic(topic, message);

    } catch (error) {
      this.logger.error('Failed to handle data change', {
        change,
        error: (error as Error).message
      });
    }
  }

  /**
   * 从数据变更获取主题
   */
  private getTopicFromChange(change: any): string | null {
    // 根据表名和操作类型映射到主题
    const topicMap: Record<string, string> = {
      'seats': 'seat_changes',
      'floors': 'floor_changes',
      'users': 'user_changes',
      'bookings': 'booking_changes'
    };

    return topicMap[change.table] || null;
  }

  /**
   * 处理消息发送失败
   */
  private handleMessageFailed(message: any): void {
    this.logger.error('Push message failed after retries', {
      messageId: message.id,
      type: message.type,
      targets: message.targets
    });

    this.emit('push_failed', message);
  }

  /**
   * 清理不活跃的订阅
   */
  private cleanupInactiveSubscriptions(): void {
    const now = Date.now();
    const timeout = this.config.subscriptionTimeoutMs;
    const toRemove: string[] = [];

    for (const [id, subscription] of this.subscriptions.entries()) {
      if (now - subscription.lastActivity > timeout) {
        toRemove.push(id);
      }
    }

    // 异步移除过期订阅
    for (const subscriptionId of toRemove) {
      this.unsubscribe(subscriptionId).catch(error => {
        this.logger.error('Failed to remove inactive subscription', {
          subscriptionId,
          error: error.message
        });
      });
    }

    if (toRemove.length > 0) {
      this.logger.info('Cleaned up inactive subscriptions', {
        count: toRemove.length
      });
    }
  }

  /**
   * 更新延迟指标
   */
  private updateLatencyMetrics(latency: number): void {
    this.latencyHistory.push(latency);
    
    if (this.latencyHistory.length > this.config.maxLatencyHistory) {
      this.latencyHistory = this.latencyHistory.slice(-this.config.maxLatencyHistory);
    }

    this.metrics.averageLatency = this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    this.metrics.totalSubscriptions = this.subscriptions.size;
    this.metrics.activeSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.isActive).length;

    // 按主题统计订阅数
    this.metrics.subscriptionsByTopic = {};
    for (const [topic, subscriptionIds] of this.topicSubscriptions.entries()) {
      this.metrics.subscriptionsByTopic[topic] = subscriptionIds.size;
    }

    // 计算错误率
    this.metrics.errorRate = this.totalMessages > 0 ? this.errorCount / this.totalMessages : 0;
  }

  /**
   * 缓存订阅到Redis
   */
  private async cacheSubscription(subscription: PushSubscription): Promise<void> {
    try {
      const key = `subscription:${subscription.id}`;
      const value = JSON.stringify(subscription);
      await this.redisClient.setex(key, 3600, value); // 1小时过期
    } catch (error) {
      this.logger.error('Failed to cache subscription', {
        subscriptionId: subscription.id,
        error: (error as Error).message
      });
    }
  }

  /**
   * 从Redis删除缓存的订阅
   */
  private async removeCachedSubscription(subscriptionId: string): Promise<void> {
    try {
      const key = `subscription:${subscriptionId}`;
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error('Failed to remove cached subscription', {
        subscriptionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * 生成订阅ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取推送指标
   */
  getMetrics(): PushMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 获取订阅状态
   */
  getSubscriptionStatus(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    subscriptionsByTopic: Record<string, number>;
    subscriptionsByUser: Record<string, number>;
  } {
    const subscriptionsByUser: Record<string, number> = {};
    
    for (const [userId, subscriptionIds] of this.userSubscriptions.entries()) {
      subscriptionsByUser[userId] = subscriptionIds.size;
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length,
      subscriptionsByTopic: { ...this.metrics.subscriptionsByTopic },
      subscriptionsByUser
    };
  }

  /**
   * 获取用户订阅
   */
  getUserSubscriptions(userId: string): PushSubscription[] {
    const subscriptionIds = this.userSubscriptions.get(userId);
    if (!subscriptionIds) {
      return [];
    }

    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter(Boolean) as PushSubscription[];
  }

  /**
   * 获取主题订阅
   */
  getTopicSubscriptions(topic: string): PushSubscription[] {
    const subscriptionIds = this.topicSubscriptions.get(topic);
    if (!subscriptionIds) {
      return [];
    }

    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter(Boolean) as PushSubscription[];
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down real-time push service');

    // 移除所有订阅
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const subscriptionId of subscriptionIds) {
      await this.unsubscribe(subscriptionId);
    }

    // 清理缓存
    this.subscriptions.clear();
    this.topicSubscriptions.clear();
    this.userSubscriptions.clear();

    this.logger.info('Real-time push service shutdown completed');
  }
}