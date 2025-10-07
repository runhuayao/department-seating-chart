#!/usr/bin/env node

// Redis MCP 包装器 - 自动检测和启动Redis服务
const { spawn, exec } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

class RedisMCPWrapper {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || 'redis://localhost:6379';
    this.redisHost = options.redisHost || 'localhost';
    this.redisPort = options.redisPort || 6379;
    this.redisPath = options.redisPath || './Redis/redis-server.exe';
    this.redisConfig = options.redisConfig || './redis.conf';
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 2000;
    this.platform = process.platform;
  }

  // 检查Redis服务器是否运行
  async checkRedisServer() {
    return new Promise((resolve) => {
      const client = new net.Socket();
      
      client.setTimeout(3000);
      
      client.on('connect', () => {
        console.log('✅ Redis服务器已运行');
        client.destroy();
        resolve(true);
      });
      
      client.on('timeout', () => {
        console.log('⚠️ Redis连接超时');
        client.destroy();
        resolve(false);
      });
      
      client.on('error', () => {
        resolve(false);
      });
      
      client.connect(this.redisPort, this.redisHost);
    });
  }

  // 查找Redis可执行文件
  findRedisExecutable() {
    const possiblePaths = [
      this.redisPath,
      './Redis/redis-server.exe',
      './Redis/redis-server',
      'redis-server.exe',
      'redis-server'
    ];

    for (const redisPath of possiblePaths) {
      if (fs.existsSync(redisPath)) {
        console.log(`✅ 找到Redis可执行文件: ${redisPath}`);
        return redisPath;
      }
    }

    // 检查系统PATH中的Redis
    return new Promise((resolve) => {
      exec('where redis-server', (error, stdout) => {
        if (!error && stdout.trim()) {
          const systemRedisPath = stdout.trim().split('\n')[0];
          console.log(`✅ 找到系统Redis: ${systemRedisPath}`);
          resolve(systemRedisPath);
        } else {
          console.log('❌ 未找到Redis可执行文件');
          resolve(null);
        }
      });
    });
  }

  // 启动Redis服务器
  async startRedisServer() {
    console.log('🚀 正在启动Redis服务器...');
    
    const redisExecutable = await this.findRedisExecutable();
    if (!redisExecutable) {
      throw new Error('Redis可执行文件未找到');
    }

    return new Promise((resolve, reject) => {
      const args = [];
      
      // 添加配置文件参数
      if (fs.existsSync(this.redisConfig)) {
        args.push(this.redisConfig);
        console.log(`✅ 使用配置文件: ${this.redisConfig}`);
      } else {
        console.log('⚠️ 配置文件未找到，使用默认配置');
      }

      // 启动Redis进程
      const redisProcess = spawn(redisExecutable, args, {
        detached: true,
        stdio: 'ignore'
      });

      redisProcess.unref(); // 允许父进程退出

      if (redisProcess.pid) {
        console.log(`✅ Redis服务器进程已启动 (PID: ${redisProcess.pid})`);
        
        // 等待Redis服务器完全启动
        this.waitForRedisReady().then(() => {
          resolve(true);
        }).catch((error) => {
          reject(error);
        });
      } else {
        reject(new Error('Redis进程启动失败'));
      }
    });
  }

  // 等待Redis服务器就绪
  async waitForRedisReady() {
    console.log('⏳ 等待Redis服务器就绪...');
    
    for (let i = 0; i < this.maxRetries; i++) {
      await this.delay(this.retryDelay);
      
      if (await this.checkRedisServer()) {
        console.log('✅ Redis服务器已就绪');
        return true;
      }
      
      console.log(`⏳ 等待中... (${i + 1}/${this.maxRetries})`);
    }
    
    throw new Error('Redis服务器启动超时');
  }

  // 测试Redis连接和基本操作
  async testRedisOperations() {
    console.log('🔍 测试Redis基本操作...');
    
    try {
      const Redis = require('ioredis');
      const redis = new Redis(this.redisUrl);
      
      // 测试PING
      const pong = await redis.ping();
      console.log('✅ PING测试成功:', pong);
      
      // 测试SET/GET
      await redis.set('mcp:test', 'Hello MCP!');
      const value = await redis.get('mcp:test');
      console.log('✅ SET/GET测试成功:', value);
      
      // 清理测试数据
      await redis.del('mcp:test');
      
      redis.disconnect();
      console.log('✅ Redis基本操作测试完成');
      return true;
    } catch (error) {
      console.error('❌ Redis操作测试失败:', error.message);
      return false;
    }
  }

  // 启动Redis MCP服务器
  async startMCPServer() {
    console.log('🚀 正在启动Redis MCP服务器...');
    
    const mcpArgs = [
      '-y',
      '@modelcontextprotocol/server-redis',
      this.redisUrl
    ];

    console.log(`📋 MCP启动命令: npx ${mcpArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('npx', mcpArgs, {
        stdio: 'inherit',
        env: {
          ...process.env,
          REDIS_URL: this.redisUrl
        }
      });

      mcpProcess.on('spawn', () => {
        console.log('✅ Redis MCP服务器已启动');
        resolve(mcpProcess);
      });

      mcpProcess.on('error', (error) => {
        console.error('❌ Redis MCP启动失败:', error.message);
        reject(error);
      });

      mcpProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error(`❌ Redis MCP进程退出，代码: ${code}`);
          reject(new Error(`MCP进程退出，代码: ${code}`));
        }
      });
    });
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 主执行流程
  async run() {
    try {
      console.log('🔍 Redis MCP 自动启动流程开始...');
      console.log(`📍 Redis URL: ${this.redisUrl}`);
      console.log(`🖥️ 平台: ${this.platform}`);
      
      // 步骤1: 检查Redis服务器
      console.log('\n📊 步骤1: 检查Redis服务器状态');
      const isRedisRunning = await this.checkRedisServer();
      
      if (!isRedisRunning) {
        // 步骤2: 启动Redis服务器
        console.log('\n🚀 步骤2: 启动Redis服务器');
        await this.startRedisServer();
      }
      
      // 步骤3: 测试Redis连接
      console.log('\n🔍 步骤3: 测试Redis连接和操作');
      const connectionTest = await this.testRedisOperations();
      
      if (!connectionTest) {
        throw new Error('Redis连接测试失败');
      }
      
      // 步骤4: 启动Redis MCP服务器
      console.log('\n🚀 步骤4: 启动Redis MCP服务器');
      await this.startMCPServer();
      
      console.log('\n🎉 Redis MCP自动启动完成！');
      
    } catch (error) {
      console.error('\n❌ Redis MCP启动失败:', error.message);
      process.exit(1);
    }
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  
  switch (key) {
    case '--redis-url':
      options.redisUrl = value;
      break;
    case '--redis-host':
      options.redisHost = value;
      break;
    case '--redis-port':
      options.redisPort = parseInt(value);
      break;
    case '--redis-path':
      options.redisPath = value;
      break;
    case '--redis-config':
      options.redisConfig = value;
      break;
    case '--max-retries':
      options.maxRetries = parseInt(value);
      break;
    case '--retry-delay':
      options.retryDelay = parseInt(value);
      break;
  }
}

// 创建并运行Redis MCP包装器
const wrapper = new RedisMCPWrapper(options);
wrapper.run();