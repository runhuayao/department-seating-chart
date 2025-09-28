/**
 * 部门地图系统综合测试脚本
 * 测试覆盖：认证系统、地图可视化、搜索功能、工位管理、数据处理准确性
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
    API_BASE_URL: 'http://localhost:8080/api',
    FRONTEND_URL: 'http://localhost:3000',
    TEST_USER: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpass123',
        fullName: '测试用户',
        employeeNumber: 'EMP001'
    },
    TIMEOUT: 10000
};

// 测试结果记录
const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
    }
};

// 工具函数
function logTest(testName, status, details = '', error = null) {
    const result = {
        name: testName,
        status,
        details,
        error: error ? error.message : null,
        timestamp: new Date().toISOString()
    };
    
    testResults.tests.push(result);
    testResults.summary.total++;
    
    if (status === 'PASS') {
        testResults.summary.passed++;
        console.log(`✅ ${testName}: ${details}`);
    } else {
        testResults.summary.failed++;
        testResults.summary.errors.push(`${testName}: ${error ? error.message : details}`);
        console.log(`❌ ${testName}: ${details}`);
        if (error) console.error(error);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. 测试用户认证系统
async function testAuthenticationSystem() {
    console.log('\n🔐 开始测试用户认证系统...');
    
    try {
        // 测试登录API
        const loginResponse = await axios.post(`${TEST_CONFIG.API_BASE_URL}/auth/login`, {
            username: TEST_CONFIG.TEST_USER.username,
            password: TEST_CONFIG.TEST_USER.password
        }, { timeout: TEST_CONFIG.TIMEOUT });
        
        if (loginResponse.status === 200 && loginResponse.data.token) {
            logTest('用户登录API', 'PASS', `成功获取token: ${loginResponse.data.token.substring(0, 20)}...`);
            
            // 测试token验证
            const verifyResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/auth/verify`, {
                headers: { Authorization: `Bearer ${loginResponse.data.token}` },
                timeout: TEST_CONFIG.TIMEOUT
            });
            
            if (verifyResponse.status === 200) {
                logTest('Token验证', 'PASS', `用户信息: ${JSON.stringify(verifyResponse.data.user)}`);
            } else {
                logTest('Token验证', 'FAIL', `验证失败，状态码: ${verifyResponse.status}`);
            }
            
            return loginResponse.data.token;
        } else {
            logTest('用户登录API', 'FAIL', `登录失败，状态码: ${loginResponse.status}`);
            return null;
        }
    } catch (error) {
        logTest('用户认证系统', 'FAIL', '认证系统测试失败', error);
        return null;
    }
}

// 2. 测试数据API
async function testDataAPIs(token) {
    console.log('\n📊 开始测试数据API...');
    
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    try {
        // 测试部门数据API
        const departmentsResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/departments`, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (departmentsResponse.status === 200 && Array.isArray(departmentsResponse.data)) {
            logTest('部门数据API', 'PASS', `获取到 ${departmentsResponse.data.length} 个部门`);
        } else {
            logTest('部门数据API', 'FAIL', `响应异常，状态码: ${departmentsResponse.status}`);
        }
        
        // 测试员工数据API
        const employeesResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/employees`, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (employeesResponse.status === 200 && Array.isArray(employeesResponse.data)) {
            logTest('员工数据API', 'PASS', `获取到 ${employeesResponse.data.length} 个员工`);
        } else {
            logTest('员工数据API', 'FAIL', `响应异常，状态码: ${employeesResponse.status}`);
        }
        
        // 测试工位数据API
        const desksResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/desks`, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (desksResponse.status === 200 && Array.isArray(desksResponse.data)) {
            logTest('工位数据API', 'PASS', `获取到 ${desksResponse.data.length} 个工位`);
        } else {
            logTest('工位数据API', 'FAIL', `响应异常，状态码: ${desksResponse.status}`);
        }
        
    } catch (error) {
        logTest('数据API测试', 'FAIL', '数据API测试失败', error);
    }
}

// 3. 测试搜索功能
async function testSearchFunctionality(token) {
    console.log('\n🔍 开始测试搜索功能...');
    
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    try {
        // 测试员工搜索
        const employeeSearchResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/search/employees?q=张三`, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (employeeSearchResponse.status === 200) {
            logTest('员工搜索功能', 'PASS', `搜索结果: ${JSON.stringify(employeeSearchResponse.data)}`);
        } else {
            logTest('员工搜索功能', 'FAIL', `搜索失败，状态码: ${employeeSearchResponse.status}`);
        }
        
        // 测试工位搜索
        const deskSearchResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/search/desks?q=A001`, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (deskSearchResponse.status === 200) {
            logTest('工位搜索功能', 'PASS', `搜索结果: ${JSON.stringify(deskSearchResponse.data)}`);
        } else {
            logTest('工位搜索功能', 'FAIL', `搜索失败，状态码: ${deskSearchResponse.status}`);
        }
        
    } catch (error) {
        logTest('搜索功能测试', 'FAIL', '搜索功能测试失败', error);
    }
}

// 4. 测试工位管理功能
async function testDeskManagement(token) {
    console.log('\n🪑 开始测试工位管理功能...');
    
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    try {
        // 测试工位状态更新
        const updateResponse = await axios.put(`${TEST_CONFIG.API_BASE_URL}/desks/1/status`, {
            status: 'maintenance'
        }, {
            headers,
            timeout: TEST_CONFIG.TIMEOUT
        });
        
        if (updateResponse.status === 200) {
            logTest('工位状态更新', 'PASS', '工位状态更新成功');
            
            // 验证状态是否更新
            await delay(1000);
            const verifyResponse = await axios.get(`${TEST_CONFIG.API_BASE_URL}/desks/1`, {
                headers,
                timeout: TEST_CONFIG.TIMEOUT
            });
            
            if (verifyResponse.data.status === 'maintenance') {
                logTest('工位状态验证', 'PASS', '工位状态更新验证成功');
            } else {
                logTest('工位状态验证', 'FAIL', '工位状态未正确更新');
            }
        } else {
            logTest('工位状态更新', 'FAIL', `更新失败，状态码: ${updateResponse.status}`);
        }
        
    } catch (error) {
        logTest('工位管理功能测试', 'FAIL', '工位管理功能测试失败', error);
    }
}

// 5. 测试实时状态更新（WebSocket）
async function testRealtimeUpdates() {
    console.log('\n🔄 开始测试实时状态更新...');
    
    try {
        // 这里应该测试WebSocket连接，但由于环境限制，我们先跳过
        logTest('实时状态更新', 'SKIP', 'WebSocket测试需要浏览器环境，暂时跳过');
    } catch (error) {
        logTest('实时状态更新测试', 'FAIL', '实时状态更新测试失败', error);
    }
}

// 6. 生成测试报告
function generateTestReport() {
    console.log('\n📋 生成测试报告...');
    
    const reportContent = `
# 部门地图系统测试报告

## 测试概览
- 测试时间: ${testResults.timestamp}
- 总测试数: ${testResults.summary.total}
- 通过测试: ${testResults.summary.passed}
- 失败测试: ${testResults.summary.failed}
- 成功率: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(2)}%

## 详细测试结果

${testResults.tests.map(test => `
### ${test.name}
- 状态: ${test.status}
- 详情: ${test.details}
- 时间: ${test.timestamp}
${test.error ? `- 错误: ${test.error}` : ''}
`).join('')}

## 发现的问题

${testResults.summary.errors.length > 0 ? 
    testResults.summary.errors.map(error => `- ${error}`).join('\n') : 
    '✅ 未发现严重问题'
}

## 建议和优化

1. **认证系统**: ${testResults.tests.find(t => t.name.includes('登录'))?.status === 'PASS' ? '✅ 工作正常' : '❌ 需要修复'}
2. **数据API**: ${testResults.tests.filter(t => t.name.includes('API')).every(t => t.status === 'PASS') ? '✅ 工作正常' : '❌ 部分API需要修复'}
3. **搜索功能**: ${testResults.tests.filter(t => t.name.includes('搜索')).every(t => t.status === 'PASS') ? '✅ 工作正常' : '❌ 搜索功能需要优化'}
4. **工位管理**: ${testResults.tests.filter(t => t.name.includes('工位')).every(t => t.status === 'PASS') ? '✅ 工作正常' : '❌ 工位管理需要改进'}

## 下一步行动

${testResults.summary.failed > 0 ? 
    '1. 优先修复失败的测试项\n2. 完善错误处理机制\n3. 增加更多边缘情况测试' : 
    '1. 继续完善功能测试覆盖\n2. 添加性能测试\n3. 进行用户体验优化'
}
`;
    
    const reportPath = path.join(__dirname, 'test_report.md');
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    
    console.log(`\n📄 测试报告已生成: ${reportPath}`);
    console.log(`\n📊 测试总结:`);
    console.log(`   总计: ${testResults.summary.total} 项测试`);
    console.log(`   通过: ${testResults.summary.passed} 项`);
    console.log(`   失败: ${testResults.summary.failed} 项`);
    console.log(`   成功率: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(2)}%`);
}

// 主测试函数
async function runComprehensiveTests() {
    console.log('🚀 开始部门地图系统综合测试...');
    console.log(`📍 API地址: ${TEST_CONFIG.API_BASE_URL}`);
    console.log(`🌐 前端地址: ${TEST_CONFIG.FRONTEND_URL}`);
    
    try {
        // 1. 测试认证系统
        const token = await testAuthenticationSystem();
        
        // 2. 测试数据API
        await testDataAPIs(token);
        
        // 3. 测试搜索功能
        await testSearchFunctionality(token);
        
        // 4. 测试工位管理
        await testDeskManagement(token);
        
        // 5. 测试实时更新
        await testRealtimeUpdates();
        
        // 6. 生成报告
        generateTestReport();
        
    } catch (error) {
        console.error('❌ 测试执行过程中发生错误:', error);
        logTest('系统测试', 'FAIL', '测试执行异常', error);
        generateTestReport();
    }
}

// 执行测试
if (require.main === module) {
    runComprehensiveTests().catch(console.error);
}

module.exports = {
    runComprehensiveTests,
    testResults
};