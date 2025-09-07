#!/usr/bin/env node

/**
 * 数据库迁移执行脚本
 * 用于执行migrations目录下的SQL迁移文件
 * 支持PostgreSQL数据库
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 创建数据库连接池
const pool = new Pool(dbConfig);

// 迁移文件目录
const migrationsDir = path.join(__dirname, '..', 'migrations');

/**
 * 创建迁移记录表
 */
async function createMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
    `);
    console.log('✓ 迁移记录表已创建');
  } catch (error) {
    console.error('✗ 创建迁移记录表失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 获取已执行的迁移文件列表
 */
async function getExecutedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
    return result.rows.map(row => row.filename);
  } catch (error) {
    console.error('✗ 获取已执行迁移列表失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 获取待执行的迁移文件列表
 */
function getPendingMigrations(executedMigrations) {
  if (!fs.existsSync(migrationsDir)) {
    console.log('✓ 迁移目录不存在，跳过迁移');
    return [];
  }

  const allMigrations = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  const pendingMigrations = allMigrations.filter(file => 
    !executedMigrations.includes(file)
  );

  return pendingMigrations;
}

/**
 * 计算文件校验和
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 执行单个迁移文件
 */
async function executeMigration(filename) {
  const filePath = path.join(migrationsDir, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const checksum = calculateChecksum(content);
  
  console.log(`\n📄 执行迁移: ${filename}`);
  
  const client = await pool.connect();
  const startTime = Date.now();
  
  try {
    // 开始事务
    await client.query('BEGIN');
    
    // 执行迁移SQL
    await client.query(content);
    
    // 记录迁移执行
    const executionTime = Date.now() - startTime;
    await client.query(
      'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3)',
      [filename, checksum, executionTime]
    );
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log(`✓ 迁移 ${filename} 执行成功 (${executionTime}ms)`);
    
  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    console.error(`✗ 迁移 ${filename} 执行失败:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 验证数据库连接
 */
async function validateConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✓ 数据库连接成功');
  } catch (error) {
    console.error('✗ 数据库连接失败:', error.message);
    console.error('请检查数据库配置和连接参数');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 显示迁移状态
 */
async function showMigrationStatus() {
  try {
    const executedMigrations = await getExecutedMigrations();
    const pendingMigrations = getPendingMigrations(executedMigrations);
    
    console.log('\n📊 迁移状态:');
    console.log(`   已执行: ${executedMigrations.length} 个迁移`);
    console.log(`   待执行: ${pendingMigrations.length} 个迁移`);
    
    if (executedMigrations.length > 0) {
      console.log('\n✅ 已执行的迁移:');
      executedMigrations.forEach(migration => {
        console.log(`   - ${migration}`);
      });
    }
    
    if (pendingMigrations.length > 0) {
      console.log('\n⏳ 待执行的迁移:');
      pendingMigrations.forEach(migration => {
        console.log(`   - ${migration}`);
      });
    }
    
  } catch (error) {
    console.error('✗ 获取迁移状态失败:', error.message);
  }
}

/**
 * 主迁移函数
 */
async function runMigrations() {
  try {
    console.log('🚀 开始数据库迁移...');
    console.log('📋 数据库配置:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      ssl: !!dbConfig.ssl
    });
    
    // 验证数据库连接
    await validateConnection();
    
    // 创建迁移记录表
    await createMigrationsTable();
    
    // 获取已执行和待执行的迁移
    const executedMigrations = await getExecutedMigrations();
    const pendingMigrations = getPendingMigrations(executedMigrations);
    
    if (pendingMigrations.length === 0) {
      console.log('\n✅ 所有迁移已执行完成，无需执行新的迁移');
      await showMigrationStatus();
      return;
    }
    
    console.log(`\n📝 发现 ${pendingMigrations.length} 个待执行的迁移`);
    
    // 执行待执行的迁移
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    console.log('\n🎉 所有迁移执行完成!');
    await showMigrationStatus();
    
  } catch (error) {
    console.error('\n💥 迁移执行失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * 回滚迁移（简单实现）
 */
async function rollbackMigration(filename) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 删除迁移记录
    const result = await client.query(
      'DELETE FROM schema_migrations WHERE filename = $1 RETURNING *',
      [filename]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`迁移 ${filename} 未找到或未执行`);
    }
    
    await client.query('COMMIT');
    console.log(`✓ 迁移 ${filename} 回滚成功`);
    console.log('⚠️  注意: 数据库结构变更需要手动处理');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ 迁移 ${filename} 回滚失败:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'up':
  case undefined:
    runMigrations();
    break;
    
  case 'status':
    (async () => {
      try {
        await validateConnection();
        await createMigrationsTable();
        await showMigrationStatus();
      } catch (error) {
        console.error('获取状态失败:', error.message);
        process.exit(1);
      } finally {
        await pool.end();
      }
    })();
    break;
    
  case 'rollback':
    const filename = args[1];
    if (!filename) {
      console.error('请指定要回滚的迁移文件名');
      console.error('用法: node migrate.js rollback <filename>');
      process.exit(1);
    }
    (async () => {
      try {
        await validateConnection();
        await rollbackMigration(filename);
      } catch (error) {
        console.error('回滚失败:', error.message);
        process.exit(1);
      } finally {
        await pool.end();
      }
    })();
    break;
    
  default:
    console.log('用法:');
    console.log('  node migrate.js [up]     - 执行待执行的迁移');
    console.log('  node migrate.js status   - 显示迁移状态');
    console.log('  node migrate.js rollback <filename> - 回滚指定迁移');
    process.exit(1);
}

// 优雅退出处理
process.on('SIGINT', async () => {
  console.log('\n收到退出信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n收到终止信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});