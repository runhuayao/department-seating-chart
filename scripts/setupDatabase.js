#!/usr/bin/env node

/**
 * 数据库环境设置和初始化脚本
 * 自动创建数据库、运行迁移、导入M0数据并验证
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { execSync } = require('child_process');

// 系统数据库连接配置（用于创建数据库）
const systemDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // 连接到系统数据库
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 目标数据库配置
const targetDbConfig = {
  ...systemDbConfig,
  database: process.env.DB_NAME || 'department_map'
};

/**
 * 检查环境变量配置
 */
function checkEnvironment() {
  console.log('🔧 检查环境配置...');
  
  const envFile = path.join(__dirname, '..', '.env');
  const envExampleFile = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envFile)) {
    if (fs.existsSync(envExampleFile)) {
      console.log('⚠️  .env文件不存在，从.env.example复制...');
      fs.copyFileSync(envExampleFile, envFile);
      console.log('✓ .env文件已创建，请根据需要修改配置');
    } else {
      console.log('⚠️  .env和.env.example文件都不存在，使用默认配置');
    }
  } else {
    console.log('✓ .env文件存在');
  }
  
  // 加载环境变量
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
  }
  
  console.log('✓ 环境配置检查完成');
}

/**
 * 检查数据库连接
 */
async function checkDatabaseConnection() {
  console.log('\n🔌 检查数据库连接...');
  
  const pool = new Pool(systemDbConfig);
  try {
    const client = await pool.connect();
    await client.query('SELECT version()');
    client.release();
    console.log('✓ PostgreSQL连接成功');
    return true;
  } catch (error) {
    console.error('✗ PostgreSQL连接失败:', error.message);
    console.log('\n请确保:');
    console.log('1. PostgreSQL服务已启动');
    console.log('2. 连接参数正确 (host, port, user, password)');
    console.log('3. 用户有足够的权限');
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * 创建数据库
 */
async function createDatabase() {
  console.log('\n🗄️  创建数据库...');
  
  const pool = new Pool(systemDbConfig);
  try {
    const client = await pool.connect();
    
    // 检查数据库是否已存在
    const checkResult = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbConfig.database]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`✓ 数据库 ${targetDbConfig.database} 已存在`);
    } else {
      // 创建数据库
      await client.query(`CREATE DATABASE "${targetDbConfig.database}"`);
      console.log(`✓ 数据库 ${targetDbConfig.database} 创建成功`);
    }
    
    client.release();
    
  } catch (error) {
    console.error('✗ 数据库创建失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * 运行数据库迁移
 */
async function runMigrations() {
  console.log('\n📋 运行数据库迁移...');
  
  try {
    const migrateScript = path.join(__dirname, 'migrate.js');
    
    if (!fs.existsSync(migrateScript)) {
      throw new Error('迁移脚本不存在: ' + migrateScript);
    }
    
    // 设置环境变量
    const env = {
      ...process.env,
      DB_HOST: targetDbConfig.host,
      DB_PORT: targetDbConfig.port.toString(),
      DB_NAME: targetDbConfig.database,
      DB_USER: targetDbConfig.user,
      DB_PASSWORD: targetDbConfig.password
    };
    
    execSync(`node "${migrateScript}"`, {
      stdio: 'inherit',
      env: env,
      cwd: path.dirname(migrateScript)
    });
    
    console.log('✓ 数据库迁移完成');
    
  } catch (error) {
    console.error('✗ 数据库迁移失败:', error.message);
    throw error;
  }
}

/**
 * 导入M0数据
 */
async function importM0Data(force = false) {
  console.log('\n📦 导入M0数据...');
  
  try {
    const migrateM0Script = path.join(__dirname, 'migrateM0Data.js');
    
    if (!fs.existsSync(migrateM0Script)) {
      throw new Error('M0数据迁移脚本不存在: ' + migrateM0Script);
    }
    
    // 设置环境变量
    const env = {
      ...process.env,
      DB_HOST: targetDbConfig.host,
      DB_PORT: targetDbConfig.port.toString(),
      DB_NAME: targetDbConfig.database,
      DB_USER: targetDbConfig.user,
      DB_PASSWORD: targetDbConfig.password
    };
    
    const args = force ? ['--force'] : [];
    const command = `node "${migrateM0Script}" ${args.join(' ')}`;
    
    execSync(command, {
      stdio: 'inherit',
      env: env,
      cwd: path.dirname(migrateM0Script)
    });
    
    console.log('✓ M0数据导入完成');
    
  } catch (error) {
    console.error('✗ M0数据导入失败:', error.message);
    throw error;
  }
}

/**
 * 验证数据
 */
async function validateData() {
  console.log('\n🔍 验证数据完整性...');
  
  try {
    const validateScript = path.join(__dirname, 'validateData.js');
    
    if (!fs.existsSync(validateScript)) {
      throw new Error('数据验证脚本不存在: ' + validateScript);
    }
    
    // 设置环境变量
    const env = {
      ...process.env,
      DB_HOST: targetDbConfig.host,
      DB_PORT: targetDbConfig.port.toString(),
      DB_NAME: targetDbConfig.database,
      DB_USER: targetDbConfig.user,
      DB_PASSWORD: targetDbConfig.password
    };
    
    execSync(`node "${validateScript}"`, {
      stdio: 'inherit',
      env: env,
      cwd: path.dirname(validateScript)
    });
    
    console.log('✓ 数据验证通过');
    
  } catch (error) {
    if (error.status === 1) {
      console.log('⚠️  数据验证发现问题，请查看上述报告');
    } else {
      console.error('✗ 数据验证失败:', error.message);
    }
    throw error;
  }
}

/**
 * 生成连接信息
 */
function generateConnectionInfo() {
  console.log('\n📋 数据库连接信息:');
  console.log('=' .repeat(50));
  console.log(`主机: ${targetDbConfig.host}`);
  console.log(`端口: ${targetDbConfig.port}`);
  console.log(`数据库: ${targetDbConfig.database}`);
  console.log(`用户: ${targetDbConfig.user}`);
  console.log('=' .repeat(50));
  
  console.log('\n🚀 可用的npm脚本:');
  console.log('  npm run db:migrate        - 运行数据库迁移');
  console.log('  npm run db:migrate-m0     - 导入M0数据');
  console.log('  npm run db:validate       - 验证数据完整性');
  console.log('  npm run db:status         - 查看迁移状态');
  console.log('  npm run server:dev        - 启动后端开发服务器');
  console.log('  npm run client:dev        - 启动前端开发服务器');
  console.log('  npm run dev               - 同时启动前后端服务器');
}

/**
 * 主设置函数
 */
async function setupDatabase() {
  try {
    console.log('🚀 开始数据库环境设置...');
    
    // 解析命令行参数
    const args = process.argv.slice(2);
    const skipM0 = args.includes('--skip-m0');
    const force = args.includes('--force');
    const skipValidation = args.includes('--skip-validation');
    
    // 1. 检查环境配置
    checkEnvironment();
    
    // 2. 检查数据库连接
    const connected = await checkDatabaseConnection();
    if (!connected) {
      process.exit(1);
    }
    
    // 3. 创建数据库
    await createDatabase();
    
    // 4. 运行迁移
    await runMigrations();
    
    // 5. 导入M0数据（可选）
    if (!skipM0) {
      await importM0Data(force);
    } else {
      console.log('\n⏭️  跳过M0数据导入');
    }
    
    // 6. 验证数据（可选）
    if (!skipValidation) {
      try {
        await validateData();
      } catch (error) {
        console.log('\n⚠️  数据验证未通过，但设置过程继续');
      }
    } else {
      console.log('\n⏭️  跳过数据验证');
    }
    
    // 7. 生成连接信息
    generateConnectionInfo();
    
    console.log('\n🎉 数据库环境设置完成!');
    
  } catch (error) {
    console.error('\n💥 数据库环境设置失败:', error.message);
    console.log('\n🔧 故障排除建议:');
    console.log('1. 检查PostgreSQL服务是否运行');
    console.log('2. 验证.env文件中的数据库配置');
    console.log('3. 确保数据库用户有足够权限');
    console.log('4. 检查网络连接和防火墙设置');
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('数据库环境设置脚本');
  console.log('\n用法:');
  console.log('  node setupDatabase.js [选项]');
  console.log('\n选项:');
  console.log('  --skip-m0           跳过M0数据导入');
  console.log('  --force             强制清理现有数据后导入');
  console.log('  --skip-validation   跳过数据验证');
  console.log('  --help              显示此帮助信息');
  console.log('\n示例:');
  console.log('  node setupDatabase.js                    # 完整设置');
  console.log('  node setupDatabase.js --skip-m0          # 只创建表结构');
  console.log('  node setupDatabase.js --force            # 强制重新导入数据');
}

// 执行设置
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  setupDatabase();
}

module.exports = {
  setupDatabase,
  checkEnvironment,
  createDatabase,
  runMigrations,
  importM0Data,
  validateData
};

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n收到退出信号，正在退出...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n收到终止信号，正在退出...');
  process.exit(0);
});