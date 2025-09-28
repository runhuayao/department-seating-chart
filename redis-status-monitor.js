#!/usr/bin/env node

/**
 * Redis状态监控脚本
 * 用于监控Redis服务器状态和MCP连接健康度
 */

const redis = require('redis');
const fs = require('fs');
const path = require('path');

// Redis连接配置
const REDIS_CONFIG = {
  host: 'localhost',
  port: 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
};

// 监控配置
const MONITOR_CONFIG = {
  checkInterval: 30000, // 30秒检查一次
  logFile: 'redis-monitor.log',
  alertThreshold: 3 // 连续失败3次后告警
};

class RedisMonitor {
  constructor() {
    this.client = null;
    this.failureCount = 0;
    this.lastSuccessTime = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      this.client = redis.createClient(REDIS_CONFIG);
      
      this.client.on('error', (err) => {
        this.logMessage(`❌ Redis连接错误: ${err.message}`, 'ERROR');
      });

      this.client.on('connect', () => {
        this.logMessage('🔗 Redis连接建立', 'INFO');
      });

      this.client.on('ready', () => {
        this.logMessage('✅ Redis客户端就绪', 'INFO');
      });

      await this.client.connect();
      this.logMessage('🚀 Redis监控器启动成功', 'INFO');
      return true;
    } catch (error) {
      this.logMessage(`❌ 初始化失败: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkRedisHealth() {
    try {
      // 1. Ping测试
      const pingResult = await this.client.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Ping测试失败');
      }

      // 2. 基本操作测试
      const testKey = 'monitor:health:check';
      const testValue = `health_check_${Date.now()}`;
      
      await this.client.set(testKey, testValue);
      const retrievedValue = await this.client.get(testKey);
      
      if (retrievedValue !== testValue) {
        throw new Error('读写测试失败');
      }

      // 3. 获取服务器信息
      const info = await this.client.info('server');
      const serverInfo = this.parseRedisInfo(info);

      // 4. 清理测试数据
      await this.client.del(testKey);

      // 健康检查通过
      this.failureCount = 0;
      this.lastSuccessTime = new Date();
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ping: 'OK',
        readWrite: 'OK',
        serverInfo: {
          version: serverInfo.redis_version,
          uptime: serverInfo.uptime_in_seconds,
          connectedClients: serverInfo.connected_clients
        }
      };

      this.logMessage(`✅ 健康检查通过 - 版本: ${serverInfo.redis_version}, 运行时间: ${serverInfo.uptime_in_seconds}秒`, 'INFO');
      return healthStatus;

    } catch (error) {
      this.failureCount++;
      const healthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        failureCount: this.failureCount,
        lastSuccess: this.lastSuccessTime ? this.lastSuccessTime.toISOString() : null
      };

      this.logMessage(`❌ 健康检查失败 (${this.failureCount}/${MONITOR_CONFIG.alertThreshold}): ${error.message}`, 'ERROR');
      
      if (this.failureCount >= MONITOR_CONFIG.alertThreshold) {
        this.logMessage(`🚨 告警: Redis连续失败${this.failureCount}次`, 'ALERT');
      }

      return healthStatus;
    }
  }

  parseRedisInfo(infoString) {
    const info = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          info[key] = value;
        }
      }
    }
    
    return info;
  }

  logMessage(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    // 控制台输出
    console.log(logEntry);
    
    // 文件日志
    try {
      fs.appendFileSync(MONITOR_CONFIG.logFile, logEntry + '\n');
    } catch (error) {
      console.error('写入日志文件失败:', error.message);
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      this.logMessage('⚠️ 监控器已在运行中', 'WARN');
      return;
    }

    this.isRunning = true;
    this.logMessage(`🔍 开始监控Redis服务 (检查间隔: ${MONITOR_CONFIG.checkInterval/1000}秒)`, 'INFO');

    const monitorLoop = async () => {
      if (!this.isRunning) return;

      const healthStatus = await this.checkRedisHealth();
      
      // 可以在这里添加更多的监控逻辑，比如发送告警通知等
      
      setTimeout(monitorLoop, MONITOR_CONFIG.checkInterval);
    };

    // 立即执行第一次检查
    await monitorLoop();
  }

  stopMonitoring() {
    this.isRunning = false;
    this.logMessage('🛑 停止Redis监控', 'INFO');
  }

  async cleanup() {
    if (this.client) {
      await this.client.quit();
      this.logMessage('🔌 Redis连接已关闭', 'INFO');
    }
  }

  // 获取监控统计信息
  getStats() {
    return {
      isRunning: this.isRunning,
      failureCount: this.failureCount,
      lastSuccessTime: this.lastSuccessTime,
      uptime: this.lastSuccessTime ? Date.now() - this.lastSuccessTime.getTime() : null
    };
  }
}

// 主函数
async function main() {
  const monitor = new RedisMonitor();
  
  // 处理程序退出
  process.on('SIGINT', async () => {
    console.log('\n🛑 收到退出信号，正在清理...');
    monitor.stopMonitoring();
    await monitor.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 收到终止信号，正在清理...');
    monitor.stopMonitoring();
    await monitor.cleanup();
    process.exit(0);
  });

  // 初始化并开始监控
  const initialized = await monitor.initialize();
  if (initialized) {
    await monitor.startMonitoring();
  } else {
    console.error('❌ 监控器初始化失败');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 监控器运行失败:', error);
    process.exit(1);
  });
}

module.exports = RedisMonitor;