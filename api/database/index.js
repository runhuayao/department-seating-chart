/**
 * 数据库模块入口文件
 * 导出数据库连接和初始化函数
 */

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 根据环境变量选择数据库类型
const DATABASE_MODE = process.env.DATABASE_MODE || 'sqlite';

let db;

if (DATABASE_MODE === 'memory') {
  // 使用内存数据库
  const { MemoryDatabase } = await import('./memory.ts');
  db = new MemoryDatabase();
  console.log('🧠 使用内存数据库模式');
} else if (DATABASE_MODE === 'sqlite') {
  // 使用SQLite数据库
  const { getSqliteConnection } = await import('./sqlite-connection.ts');
  db = getSqliteConnection();
  console.log('📁 使用SQLite数据库模式');
} else {
  // 使用PostgreSQL数据库
  const { db: pgDb } = await import('./connection.ts');
  db = pgDb;
  console.log('🐘 使用PostgreSQL数据库模式');
}

/**
 * 初始化数据库
 * 测试连接并执行必要的初始化操作
 */
export async function initializeDatabase() {
  try {
    console.log('正在初始化数据库连接...');
    
    if (DATABASE_MODE === 'memory') {
      // 内存数据库不需要连接测试，直接返回成功
      console.log('内存数据库初始化完成');
      return true;
    } else {
      // 测试数据库连接
      const isConnected = await db.testConnection();
      if (!isConnected) {
        throw new Error('数据库连接测试失败');
      }
    }
    
    console.log('数据库初始化完成');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabaseConnections() {
  try {
    console.log('正在关闭数据库连接...');
    if (DATABASE_MODE === 'sqlite' && typeof db.close === 'function') {
      await db.close();
    } else if (db && typeof db.close === 'function') {
      await db.close();
    }
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('关闭数据库连接时出错:', error);
    throw error;
  }
}

// 导出数据库实例
export { db };

// 默认导出
export default {
  initializeDatabase,
  closeDatabaseConnections,
  db
};