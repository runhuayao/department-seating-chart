#!/usr/bin/env node

/**
 * 跨平台服务启动脚本
 * 自动检测并启动 PostgreSQL 和 Redis 服务
 */

const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');

const platform = os.platform();
const isWindows = platform === 'win32';
const isMacOS = platform === 'darwin';
const isLinux = platform === 'linux';

// 服务配置
const services = {
  postgresql: {
    name: 'PostgreSQL',
    windows: {
      serviceName: 'postgresql-x64-16', // 常见的Windows服务名
      checkCommand: 'sc query postgresql-x64-16',
      startCommand: 'net start postgresql-x64-16',
      testConnection: 'psql -U postgres -d postgres -c "SELECT 1;"',
      installCheckCommand: 'sc query postgresql-x64-16'
    },
    macos: {
      serviceName: 'postgresql',
      checkCommand: 'brew services list | grep postgresql',
      startCommand: 'brew services start postgresql',
      testConnection: 'psql -U postgres -d postgres -c "SELECT 1;"',
      installCheckCommand: 'which psql'
    },
    linux: {
      serviceName: 'postgresql',
      checkCommand: 'systemctl is-active postgresql',
      startCommand: 'sudo systemctl start postgresql',
      testConnection: 'sudo -u postgres psql -c "SELECT 1;"',
      installCheckCommand: 'which psql'
    }
  },
  redis: {
    name: 'Redis',
    windows: {
      serviceName: 'Redis',
      checkCommand: 'sc query Redis',
      startCommand: 'net start Redis',
      testConnection: 'redis-cli ping',
      installCheckCommand: 'sc query Redis'
    },
    macos: {
      serviceName: 'redis',
      checkCommand: 'brew services list | grep redis',
      startCommand: 'brew services start redis',
      testConnection: 'redis-cli ping',
      installCheckCommand: 'which redis-server'
    },
    linux: {
      serviceName: 'redis-server',
      checkCommand: 'systemctl is-active redis-server',
      startCommand: 'sudo systemctl start redis-server',
      testConnection: 'redis-cli ping',
      installCheckCommand: 'which redis-server'
    }
  }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 执行命令的Promise包装
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 10000, ...options }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error, stdout, stderr });
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

// 检查服务是否已安装
async function checkServiceInstalled(serviceName) {
  const service = services[serviceName];
  if (!service) {
    return false;
  }

  let config;
  if (isWindows) {
    config = service.windows;
  } else if (isMacOS) {
    config = service.macos;
  } else if (isLinux) {
    config = service.linux;
  } else {
    return false;
  }

  try {
    const result = await execCommand(config.installCheckCommand);
    return result.success;
  } catch (error) {
    return false;
  }
}

// 检查服务状态
async function checkServiceStatus(serviceName) {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  let config;
  if (isWindows) {
    config = service.windows;
  } else if (isMacOS) {
    config = service.macos;
  } else if (isLinux) {
    config = service.linux;
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  log(`检查 ${service.name} 服务状态...`, 'blue');
  
  const result = await execCommand(config.checkCommand);
  
  if (isWindows) {
    // Windows: 检查服务是否运行
    return result.success && result.stdout.includes('RUNNING');
  } else if (isMacOS) {
    // macOS: 检查brew services输出
    return result.success && result.stdout.includes('started');
  } else if (isLinux) {
    // Linux: 检查systemctl状态
    return result.success && result.stdout.trim() === 'active';
  }
  
  return false;
}

// 启动服务
async function startService(serviceName) {
  const service = services[serviceName];
  let config;
  
  if (isWindows) {
    config = service.windows;
  } else if (isMacOS) {
    config = service.macos;
  } else if (isLinux) {
    config = service.linux;
  }

  log(`启动 ${service.name} 服务...`, 'yellow');
  
  const result = await execCommand(config.startCommand);
  
  if (result.success) {
    log(`${service.name} 服务启动成功`, 'green');
    return true;
  } else {
    log(`${service.name} 服务启动失败: ${result.error?.message || result.stderr}`, 'red');
    return false;
  }
}

// 测试服务连接
async function testServiceConnection(serviceName) {
  const service = services[serviceName];
  let config;
  
  if (isWindows) {
    config = service.windows;
  } else if (isMacOS) {
    config = service.macos;
  } else if (isLinux) {
    config = service.linux;
  }

  log(`测试 ${service.name} 连接...`, 'cyan');
  
  // 等待服务完全启动
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const result = await execCommand(config.testConnection);
  
  if (result.success) {
    log(`${service.name} 连接测试成功`, 'green');
    return true;
  } else {
    log(`${service.name} 连接测试失败，但服务可能仍在启动中`, 'yellow');
    return false;
  }
}

// 主函数
async function main() {
  log('=== 服务启动检查器 ===', 'magenta');
  log(`检测到平台: ${platform}`, 'blue');
  
  const servicesToCheck = ['postgresql', 'redis'];
  const results = {};
  
  for (const serviceName of servicesToCheck) {
    try {
      const isInstalled = await checkServiceInstalled(serviceName);
      
      if (!isInstalled) {
        log(`⚠️  ${services[serviceName].name} 未安装，跳过启动`, 'yellow');
        if (serviceName === 'redis') {
          log('   如需使用搜索功能，请安装 Redis 服务', 'yellow');
        }
        results[serviceName] = false;
      } else {
        const isRunning = await checkServiceStatus(serviceName);
        
        if (isRunning) {
          log(`${services[serviceName].name} 服务已运行`, 'green');
          results[serviceName] = true;
        } else {
          log(`${services[serviceName].name} 服务未运行，尝试启动...`, 'yellow');
          
          const started = await startService(serviceName);
          if (started) {
            const connected = await testServiceConnection(serviceName);
            results[serviceName] = connected;
          } else {
            results[serviceName] = false;
          }
        }
      }
    } catch (error) {
      log(`处理 ${services[serviceName].name} 时出错: ${error.message}`, 'red');
      results[serviceName] = false;
    }
  }
  
  // 输出总结
  log('\n=== 服务状态总结 ===', 'magenta');
  
  const postgresReady = results.postgresql;
  const redisInstalled = await checkServiceInstalled('redis');
  const redisReady = results.redis;
  
  log(`PostgreSQL: ${postgresReady ? '✓ 就绪' : '✗ 未就绪'}`, postgresReady ? 'green' : 'red');
  
  if (redisInstalled) {
    log(`Redis: ${redisReady ? '✓ 就绪' : '✗ 未就绪'}`, redisReady ? 'green' : 'red');
  } else {
    log('Redis: ⚠️  未安装 (搜索功能将不可用)', 'yellow');
  }
  
  // PostgreSQL 是必需的，Redis 是可选的
  if (postgresReady) {
    if (redisInstalled && redisReady) {
      log('\n🎉 所有服务已就绪，可以启动应用程序！', 'green');
    } else if (redisInstalled && !redisReady) {
      log('\n⚠️  PostgreSQL 已就绪，但 Redis 未就绪', 'yellow');
      log('   应用程序可以启动，但搜索功能将不可用', 'yellow');
    } else {
      log('\n✅ PostgreSQL 已就绪，应用程序可以启动', 'green');
      log('   注意：Redis 未安装，搜索功能将不可用', 'yellow');
    }
    process.exit(0);
  } else {
    log('\n❌ PostgreSQL 未就绪，无法启动应用程序', 'red');
    
    log('\n手动启动建议:', 'yellow');
    if (isWindows) {
      log('PostgreSQL: net start postgresql-x64-16', 'cyan');
    } else if (isMacOS) {
      log('PostgreSQL: brew services start postgresql', 'cyan');
    } else {
      log('PostgreSQL: sudo systemctl start postgresql', 'cyan');
    }
    
    if (redisInstalled && !redisReady) {
      if (isWindows) {
        log('Redis: net start Redis', 'cyan');
      } else if (isMacOS) {
        log('Redis: brew services start redis', 'cyan');
      } else {
        log('Redis: sudo systemctl start redis-server', 'cyan');
      }
    }
    
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  log(`未捕获的异常: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`未处理的Promise拒绝: ${reason}`, 'red');
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    log(`启动脚本执行失败: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main, checkServiceInstalled, checkServiceStatus, startService, testServiceConnection };