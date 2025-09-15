/**
 * 数据库连接和SQL查询测试脚本
 * 验证数据库基础功能和响应能力
 */

import { db } from '../api/database/index.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 测试数据库连接
 */
async function testDatabaseConnection() {
  console.log('🔌 测试数据库连接...');
  
  try {
    // 测试基础连接
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('✅ 数据库连接成功');
      return true;
    } else {
      console.log('❌ 数据库连接失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error.message);
    return false;
  }
}

/**
 * 测试基础SQL查询
 */
async function testBasicQueries() {
  console.log('\n📊 测试基础SQL查询...');
  
  try {
    // 测试部门查询
    console.log('1. 测试部门表查询:');
    const departments = await db.query('SELECT * FROM departments LIMIT 3');
    console.log(`   ✅ 查询到 ${departments.length} 个部门`);
    if (departments.length > 0) {
      console.log(`   📋 示例: ${departments[0].name}`);
    }
    
    // 测试员工查询
    console.log('2. 测试员工表查询:');
    const employees = await db.query('SELECT * FROM employees LIMIT 3');
    console.log(`   ✅ 查询到 ${employees.length} 个员工`);
    if (employees.length > 0) {
      console.log(`   👤 示例: ${employees[0].name}`);
    }
    
    // 测试工位查询
    console.log('3. 测试工位表查询:');
    const workstations = await db.query('SELECT * FROM workstations LIMIT 3');
    console.log(`   ✅ 查询到 ${workstations.length} 个工位`);
    if (workstations.length > 0) {
      console.log(`   🪑 示例: ${workstations[0].name}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ SQL查询测试失败:', error.message);
    return false;
  }
}

/**
 * 测试复杂查询和事务
 */
async function testAdvancedQueries() {
  console.log('\n🔍 测试复杂查询...');
  
  try {
    // 测试联表查询
    const joinQuery = `
      SELECT e.name as employee_name, e.department as department_name 
      FROM employees e 
      LIMIT 3
    `;
    const joinResults = await db.query(joinQuery);
    console.log(`   ✅ 联表查询成功，返回 ${joinResults.length} 条记录`);
    
    // 测试聚合查询
    const countQuery = 'SELECT COUNT(*) as total FROM employees';
    const countResult = await db.query(countQuery);
    console.log(`   ✅ 聚合查询成功，员工总数: ${countResult[0].total}`);
    
    return true;
  } catch (error) {
    console.error('❌ 复杂查询测试失败:', error.message);
    return false;
  }
}

/**
 * 测试数据库响应时间
 */
async function testResponseTime() {
  console.log('\n⏱️ 测试数据库响应时间...');
  
  try {
    const startTime = Date.now();
    await db.query('SELECT COUNT(*) FROM employees');
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`   ✅ 查询响应时间: ${responseTime}ms`);
    
    if (responseTime < 100) {
      console.log('   🚀 响应速度: 优秀');
    } else if (responseTime < 500) {
      console.log('   ⚡ 响应速度: 良好');
    } else {
      console.log('   ⚠️ 响应速度: 需要优化');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 响应时间测试失败:', error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runDatabaseTests() {
  console.log('🚀 开始数据库功能测试...');
  console.log(`📊 数据库模式: ${process.env.DATABASE_MODE}`);
  console.log('=' .repeat(50));
  
  let allTestsPassed = true;
  
  // 1. 连接测试
  const connectionTest = await testDatabaseConnection();
  allTestsPassed = allTestsPassed && connectionTest;
  
  if (connectionTest) {
    // 2. 基础查询测试
    const basicTest = await testBasicQueries();
    allTestsPassed = allTestsPassed && basicTest;
    
    // 3. 复杂查询测试
    const advancedTest = await testAdvancedQueries();
    allTestsPassed = allTestsPassed && advancedTest;
    
    // 4. 响应时间测试
    const responseTest = await testResponseTime();
    allTestsPassed = allTestsPassed && responseTest;
  }
  
  console.log('\n' + '=' .repeat(50));
  if (allTestsPassed) {
    console.log('🎉 所有数据库测试通过！');
    console.log('✅ 数据库服务正常运行，可以正常响应SQL查询');
  } else {
    console.log('❌ 部分测试失败，请检查数据库配置');
  }
  
  return allTestsPassed;
}

// 运行测试
runDatabaseTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });

export { runDatabaseTests };