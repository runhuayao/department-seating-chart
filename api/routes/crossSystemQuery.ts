import express from 'express';
import { z } from 'zod';
import axios from 'axios';
import { db } from '../database/index.js';
import { executeQuery } from '../config/database.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// WebSocket实例引用（将在server.ts中设置）
let serverMonitorWS: any = null;

// 设置WebSocket实例的函数
export function setWebSocketInstance(wsInstance: any) {
  serverMonitorWS = wsInstance;
}

// 应用频率限制
router.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 50, // 最多50次请求
  message: '请求过于频繁，请稍后再试'
})); // 每15分钟最多50次跨系统查询请求

// 跨系统查询验证schema
const crossSystemQuerySchema = z.object({
  query: z.string().min(1, '查询关键词不能为空'),
  type: z.enum(['employee', 'desk', 'all']).optional().default('all'),
  targetSystem: z.enum(['M1', 'all']).optional().default('all'),
  timeout: z.number().min(1000).max(30000).optional().default(5000)
});

// M1服务器管理系统配置
const M1_SYSTEM_CONFIG = {
  baseUrl: process.env.M1_SYSTEM_URL || 'http://localhost:3000',
  apiKey: process.env.M1_API_KEY || '',
  timeout: 5000
};

// 跨系统员工查询
router.get('/employee', async (req, res) => {
  try {
    const validation = crossSystemQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validation.error.errors
      });
    }

    const { query, targetSystem, timeout } = validation.data;
    const results = {
      local: [],
      remote: [],
      total: 0,
      sources: []
    };

    // 查询本地系统
    if (targetSystem === 'all') {
      try {
        const localEmployees = await executeQuery<any[]>(
          `SELECT e.*, d.name as department_name, 'local' as source
           FROM employees e 
           LEFT JOIN departments d ON e.department_id = d.id 
           WHERE (e.name ILIKE $1 OR e.employee_number ILIKE $1 OR e.name_pinyin ILIKE $1)
           ORDER BY e.id LIMIT 10`,
          [`%${query}%`]
        );
        results.local = localEmployees;
        results.sources.push('local');
      } catch (error) {
        console.error('本地员工查询失败:', error);
      }
    }

    // 查询M1系统
    if (targetSystem === 'M1' || targetSystem === 'all') {
      try {
        const response = await axios.get(`${M1_SYSTEM_CONFIG.baseUrl}/api/employees/search`, {
          params: { q: query },
          headers: {
            'Authorization': `Bearer ${M1_SYSTEM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout
        });

        if (response.data && response.data.success && response.data.data) {
          const remoteEmployees = response.data.data.map((emp: any) => ({
            ...emp,
            source: 'M1',
            system_id: emp.id,
            id: `M1_${emp.id}`
          }));
          results.remote = remoteEmployees;
          results.sources.push('M1');
        }
      } catch (error) {
        console.error('M1系统员工查询失败:', error);
        // 不抛出错误，继续返回本地结果
      }
    }

    results.total = results.local.length + results.remote.length;

    // 记录跨系统查询日志
    try {
      await executeQuery(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'cross_system_query',
          JSON.stringify({ 
            query, 
            targetSystem, 
            type: 'employee',
            results_count: results.total,
            sources: results.sources
          }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录跨系统查询日志失败:', logError);
    }

    res.json({
      success: true,
      data: results,
      message: `跨系统查询完成，找到 ${results.total} 条员工记录`
    });

  } catch (error) {
    console.error('跨系统员工查询时出错:', error);
    res.status(500).json({
      success: false,
      message: '跨系统查询失败，请稍后重试'
    });
  }
});

// 跨系统工位查询
router.get('/desk', async (req, res) => {
  try {
    const validation = crossSystemQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validation.error.errors
      });
    }

    const { query, targetSystem, timeout } = validation.data;
    const results = {
      local: [],
      remote: [],
      total: 0,
      sources: []
    };

    // 查询本地系统
    if (targetSystem === 'all') {
      try {
        const localDesks = await executeQuery<any[]>(
          `SELECT d.*, dept.name as department_name, 
                  e.name as employee_name, e.employee_number as employee_code,
                  'local' as source
           FROM desks d 
           LEFT JOIN departments dept ON d.department_id = dept.id
           LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
           LEFT JOIN employees e ON da.employee_id = e.id
           WHERE d.desk_number ILIKE $1
           ORDER BY d.desk_number LIMIT 20`,
          [`%${query}%`]
        );
        results.local = localDesks;
        results.sources.push('local');
      } catch (error) {
        console.error('本地工位查询失败:', error);
      }
    }

    // 查询M1系统
    if (targetSystem === 'M1' || targetSystem === 'all') {
      try {
        const response = await axios.get(`${M1_SYSTEM_CONFIG.baseUrl}/api/desks/search`, {
          params: { q: query },
          headers: {
            'Authorization': `Bearer ${M1_SYSTEM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout
        });

        if (response.data && response.data.success && response.data.data) {
          const remoteDesks = response.data.data.map((desk: any) => ({
            ...desk,
            source: 'M1',
            system_id: desk.id,
            id: `M1_${desk.id}`
          }));
          results.remote = remoteDesks;
          results.sources.push('M1');
        }
      } catch (error) {
        console.error('M1系统工位查询失败:', error);
      }
    }

    results.total = results.local.length + results.remote.length;

    // 记录跨系统查询日志
    try {
      await executeQuery(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'cross_system_query',
          JSON.stringify({ 
            query, 
            targetSystem, 
            type: 'desk',
            results_count: results.total,
            sources: results.sources
          }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录跨系统查询日志失败:', logError);
    }

    res.json({
      success: true,
      data: results,
      message: `跨系统查询完成，找到 ${results.total} 条工位记录`
    });

  } catch (error) {
    console.error('跨系统工位查询时出错:', error);
    res.status(500).json({
      success: false,
      message: '跨系统查询失败，请稍后重试'
    });
  }
});

// 综合跨系统查询
router.get('/all', async (req, res) => {
  try {
    const validation = crossSystemQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validation.error.errors
      });
    }

    const { query, targetSystem, timeout } = validation.data;
    const results = {
      employees: { local: [], remote: [] },
      desks: { local: [], remote: [] },
      total: 0,
      sources: []
    };

    // 并行查询员工和工位
    const promises = [];

    // 本地查询
    if (targetSystem === 'all') {
      promises.push(
        // 本地员工查询
        executeQuery<any[]>(
          `SELECT e.*, d.name as department_name, 'employee' as type, 'local' as source
           FROM employees e 
           LEFT JOIN departments d ON e.department_id = d.id 
           WHERE (e.name ILIKE $1 OR e.employee_number ILIKE $1 OR e.name_pinyin ILIKE $1)
           ORDER BY e.id LIMIT 5`,
          [`%${query}%`]
        ).then(data => ({ type: 'local_employees', data })).catch(() => ({ type: 'local_employees', data: [] })),
        
        // 本地工位查询
        executeQuery<any[]>(
          `SELECT d.*, dept.name as department_name, 
                  e.name as employee_name, e.employee_number as employee_code,
                  'desk' as type, 'local' as source
           FROM desks d 
           LEFT JOIN departments dept ON d.department_id = dept.id
           LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
           LEFT JOIN employees e ON da.employee_id = e.id
           WHERE d.desk_number ILIKE $1
           ORDER BY d.desk_number LIMIT 10`,
          [`%${query}%`]
        ).then(data => ({ type: 'local_desks', data })).catch(() => ({ type: 'local_desks', data: [] }))
      );
    }

    // M1系统查询
    if (targetSystem === 'M1' || targetSystem === 'all') {
      promises.push(
        // M1员工查询
        axios.get(`${M1_SYSTEM_CONFIG.baseUrl}/api/employees/search`, {
          params: { q: query },
          headers: {
            'Authorization': `Bearer ${M1_SYSTEM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout
        }).then(response => ({
          type: 'remote_employees',
          data: response.data?.success ? response.data.data.map((emp: any) => ({
            ...emp,
            type: 'employee',
            source: 'M1',
            system_id: emp.id,
            id: `M1_${emp.id}`
          })) : []
        })).catch(() => ({ type: 'remote_employees', data: [] })),
        
        // M1工位查询
        axios.get(`${M1_SYSTEM_CONFIG.baseUrl}/api/desks/search`, {
          params: { q: query },
          headers: {
            'Authorization': `Bearer ${M1_SYSTEM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout
        }).then(response => ({
          type: 'remote_desks',
          data: response.data?.success ? response.data.data.map((desk: any) => ({
            ...desk,
            type: 'desk',
            source: 'M1',
            system_id: desk.id,
            id: `M1_${desk.id}`
          })) : []
        })).catch(() => ({ type: 'remote_desks', data: [] }))
      );
    }

    // 等待所有查询完成
    const queryResults = await Promise.allSettled(promises);
    
    // 处理查询结果
    queryResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { type, data } = result.value;
        switch (type) {
          case 'local_employees':
            results.employees.local = data;
            if (data.length > 0) results.sources.push('local');
            break;
          case 'local_desks':
            results.desks.local = data;
            if (data.length > 0 && !results.sources.includes('local')) results.sources.push('local');
            break;
          case 'remote_employees':
            results.employees.remote = data;
            if (data.length > 0) results.sources.push('M1');
            break;
          case 'remote_desks':
            results.desks.remote = data;
            if (data.length > 0 && !results.sources.includes('M1')) results.sources.push('M1');
            break;
        }
      }
    });

    results.total = 
      results.employees.local.length + 
      results.employees.remote.length + 
      results.desks.local.length + 
      results.desks.remote.length;

    // 记录跨系统查询日志
    try {
      await executeQuery(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'cross_system_query',
          JSON.stringify({ 
            query, 
            targetSystem, 
            type: 'all',
            results_count: results.total,
            sources: results.sources
          }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录跨系统查询日志失败:', logError);
    }

    res.json({
      success: true,
      data: results,
      message: `跨系统综合查询完成，找到 ${results.total} 条记录`
    });

  } catch (error) {
    console.error('跨系统综合查询时出错:', error);
    res.status(500).json({
      success: false,
      message: '跨系统查询失败，请稍后重试'
    });
  }
});

// 系统连接状态检查
router.get('/status', async (req, res) => {
  try {
    const status = {
      local: true, // 本地系统总是可用
      M1: false,
      timestamp: new Date().toISOString()
    };

    // 检查M1系统连接状态
    try {
      const response = await axios.get(`${M1_SYSTEM_CONFIG.baseUrl}/api/health`, {
        headers: {
          'Authorization': `Bearer ${M1_SYSTEM_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      });
      status.M1 = response.status === 200;
    } catch (error) {
      console.warn('M1系统连接检查失败:', error.message);
      status.M1 = false;
    }

    res.json({
      success: true,
      data: status,
      message: '系统状态检查完成'
    });

  } catch (error) {
    console.error('系统状态检查时出错:', error);
    res.status(500).json({
      success: false,
      message: '系统状态检查失败'
    });
  }
});

export default router;