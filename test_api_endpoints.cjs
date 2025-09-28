const axios = require('axios');
const fs = require('fs');

// 测试配置
const baseURL = 'http://localhost:8080';
const api = axios.create({ baseURL, timeout: 10000 });

// 测试结果
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, status, details, error = null) {
  const test = { name, status, details, error: error?.message, timestamp: new Date().toISOString() };
  results.tests.push(test);
  results.total++;
  
  if (status === 'PASS') {
    results.passed++;
    console.log(`✅ ${name}: ${details}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}: ${details}`);
    if (error) console.log(`   错误: ${error.message}`);
  }
}

// 测试函数
async function testEndpoint(method, path, data = null, expectedStatus = 200) {
  try {
    let response;
    if (method === 'GET') {
      response = await api.get(path);
    } else if (method === 'POST') {
      response = await api.post(path, data);
    } else if (method === 'PUT') {
      response = await api.put(path, data);
    }
    
    if (response.status === expectedStatus) {
      return { success: true, data: response.data, status: response.status };
    } else {
      return { success: false, error: `期望状态码 ${expectedStatus}，实际 ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function runTests() {
  console.log('🚀 开始API端点测试\n');
  
  // 1. 测试健康检查
  console.log('🏥 测试健康检查...');
  const healthResult = await testEndpoint('GET', '/api/health');
  if (healthResult.success) {
    logTest('API健康检查', 'PASS', `服务器状态正常`);
  } else {
    logTest('API健康检查', 'FAIL', '健康检查失败', new Error(healthResult.error));
  }
  
  // 2. 测试认证端点
  console.log('\n🔐 测试认证端点...');
  
  // 测试用户注册
  const registerData = {
    username: 'testuser' + Date.now(),
    email: `test${Date.now()}@example.com`,
    password: 'testpass123',
    fullName: '测试用户'
  };
  
  const registerResult = await testEndpoint('POST', '/api/auth/register', registerData, 201);
  if (registerResult.success) {
    logTest('用户注册', 'PASS', '注册成功');
    
    // 测试登录
    const loginResult = await testEndpoint('POST', '/api/auth/login', {
      username: registerData.username,
      password: registerData.password
    });
    
    if (loginResult.success && loginResult.data.data?.accessToken) {
      logTest('用户登录', 'PASS', '登录成功，获取到令牌');
      
      // 设置认证头
      const token = loginResult.data.data.accessToken;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // 测试令牌验证
      const verifyResult = await testEndpoint('GET', '/api/auth/verify');
      if (verifyResult.success) {
        logTest('令牌验证', 'PASS', '令牌验证成功');
      } else {
        logTest('令牌验证', 'FAIL', '令牌验证失败', new Error(verifyResult.error));
      }
    } else {
      logTest('用户登录', 'FAIL', '登录失败', new Error(loginResult.error));
    }
  } else {
    logTest('用户注册', 'FAIL', '注册失败', new Error(registerResult.error));
  }
  
  // 3. 测试数据端点（需要认证）
  console.log('\n📊 测试数据端点...');
  
  const dataEndpoints = [
    { path: '/api/departments', name: '部门数据' },
    { path: '/api/employees', name: '员工数据' },
    { path: '/api/desks?dept=开发部', name: '工位数据' },
    { path: '/api/status', name: '状态数据' },
    { path: '/api/overview', name: '概览数据' }
  ];
  
  for (const endpoint of dataEndpoints) {
    const result = await testEndpoint('GET', endpoint.path);
    if (result.success) {
      const dataLength = Array.isArray(result.data.data) ? result.data.data.length : 'N/A';
      logTest(`${endpoint.name}获取`, 'PASS', `成功获取数据，记录数: ${dataLength}`);
    } else {
      logTest(`${endpoint.name}获取`, 'FAIL', '数据获取失败', new Error(result.error));
    }
  }
  
  // 4. 测试搜索端点
  console.log('\n🔍 测试搜索功能...');
  const searchResult = await testEndpoint('GET', '/api/search?type=employee&query=张');
  if (searchResult.success) {
    logTest('搜索功能', 'PASS', '搜索请求成功');
  } else {
    logTest('搜索功能', 'FAIL', '搜索请求失败', new Error(searchResult.error));
  }
  
  // 5. 测试系统监控端点
  console.log('\n📈 测试系统监控...');
  const monitoringEndpoints = [
    { path: '/api/system/status', name: '系统状态' },
    { path: '/api/websocket/stats', name: 'WebSocket统计' },
    { path: '/api/system/metrics', name: '系统指标' }
  ];
  
  for (const endpoint of monitoringEndpoints) {
    const result = await testEndpoint('GET', endpoint.path);
    if (result.success) {
      logTest(`${endpoint.name}`, 'PASS', '监控数据获取成功');
    } else {
      logTest(`${endpoint.name}`, 'FAIL', '监控数据获取失败', new Error(result.error));
    }
  }
  
  // 生成报告
  generateReport();
}

function generateReport() {
  const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(2) : '0.00';
  
  const report = `# API端点测试报告

## 测试概览
- 测试时间: ${new Date().toISOString()}
- 总测试数: ${results.total}
- 通过测试: ${results.passed}
- 失败测试: ${results.failed}
- 成功率: ${successRate}%

## 详细结果

${results.tests.map(test => `### ${test.name}
- 状态: ${test.status}
- 详情: ${test.details}
- 时间: ${test.timestamp}${test.error ? `\n- 错误: ${test.error}` : ''}`).join('\n\n')}

## 总结

${results.failed > 0 ? '发现问题，需要修复失败的端点。' : '所有测试通过，API运行正常。'}
`;
  
  fs.writeFileSync('api_test_report.md', report);
  console.log('\n📄 测试报告已生成: api_test_report.md');
  
  console.log(`\n📊 测试总结:`);
  console.log(`   总计: ${results.total} 项测试`);
  console.log(`   通过: ${results.passed} 项`);
  console.log(`   失败: ${results.failed} 项`);
  console.log(`   成功率: ${successRate}%`);
}

// 运行测试
runTests().catch(console.error);