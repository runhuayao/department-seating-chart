import { EventEmitter } from 'events';
import { Logger } from '../../infrastructure/logging/logger';
import { DatabaseConnectionPool } from '../database/connection-pool';
import { WebSocketPoolManager } from '../websocket/manager';
import { RedisClient } from 'redis';

export interface SyncEvent {
  id: string;
  type: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  userId?: string;
  timestamp: number;
  version: number;
}

export interface SyncConfig {
  batchSize: number;
  batchInterval: number;
  retryAttempts: number;
  retryDelay: number;
  enableCompression: boolean;
  enableDeduplication: boolean;
  maxQueueSize: number;
  syncTimeout: number;
}

export interface SyncMetrics {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  queueSize: number;
  averageProcessingTime: number;
  lastSyncTime: number;
  syncErrors: number;
  duplicateEvents: number;
  compressionRatio: number;
}

/**
 * 实时数据同步服务
 * 负责在WebSocket客户端和PostgreSQL数据库之间同步数据
 */
export class RealTimeDataSyncService extends EventEmitter {
  private logger: Logger;
  private dbPool: DatabaseConnectionPool;
  private wsManager: WebSocketPoolManager;
  private redisClient: RedisClient;
  private config: SyncConfig;
  private metrics: SyncMetrics;
  private eventQueue: SyncEvent[] = [];
  private processingQueue: boolean = false;
  private batchTimer?: NodeJS.Timeout;
  private syncSubscriptions: Map<string, Set<string>> = new Map(); // entity -> connectionIds
  private eventDeduplication: Map<string, number> = new Map(); // eventId -> timestamp
  private isShuttingDown: boolean = false;

  constructor(
    dbPool: DatabaseConnectionPool,
    wsManager: WebSocketPoolManager,
    redisClient: RedisClient,
    logger: Logger,
    config?: Partial<SyncConfig>
  ) {
    super();
    this.dbPool = dbPool;
    this.wsManager = wsManager;
    this.redisClient = redisClient;
    this.logger = logger;
    this.config = {
      batchSize: 100,
      batchInterval: 1000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCompression: true,
      enableDeduplication: true,
      maxQueueSize: 10000,
      syncTimeout: 30000,
      ...config
    };
    this.initializeMetrics();
    this.setupEventHandlers();
    this.startBatchProcessor();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      queueSize: 0,
      averageProcessingTime: 0,
      lastSyncTime: 0,
      syncErrors: 0,
      duplicateEvents: 0,
      compressionRatio: 1.0
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听数据库变更事件
    this.dbPool.on('data_change', (event: any) => {
      this.handleDatabaseChange(event);
    });

    // 监听WebSocket消息事件
    this.wsManager.on('client_message', (connectionId: string, message: any) => {
      this.handleClientMessage(connectionId, message);
    });

    // 监听WebSocket连接事件
    this.wsManager.on('connection_established', (connectionId: string) => {
      this.handleConnectionEstablished(connectionId);
    });

    // 监听WebSocket断开事件
    this.wsManager.on('connection_closed', (connectionId: string) => {
      this.handleConnectionClosed(connectionId);
    });
  }

  /**
   * 启动批处理器
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      if (!this.processingQueue && this.eventQueue.length > 0) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * 处理数据库变更事件
   */
  private async handleDatabaseChange(event: any): Promise<void> {
    try {
      const syncEvent: SyncEvent = {
        id: this.generateEventId(),
        type: 'database_change',
        entity: event.table,
        operation: event.operation,
        data: event.data,
        timestamp: Date.now(),
        version: event.version || 1
      };

      await this.queueEvent(syncEvent);
      
      this.logger.debug('Database change event queued', {
        eventId: syncEvent.id,
        entity: syncEvent.entity,
        operation: syncEvent.operation
      });
    } catch (error) {
      this.logger.error('Failed to handle database change', {
        error: (error as Error).message,
        event
      });
    }
  }

  /**
   * 处理客户端消息
   */
  private async handleClientMessage(connectionId: string, message: any): Promise<void> {
    try {
      const connection = this.wsManager.getConnection(connectionId);
      if (!connection) {
        this.logger.warn('Connection not found for message', { connectionId });
        return;
      }

      const syncEvent: SyncEvent = {
        id: this.generateEventId(),
        type: 'client_message',
        entity: message.entity || 'unknown',
        operation: message.operation || 'update',
        data: message.data,
        userId: connection.getUserId() || undefined,
        timestamp: Date.now(),
        version: message.version || 1
      };

      // 根据消息类型进行不同处理
      switch (message.type) {
        case 'seat_select':
          await this.handleSeatSelection(syncEvent, connectionId);
          break;
        
        case 'seat_release':
          await this.handleSeatRelease(syncEvent, connectionId);
          break;
        
        case 'floor_change':
          await this.handleFloorChange(syncEvent, connectionId);
          break;
        
        case 'subscribe':
          await this.handleSubscription(syncEvent, connectionId);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscription(syncEvent, connectionId);
          break;
        
        default:
          await this.queueEvent(syncEvent);
      }

      this.logger.debug('Client message processed', {
        connectionId,
        messageType: message.type,
        eventId: syncEvent.id
      });
    } catch (error) {
      this.logger.error('Failed to handle client message', {
        error: (error as Error).message,
        connectionId,
        message
      });
    }
  }

  /**
   * 处理座位选择
   */
  private async handleSeatSelection(event: SyncEvent, connectionId: string): Promise<void> {
    const { seatId, floorId } = event.data;
    
    try {
      // 检查座位是否可用
      const seatStatus = await this.checkSeatAvailability(seatId);
      
      if (!seatStatus.available) {
        // 发送座位不可用消息
        await this.wsManager.sendToConnection(connectionId, {
          type: 'seat_selection_failed',
          data: {
            seatId,
            reason: 'seat_occupied',
            occupiedBy: seatStatus.occupiedBy
          }
        });
        return;
      }

      // 使用Redis锁确保原子性
      const lockKey = `seat_lock:${seatId}`;
      const lockResult = await this.redisClient.set(lockKey, connectionId, 'PX', 30000, 'NX');
      
      if (!lockResult) {
        // 获取锁失败，座位被其他用户选择
        await this.wsManager.sendToConnection(connectionId, {
          type: 'seat_selection_failed',
          data: {
            seatId,
            reason: 'seat_locked'
          }
        });
        return;
      }

      try {
        // 更新数据库
        await this.dbPool.transaction(async (client) => {
          await client.query(
            'UPDATE seats SET status = $1, occupied_by = $2, occupied_at = NOW() WHERE id = $3',
            ['occupied', event.userId, seatId]
          );
          
          // 记录座位选择历史
          await client.query(
            'INSERT INTO seat_history (seat_id, user_id, action, timestamp) VALUES ($1, $2, $3, NOW())',
            [seatId, event.userId, 'select']
          );
        });

        // 广播座位状态变更
        await this.broadcastSeatUpdate(seatId, {
          status: 'occupied',
          occupiedBy: event.userId,
          occupiedAt: new Date().toISOString()
        });

        // 发送成功确认
        await this.wsManager.sendToConnection(connectionId, {
          type: 'seat_selection_success',
          data: {
            seatId,
            floorId
          }
        });

        this.logger.info('Seat selection completed', {
          seatId,
          userId: event.userId,
          connectionId
        });
      } finally {
        // 释放Redis锁
        await this.redisClient.del(lockKey);
      }
    } catch (error) {
      this.logger.error('Seat selection failed', {
        error: (error as Error).message,
        seatId,
        userId: event.userId
      });

      await this.wsManager.sendToConnection(connectionId, {
        type: 'seat_selection_failed',
        data: {
          seatId,
          reason: 'server_error',
          error: (error as Error).message
        }
      });
    }
  }

  /**
   * 处理座位释放
   */
  private async handleSeatRelease(event: SyncEvent, connectionId: string): Promise<void> {
    const { seatId } = event.data;
    
    try {
      // 验证用户是否有权限释放该座位
      const seatInfo = await this.dbPool.query(
        'SELECT occupied_by FROM seats WHERE id = $1',
        [seatId]
      );

      if (seatInfo.rows.length === 0) {
        await this.wsManager.sendToConnection(connectionId, {
          type: 'seat_release_failed',
          data: {
            seatId,
            reason: 'seat_not_found'
          }
        });
        return;
      }

      const occupiedBy = seatInfo.rows[0].occupied_by;
      if (occupiedBy !== event.userId) {
        await this.wsManager.sendToConnection(connectionId, {
          type: 'seat_release_failed',
          data: {
            seatId,
            reason: 'permission_denied'
          }
        });
        return;
      }

      // 更新数据库
      await this.dbPool.transaction(async (client) => {
        await client.query(
          'UPDATE seats SET status = $1, occupied_by = NULL, occupied_at = NULL WHERE id = $2',
          ['available', seatId]
        );
        
        // 记录座位释放历史
        await client.query(
          'INSERT INTO seat_history (seat_id, user_id, action, timestamp) VALUES ($1, $2, $3, NOW())',
          [seatId, event.userId, 'release']
        );
      });

      // 广播座位状态变更
      await this.broadcastSeatUpdate(seatId, {
        status: 'available',
        occupiedBy: null,
        occupiedAt: null
      });

      // 发送成功确认
      await this.wsManager.sendToConnection(connectionId, {
        type: 'seat_release_success',
        data: { seatId }
      });

      this.logger.info('Seat release completed', {
        seatId,
        userId: event.userId,
        connectionId
      });
    } catch (error) {
      this.logger.error('Seat release failed', {
        error: (error as Error).message,
        seatId,
        userId: event.userId
      });

      await this.wsManager.sendToConnection(connectionId, {
        type: 'seat_release_failed',
        data: {
          seatId,
          reason: 'server_error',
          error: (error as Error).message
        }
      });
    }
  }

  /**
   * 处理楼层切换
   */
  private async handleFloorChange(event: SyncEvent, connectionId: string): Promise<void> {
    const { floorId } = event.data;
    
    try {
      // 获取楼层信息和座位数据
      const floorData = await this.getFloorData(floorId);
      
      // 发送楼层数据
      await this.wsManager.sendToConnection(connectionId, {
        type: 'floor_data',
        data: floorData
      });

      // 订阅楼层更新
      await this.subscribeToEntity(connectionId, `floor:${floorId}`);

      this.logger.info('Floor change completed', {
        floorId,
        connectionId,
        seatCount: floorData.seats?.length || 0
      });
    } catch (error) {
      this.logger.error('Floor change failed', {
        error: (error as Error).message,
        floorId,
        connectionId
      });

      await this.wsManager.sendToConnection(connectionId, {
        type: 'floor_change_failed',
        data: {
          floorId,
          reason: 'server_error',
          error: (error as Error).message
        }
      });
    }
  }

  /**
   * 处理订阅
   */
  private async handleSubscription(event: SyncEvent, connectionId: string): Promise<void> {
    const { entity } = event.data;
    await this.subscribeToEntity(connectionId, entity);
    
    this.logger.debug('Subscription added', {
      connectionId,
      entity
    });
  }

  /**
   * 处理取消订阅
   */
  private async handleUnsubscription(event: SyncEvent, connectionId: string): Promise<void> {
    const { entity } = event.data;
    await this.unsubscribeFromEntity(connectionId, entity);
    
    this.logger.debug('Subscription removed', {
      connectionId,
      entity
    });
  }

  /**
   * 处理连接建立
   */
  private async handleConnectionEstablished(connectionId: string): Promise<void> {
    this.logger.debug('Connection established for sync service', { connectionId });
    
    // 发送初始状态数据
    try {
      const initialData = await this.getInitialData();
      await this.wsManager.sendToConnection(connectionId, {
        type: 'initial_data',
        data: initialData
      });
    } catch (error) {
      this.logger.error('Failed to send initial data', {
        error: (error as Error).message,
        connectionId
      });
    }
  }

  /**
   * 处理连接关闭
   */
  private async handleConnectionClosed(connectionId: string): Promise<void> {
    // 清理订阅
    for (const [entity, connections] of this.syncSubscriptions.entries()) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.syncSubscriptions.delete(entity);
      }
    }

    this.logger.debug('Connection closed, subscriptions cleaned', { connectionId });
  }

  /**
   * 队列事件
   */
  private async queueEvent(event: SyncEvent): Promise<void> {
    // 检查队列大小
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.logger.warn('Event queue is full, dropping oldest events');
      this.eventQueue = this.eventQueue.slice(-this.config.maxQueueSize + 1);
    }

    // 去重检查
    if (this.config.enableDeduplication) {
      const existingTimestamp = this.eventDeduplication.get(event.id);
      if (existingTimestamp && (Date.now() - existingTimestamp) < 60000) {
        this.metrics.duplicateEvents++;
        this.logger.debug('Duplicate event detected, skipping', { eventId: event.id });
        return;
      }
      this.eventDeduplication.set(event.id, event.timestamp);
    }

    this.eventQueue.push(event);
    this.metrics.totalEvents++;
    this.metrics.queueSize = this.eventQueue.length;

    // 如果队列达到批处理大小，立即处理
    if (this.eventQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * 处理批次
   */
  private async processBatch(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    const startTime = Date.now();

    try {
      const batch = this.eventQueue.splice(0, this.config.batchSize);
      this.metrics.queueSize = this.eventQueue.length;

      await this.processBatchEvents(batch);
      
      this.metrics.processedEvents += batch.length;
      this.metrics.lastSyncTime = Date.now();
      
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      this.logger.debug('Batch processed successfully', {
        batchSize: batch.length,
        processingTime,
        queueSize: this.eventQueue.length
      });
    } catch (error) {
      this.metrics.syncErrors++;
      this.logger.error('Batch processing failed', {
        error: (error as Error).message,
        queueSize: this.eventQueue.length
      });
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * 处理批次事件
   */
  private async processBatchEvents(events: SyncEvent[]): Promise<void> {
    const groupedEvents = this.groupEventsByEntity(events);

    for (const [entity, entityEvents] of groupedEvents.entries()) {
      try {
        await this.processEntityEvents(entity, entityEvents);
      } catch (error) {
        this.metrics.failedEvents += entityEvents.length;
        this.logger.error('Failed to process entity events', {
          entity,
          eventCount: entityEvents.length,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * 按实体分组事件
   */
  private groupEventsByEntity(events: SyncEvent[]): Map<string, SyncEvent[]> {
    const grouped = new Map<string, SyncEvent[]>();
    
    for (const event of events) {
      const key = event.entity;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }
    
    return grouped;
  }

  /**
   * 处理实体事件
   */
  private async processEntityEvents(entity: string, events: SyncEvent[]): Promise<void> {
    const subscribers = this.syncSubscriptions.get(entity);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // 压缩事件数据
    const compressedData = this.config.enableCompression 
      ? await this.compressEvents(events)
      : events;

    // 广播给订阅者
    const message = {
      type: 'sync_update',
      entity,
      events: compressedData,
      timestamp: Date.now()
    };

    for (const connectionId of subscribers) {
      try {
        await this.wsManager.sendToConnection(connectionId, message);
      } catch (error) {
        this.logger.error('Failed to send sync update', {
          connectionId,
          entity,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * 压缩事件数据
   */
  private async compressEvents(events: SyncEvent[]): Promise<any> {
    // 简单的压缩策略：合并相同实体的连续更新
    const compressed: SyncEvent[] = [];
    const entityMap = new Map<string, SyncEvent>();

    for (const event of events) {
      const key = `${event.entity}:${event.data?.id || 'unknown'}`;
      
      if (event.operation === 'delete') {
        // 删除操作总是保留
        compressed.push(event);
        entityMap.delete(key);
      } else {
        // 更新操作可以合并
        const existing = entityMap.get(key);
        if (existing) {
          // 合并数据
          existing.data = { ...existing.data, ...event.data };
          existing.timestamp = event.timestamp;
          existing.version = Math.max(existing.version, event.version);
        } else {
          entityMap.set(key, event);
          compressed.push(event);
        }
      }
    }

    const originalSize = JSON.stringify(events).length;
    const compressedSize = JSON.stringify(compressed).length;
    this.metrics.compressionRatio = compressedSize / originalSize;

    return compressed;
  }

  /**
   * 订阅实体
   */
  private async subscribeToEntity(connectionId: string, entity: string): Promise<void> {
    if (!this.syncSubscriptions.has(entity)) {
      this.syncSubscriptions.set(entity, new Set());
    }
    this.syncSubscriptions.get(entity)!.add(connectionId);
  }

  /**
   * 取消订阅实体
   */
  private async unsubscribeFromEntity(connectionId: string, entity: string): Promise<void> {
    const subscribers = this.syncSubscriptions.get(entity);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.syncSubscriptions.delete(entity);
      }
    }
  }

  /**
   * 广播座位更新
   */
  private async broadcastSeatUpdate(seatId: string, data: any): Promise<void> {
    const message = {
      type: 'seat_update',
      data: {
        seatId,
        ...data
      }
    };

    // 广播给所有相关订阅者
    const entities = [`seat:${seatId}`, 'seats', 'floor:*'];
    
    for (const entity of entities) {
      const subscribers = this.syncSubscriptions.get(entity);
      if (subscribers) {
        for (const connectionId of subscribers) {
          try {
            await this.wsManager.sendToConnection(connectionId, message);
          } catch (error) {
            this.logger.error('Failed to broadcast seat update', {
              connectionId,
              seatId,
              error: (error as Error).message
            });
          }
        }
      }
    }
  }

  /**
   * 检查座位可用性
   */
  private async checkSeatAvailability(seatId: string): Promise<{
    available: boolean;
    occupiedBy?: string;
    occupiedAt?: Date;
  }> {
    const result = await this.dbPool.query(
      'SELECT status, occupied_by, occupied_at FROM seats WHERE id = $1',
      [seatId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Seat ${seatId} not found`);
    }

    const seat = result.rows[0];
    return {
      available: seat.status === 'available',
      occupiedBy: seat.occupied_by,
      occupiedAt: seat.occupied_at
    };
  }

  /**
   * 获取楼层数据
   */
  private async getFloorData(floorId: string): Promise<any> {
    const floorResult = await this.dbPool.query(
      'SELECT * FROM floors WHERE id = $1',
      [floorId]
    );

    if (floorResult.rows.length === 0) {
      throw new Error(`Floor ${floorId} not found`);
    }

    const seatsResult = await this.dbPool.query(
      'SELECT * FROM seats WHERE floor_id = $1 ORDER BY position_x, position_y',
      [floorId]
    );

    return {
      floor: floorResult.rows[0],
      seats: seatsResult.rows
    };
  }

  /**
   * 获取初始数据
   */
  private async getInitialData(): Promise<any> {
    const floorsResult = await this.dbPool.query('SELECT * FROM floors ORDER BY name');
    const seatsResult = await this.dbPool.query('SELECT * FROM seats ORDER BY floor_id, position_x, position_y');

    return {
      floors: floorsResult.rows,
      seats: seatsResult.rows,
      timestamp: Date.now()
    };
  }

  /**
   * 更新平均处理时间
   */
  private updateAverageProcessingTime(processingTime: number): void {
    if (this.metrics.averageProcessingTime === 0) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      // 使用指数移动平均
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
    }
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取同步指标
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取订阅统计
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    entitiesBySubscriberCount: Array<{ entity: string; subscribers: number }>;
    connectionsBySubscriptionCount: Array<{ connectionId: string; subscriptions: number }>;
  } {
    const entitiesBySubscriberCount = Array.from(this.syncSubscriptions.entries())
      .map(([entity, subscribers]) => ({ entity, subscribers: subscribers.size }))
      .sort((a, b) => b.subscribers - a.subscribers);

    const connectionSubscriptions = new Map<string, number>();
    for (const subscribers of this.syncSubscriptions.values()) {
      for (const connectionId of subscribers) {
        connectionSubscriptions.set(
          connectionId,
          (connectionSubscriptions.get(connectionId) || 0) + 1
        );
      }
    }

    const connectionsBySubscriptionCount = Array.from(connectionSubscriptions.entries())
      .map(([connectionId, subscriptions]) => ({ connectionId, subscriptions }))
      .sort((a, b) => b.subscriptions - a.subscriptions);

    return {
      totalSubscriptions: Array.from(this.syncSubscriptions.values())
        .reduce((sum, subscribers) => sum + subscribers.size, 0),
      entitiesBySubscriberCount,
      connectionsBySubscriptionCount
    };
  }

  /**
   * 清理过期的去重记录
   */
  private cleanupDeduplication(): void {
    const now = Date.now();
    const expiredThreshold = 60000; // 1分钟

    for (const [eventId, timestamp] of this.eventDeduplication.entries()) {
      if (now - timestamp > expiredThreshold) {
        this.eventDeduplication.delete(eventId);
      }
    }
  }

  /**
   * 优雅关闭服务
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down real-time sync service');

    // 停止批处理器
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // 处理剩余的事件
    if (this.eventQueue.length > 0) {
      this.logger.info(`Processing ${this.eventQueue.length} remaining events`);
      await this.processBatch();
    }

    // 清理订阅
    this.syncSubscriptions.clear();
    this.eventDeduplication.clear();

    this.logger.info('Real-time sync service shutdown completed');
  }
}