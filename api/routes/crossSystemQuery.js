import express from 'express';
import { db } from '../database/connection.js';
import { logCrossSystemActivity } from '../utils/crossSystemLogger.js';

const router = express.Router();

// 跨系统查询接口 - 从目标系统查询数据
router.get('/query/:targetPort/:endpoint', async (req, res) => {
  const { targetPort, endpoint } = req.params;
  const queryParams = req.query;
  
  try {
    console.log(`跨系统查询: 目标端口 ${targetPort}, 端点 ${endpoint}`);
    
    // 记录查询日志
    await logCrossSystemActivity({
      type: 'query_from_target',
      endpoint: endpoint,
      params: JSON.stringify(queryParams),
      status: 'pending',
      source: `localhost:${req.get('host')?.split(':')[1] || '5173'}`
    });
    
    // 构建目标系统URL
    const targetUrl = `http://localhost:${targetPort}/api/${endpoint}`;
    const urlWithParams = new URL(targetUrl);
    Object.keys(queryParams).forEach(key => {
      urlWithParams.searchParams.append(key, queryParams[key]);
    });
    
    console.log(`请求目标URL: ${urlWithParams.toString()}`);
    
    // 发送请求到目标系统
    const response = await fetch(urlWithParams.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CrossSystemQuery/1.0'
      },
      timeout: 10000 // 10秒超时
    });
    
    if (!response.ok) {
      throw new Error(`目标系统响应错误: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const responseSize = JSON.stringify(data).length;
    
    // 更新成功日志
    await logCrossSystemActivity({
      type: 'query_from_target',
      endpoint: endpoint,
      params: JSON.stringify(queryParams),
      status: 'success',
      data_size: 0,
      response_size: responseSize,
      source: `localhost:${targetPort}`
    });
    
    console.log(`跨系统查询成功: 获得 ${Array.isArray(data) ? data.length : 1} 条记录`);
    
    res.json({
      success: true,
      data: data,
      meta: {
        source: `localhost:${targetPort}`,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        recordCount: Array.isArray(data) ? data.length : 1
      }
    });
    
  } catch (error) {
    console.error('跨系统查询失败:', error.message);
    
    // 记录错误日志
    await logCrossSystemActivity({
      type: 'query_from_target',
      endpoint: endpoint,
      params: JSON.stringify(queryParams),
      status: 'error',
      error: error.message,
      source: `localhost:${targetPort}`
    });
    
    res.status(500).json({
      success: false,
      error: '跨系统查询失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 跨系统数据发送接口 - 向目标系统发送数据
router.post('/send/:targetPort/:endpoint', async (req, res) => {
  const { targetPort, endpoint } = req.params;
  const sendData = req.body;
  
  try {
    console.log(`跨系统数据发送: 目标端口 ${targetPort}, 端点 ${endpoint}`);
    
    const dataSize = JSON.stringify(sendData).length;
    
    // 记录发送日志
    await logCrossSystemActivity({
      type: 'send_to_target',
      endpoint: endpoint,
      params: JSON.stringify(sendData),
      status: 'pending',
      data_size: dataSize,
      source: `localhost:${req.get('host')?.split(':')[1] || '5173'}`
    });
    
    // 构建目标系统URL
    const targetUrl = `http://localhost:${targetPort}/api/${endpoint}`;
    
    console.log(`发送数据到目标URL: ${targetUrl}`);
    
    // 发送数据到目标系统
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CrossSystemQuery/1.0'
      },
      body: JSON.stringify(sendData),
      timeout: 15000 // 15秒超时
    });
    
    if (!response.ok) {
      throw new Error(`目标系统响应错误: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const responseSize = JSON.stringify(result).length;
    
    // 更新成功日志
    await logCrossSystemActivity({
      type: 'send_to_target',
      endpoint: endpoint,
      params: JSON.stringify(sendData),
      status: 'success',
      data_size: dataSize,
      response_size: responseSize,
      source: `localhost:${targetPort}`
    });
    
    console.log(`跨系统数据发送成功`);
    
    res.json({
      success: true,
      result: result,
      meta: {
        target: `localhost:${targetPort}`,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        dataSent: dataSize,
        responseReceived: responseSize
      }
    });
    
  } catch (error) {
    console.error('跨系统数据发送失败:', error.message);
    
    // 记录错误日志
    await logCrossSystemActivity({
      type: 'send_to_target',
      endpoint: endpoint,
      params: JSON.stringify(sendData),
      status: 'error',
      error: error.message,
      data_size: JSON.stringify(sendData).length,
      source: `localhost:${targetPort}`
    });
    
    res.status(500).json({
      success: false,
      error: '跨系统数据发送失败',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取跨系统活动日志
router.get('/logs', async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM cross_system_logs';
    const conditions = [];
    const params = [];
    
    if (type) {
      conditions.push('type = $' + (params.length + 1));
      params.push(type);
    }
    
    if (status) {
      conditions.push('status = $' + (params.length + 1));
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      logs: result.rows,
      meta: {
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('获取跨系统日志失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取日志失败',
      message: error.message
    });
  }
});

// 获取跨系统统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        type,
        status,
        COUNT(*) as count,
        AVG(data_size) as avg_data_size,
        AVG(response_size) as avg_response_size
      FROM cross_system_logs 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY type, status
      ORDER BY type, status
    `);
    
    const totalQuery = await db.query(`
      SELECT COUNT(*) as total_requests
      FROM cross_system_logs 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    res.json({
      success: true,
      stats: stats.rows,
      summary: {
        total_requests_24h: parseInt(totalQuery.rows[0].total_requests),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('获取跨系统统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取统计失败',
      message: error.message
    });
  }
});

export default router;