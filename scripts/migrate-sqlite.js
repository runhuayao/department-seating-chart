#!/usr/bin/env node

/**
 * SQLite数据库迁移执行脚本
 * 用于执行migrations目录下的SQL迁移文件
 * 支持SQLite数据库
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'department_map.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 迁移文件目录
const migrationsDir = path.join(__dirname, '..', 'migrations');

/**
 * 创建迁移记录表
 */
function createMigrationsTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        execution_time_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
    `);
    console.log('✓ 迁移记录表已创建');
  } catch (error) {
    console.error('✗ 创建迁移记录表失败:', error.message);
    throw error;
  }
}

/**
 * 获取已执行的迁移文件列表
 */
function getExecutedMigrations() {
  try {
    const stmt = db.prepare('SELECT filename FROM schema_migrations ORDER BY filename');
    const rows = stmt.all();
    return rows.map(row => row.filename);
  } catch (error) {
    console.error('✗ 获取已执行迁移列表失败:', error.message);
    throw error;
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
 * 转换PostgreSQL SQL为SQLite兼容格式
 */
function convertPostgreSQLToSQLite(sql) {
  return sql
    // 移除PostgreSQL特定的语法
    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME')
    .replace(/TIMESTAMP/gi, 'DATETIME')
    .replace(/CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP')
    .replace(/VARCHAR\((\d+)\)/gi, 'TEXT')
    .replace(/TEXT\[\]/gi, 'TEXT')
    .replace(/JSONB/gi, 'TEXT')
    .replace(/JSON/gi, 'TEXT')
    // 移除PostgreSQL扩展
    .replace(/CREATE EXTENSION IF NOT EXISTS[^;]+;/gi, '')
    // 处理索引创建
    .replace(/CREATE INDEX CONCURRENTLY/gi, 'CREATE INDEX')
    // 移除PostgreSQL特定函数
    .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/CURRENT_DATE/gi, 'date("now")')
    // 处理布尔类型
    .replace(/BOOLEAN/gi, 'INTEGER')
    .replace(/TRUE/gi, '1')
    .replace(/FALSE/gi, '0')
    // 移除不支持的约束
    .replace(/ON DELETE CASCADE/gi, '')
    .replace(/ON UPDATE CASCADE/gi, '')
    // 清理多余的空行和注释
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * 执行单个迁移文件
 */
function executeMigration(filename) {
  const filePath = path.join(migrationsDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 转换PostgreSQL语法为SQLite兼容格式
  content = convertPostgreSQLToSQLite(content);
  
  const checksum = calculateChecksum(content);
  
  console.log(`\n📄 执行迁移: ${filename}`);
  
  const startTime = Date.now();
  
  try {
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    // 分割SQL语句并逐个执行
    const statements = content.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      const trimmedStmt = statement.trim();
      if (trimmedStmt) {
        try {
          db.exec(trimmedStmt);
        } catch (error) {
          console.warn(`⚠️  跳过语句 (可能不兼容): ${trimmedStmt.substring(0, 50)}...`);
          console.warn(`   错误: ${error.message}`);
        }
      }
    }
    
    // 记录迁移执行
    const executionTime = Date.now() - startTime;
    const insertStmt = db.prepare(
      'INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES (?, ?, ?)'
    );
    insertStmt.run(filename, checksum, executionTime);
    
    // 提交事务
    db.exec('COMMIT');
    
    console.log(`✓ 迁移 ${filename} 执行成功 (${executionTime}ms)`);
    
  } catch (error) {
    // 回滚事务
    db.exec('ROLLBACK');
    console.error(`✗ 迁移 ${filename} 执行失败:`, error.message);
    throw error;
  }
}

/**
 * 显示迁移状态
 */
function showMigrationStatus() {
  try {
    const executedMigrations = getExecutedMigrations();
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
function runMigrations() {
  try {
    console.log('🚀 开始SQLite数据库迁移...');
    console.log('📋 数据库文件:', dbPath);
    
    // 创建迁移记录表
    createMigrationsTable();
    
    // 获取待执行的迁移
    const executedMigrations = getExecutedMigrations();
    const pendingMigrations = getPendingMigrations(executedMigrations);
    
    if (pendingMigrations.length === 0) {
      console.log('\n✅ 所有迁移都已执行，无需更新');
      return;
    }
    
    console.log(`\n📦 发现 ${pendingMigrations.length} 个待执行的迁移`);
    
    // 执行所有待执行的迁移
    for (const migration of pendingMigrations) {
      executeMigration(migration);
    }
    
    console.log('\n🎉 所有迁移执行完成！');
    
  } catch (error) {
    console.error('\n💥 迁移执行失败:', error.message);
    process.exit(1);
  }
}

/**
 * 回滚迁移函数
 */
function rollbackMigration(filename) {
  try {
    console.log(`🔄 回滚迁移: ${filename}`);
    
    // SQLite不支持复杂的回滚，这里只是从记录中删除
    const deleteStmt = db.prepare('DELETE FROM schema_migrations WHERE filename = ?');
    const result = deleteStmt.run(filename);
    
    if (result.changes > 0) {
      console.log(`✓ 迁移记录 ${filename} 已删除`);
      console.log('⚠️  注意: SQLite不支持自动回滚，请手动检查数据库状态');
    } else {
      console.log(`⚠️  未找到迁移记录: ${filename}`);
    }
    
  } catch (error) {
    console.error('✗ 回滚失败:', error.message);
    throw error;
  }
}

/**
 * 处理命令行参数
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'up':
      case undefined:
        runMigrations();
        break;
        
      case 'status':
        showMigrationStatus();
        break;
        
      case 'rollback':
        const filename = args[1];
        if (!filename) {
          console.error('✗ 请指定要回滚的迁移文件名');
          process.exit(1);
        }
        rollbackMigration(filename);
        break;
        
      default:
        console.log('用法:');
        console.log('  node migrate-sqlite.js [up]     - 执行所有待执行的迁移');
        console.log('  node migrate-sqlite.js status   - 显示迁移状态');
        console.log('  node migrate-sqlite.js rollback <filename> - 回滚指定迁移');
        break;
    }
  } catch (error) {
    console.error('💥 执行失败:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    db.close();
  }
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，正在关闭数据库连接...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在关闭数据库连接...');
  db.close();
  process.exit(0);
});

// 执行主函数
main();