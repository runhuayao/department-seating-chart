import express from 'express';
import os from 'os';
import fs from 'fs';
import { promisify } from 'util';

const router = express.Router();
const stat = promisify(fs.stat);

// 获取系统基本信息
router.get('/system-info', (req, res) => {
  try {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
      networkInterfaces: Object.keys(os.networkInterfaces())
    };
    
    res.json({
      success: true,
      data: systemInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取CPU使用率
router.get('/cpu-usage', (req, res) => {
  try {
    const cpus = os.cpus();
    const cpuUsage = cpus.map((cpu, index) => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const idle = cpu.times.idle;
      const usage = ((total - idle) / total) * 100;
      
      return {
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        usage: Math.round(usage * 100) / 100
      };
    });
    
    const avgUsage = cpuUsage.reduce((acc, cpu) => acc + cpu.usage, 0) / cpuUsage.length;
    
    res.json({
      success: true,
      data: {
        cores: cpuUsage,
        average: Math.round(avgUsage * 100) / 100,
        loadAverage: os.loadavg()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get CPU usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取内存使用情况
router.get('/memory-usage', (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;
    
    res.json({
      success: true,
      data: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: Math.round(usagePercent * 100) / 100,
        totalGB: Math.round((totalMem / (1024 ** 3)) * 100) / 100,
        freeGB: Math.round((freeMem / (1024 ** 3)) * 100) / 100,
        usedGB: Math.round((usedMem / (1024 ** 3)) * 100) / 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get memory usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取磁盘使用情况（Windows系统）
router.get('/disk-usage', async (req, res) => {
  try {
    // 模拟磁盘使用情况（实际项目中可使用第三方库如 node-disk-info）
    const diskInfo = {
      drives: [
        {
          drive: 'C:',
          total: 500 * 1024 * 1024 * 1024, // 500GB
          free: 150 * 1024 * 1024 * 1024,  // 150GB
          used: 350 * 1024 * 1024 * 1024,  // 350GB
          usagePercent: 70
        },
        {
          drive: 'D:',
          total: 1000 * 1024 * 1024 * 1024, // 1TB
          free: 600 * 1024 * 1024 * 1024,   // 600GB
          used: 400 * 1024 * 1024 * 1024,   // 400GB
          usagePercent: 40
        }
      ]
    };
    
    res.json({
      success: true,
      data: diskInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get disk usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取网络接口信息
router.get('/network-interfaces', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const networkInfo = Object.entries(interfaces).map(([name, addresses]) => {
      if (!addresses) return null;
      
      return {
        name,
        addresses: addresses.map(addr => ({
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
          mac: addr.mac
        }))
      };
    }).filter(Boolean);
    
    res.json({
      success: true,
      data: networkInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get network interfaces',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取进程信息
router.get('/processes', (req, res) => {
  try {
    // 模拟进程信息（实际项目中可使用 ps-list 等库）
    const processes = [
      {
        pid: 1234,
        name: 'node.exe',
        cpu: 15.5,
        memory: 128 * 1024 * 1024, // 128MB
        status: 'running'
      },
      {
        pid: 5678,
        name: 'chrome.exe',
        cpu: 8.2,
        memory: 256 * 1024 * 1024, // 256MB
        status: 'running'
      },
      {
        pid: 9012,
        name: 'explorer.exe',
        cpu: 2.1,
        memory: 64 * 1024 * 1024, // 64MB
        status: 'running'
      }
    ];
    
    res.json({
      success: true,
      data: {
        processes,
        total: processes.length,
        totalCpuUsage: processes.reduce((acc, proc) => acc + proc.cpu, 0),
        totalMemoryUsage: processes.reduce((acc, proc) => acc + proc.memory, 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get processes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取系统日志（模拟）
router.get('/system-logs', (req, res) => {
  try {
    const { level = 'all', limit = 50 } = req.query;
    
    // 模拟系统日志
    const logs = [
      {
        id: 1,
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        level: 'info',
        message: 'Server started successfully',
        source: 'system'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        level: 'warn',
        message: 'High memory usage detected: 85%',
        source: 'monitor'
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
        level: 'error',
        message: 'Failed to connect to database',
        source: 'database'
      },
      {
        id: 4,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'System monitoring active',
        source: 'monitor'
      }
    ];
    
    let filteredLogs = logs;
    if (level !== 'all') {
      filteredLogs = logs.filter(log => log.level === level);
    }
    
    const limitedLogs = filteredLogs.slice(0, Number(limit));
    
    res.json({
      success: true,
      data: {
        logs: limitedLogs,
        total: filteredLogs.length,
        levels: ['info', 'warn', 'error']
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;