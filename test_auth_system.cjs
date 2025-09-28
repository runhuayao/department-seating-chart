const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5174',
  timeout: 30000,
  viewport: { width: 1920, height: 1080 },
  testCredentials: {
    validUser: {
      username: 'admin',
      password: '123456'
    },
    invalidUser: {
      username: 'wronguser',
      password: 'wrongpass'
    }
  }
};

// 日志函数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(logMessage);
  return logMessage;
}

// 测试结果收集器
class TestResults {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(testName, passed, details = '', error = null) {
    this.results.push({
      testName,
      passed,
      details,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    });
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const duration = Date.now() - this.startTime;

    return {
      total,
      passed,
      failed,
      duration,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0
    };
  }
}

// 用户认证系统测试类
class AuthSystemTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = new TestResults();
  }

  async initialize() {
    try {
      log('启动浏览器...');
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: TEST_CONFIG.viewport,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport(TEST_CONFIG.viewport);
      
      // 监听控制台错误
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          log(`控制台错误: ${msg.text()}`, 'error');
        }
      });

      // 监听页面错误
      this.page.on('pageerror', error => {
        log(`页面错误: ${error.message}`, 'error');
      });

      log('浏览器初始化完成');
      return true;
    } catch (error) {
      log(`浏览器初始化失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testPageLoad() {
    try {
      log('测试页面加载...');
      
      const response = await this.page.goto(TEST_CONFIG.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: TEST_CONFIG.timeout
      });

      if (!response.ok()) {
        throw new Error(`页面加载失败，状态码: ${response.status()}`);
      }

      // 检查页面标题
      const title = await this.page.title();
      log(`页面标题: ${title}`);

      // 检查是否有登录表单
      const loginForm = await this.page.$('form');
      if (!loginForm) {
        throw new Error('未找到登录表单');
      }

      this.results.addResult('页面加载测试', true, `页面成功加载，标题: ${title}`);
      log('页面加载测试通过');
      return true;
    } catch (error) {
      this.results.addResult('页面加载测试', false, '', error);
      log(`页面加载测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testLoginFormElements() {
    try {
      log('测试登录表单元素...');
      
      // First click the login button to open the modal
      const loginButton = await this.page.waitForSelector('button', { timeout: 10000 });
      const loginButtons = await this.page.$$('button');
      let targetLoginButton = null;
      for (const btn of loginButtons) {
          const text = await btn.evaluate(el => el.textContent);
          if (text && text.includes('登录')) {
              targetLoginButton = btn;
              break;
          }
      }
      if (targetLoginButton) {
        await targetLoginButton.click();
        log('✓ Login button clicked, modal should open');
        
        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查用户名输入框
        const usernameInput = await this.page.$('#username');
        if (!usernameInput) {
          throw new Error('未找到用户名输入框');
        }

        // 检查密码输入框
        const passwordInput = await this.page.$('#password');
        if (!passwordInput) {
          throw new Error('未找到密码输入框');
        }

        // 检查登录按钮
        const submitButton = await this.page.$('button[type="submit"]');
        if (!submitButton) {
          throw new Error('未找到登录按钮');
        }

        this.results.addResult('登录表单元素测试', true, '所有必需的表单元素都存在');
        log('登录表单元素测试通过');
        return true;
      } else {
        throw new Error('未找到登录按钮');
      }
    } catch (error) {
      this.results.addResult('登录表单元素测试', false, '', error);
      log(`登录表单元素测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testInvalidLogin() {
    try {
      log('测试无效登录...');
      
      // Ensure modal is open first
      let form = await this.page.$('form');
      if (!form) {
        const loginButtons = await this.page.$$('button');
        for (const btn of loginButtons) {
          const text = await btn.evaluate(el => el.textContent);
          if (text && text.includes('登录')) {
            await btn.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        }
      }
      
      // 清空输入框并输入无效凭据
      await this.page.click('#username', { clickCount: 3 });
      await this.page.type('#username', TEST_CONFIG.testCredentials.invalidUser.username);
      
      await this.page.click('#password', { clickCount: 3 });
      await this.page.type('#password', TEST_CONFIG.testCredentials.invalidUser.password);
      
      // 点击登录按钮
      await this.page.click('button[type="submit"]');
      
      // 等待错误消息或响应
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查是否显示错误消息
      const errorMessage = await this.page.$('.bg-red-50, .error, .alert-error, [class*="error"], [class*="danger"]');
      
      // 检查是否仍有登录表单（登录失败）
      const stillHasForm = await this.page.$('form');
      
      if (errorMessage || stillHasForm) {
        this.results.addResult('无效登录测试', true, '系统正确拒绝了无效凭据');
        log('无效登录测试通过');
        return true;
      } else {
        throw new Error('系统未正确处理无效登录');
      }
    } catch (error) {
      this.results.addResult('无效登录测试', false, '', error);
      log(`无效登录测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testValidLogin() {
    try {
      log('测试有效登录...');
      
      // Ensure modal is open first
      let form = await this.page.$('form');
      if (!form) {
        const loginButton = await this.page.$('button:has-text("登录")');
        if (loginButton) {
          await loginButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 清空输入框并输入有效凭据
      await this.page.click('#username', { clickCount: 3 });
      await this.page.type('#username', TEST_CONFIG.testCredentials.validUser.username);
      
      await this.page.click('#password', { clickCount: 3 });
      await this.page.type('#password', TEST_CONFIG.testCredentials.validUser.password);
      
      // 点击登录按钮
      await this.page.click('button[type="submit"]');
      
      // 等待登录处理
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查是否成功登录（模态框应该关闭）
      const modalStillExists = await this.page.$('.fixed.inset-0');
      if (!modalStillExists) {
        this.results.addResult('有效登录测试', true, '成功登录 - 模态框已关闭');
        log('有效登录测试通过');
        return true;
      } else {
        // 检查是否显示用户信息
        const userInfo = await this.page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements.find(el => el.textContent && el.textContent.includes('欢迎'));
        });
        if (userInfo && await userInfo.asElement()) {
          this.results.addResult('有效登录测试', true, '成功登录 - 显示用户信息');
          log('有效登录测试通过');
          return true;
        } else {
          throw new Error('登录后未找到成功指示器');
        }
      }
    } catch (error) {
      this.results.addResult('有效登录测试', false, '', error);
      log(`有效登录测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testSessionPersistence() {
    try {
      log('测试会话持久性...');
      
      // 刷新页面
      await this.page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查是否仍然保持登录状态
      const currentUrl = this.page.url();
      const stillLoggedIn = !currentUrl.includes('login') && currentUrl !== TEST_CONFIG.baseUrl;
      
      // 检查是否有登录状态指示器
      const loginIndicator = await this.page.$('.user-info, .logout, [class*="user"], .profile');
      
      if (stillLoggedIn || loginIndicator) {
        this.results.addResult('会话持久性测试', true, '会话在页面刷新后保持有效');
        log('会话持久性测试通过');
        return true;
      } else {
        throw new Error('会话在页面刷新后丢失');
      }
    } catch (error) {
      this.results.addResult('会话持久性测试', false, '', error);
      log(`会话持久性测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async testLogout() {
    try {
      log('测试登出功能...');
      
      // Look for logout button by searching through all buttons
      const userButtons = await this.page.$$('button');
      let logoutButton = null;
      
      for (const button of userButtons) {
        const text = await button.evaluate(el => el.textContent);
        if (text && (text.includes('退出') || text.includes('登出') || text.includes('注销') || text.includes('Logout'))) {
          logoutButton = button;
          log(`找到登出按钮，文本: ${text}`);
          break;
        }
      }
      
      // Also check for buttons with logout-related attributes
      if (!logoutButton) {
        const logoutSelectors = [
          '[data-testid="logout-button"]',
          '.logout-btn',
          'button[title*="退出"]',
          'button[title*="登出"]'
        ];
        
        for (const selector of logoutSelectors) {
          try {
            logoutButton = await this.page.waitForSelector(selector, { timeout: 1000 });
            if (logoutButton) {
              log(`找到登出按钮: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
      }
      
      if (logoutButton) {
        await logoutButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查是否成功登出（登录按钮应该重新出现）
        const allButtons = await this.page.$$('button');
        let loginButtonFound = false;
        for (const btn of allButtons) {
          const text = await btn.evaluate(el => el.textContent);
          if (text && text.includes('登录')) {
            loginButtonFound = true;
            break;
          }
        }
        
        if (loginButtonFound) {
          this.results.addResult('登出功能测试', true, '成功登出');
          log('登出功能测试通过');
          return true;
        } else {
          throw new Error('登出后未找到登录按钮');
        }
      } else {
        this.results.addResult('登出功能测试', false, '未找到登出按钮');
        log('登出功能测试失败: 未找到登出按钮', 'warn');
        return false;
      }
    } catch (error) {
      this.results.addResult('登出功能测试', false, '', error);
      log(`登出功能测试失败: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllTests() {
    log('开始用户认证系统测试...');
    
    const tests = [
      () => this.testPageLoad(),
      () => this.testLoginFormElements(),
      () => this.testInvalidLogin(),
      () => this.testValidLogin(),
      () => this.testSessionPersistence(),
      () => this.testLogout()
    ];

    for (const test of tests) {
      try {
        await test();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 测试间隔
      } catch (error) {
        log(`测试执行出错: ${error.message}`, 'error');
      }
    }

    log('用户认证系统测试完成');
  }

  async generateReport() {
    const summary = this.results.getSummary();
    const reportContent = `# 用户认证系统测试报告

## 测试概览
- **测试时间**: ${new Date().toLocaleString()}
- **总测试数**: ${summary.total}
- **通过数**: ${summary.passed}
- **失败数**: ${summary.failed}
- **通过率**: ${summary.passRate}%
- **测试耗时**: ${(summary.duration / 1000).toFixed(2)}秒

## 详细测试结果

${this.results.results.map((result, index) => `
### ${index + 1}. ${result.testName}
- **状态**: ${result.passed ? '✅ 通过' : '❌ 失败'}
- **时间**: ${result.timestamp}
- **详情**: ${result.details}
${result.error ? `- **错误**: ${result.error}` : ''}
`).join('')}

## 测试建议

${this.generateRecommendations()}
`;

    const reportPath = path.join(process.cwd(), 'auth_system_test_report.md');
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    log(`测试报告已生成: ${reportPath}`);
    
    return reportContent;
  }

  generateRecommendations() {
    const failedTests = this.results.results.filter(r => !r.passed);
    
    if (failedTests.length === 0) {
      return '🎉 所有测试都通过了！用户认证系统运行良好。';
    }

    let recommendations = '### 修复建议\n\n';
    
    failedTests.forEach(test => {
      switch (test.testName) {
        case '页面加载测试':
          recommendations += '- 检查前端服务器是否正常运行\n- 验证路由配置是否正确\n';
          break;
        case '登录表单元素测试':
          recommendations += '- 确保登录表单包含必要的输入字段\n- 检查表单元素的name属性和选择器\n';
          break;
        case '无效登录测试':
          recommendations += '- 实现适当的错误处理和用户反馈\n- 确保无效凭据被正确拒绝\n';
          break;
        case '有效登录测试':
          recommendations += '- 检查后端认证逻辑\n- 验证登录成功后的页面跳转\n';
          break;
        case '会话持久性测试':
          recommendations += '- 实现适当的会话管理\n- 检查JWT令牌或会话存储\n';
          break;
        case '登出功能测试':
          recommendations += '- 添加登出按钮和功能\n- 确保登出后清除会话状态\n';
          break;
      }
    });

    return recommendations;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      log('浏览器已关闭');
    }
  }
}

// 主执行函数
async function main() {
  const tester = new AuthSystemTester();
  
  try {
    const initialized = await tester.initialize();
    if (!initialized) {
      log('测试初始化失败，退出', 'error');
      process.exit(1);
    }

    await tester.runAllTests();
    await tester.generateReport();
    
    const summary = tester.results.getSummary();
    log(`\n测试完成！通过率: ${summary.passRate}% (${summary.passed}/${summary.total})`);
    
  } catch (error) {
    log(`测试执行失败: ${error.message}`, 'error');
  } finally {
    await tester.cleanup();
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AuthSystemTester, TEST_CONFIG };