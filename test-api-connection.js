/**
 * API连接测试脚本
 * 测试数据库连接、用户创建和API端点访问
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import bcrypt from 'bcrypt';
// 加载环境变量
dotenv.config();

// 导入SQLite数据库连接
import { getSqliteConnection } from './api/database/sqlite-connection.ts';
const db = getSqliteConnection();

const API_BASE = 'http://localhost:8080/api';

// 测试结果收集
const testResults = [];

// 添加测试结果
function addTestResult(testName, passed, message) {
  testResults.push({ testName, passed, message });
  console.log(`${passed ? '✅' : '❌'} ${testName}: ${message}`);
}

// HTTP请求封装
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      status: response.status,
      data,
      headers: response.headers
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      data: null
    };
  }
}

// 测试1: 数据库连接
async function testDatabaseConnection() {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM departments');
    const passed = result && result.length > 0;
    addTestResult('数据库连接', passed, passed ? `查询成功，部门数量: ${result[0].count}` : '查询失败');
    return passed;
  } catch (error) {
    addTestResult('数据库连接', false, `连接失败: ${error.message}`);
    return false;
  }
}

// 测试2: 创建测试用户
async function createTestUser() {
  try {
    // 检查测试用户是否已存在
    const existingUser = await db.query('SELECT id FROM users WHERE username = ?', ['testuser']);
    
    if (existingUser.length > 0) {
      addTestResult('创建测试用户', true, '测试用户已存在');
      return true;
    }
    
    // 创建测试用户
    const hashedPassword = await bcrypt.hash('123456', 10);
    const result = await db.query(`
      INSERT INTO users (username, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `, ['testuser', 'test@example.com', hashedPassword, 'user', 'active']);
    
    const passed = result && result.length > 0 && result[0].lastInsertRowid;
    addTestResult('创建测试用户', passed, passed ? `用户创建成功，ID: ${result[0].lastInsertRowid}` : '用户创建失败');
    return passed;
  } catch (error) {
    addTestResult('创建测试用户', false, `创建失败: ${error.message}`);
    return false;
  }
}

// 测试3: 用户登录获取token
async function testUserLogin() {
  const response = await makeRequest(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'testuser',
      password: '123456'
    })
  });
  
  const passed = response.status === 200 && response.data.success && response.data.data.token;
  addTestResult('用户登录', passed, passed ? '登录成功，获取到token' : `登录失败: ${response.data?.message || response.error}`);
  
  return passed ? response.data.data.token : null;
}

// 测试4: API健康检查
async function testHealthCheck() {
  const response = await makeRequest(`${API_BASE}/health`);
  const passed = response.status === 200;
  addTestResult('API健康检查', passed, passed ? '服务器正常运行' : '服务器无响应');
  return passed;
}

// 测试5: 带认证的API访问
async function testAuthenticatedAPI(token) {
  if (!token) {
    addTestResult('认证API访问', false, '无有效token');
    return false;
  }
  
  const response = await makeRequest(`${API_BASE}/departments`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const passed = response.status === 200 && response.data.success;
  addTestResult('认证API访问', passed, passed ? `获取到 ${response.data.data?.length || 0} 个部门` : `访问失败: ${response.data?.message || response.error}`);
  return passed;
}

// 测试6: 搜索功能
async function testSearchAPI(token) {
  if (!token) {
    addTestResult('搜索功能', false, '无有效token');
    return false;
  }
  
  const response = await makeRequest(`${API_BASE}/search?q=技术`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const passed = response.status === 200;
  addTestResult('搜索功能', passed, passed ? `搜索成功，返回 ${response.data?.data?.length || 0} 条结果` : `搜索失败: ${response.data?.message || response.error}`);
  return passed;
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始API连接测试...\n');
  
  // 执行测试
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('\n❌ 数据库连接失败，终止测试');
    return;
  }
  
  await createTestUser();
  const token = await testUserLogin();
  await testHealthCheck();
  await testAuthenticatedAPI(token);
  await testSearchAPI(token);
  
  // 测试总结
  console.log('\n📊 测试总结:');
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`- 总测试数: ${totalTests}`);
  console.log(`- 通过: ${passedTests}`);
  console.log(`- 失败: ${failedTests}`);
  console.log(`- 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testName}: ${r.message}`);
    });
  }
  
  console.log('\n✅ API连接测试完成');
}

// 运行测试
runAllTests().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});