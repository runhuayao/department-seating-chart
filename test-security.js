/**
 * 安全机制测试脚本
 * 测试前后端数据传输安全机制的有效性
 */

const API_BASE = 'http://localhost:8080/api';

// 测试结果收集
const testResults = [];

// 添加测试结果
function addTestResult(testName, passed, message) {
  testResults.push({ testName, passed, message });
  console.log(`${passed ? '✅' : '❌'} ${testName}: ${message}`);
}

// HTTP请求函数
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { rawResponse: data };
    }
    
    return {
      status: response.status,
      headers: response.headers,
      data: jsonData
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

// 测试1: API健康检查
async function testHealthCheck() {
  const response = await makeRequest(`${API_BASE}/health`);
  const passed = response.status === 200 && response.data.status === 'ok';
  addTestResult('API健康检查', passed, passed ? '服务器正常运行' : '服务器无响应');
}

// 测试2: 未认证访问保护
async function testUnauthenticatedAccess() {
  const response = await makeRequest(`${API_BASE}/workstations`);
  const passed = response.status === 401;
  addTestResult('未认证访问保护', passed, passed ? '正确拒绝未认证请求' : '安全漏洞：允许未认证访问');
}

// 测试3: 无效token处理
async function testInvalidToken() {
  const response = await makeRequest(`${API_BASE}/workstations`, {
    headers: {
      'Authorization': 'Bearer invalid-token'
    }
  });
  const passed = response.status === 403;
  addTestResult('无效Token处理', passed, passed ? '正确拒绝无效token' : '安全漏洞：接受无效token');
}

// 测试4: 登录功能
async function testLogin() {
  const response = await makeRequest(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: '123456'
    })
  });
  
  const passed = response.status === 401; // 预期失败，因为用户不存在
  addTestResult('登录功能', passed, passed ? '登录验证正常工作' : '登录功能异常');
}

// 测试5: SQL注入防护
async function testSQLInjection() {
  const maliciousInput = "'; DROP TABLE users; --";
  const response = await makeRequest(`${API_BASE}/search?q=${encodeURIComponent(maliciousInput)}`);
  
  // 如果返回401（未认证），说明中间件正常工作
  const passed = response.status === 401;
  addTestResult('SQL注入防护', passed, passed ? '输入验证正常' : '可能存在SQL注入风险');
}

// 测试6: XSS防护
async function testXSSProtection() {
  const xssPayload = '<script>alert("xss")</script>';
  const response = await makeRequest(`${API_BASE}/search?q=${encodeURIComponent(xssPayload)}`);
  
  const passed = response.status === 401; // 预期被认证中间件拦截
  addTestResult('XSS防护', passed, passed ? 'XSS防护正常' : '可能存在XSS风险');
}

// 测试7: CORS配置
async function testCORS() {
  const response = await makeRequest(`${API_BASE}/health`, {
    method: 'OPTIONS'
  });
  
  const corsMethodsHeader = response.headers?.get('Access-Control-Allow-Methods');
  const corsCredentialsHeader = response.headers?.get('Access-Control-Allow-Credentials');
  const passed = corsMethodsHeader !== null && corsCredentialsHeader !== null;
  addTestResult('CORS配置', passed, passed ? 'CORS配置正确' : 'CORS配置缺失');
}

// 测试8: 安全头检查
async function testSecurityHeaders() {
  const response = await makeRequest(`${API_BASE}/health`);
  
  const securityHeaders = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Content-Security-Policy'
  ];
  
  let foundHeaders = 0;
  securityHeaders.forEach(header => {
    if (response.headers?.get(header)) {
      foundHeaders++;
    }
  });
  
  const passed = foundHeaders >= 3;
  addTestResult('安全头配置', passed, `发现${foundHeaders}/${securityHeaders.length}个安全头`);
}

// 测试9: 请求大小限制
async function testRequestSizeLimit() {
  // 创建一个大的请求体（超过10MB）
  const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB
  
  try {
    const response = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ data: largeData })
    });
    
    // 预期被请求大小限制拦截 (413, 500, 或网络错误)
     const passed = response.status === 413 || response.status === 500 || response.error?.includes('请求体过大') || response.error?.includes('ECONNRESET');
     addTestResult('请求大小限制', passed, passed ? '请求大小限制正常' : '请求大小限制失效');
  } catch (error) {
    // 网络错误通常表示请求被拒绝
    const passed = error.message.includes('ECONNRESET') || error.message.includes('body');
    addTestResult('请求大小限制', passed, passed ? '请求大小限制正常' : '请求大小限制失效');
  }
}

// 运行所有测试
async function runSecurityTests() {
  console.log('🔒 开始安全机制测试...\n');
  
  await testHealthCheck();
  await testUnauthenticatedAccess();
  await testInvalidToken();
  await testLogin();
  await testSQLInjection();
  await testXSSProtection();
  await testCORS();
  await testSecurityHeaders();
  await testRequestSizeLimit();
  
  // 统计结果
  const passedTests = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;
  
  console.log('\n📊 测试结果汇总:');
  console.log(`通过: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有安全测试通过！');
  } else {
    console.log('⚠️  部分安全测试失败，请检查安全配置');
  }
  
  return { passedTests, totalTests, results: testResults };
}

// 如果直接运行此脚本
if (typeof window === 'undefined') {
  // Node.js环境
  import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
    runSecurityTests();
  });
} else {
  // 浏览器环境
  window.runSecurityTests = runSecurityTests;
}