import { db } from '../database/connection.js';

/**
 * 记录跨系统活动日志
 * @param {Object} logData - 日志数据
 * @param {string} logData.type - 日志类型: 'query_from_target', 'send_to_target', 'data_sync', 'sync_receive'
 * @param {string} logData.endpoint - API端点
 * @param {string} logData.params - 参数（JSON字符串）
 * @param {string} logData.status - 状态: 'success', 'error', 'pending'
 * @param {string} [logData.error] - 错误信息
 * @param {number} [logData.data_size] - 数据大小（字节）
 * @param {number} [logData.response_size] - 响应大小（字节）
 * @param {string} [logData.table_name] - 涉及的表名
 * @param {string} [logData.operation] - 操作类型: 'create', 'update', 'delete'
 * @param {string} [logData.source] - 数据源系统
 */
export async function logCrossSystemActivity(logData) {
  try {
    const query = `
      INSERT INTO cross_system_logs (
        type, endpoint, params, status, error, 
        data_size, response_size, table_name, operation, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at
    `;
    
    const values = [
      logData.type,
      logData.endpoint || null,
      logData.params || null,
      logData.status,
      logData.error || null,
      logData.data_size || 0,
      logData.response_size || 0,
      logData.table_name || null,
      logData.operation || null,
      logData.source || null
    ];
    
    const result = await db.query(query, values);
    
    console.log(`跨系统日志记录成功: ID ${result.rows[0].id}, 类型 ${logData.type}, 状态 ${logData.status}`);
    
    return result.rows[0];
    
  } catch (error) {
    console.error('跨系统日志记录失败:', error.message);
    console.error('日志数据:', logData);
    // 不抛出错误，避免影响主业务流程
    return null;
  }
}

/**
 * 记录数据同步活动
 * @param {Object} syncData - 同步数据
 * @param {string} syncData.table_name - 表名
 * @param {string} syncData.operation - 操作类型
 * @param {Object} syncData.data - 同步的数据
 * @param {string} syncData.source - 数据源
 * @param {string} [syncData.target] - 目标系统
 */
export async function logDataSync(syncData) {
  try {
    const logEntry = {
      type: 'data_sync',
      table_name: syncData.table_name,
      operation: syncData.operation,
      params: JSON.stringify(syncData.data),
      status: 'success',
      data_size: JSON.stringify(syncData.data).length,
      source: syncData.source
    };
    
    return await logCrossSystemActivity(logEntry);
    
  } catch (error) {
    console.error('数据同步日志记录失败:', error.message);
    return null;
  }
}

/**
 * 记录同步接收活动
 * @param {Object} receiveData - 接收数据
 * @param {string} receiveData.table_name - 表名
 * @param {string} receiveData.operation - 操作类型
 * @param {Object} receiveData.data - 接收的数据
 * @param {string} receiveData.source - 数据源
 */
export async function logSyncReceive(receiveData) {
  try {
    const logEntry = {
      type: 'sync_receive',
      table_name: receiveData.table_name,
      operation: receiveData.operation,
      params: JSON.stringify(receiveData.data),
      status: 'success',
      response_size: JSON.stringify(receiveData.data).length,
      source: receiveData.source
    };
    
    return await logCrossSystemActivity(logEntry);
    
  } catch (error) {
    console.error('同步接收日志记录失败:', error.message);
    return null;
  }
}

/**
 * 获取跨系统活动统计
 * @param {Object} options - 查询选项
 * @param {string} [options.timeRange] - 时间范围: '1h', '24h', '7d', '30d'
 * @param {string} [options.type] - 日志类型过滤
 * @param {string} [options.status] - 状态过滤
 */
export async function getCrossSystemStats(options = {}) {
  try {
    const { timeRange = '24h', type, status } = options;
    
    // 构建时间条件
    let timeCondition = '';
    switch (timeRange) {
      case '1h':
        timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "created_at >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
    }
    
    // 构建查询条件
    const conditions = [timeCondition];
    const params = [];
    
    if (type) {
      conditions.push('type = $' + (params.length + 1));
      params.push(type);
    }
    
    if (status) {
      conditions.push('status = $' + (params.length + 1));
      params.push(status);
    }
    
    const whereClause = conditions.join(' AND ');
    
    // 获取统计数据
    const statsQuery = `
      SELECT 
        type,
        status,
        COUNT(*) as count,
        AVG(data_size) as avg_data_size,
        AVG(response_size) as avg_response_size,
        SUM(data_size) as total_data_size,
        SUM(response_size) as total_response_size
      FROM cross_system_logs 
      WHERE ${whereClause}
      GROUP BY type, status
      ORDER BY type, status
    `;
    
    const totalQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_requests
      FROM cross_system_logs 
      WHERE ${whereClause}
    `;
    
    const [statsResult, totalResult] = await Promise.all([
      db.query(statsQuery, params),
      db.query(totalQuery, params)
    ]);
    
    const total = totalResult.rows[0];
    const successRate = total.total_requests > 0 
      ? (total.successful_requests / total.total_requests * 100).toFixed(2)
      : 0;
    
    return {
      timeRange,
      summary: {
        total_requests: parseInt(total.total_requests),
        successful_requests: parseInt(total.successful_requests),
        failed_requests: parseInt(total.failed_requests),
        success_rate: parseFloat(successRate)
      },
      details: statsResult.rows.map(row => ({
        type: row.type,
        status: row.status,
        count: parseInt(row.count),
        avg_data_size: parseFloat(row.avg_data_size) || 0,
        avg_response_size: parseFloat(row.avg_response_size) || 0,
        total_data_size: parseInt(row.total_data_size) || 0,
        total_response_size: parseInt(row.total_response_size) || 0
      })),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('获取跨系统统计失败:', error.message);
    throw error;
  }
}

/**
 * 清理过期日志
 * @param {number} daysToKeep - 保留天数，默认30天
 */
export async function cleanupOldLogs(daysToKeep = 30) {
  try {
    const query = `
      DELETE FROM cross_system_logs 
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `;
    
    const result = await db.query(query);
    
    console.log(`清理了 ${result.rowCount} 条过期的跨系统日志记录`);
    
    return result.rowCount;
    
  } catch (error) {
    console.error('清理过期日志失败:', error.message);
    throw error;
  }
}