#!/usr/bin/env node

/**
 * 服务健康检查脚本
 * 检查 PostgreSQL 和 Redis 服务的详细状态
 */

const { exec } = require('child_process');
const os = require('os');
const net = require('net');

const platform = os.platform();
const isWindows = platform === 'win32';

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
    exec(command, { timeout: 5000, ...options }, (error, stdout, stderr) => {
      resolve({ 
        success: !error, 
        error, 
        stdout: stdout?.trim() || '', 
        stderr: stderr?.trim() || '' 
      });
    });
  });
}

// 检查端口是否开放
function checkPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    
    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);
    
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

// 检查PostgreSQL状态
async function checkPostgreSQL() {
  log('\n=== PostgreSQL 健康检查 ===', 'blue');
  
  const checks = {
    service: false,
    port: false,
    connection: false,
    version: null
  };
  
  // 1. 检查服务状态
  try {
    let serviceCommand;
    if (isWindows) {
      serviceCommand = 'sc query postgresql-x64-16';
    } else if (platform === 'darwin') {
      serviceCommand = 'brew services list | grep postgresql';
    } else {
      serviceCommand = 'systemctl is-active postgresql';
    }
    
    const serviceResult = await execCommand(serviceCommand);
    
    if (isWindows) {
      checks.service = serviceResult.success && serviceResult.stdout.includes('RUNNING');
    } else if (platform === 'darwin') {
      checks.service = serviceResult.success && serviceResult.stdout.includes('started');
    } else {
      checks.service = serviceResult.success && serviceResult.stdout === 'active';
    }
    
    log(`服务状态: ${checks.service ? '✓ 运行中' : '✗ 未运行'}`, checks.service ? 'green' : 'red');
  } catch (error) {
    log(`服务状态检查失败: ${error.message}`, 'red');
  }
  
  // 2. 检查端口
  checks.port = await checkPort('localhost', 5432);
  log(`端口 5432: ${checks.port ? '✓ 开放' : '✗ 关闭'}`, checks.port ? 'green' : 'red');
  
  // 3. 检查数据库连接
  try {
    const connectionResult = await execCommand('psql -U postgres -d postgres -c "SELECT version();"', {
      env: { ...process.env, PGPASSWORD: 'postgres' }
    });
    
    checks.connection = connectionResult.success;
    
    if (checks.connection && connectionResult.stdout) {
      const versionMatch = connectionResult.stdout.match(/PostgreSQL ([\d\.]+)/);
      checks.version = versionMatch ? versionMatch[1] : 'Unknown';
    }
    
    log(`数据库连接: ${checks.connection ? '✓ 成功' : '✗ 失败'}`, checks.connection ? 'green' : 'red');
    
    if (checks.version) {
      log(`PostgreSQL 版本: ${checks.version}`, 'cyan');
    }
    
    if (!checks.connection && connectionResult.stderr) {
      log(`连接错误: ${connectionResult.stderr}`, 'yellow');
    }
  } catch (error) {
    log(`数据库连接检查失败: ${error.message}`, 'red');
  }
  
  return checks;
}

// 检查Redis状态
async function checkRedis() {
  log('\n=== Redis 健康检查 ===', 'blue');
  
  const checks = {
    service: false,
    port: false,
    connection: false,
    version: null,
    memory: null
  };
  
  // 1. 检查服务状态
  try {
    let serviceCommand;
    if (isWindows) {
      serviceCommand = 'sc query Redis';
    } else if (platform === 'darwin') {
      serviceCommand = 'brew services list | grep redis';
    } else {
      serviceCommand = 'systemctl is-active redis-server';
    }
    
    const serviceResult = await execCommand(serviceCommand);
    
    if (isWindows) {
      checks.service = serviceResult.success && serviceResult.stdout.includes('RUNNING');
    } else if (platform === 'darwin') {
      checks.service = serviceResult.success && serviceResult.stdout.includes('started');
    } else {
      checks.service = serviceResult.success && serviceResult.stdout === 'active';
    }
    
    log(`服务状态: ${checks.service ? '✓ 运行中' : '✗ 未运行'}`, checks.service ? 'green' : 'red');
  } catch (error) {
    log(`服务状态检查失败: ${error.message}`, 'red');
  }
  
  // 2. 检查端口
  checks.port = await checkPort('localhost', 6379);
  log(`端口 6379: ${checks.port ? '✓ 开放' : '✗ 关闭'}`, checks.port ? 'green' : 'red');
  
  // 3. 检查Redis连接和信息
  try {
    const pingResult = await execCommand('redis-cli ping');
    checks.connection = pingResult.success && pingResult.stdout === 'PONG';
    
    log(`Redis连接: ${checks.connection ? '✓ 成功' : '✗ 失败'}`, checks.connection ? 'green' : 'red');
    
    if (checks.connection) {
      // 获取Redis版本信息
      const infoResult = await execCommand('redis-cli info server');
      if (infoResult.success) {
        const versionMatch = infoResult.stdout.match(/redis_version:([\d\.]+)/);
        checks.version = versionMatch ? versionMatch[1] : 'Unknown';
        
        if (checks.version) {
          log(`Redis 版本: ${checks.version}`, 'cyan');
        }
      }
      
      // 获取内存使用信息
      const memoryResult = await execCommand('redis-cli info memory');
      if (memoryResult.success) {
        const memoryMatch = memoryResult.stdout.match(/used_memory_human:([^\r\n]+)/);
        checks.memory = memoryMatch ? memoryMatch[1] : null;
        
        if (checks.memory) {
          log(`内存使用: ${checks.memory}`, 'cyan');
        }
      }
    } else if (pingResult.stderr) {
      log(`连接错误: ${pingResult.stderr}`, 'yellow');
    }
  } catch (error) {
    log(`Redis连接检查失败: ${error.message}`, 'red');
  }
  
  return checks;
}

// 生成健康报告
function generateHealthReport(postgresChecks, redisChecks) {
  log('\n=== 服务健康报告 ===', 'magenta');
  
  const postgresHealthy = postgresChecks.service && postgresChecks.port && postgresChecks.connection;
  const redisHealthy = redisChecks.service && redisChecks.port && redisChecks.connection;
  
  log(`PostgreSQL: ${postgresHealthy ? '✓ 健康' : '✗ 异常'}`, postgresHealthy ? 'green' : 'red');
  log(`Redis: ${redisHealthy ? '✓ 健康' : '✗ 异常'}`, redisHealthy ? 'green' : 'red');
  
  const overallHealthy = postgresHealthy && redisHealthy;
  log(`\n整体状态: ${overallHealthy ? '✓ 所有服务正常' : '✗ 部分服务异常'}`, overallHealthy ? 'green' : 'red');
  
  if (!overallHealthy) {
    log('\n建议操作:', 'yellow');
    
    if (!postgresHealthy) {
      log('PostgreSQL 问题:', 'red');
      if (!postgresChecks.service) {
        log('  - 启动 PostgreSQL 服务', 'cyan');
      }
      if (!postgresChecks.port) {
        log('  - 检查 PostgreSQL 配置和防火墙设置', 'cyan');
      }
      if (!postgresChecks.connection) {
        log('  - 检查数据库用户权限和密码', 'cyan');
      }
    }
    
    if (!redisHealthy) {
      log('Redis 问题:', 'red');
      if (!redisChecks.service) {
        log('  - 启动 Redis 服务', 'cyan');
      }
      if (!redisChecks.port) {
        log('  - 检查 Redis 配置和防火墙设置', 'cyan');
      }
      if (!redisChecks.connection) {
        log('  - 检查 Redis 配置文件', 'cyan');
      }
    }
  }
  
  return overallHealthy;
}

// 主函数
async function main() {
  log('=== 服务健康检查器 ===', 'magenta');
  log(`平台: ${platform}`, 'blue');
  log(`时间: ${new Date().toLocaleString()}`, 'blue');
  
  try {
    const postgresChecks = await checkPostgreSQL();
    const redisChecks = await checkRedis();
    
    const isHealthy = generateHealthReport(postgresChecks, redisChecks);
    
    process.exit(isHealthy ? 0 : 1);
  } catch (error) {
    log(`\n健康检查失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    log(`脚本执行失败: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main, checkPostgreSQL, checkRedis, generateHealthReport };