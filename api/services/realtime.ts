/**
 * WebSocket实时数据同步服务
 * 基于WebSocket与PostgreSQL组件关联技术文档
 */

import { WebSocket } from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

// 数据同步事件类型
export enum SyncEventType {
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  DEPARTMENT_CREATED = 'department_created',
  DEPARTMENT_UPDATED = 'department_updated',
  DEPARTMENT_DELETED = 'department_deleted',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SYSTEM_CONFIG_UPDATED = 'system_config_updated'
}

// 同步数据接口
export interface SyncData {
  type: SyncEventType;
  data: any;
  userId?: number;
  departmentId?: number;
  timestamp: Date;
  source: string;
}

// 订阅配置接口
export interface SubscriptionConfig {
  userId: number;
  departmentId?: number;
  permissions: string[];
  subscriptions: SyncEventType[];
}

// 实时数据同步服务类
export class RealtimeService extends EventEmitter {
  private pool: Pool;
  private redis: Redis;
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private connectionStats = {
    totalConnections: 0,
    activeSubscriptions: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0
  };

  constructor(pool: Pool, redis: Redis) {
    super();
    this.pool = pool;
    this.redis = redis;
    this.setupRedisSubscriptions();
  }

  /**
   * 设置Redis订阅
   */
  private setupRedisSubscriptions(): void {
    // 订阅数据变更通知
    this.redis.subscribe('data_sync', (err, count) => {
      if (err) {
        console.error('Redis subscription error:', err);
        this.connectionStats.errors++;
      } else {
        console.log(`Subscribed to ${count} Redis channels`);
      }
    });

    // 处理Redis消息
    this.redis.on('message', (channel, message) => {
      try {
        if (channel === 'data_sync') {
          const syncData: SyncData = JSON.parse(message);
          this.handleDataSync(syncData);
        }
      } catch (error) {
        console.error('Error processing Redis message:', error);
        this.connectionStats.errors++;
      }
    });
  }

  /**
   * 处理数据同步
   */
  private async handleDataSync(syncData: SyncData): Promise<void> {
    try {
      // 根据事件类型和权限过滤订阅者
      const targetConnections = this.getTargetConnections(syncData);
      
      // 广播数据到目标连接
      for (const connectionId of targetConnections) {
        this.emit('broadcast', connectionId, syncData);
        this.connectionStats.messagesSent++;
      }

      // 记录同步日志
      await this.logSyncEvent(syncData);
    } catch (error) {
      console.error('Error handling data sync:', error);
      this.connectionStats.errors++;
    }
  }

  /**
   * 获取目标连接
   */
  private getTargetConnections(syncData: SyncData): string[] {
    const targetConnections: string[] = [];

    for (const [connectionId, config] of this.subscriptions) {
      // 检查是否订阅了该事件类型
      if (!config.subscriptions.includes(syncData.type)) {
        continue;
      }

      // 检查权限
      if (!this.hasPermission(config, syncData)) {
        continue;
      }

      // 检查部门权限
      if (syncData.departmentId && config.departmentId && 
          syncData.departmentId !== config.departmentId) {
        continue;
      }

      targetConnections.push(connectionId);
    }

    return targetConnections;
  }

  /**
   * 检查权限
   */
  private hasPermission(config: SubscriptionConfig, syncData: SyncData): boolean {
    const requiredPermissions: { [key in SyncEventType]: string[] } = {
      [SyncEventType.USER_CREATED]: ['user.view'],
      [SyncEventType.USER_UPDATED]: ['user.view'],
      [SyncEventType.USER_DELETED]: ['user.view'],
      [SyncEventType.DEPARTMENT_CREATED]: ['department.view'],
      [SyncEventType.DEPARTMENT_UPDATED]: ['department.view'],
      [SyncEventType.DEPARTMENT_DELETED]: ['department.view'],
      [SyncEventType.SESSION_CREATED]: ['system.monitor'],
      [SyncEventType.SESSION_EXPIRED]: ['system.monitor'],
      [SyncEventType.SYSTEM_CONFIG_UPDATED]: ['system.config']
    };

    const required = requiredPermissions[syncData.type] || [];
    return required.some(permission => config.permissions.includes(permission));
  }

  /**
   * 记录同步事件日志
   */
  private async logSyncEvent(syncData: SyncData): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (action, resource, resource_id, new_values, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await this.pool.query(query, [
        `realtime_sync_${syncData.type}`,
        'realtime',
        syncData.source,
        JSON.stringify(syncData.data),
        syncData.timestamp
      ]);
    } catch (error) {
      console.error('Error logging sync event:', error);
    }
  }

  /**
   * 添加订阅
   */
  public addSubscription(connectionId: string, config: SubscriptionConfig): void {
    this.subscriptions.set(connectionId, config);
    this.connectionStats.activeSubscriptions++;
    console.log(`Added subscription for connection ${connectionId}`);
  }

  /**
   * 移除订阅
   */
  public removeSubscription(connectionId: string): void {
    if (this.subscriptions.delete(connectionId)) {
      this.connectionStats.activeSubscriptions--;
      console.log(`Removed subscription for connection ${connectionId}`);
    }
  }

  /**
   * 更新订阅配置
   */
  public updateSubscription(connectionId: string, config: Partial<SubscriptionConfig>): void {
    const existing = this.subscriptions.get(connectionId);
    if (existing) {
      this.subscriptions.set(connectionId, { ...existing, ...config });
      console.log(`Updated subscription for connection ${connectionId}`);
    }
  }

  /**
   * 发布数据变更事件
   */
  public async publishDataChange(
    type: SyncEventType,
    data: any,
    options: {
      userId?: number;
      departmentId?: number;
      source?: string;
    } = {}
  ): Promise<void> {
    const syncData: SyncData = {
      type,
      data,
      userId: options.userId,
      departmentId: options.departmentId,
      timestamp: new Date(),
      source: options.source || 'api'
    };

    try {
      // 发布到Redis
      await this.redis.publish('data_sync', JSON.stringify(syncData));
      this.connectionStats.messagesReceived++;
      console.log(`Published data change: ${type}`);
    } catch (error) {
      console.error('Error publishing data change:', error);
      this.connectionStats.errors++;
      throw error;
    }
  }

  /**
   * 获取用户权限
   */
  public async getUserPermissions(userId: number): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT p.name
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN users u ON u.role = rp.role
        WHERE u.id = $1 AND u.is_active = true AND p.is_active = true
        UNION
        SELECT DISTINCT p.name
        FROM permissions p
        INNER JOIN user_permissions up ON p.id = up.permission_id
        WHERE up.user_id = $1 AND up.is_active = true 
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
          AND p.is_active = true
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * 获取用户部门ID
   */
  public async getUserDepartmentId(userId: number): Promise<number | null> {
    try {
      const query = 'SELECT department_id FROM users WHERE id = $1 AND is_active = true';
      const result = await this.pool.query(query, [userId]);
      return result.rows[0]?.department_id || null;
    } catch (error) {
      console.error('Error getting user department:', error);
      return null;
    }
  }

  /**
   * 创建用户订阅配置
   */
  public async createUserSubscription(
    connectionId: string,
    userId: number,
    subscriptions: SyncEventType[] = Object.values(SyncEventType)
  ): Promise<SubscriptionConfig> {
    const permissions = await this.getUserPermissions(userId);
    const departmentId = await this.getUserDepartmentId(userId);

    const config: SubscriptionConfig = {
      userId,
      departmentId: departmentId || undefined,
      permissions,
      subscriptions
    };

    this.addSubscription(connectionId, config);
    return config;
  }

  /**
   * 获取连接统计信息
   */
  public getStats(): typeof this.connectionStats {
    return { ...this.connectionStats };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.connectionStats = {
      totalConnections: this.subscriptions.size,
      activeSubscriptions: this.subscriptions.size,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };
  }

  /**
   * 获取活跃订阅列表
   */
  public getActiveSubscriptions(): Array<{ connectionId: string; config: SubscriptionConfig }> {
    return Array.from(this.subscriptions.entries()).map(([connectionId, config]) => ({
      connectionId,
      config
    }));
  }

  /**
   * 清理过期连接
   */
  public async cleanupExpiredConnections(): Promise<void> {
    try {
      // 获取过期的WebSocket连接
      const query = `
        SELECT connection_id 
        FROM websocket_connections 
        WHERE is_active = true 
          AND last_activity < NOW() - INTERVAL '5 minutes'
      `;
      
      const result = await this.pool.query(query);
      
      for (const row of result.rows) {
        this.removeSubscription(row.connection_id);
      }

      // 更新数据库中的连接状态
      const updateQuery = `
        UPDATE websocket_connections 
        SET is_active = false, disconnected_at = NOW()
        WHERE is_active = true 
          AND last_activity < NOW() - INTERVAL '5 minutes'
      `;
      
      await this.pool.query(updateQuery);
      
      console.log(`Cleaned up ${result.rows.length} expired connections`);
    } catch (error) {
      console.error('Error cleaning up expired connections:', error);
    }
  }

  /**
   * 关闭服务
   */
  public async close(): Promise<void> {
    try {
      await this.redis.unsubscribe('data_sync');
      await this.redis.quit();
      this.subscriptions.clear();
      console.log('Realtime service closed');
    } catch (error) {
      console.error('Error closing realtime service:', error);
    }
  }
}

// 数据库触发器函数（用于自动发布数据变更）
export const createDatabaseTriggers = async (pool: Pool): Promise<void> => {
  const triggers = [
    {
      table: 'users',
      events: ['INSERT', 'UPDATE', 'DELETE'],
      function: 'notify_user_changes'
    },
    {
      table: 'departments',
      events: ['INSERT', 'UPDATE', 'DELETE'],
      function: 'notify_department_changes'
    },
    {
      table: 'system_configs',
      events: ['UPDATE'],
      function: 'notify_config_changes'
    }
  ];

  try {
    // 创建通知函数
    await pool.query(`
      CREATE OR REPLACE FUNCTION notify_user_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'user_created',
            'data', row_to_json(NEW),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'user_updated',
            'data', row_to_json(NEW),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'user_deleted',
            'data', row_to_json(OLD),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION notify_department_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'department_created',
            'data', row_to_json(NEW),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'department_updated',
            'data', row_to_json(NEW),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM pg_notify('data_sync', json_build_object(
            'type', 'department_deleted',
            'data', row_to_json(OLD),
            'timestamp', NOW(),
            'source', 'database'
          )::text);
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION notify_config_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify('data_sync', json_build_object(
          'type', 'system_config_updated',
          'data', row_to_json(NEW),
          'timestamp', NOW(),
          'source', 'database'
        )::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 创建触发器
    for (const trigger of triggers) {
      for (const event of trigger.events) {
        const triggerName = `${trigger.table}_${event.toLowerCase()}_notify`;
        await pool.query(`
          DROP TRIGGER IF EXISTS ${triggerName} ON ${trigger.table};
          CREATE TRIGGER ${triggerName}
            AFTER ${event} ON ${trigger.table}
            FOR EACH ROW EXECUTE FUNCTION ${trigger.function}();
        `);
      }
    }

    console.log('Database triggers created successfully');
  } catch (error) {
    console.error('Error creating database triggers:', error);
    throw error;
  }
};