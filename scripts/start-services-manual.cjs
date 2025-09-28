#!/usr/bin/env node

/**
 * 手动启动服务脚本
 * 提供交互式的服务启动选项
 */

const { exec } = require('child_process');
const os = require('os');
const readline = require('readline');

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

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 执行命令的Promise包装
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    log(`执行命令: ${command}`, 'cyan');
    
    const child = exec(command, { timeout: 30000, ...options }, (error, stdout, stderr) => {
      resolve({ 
        success: !error, 
        error, 
        stdout: stdout?.trim() || '', 
        stderr: stderr?.trim() || '' 
      });
    });
    
    // 实时输出
    child.stdout?.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

// 询问用户选择
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

// 启动PostgreSQL服务
async function startPostgreSQL() {
  log('\n=== 启动 PostgreSQL 服务 ===', 'blue');
  
  let command;
  if (isWindows) {
    command = 'net start postgresql-x64-16';
  } else if (platform === 'darwin') {
    command = 'brew services start postgresql@16';
  } else {
    command = 'sudo systemctl start postgresql';
  }
  
  try {
    const result = await execCommand(command);
    
    if (result.success) {
      log('✓ PostgreSQL 服务启动成功', 'green');
      return true;
    } else {
      log('✗ PostgreSQL 服务启动失败', 'red');
      if (result.stderr) {
        log(`错误信息: ${result.stderr}`, 'yellow');
      }
      return false;
    }
  } catch (error) {
    log(`PostgreSQL 启动异常: ${error.message}`, 'red');
    return false;
  }
}

// 启动Redis服务
async function startRedis() {
  log('\n=== 启动 Redis 服务 ===', 'blue');
  
  let command;
  if (isWindows) {
    command = 'net start Redis';
  } else if (platform === 'darwin') {
    command = 'brew services start redis';
  } else {
    command = 'sudo systemctl start redis-server';
  }
  
  try {
    const result = await execCommand(command);
    
    if (result.success) {
      log('✓ Redis 服务启动成功', 'green');
      return true;
    } else {
      log('✗ Redis 服务启动失败', 'red');
      if (result.stderr) {
        log(`错误信息: ${result.stderr}`, 'yellow');
      }
      return false;
    }
  } catch (error) {
    log(`Redis 启动异常: ${error.message}`, 'red');
    return false;
  }
}

// 显示菜单
function showMenu() {
  log('\n=== 服务管理菜单 ===', 'magenta');
  log('1. 启动 PostgreSQL', 'cyan');
  log('2. 启动 Redis', 'cyan');
  log('3. 启动所有服务', 'cyan');
  log('4. 检查服务状态', 'cyan');
  log('5. 退出', 'cyan');
  log('');
}

// 检查服务状态
async function checkServicesStatus() {
  log('\n=== 检查服务状态 ===', 'blue');
  
  try {
    const { main } = require('./check-services.cjs');
    await main();
  } catch (error) {
    log(`状态检查失败: ${error.message}`, 'red');
    log('请确保 check-services.js 文件存在', 'yellow');
  }
}

// 主菜单循环
async function mainMenu() {
  while (true) {
    showMenu();
    
    const choice = await askQuestion('请选择操作 (1-5): ');
    
    switch (choice) {
      case '1':
        await startPostgreSQL();
        break;
        
      case '2':
        await startRedis();
        break;
        
      case '3':
        log('\n=== 启动所有服务 ===', 'blue');
        const pgResult = await startPostgreSQL();
        const redisResult = await startRedis();
        
        if (pgResult && redisResult) {
          log('\n✓ 所有服务启动成功！', 'green');
        } else {
          log('\n✗ 部分服务启动失败，请检查错误信息', 'red');
        }
        break;
        
      case '4':
        await checkServicesStatus();
        break;
        
      case '5':
        log('\n再见！', 'green');
        rl.close();
        return;
        
      default:
        log('\n无效选择，请输入 1-5', 'red');
        break;
    }
    
    // 询问是否继续
    const continueChoice = await askQuestion('\n按 Enter 继续，或输入 q 退出: ');
    if (continueChoice === 'q') {
      log('\n再见！', 'green');
      rl.close();
      return;
    }
  }
}

// 主函数
async function main() {
  log('=== 服务手动启动工具 ===', 'magenta');
  log(`平台: ${platform}`, 'blue');
  log(`时间: ${new Date().toLocaleString()}`, 'blue');
  
  // 检查是否以管理员权限运行（Windows）
  if (isWindows) {
    log('\n注意: 在 Windows 上启动服务可能需要管理员权限', 'yellow');
    log('如果遇到权限错误，请以管理员身份运行命令提示符', 'yellow');
  }
  
  // 检查是否有sudo权限（Linux）
  if (platform === 'linux') {
    log('\n注意: 在 Linux 上启动系统服务需要 sudo 权限', 'yellow');
    log('请确保当前用户有 sudo 权限', 'yellow');
  }
  
  try {
    await mainMenu();
  } catch (error) {
    log(`\n程序执行失败: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    log(`脚本执行失败: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  });
}

module.exports = { main, startPostgreSQL, startRedis };