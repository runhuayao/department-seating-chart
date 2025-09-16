/**
 * 数据同步服务 - 系统架构关联逻辑数据层组件
 * 负责多系统间的数据同步和一致性保证
 */

import { EventEmitter } from 'events';
import { PoolClient } from 'pg';
import { RedisClientType } from 'redis';
import { ConnectionManager } from './ConnectionManager';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  source: string;
  target?: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

interface SyncConfig {
  batchSize: number;
  retryLimit: number;
  syncInterval: number;
  conflictResolution: 'source_wins' | 'target_wins' | 'timestamp_wins' | 'manual';
}

interface DataChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldData?: any;
  newData?: any;
  timestamp: Date;
  source: string;
}

export class DataSyncService extends EventEmitter {
  private connectionManager: ConnectionManager;
  private syncQueue: Map<string, SyncOperation> = new Map();
  private config: SyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  // 需要同步的表配置
  private syncTables = {
    departments: {
      primaryKey: 'id',
      syncFields: ['name', 'description', 'parent_id', 'level', 'sort_order', 'status'],
      targets: ['department-map', 'server-management']
    },
    users: {
      primaryKey: 'id',
      syncFields: ['username', 'email', 'role', 'department_id', 'status', 'last_login'],
      targets: ['department-map', 'server-management', 'api-monitor']
    },
    workstations: {
      primaryKey: 'id',
      syncFields: ['name', 'department_id', 'location', 'status', 'assigned_user_id'],
      targets: ['department-map', 'server-management']
    },
    system_logs: {
      primaryKey: 'id',
      syncFields: ['level', 'message', 'source', 'user_id', 'created_at'],
      targets: ['api-monitor']
    }
  };

  constructor(connectionManager: ConnectionManager, config: Partial<SyncConfig> = {}) {
    super();
    this.connectionManager = connectionManager;
    this.config = {
      batchSize: 50,
      retryLimit: 3,
      syncInterval: 5000,
      conflictResolution: 'timestamp_wins',
      ...config
    };

    this.initialize();
  }

  /**
   * 初始化数据同步服务
   */
  private async initialize(): Promise<void> {
    try {
      // 设置数据库触发器监听数据变更
      await this.setupDatabaseTriggers();
      
      // 启动同步处理循环
      this.startSyncProcessor();
      
      // 监听连接管理器事件
      this.connectionManager.on('system:connected', (connection) => {
        this.handleSystemConnected(connection);
      });
      
      this.connectionManager.on('system:disconnected', (connection) => {
        this.handleSystemDisconnected(connection);
      });
      
      console.log('✅ DataSyncService initialized');
    } catch (error) {
      console.error('❌ DataSyncService initialization failed:', error);
      throw error;
    }
  }

  /**
   * 设置数据库触发器
   */
  private async setupDatabaseTriggers(): Promise<void> {
    const client = await this.connectionManager.getDatabaseClient();
    
    try {
      // 创建通知函数
      await client.query(`
        CREATE OR REPLACE FUNCTION notify_data_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM pg_notify(
            'data_change',
            json_build_object(
              'table', TG_TABLE_NAME,
              'operation', TG_OP,
              'old_data', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
              'new_data', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
              'timestamp', NOW(),
              'source', 'database'
            )::text
          );
          
          RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // 为每个同步表创建触发器
      for (const tableName of Object.keys(this.syncTables)) {
        await client.query(`
          DROP TRIGGER IF EXISTS ${tableName}_sync_trigger ON ${tableName};
          CREATE TRIGGER ${tableName}_sync_trigger
            AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
            FOR EACH ROW EXECUTE FUNCTION notify_data_change();
        `);
      }

      // 监听数据库通知
      await client.query('LISTEN data_change');
      
      client.on('notification', (msg) => {
        if (msg.channel === 'data_change') {
          this.handleDataChange(JSON.parse(msg.payload!));
        }
      });

      console.log('✅ Database triggers setup completed');
    } finally {
      // 注意：这里不释放客户端，因为需要保持监听
      // client.release();
    }
  }

  /**
   * 处理数据变更事件
   */
  private handleDataChange(changeEvent: DataChangeEvent): void {
    const tableConfig = this.syncTables[changeEvent.table as keyof typeof this.syncTables];
    
    if (!tableConfig) {
      return; // 不需要同步的表
    }

    // 创建同步操作
    const syncOperation: SyncOperation = {
      id: `${changeEvent.table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: changeEvent.operation.toLowerCase() as 'create' | 'update' | 'delete',
      table: changeEvent.table,
      data: changeEvent.newData || changeEvent.oldData,
      timestamp: changeEvent.timestamp,
      source: changeEvent.source,
      target: tableConfig.targets,
      status: 'pending',
      retryCount: 0
    };

    // 添加到同步队列
    this.syncQueue.set(syncOperation.id, syncOperation);
    
    this.emit('sync:queued', syncOperation);
    console.log(`📝 Sync operation queued: ${syncOperation.type} on ${syncOperation.table}`);
  }

  /**
   * 启动同步处理器
   */
  private startSyncProcessor(): void {
    this.syncInterval = setInterval(async () => {
      if (!this.isProcessing && this.syncQueue.size > 0) {
        await this.processSyncQueue();
      }
    }, this.config.syncInterval);
  }

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const pendingOperations = Array.from(this.syncQueue.values())
        .filter(op => op.status === 'pending')
        .slice(0, this.config.batchSize);

      if (pendingOperations.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`🔄 Processing ${pendingOperations.length} sync operations`);

      for (const operation of pendingOperations) {
        await this.processSyncOperation(operation);
      }
    } catch (error) {
      console.error('Sync processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个同步操作
   */
  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      operation.status = 'processing';
      
      // 根据操作类型执行同步
      switch (operation.type) {
        case 'create':
          await this.syncCreate(operation);
          break;
        case 'update':
          await this.syncUpdate(operation);
          break;
        case 'delete':
          await this.syncDelete(operation);
          break;
      }

      // 广播同步事件到目标系统
      this.broadcastSyncEvent(operation);
      
      // 缓存同步结果
      await this.cacheSyncResult(operation);
      
      operation.status = 'completed';
      this.emit('sync:completed', operation);
      
      // 从队列中移除已完成的操作
      this.syncQueue.delete(operation.id);
      
      console.log(`✅ Sync completed: ${operation.type} on ${operation.table}`);
    } catch (error) {
      await this.handleSyncError(operation, error as Error);
    }
  }

  /**
   * 同步创建操作
   */
  private async syncCreate(operation: SyncOperation): Promise<void> {
    const tableConfig = this.syncTables[operation.table as keyof typeof this.syncTables];
    const redis = this.connectionManager.getRedisClient();
    
    // 缓存新数据
    const cacheKey = `${operation.table}:${operation.data[tableConfig.primaryKey]}`;
    await redis.setEx(cacheKey, 3600, JSON.stringify(operation.data));
    
    // 更新索引缓存
    await this.updateIndexCache(operation.table, operation.data, 'create');
  }

  /**
   * 同步更新操作
   */
  private async syncUpdate(operation: SyncOperation): Promise<void> {
    const tableConfig = this.syncTables[operation.table as keyof typeof this.syncTables];
    const redis = this.connectionManager.getRedisClient();
    
    // 检查冲突
    const conflict = await this.checkConflict(operation);
    if (conflict) {
      await this.resolveConflict(operation, conflict);
      return;
    }
    
    // 更新缓存
    const cacheKey = `${operation.table}:${operation.data[tableConfig.primaryKey]}`;
    await redis.setEx(cacheKey, 3600, JSON.stringify(operation.data));
    
    // 更新索引缓存
    await this.updateIndexCache(operation.table, operation.data, 'update');
  }

  /**
   * 同步删除操作
   */
  private async syncDelete(operation: SyncOperation): Promise<void> {
    const tableConfig = this.syncTables[operation.table as keyof typeof this.syncTables];
    const redis = this.connectionManager.getRedisClient();
    
    // 删除缓存
    const cacheKey = `${operation.table}:${operation.data[tableConfig.primaryKey]}`;
    await redis.del(cacheKey);
    
    // 更新索引缓存
    await this.updateIndexCache(operation.table, operation.data, 'delete');
  }

  /**
   * 检查数据冲突
   */
  private async checkConflict(operation: SyncOperation): Promise<any | null> {
    const redis = this.connectionManager.getRedisClient();
    const tableConfig = this.syncTables[operation.table as keyof typeof this.syncTables];
    
    const cacheKey = `${operation.table}:${operation.data[tableConfig.primaryKey]}`;
    const cachedData = await redis.get(cacheKey);
    
    if (!cachedData) return null;
    
    const cached = JSON.parse(cachedData);
    
    // 检查时间戳冲突
    if (cached.updated_at && operation.data.updated_at) {
      const cachedTime = new Date(cached.updated_at).getTime();
      const operationTime = new Date(operation.data.updated_at).getTime();
      
      if (cachedTime > operationTime) {
        return { type: 'timestamp', cached, operation: operation.data };
      }
    }
    
    return null;
  }

  /**
   * 解决数据冲突
   */
  private async resolveConflict(operation: SyncOperation, conflict: any): Promise<void> {
    switch (this.config.conflictResolution) {
      case 'source_wins':
        // 源数据获胜，继续同步
        break;
      case 'target_wins':
        // 目标数据获胜，跳过同步
        operation.status = 'completed';
        return;
      case 'timestamp_wins':
        // 时间戳新的获胜
        if (conflict.type === 'timestamp') {
          operation.status = 'completed';
          return;
        }
        break;
      case 'manual':
        // 手动解决，标记为失败等待人工处理
        throw new Error(`Conflict detected: ${JSON.stringify(conflict)}`);
    }
  }

  /**
   * 更新索引缓存
   */
  private async updateIndexCache(table: string, data: any, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const redis = this.connectionManager.getRedisClient();
    const indexKey = `${table}:index`;
    
    switch (operation) {
      case 'create':
      case 'update':
        await redis.sAdd(indexKey, data.id.toString());
        break;
      case 'delete':
        await redis.sRem(indexKey, data.id.toString());
        break;
    }
    
    // 设置索引过期时间
    await redis.expire(indexKey, 7200); // 2小时
  }

  /**
   * 广播同步事件
   */
  private broadcastSyncEvent(operation: SyncOperation): void {
    const event = {
      type: 'data_sync',
      operation: operation.type,
      table: operation.table,
      data: operation.data,
      timestamp: operation.timestamp,
      source: operation.source
    };
    
    if (operation.target) {
      // 发送到指定目标系统
      operation.target.forEach(target => {
        this.connectionManager.sendToSystem(target, 'data_sync', event);
      });
    } else {
      // 广播到所有系统
      this.connectionManager.broadcastToSystems('data_sync', event);
    }
  }

  /**
   * 缓存同步结果
   */
  private async cacheSyncResult(operation: SyncOperation): Promise<void> {
    const redis = this.connectionManager.getRedisClient();
    const resultKey = `sync:result:${operation.id}`;
    
    const result = {
      id: operation.id,
      type: operation.type,
      table: operation.table,
      status: operation.status,
      timestamp: operation.timestamp,
      completedAt: new Date()
    };
    
    await redis.setEx(resultKey, 86400, JSON.stringify(result)); // 24小时过期
  }

  /**
   * 处理同步错误
   */
  private async handleSyncError(operation: SyncOperation, error: Error): Promise<void> {
    operation.retryCount++;
    operation.error = error.message;
    
    if (operation.retryCount < this.config.retryLimit) {
      operation.status = 'pending';
      console.warn(`⚠️ Sync retry ${operation.retryCount}/${this.config.retryLimit}: ${operation.id}`);
    } else {
      operation.status = 'failed';
      this.emit('sync:failed', operation);
      console.error(`❌ Sync failed permanently: ${operation.id}`, error);
      
      // 移除失败的操作
      this.syncQueue.delete(operation.id);
    }
  }

  /**
   * 处理系统连接事件
   */
  private handleSystemConnected(connection: any): void {
    console.log(`🔗 System connected for sync: ${connection.type}`);
    
    // 发送初始同步数据
    this.sendInitialSyncData(connection);
  }

  /**
   * 处理系统断开事件
   */
  private handleSystemDisconnected(connection: any): void {
    console.log(`🔌 System disconnected from sync: ${connection.type}`);
    
    // 标记相关同步操作为待处理
    for (const operation of this.syncQueue.values()) {
      if (operation.target?.includes(connection.type) && operation.status === 'processing') {
        operation.status = 'pending';
      }
    }
  }

  /**
   * 发送初始同步数据
   */
  private async sendInitialSyncData(connection: any): Promise<void> {
    try {
      const client = await this.connectionManager.getDatabaseClient();
      
      // 为每个相关表发送最新数据
      for (const [tableName, config] of Object.entries(this.syncTables)) {
        if (config.targets.includes(connection.type)) {
          const result = await client.query(`
            SELECT ${config.syncFields.join(', ')}, ${config.primaryKey}
            FROM ${tableName}
            WHERE status != 'deleted'
            ORDER BY updated_at DESC
            LIMIT 100
          `);
          
          this.connectionManager.sendToSystem(connection.id, 'initial_sync', {
            table: tableName,
            data: result.rows
          });
        }
      }
      
      client.release();
    } catch (error) {
      console.error('Initial sync error:', error);
    }
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(): {
    queueSize: number;
    processing: boolean;
    completed: number;
    failed: number;
    pending: number;
  } {
    const operations = Array.from(this.syncQueue.values());
    
    return {
      queueSize: this.syncQueue.size,
      processing: this.isProcessing,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      pending: operations.filter(op => op.status === 'pending').length
    };
  }

  /**
   * 手动触发同步
   */
  public async triggerSync(table: string, operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    const changeEvent: DataChangeEvent = {
      table,
      operation: operation.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE',
      newData: operation !== 'delete' ? data : undefined,
      oldData: operation === 'delete' ? data : undefined,
      timestamp: new Date(),
      source: 'manual'
    };
    
    this.handleDataChange(changeEvent);
  }

  /**
   * 清理同步队列
   */
  public clearSyncQueue(): void {
    this.syncQueue.clear();
    console.log('🧹 Sync queue cleared');
  }

  /**
   * 关闭数据同步服务
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing DataSyncService...');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // 等待当前处理完成
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.syncQueue.clear();
    
    console.log('✅ DataSyncService closed');
  }
}