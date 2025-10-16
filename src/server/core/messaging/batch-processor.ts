import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { WebSocketPoolManager } from '../websocket/manager';
import { RedisClient } from 'redis';

export interface BatchMessage {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  targetType: 'broadcast' | 'user' | 'group' | 'connection';
  targets: string[];
  payload: any;
  timestamp: number;
  expiresAt?: number;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface BatchConfig {
  maxBatchSize: number;
  batchTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  priorityQueues: boolean;
  enableCompression: boolean;
  enableDeduplication: boolean;
  maxQueueSize: number;
  processingConcurrency: number;
}

export interface BatchMetrics {
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  droppedMessages: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  queueSizes: Record<string, number>;
  compressionRatio: number;
  deduplicationHits: number;
  retryAttempts: number;
}

/**
 * 消息批处理器
 * 负责高效地批量处理和发送WebSocket消息
 */
export class MessageBatchProcessor extends EventEmitter {
  private logger: Logger;
  private wsManager: WebSocketPoolManager;
  private redisClient: RedisClient;
  private config: BatchConfig;
  private metrics: BatchMetrics;
  
  // 优先级队列
  private queues: Map<string, BatchMessage[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // 去重和压缩
  private messageHashes: Set<string> = new Set();
  private compressionCache: Map<string, any> = new Map();
  
  // 处理统计
  private batchSizes: number[] = [];
  private processingTimes: number[] = [];
  private maxHistorySize: number = 1000;
  
  private isShuttingDown: boolean = false;

  constructor(
    wsManager: WebSocketPoolManager,
    redisClient: RedisClient,
    logger: Logger,
    config?: Partial<BatchConfig>
  ) {
    super();
    this.wsManager = wsManager;
    this.redisClient = redisClient;
    this.logger = logger;
    this.config = {
      maxBatchSize: 100,
      batchTimeoutMs: 1000,
      maxRetries: 3,
      retryDelayMs: 1000,
      priorityQueues: true,
      enableCompression: true,
      enableDeduplication: true,
      maxQueueSize: 10000,
      processingConcurrency: 5,
      ...config
    };
    
    this.initializeMetrics();
    this.initializeQueues();
    this.startCleanupTimer();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalMessages: 0,
      processedMessages: 0,
      failedMessages: 0,
      droppedMessages: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      queueSizes: {},
      compressionRatio: 1.0,
      deduplicationHits: 0,
      retryAttempts: 0
    };
  }

  /**
   * 初始化队列
   */
  private initializeQueues(): void {
    const priorities = ['critical', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      this.queues.set(priority, []);
      this.processing.set(priority, false);
      this.metrics.queueSizes[priority] = 0;
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredMessages();
      this.cleanupDeduplicationCache();
      this.cleanupCompressionCache();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 添加消息到批处理队列
   */
  async addMessage(message: Omit<BatchMessage, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Batch processor is shutting down');
    }

    const batchMessage: BatchMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      retryCount: 0,
      ...message
    };

    // 去重检查
    if (this.config.enableDeduplication) {
      const messageHash = this.generateMessageHash(batchMessage);
      if (this.messageHashes.has(messageHash)) {
        this.metrics.deduplicationHits++;
        this.logger.debug('Duplicate message detected, skipping', {
          messageId: batchMessage.id,
          hash: messageHash
        });
        return batchMessage.id;
      }
      this.messageHashes.add(messageHash);
    }

    // 检查队列大小限制
    const queue = this.getQueue(batchMessage.priority);
    if (queue.length >= this.config.maxQueueSize) {
      this.metrics.droppedMessages++;
      this.logger.warn('Queue is full, dropping message', {
        priority: batchMessage.priority,
        queueSize: queue.length,
        messageId: batchMessage.id
      });
      throw new Error(`Queue for priority ${batchMessage.priority} is full`);
    }

    // 添加到队列
    queue.push(batchMessage);
    this.metrics.totalMessages++;
    this.metrics.queueSizes[batchMessage.priority] = queue.length;

    this.logger.debug('Message added to batch queue', {
      messageId: batchMessage.id,
      priority: batchMessage.priority,
      queueSize: queue.length
    });

    // 触发批处理
    this.scheduleBatchProcessing(batchMessage.priority);

    return batchMessage.id;
  }

  /**
   * 获取优先级队列
   */
  private getQueue(priority: string): BatchMessage[] {
    let queue = this.queues.get(priority);
    if (!queue) {
      queue = [];
      this.queues.set(priority, queue);
      this.processing.set(priority, false);
      this.metrics.queueSizes[priority] = 0;
    }
    return queue;
  }

  /**
   * 调度批处理
   */
  private scheduleBatchProcessing(priority: string): void {
    const queue = this.getQueue(priority);
    
    // 如果队列达到最大批处理大小，立即处理
    if (queue.length >= this.config.maxBatchSize) {
      this.processBatch(priority);
      return;
    }

    // 设置超时处理
    const existingTimer = this.batchTimers.get(priority);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.processBatch(priority);
    }, this.config.batchTimeoutMs);

    this.batchTimers.set(priority, timer);
  }

  /**
   * 处理批次
   */
  private async processBatch(priority: string): Promise<void> {
    if (this.processing.get(priority)) {
      return;
    }

    const queue = this.getQueue(priority);
    if (queue.length === 0) {
      return;
    }

    this.processing.set(priority, true);
    const startTime = Date.now();

    try {
      // 清除定时器
      const timer = this.batchTimers.get(priority);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(priority);
      }

      // 提取批次
      const batchSize = Math.min(queue.length, this.config.maxBatchSize);
      const batch = queue.splice(0, batchSize);
      this.metrics.queueSizes[priority] = queue.length;

      this.logger.debug('Processing batch', {
        priority,
        batchSize,
        remainingInQueue: queue.length
      });

      // 处理批次消息
      await this.processBatchMessages(batch);

      // 更新统计
      const processingTime = Date.now() - startTime;
      this.updateBatchStatistics(batchSize, processingTime);
      this.metrics.processedMessages += batchSize;

      this.logger.debug('Batch processed successfully', {
        priority,
        batchSize,
        processingTime
      });

    } catch (error) {
      this.logger.error('Batch processing failed', {
        priority,
        error: (error as Error).message
      });
    } finally {
      this.processing.set(priority, false);
      
      // 如果队列中还有消息，继续处理
      if (queue.length > 0) {
        this.scheduleBatchProcessing(priority);
      }
    }
  }

  /**
   * 处理批次消息
   */
  private async processBatchMessages(batch: BatchMessage[]): Promise<void> {
    // 按目标类型分组消息
    const groupedMessages = this.groupMessagesByTarget(batch);

    // 并发处理不同的目标组
    const processingPromises: Promise<void>[] = [];

    for (const [targetKey, messages] of groupedMessages.entries()) {
      const promise = this.processTargetGroup(targetKey, messages);
      processingPromises.push(promise);

      // 控制并发数
      if (processingPromises.length >= this.config.processingConcurrency) {
        await Promise.all(processingPromises);
        processingPromises.length = 0;
      }
    }

    // 等待剩余的处理完成
    if (processingPromises.length > 0) {
      await Promise.all(processingPromises);
    }
  }

  /**
   * 按目标分组消息
   */
  private groupMessagesByTarget(messages: BatchMessage[]): Map<string, BatchMessage[]> {
    const grouped = new Map<string, BatchMessage[]>();

    for (const message of messages) {
      let targetKey: string;

      switch (message.targetType) {
        case 'broadcast':
          targetKey = 'broadcast';
          break;
        case 'user':
          targetKey = `user:${message.targets.join(',')}`;
          break;
        case 'group':
          targetKey = `group:${message.targets.join(',')}`;
          break;
        case 'connection':
          targetKey = `connection:${message.targets.join(',')}`;
          break;
        default:
          targetKey = 'unknown';
      }

      if (!grouped.has(targetKey)) {
        grouped.set(targetKey, []);
      }
      grouped.get(targetKey)!.push(message);
    }

    return grouped;
  }

  /**
   * 处理目标组
   */
  private async processTargetGroup(targetKey: string, messages: BatchMessage[]): Promise<void> {
    try {
      // 压缩消息（如果启用）
      const processedMessages = this.config.enableCompression 
        ? await this.compressMessages(messages)
        : messages;

      // 根据目标类型发送消息
      if (targetKey === 'broadcast') {
        await this.processBroadcastMessages(processedMessages);
      } else if (targetKey.startsWith('user:')) {
        await this.processUserMessages(processedMessages);
      } else if (targetKey.startsWith('group:')) {
        await this.processGroupMessages(processedMessages);
      } else if (targetKey.startsWith('connection:')) {
        await this.processConnectionMessages(processedMessages);
      }

      this.logger.debug('Target group processed', {
        targetKey,
        messageCount: messages.length
      });

    } catch (error) {
      this.logger.error('Failed to process target group', {
        targetKey,
        messageCount: messages.length,
        error: (error as Error).message
      });

      // 重试失败的消息
      await this.retryFailedMessages(messages);
    }
  }

  /**
   * 处理广播消息
   */
  private async processBroadcastMessages(messages: BatchMessage[]): Promise<void> {
    for (const message of messages) {
      try {
        await this.wsManager.broadcast(message.payload);
      } catch (error) {
        this.logger.error('Failed to broadcast message', {
          messageId: message.id,
          error: (error as Error).message
        });
        throw error;
      }
    }
  }

  /**
   * 处理用户消息
   */
  private async processUserMessages(messages: BatchMessage[]): Promise<void> {
    for (const message of messages) {
      for (const userId of message.targets) {
        try {
          await this.wsManager.sendToUser(userId, message.payload);
        } catch (error) {
          this.logger.error('Failed to send message to user', {
            messageId: message.id,
            userId,
            error: (error as Error).message
          });
          throw error;
        }
      }
    }
  }

  /**
   * 处理组消息
   */
  private async processGroupMessages(messages: BatchMessage[]): Promise<void> {
    for (const message of messages) {
      for (const groupId of message.targets) {
        try {
          // 获取组成员
          const members = await this.getGroupMembers(groupId);
          
          // 发送给组成员
          for (const userId of members) {
            await this.wsManager.sendToUser(userId, message.payload);
          }
        } catch (error) {
          this.logger.error('Failed to send message to group', {
            messageId: message.id,
            groupId,
            error: (error as Error).message
          });
          throw error;
        }
      }
    }
  }

  /**
   * 处理连接消息
   */
  private async processConnectionMessages(messages: BatchMessage[]): Promise<void> {
    for (const message of messages) {
      for (const connectionId of message.targets) {
        try {
          await this.wsManager.sendToConnection(connectionId, message.payload);
        } catch (error) {
          this.logger.error('Failed to send message to connection', {
            messageId: message.id,
            connectionId,
            error: (error as Error).message
          });
          throw error;
        }
      }
    }
  }

  /**
   * 压缩消息
   */
  private async compressMessages(messages: BatchMessage[]): Promise<BatchMessage[]> {
    // 简单的压缩策略：合并相同类型和目标的消息
    const compressed = new Map<string, BatchMessage>();

    for (const message of messages) {
      const key = `${message.type}:${message.targetType}:${message.targets.join(',')}`;
      
      const existing = compressed.get(key);
      if (existing && this.canMergeMessages(existing, message)) {
        // 合并消息
        existing.payload = this.mergePayloads(existing.payload, message.payload);
        existing.timestamp = Math.max(existing.timestamp, message.timestamp);
      } else {
        compressed.set(key, { ...message });
      }
    }

    const result = Array.from(compressed.values());
    
    // 计算压缩比
    const originalSize = JSON.stringify(messages).length;
    const compressedSize = JSON.stringify(result).length;
    this.metrics.compressionRatio = compressedSize / originalSize;

    return result;
  }

  /**
   * 检查是否可以合并消息
   */
  private canMergeMessages(msg1: BatchMessage, msg2: BatchMessage): boolean {
    return msg1.type === msg2.type && 
           msg1.targetType === msg2.targetType &&
           JSON.stringify(msg1.targets) === JSON.stringify(msg2.targets) &&
           msg1.priority === msg2.priority;
  }

  /**
   * 合并消息载荷
   */
  private mergePayloads(payload1: any, payload2: any): any {
    if (Array.isArray(payload1) && Array.isArray(payload2)) {
      return [...payload1, ...payload2];
    }
    
    if (typeof payload1 === 'object' && typeof payload2 === 'object') {
      return { ...payload1, ...payload2 };
    }
    
    // 无法合并，返回最新的
    return payload2;
  }

  /**
   * 重试失败的消息
   */
  private async retryFailedMessages(messages: BatchMessage[]): Promise<void> {
    for (const message of messages) {
      if (message.retryCount < message.maxRetries) {
        message.retryCount++;
        this.metrics.retryAttempts++;
        
        // 延迟重试
        setTimeout(() => {
          const queue = this.getQueue(message.priority);
          queue.unshift(message); // 添加到队列前面，优先处理
          this.metrics.queueSizes[message.priority] = queue.length;
          this.scheduleBatchProcessing(message.priority);
        }, this.config.retryDelayMs * message.retryCount);

        this.logger.debug('Message scheduled for retry', {
          messageId: message.id,
          retryCount: message.retryCount,
          maxRetries: message.maxRetries
        });
      } else {
        this.metrics.failedMessages++;
        this.logger.error('Message failed after max retries', {
          messageId: message.id,
          retryCount: message.retryCount
        });

        // 触发失败事件
        this.emit('message_failed', message);
      }
    }
  }

  /**
   * 获取组成员
   */
  private async getGroupMembers(groupId: string): Promise<string[]> {
    try {
      // 从Redis缓存获取
      const cached = await this.redisClient.get(`group_members:${groupId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // 如果缓存不存在，返回空数组（实际应用中应该从数据库查询）
      this.logger.warn('Group members not found in cache', { groupId });
      return [];
    } catch (error) {
      this.logger.error('Failed to get group members', {
        groupId,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * 清理过期消息
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [priority, queue] of this.queues.entries()) {
      const originalLength = queue.length;
      
      // 过滤掉过期的消息
      const filtered = queue.filter(message => {
        if (message.expiresAt && message.expiresAt < now) {
          cleanedCount++;
          return false;
        }
        return true;
      });

      // 更新队列
      this.queues.set(priority, filtered);
      this.metrics.queueSizes[priority] = filtered.length;

      if (originalLength !== filtered.length) {
        this.logger.debug('Cleaned expired messages', {
          priority,
          removed: originalLength - filtered.length,
          remaining: filtered.length
        });
      }
    }

    if (cleanedCount > 0) {
      this.metrics.droppedMessages += cleanedCount;
      this.logger.info('Expired messages cleaned up', { count: cleanedCount });
    }
  }

  /**
   * 清理去重缓存
   */
  private cleanupDeduplicationCache(): void {
    // 简单策略：定期清空整个缓存
    if (this.messageHashes.size > 10000) {
      this.messageHashes.clear();
      this.logger.debug('Deduplication cache cleared');
    }
  }

  /**
   * 清理压缩缓存
   */
  private cleanupCompressionCache(): void {
    if (this.compressionCache.size > 1000) {
      this.compressionCache.clear();
      this.logger.debug('Compression cache cleared');
    }
  }

  /**
   * 更新批处理统计
   */
  private updateBatchStatistics(batchSize: number, processingTime: number): void {
    // 记录批处理大小
    this.batchSizes.push(batchSize);
    if (this.batchSizes.length > this.maxHistorySize) {
      this.batchSizes = this.batchSizes.slice(-this.maxHistorySize);
    }

    // 记录处理时间
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > this.maxHistorySize) {
      this.processingTimes = this.processingTimes.slice(-this.maxHistorySize);
    }

    // 计算平均值
    this.metrics.averageBatchSize = this.batchSizes.reduce((sum, size) => sum + size, 0) / this.batchSizes.length;
    this.metrics.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成消息哈希
   */
  private generateMessageHash(message: BatchMessage): string {
    const hashData = {
      type: message.type,
      targetType: message.targetType,
      targets: message.targets.sort(),
      payload: message.payload
    };
    
    return Buffer.from(JSON.stringify(hashData)).toString('base64');
  }

  /**
   * 获取批处理指标
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queues: Array<{
      priority: string;
      size: number;
      processing: boolean;
      hasTimer: boolean;
    }>;
    totalQueueSize: number;
    totalProcessing: number;
  } {
    const queues = Array.from(this.queues.entries()).map(([priority, queue]) => ({
      priority,
      size: queue.length,
      processing: this.processing.get(priority) || false,
      hasTimer: this.batchTimers.has(priority)
    }));

    const totalQueueSize = queues.reduce((sum, q) => sum + q.size, 0);
    const totalProcessing = queues.filter(q => q.processing).length;

    return {
      queues,
      totalQueueSize,
      totalProcessing
    };
  }

  /**
   * 强制处理所有队列
   */
  async flushAll(): Promise<void> {
    this.logger.info('Flushing all message queues');
    
    const priorities = Array.from(this.queues.keys());
    const flushPromises = priorities.map(priority => this.processBatch(priority));
    
    await Promise.all(flushPromises);
    
    this.logger.info('All message queues flushed');
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down message batch processor');

    // 清除所有定时器
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // 处理剩余的消息
    await this.flushAll();

    // 清理缓存
    this.messageHashes.clear();
    this.compressionCache.clear();

    this.logger.info('Message batch processor shutdown completed');
  }
}