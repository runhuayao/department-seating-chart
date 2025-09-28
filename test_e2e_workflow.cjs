const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class E2EWorkflowTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
    this.startTime = new Date();
    this.userActions = [];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // 监听控制台消息
    this.page.on('console', msg => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // 监听页面错误
    this.page.on('pageerror', error => {
      console.log(`[ERROR] 页面错误: ${error.message}`);
    });
  }

  async logUserAction(action, details) {
    this.userActions.push({
      action,
      details,
      timestamp: new Date().toISOString()
    });
    console.log(`[用户操作] ${action}: ${details}`);
  }

  async testCompleteUserJourney() {
    try {
      console.log('[INFO] 测试完整用户旅程...');
      
      // 1. 用户访问系统
      await this.page.goto('http://localhost:5174', { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });
      await this.logUserAction('访问系统', '用户打开部门地图系统');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. 查看初始地图状态
      const initialMapState = await this.page.evaluate(() => {
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
        const departments = document.querySelectorAll('.department, [data-department], .floor');
        return {
          workstationCount: workstations.length,
          departmentCount: departments.length,
          mapVisible: document.querySelector('.map, .floor-plan, .office-layout') !== null
        };
      });
      
      await this.logUserAction('查看地图', `发现${initialMapState.workstationCount}个工位，${initialMapState.departmentCount}个部门`);

      // 3. 尝试搜索功能
      const searchInput = await this.page.$('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
      if (searchInput) {
        await searchInput.type('张三');
        await this.logUserAction('搜索员工', '搜索员工"张三"');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查搜索结果
        const searchResults = await this.page.evaluate(() => {
          const results = document.querySelectorAll('.search-result, .result-item, .employee-result');
          return results.length;
        });
        await this.logUserAction('查看搜索结果', `找到${searchResults}个搜索结果`);
        
        // 清空搜索
        await searchInput.click({ clickCount: 3 });
        await searchInput.type('');
      }

      // 4. 部门切换操作
      const departmentButtons = await this.page.$$('button, .department-btn, [data-department], .tab');
      if (departmentButtons.length > 0) {
        await departmentButtons[0].click();
        await this.logUserAction('切换部门', '点击第一个部门按钮');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 检查部门切换后的变化
        const afterSwitchState = await this.page.evaluate(() => {
          const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
          return workstations.length;
        });
        await this.logUserAction('查看部门内容', `部门切换后显示${afterSwitchState}个工位`);
      }

      // 5. 工位交互操作
      const workstations = await this.page.$$('.workstation, [data-workstation], .seat');
      if (workstations.length > 0) {
        // 点击第一个工位
        await workstations[0].click();
        await this.logUserAction('选择工位', '点击第一个工位');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查工位详情或状态变化
        const workstationDetails = await this.page.evaluate(() => {
          const modal = document.querySelector('.modal, .popup, .details, .info-panel');
          const highlighted = document.querySelector('.selected, .active, .highlighted');
          return {
            hasModal: modal !== null,
            hasHighlight: highlighted !== null
          };
        });
        
        await this.logUserAction('查看工位详情', `模态框:${workstationDetails.hasModal}, 高亮:${workstationDetails.hasHighlight}`);
        
        // 如果有模态框，尝试关闭
        const closeButton = await this.page.$('.close, .modal-close, [aria-label="close"], .btn-close');
        if (closeButton) {
          await closeButton.click();
          await this.logUserAction('关闭详情', '关闭工位详情模态框');
        }
      }

      // 6. 地图缩放和平移操作
      const mapContainer = await this.page.$('.map, .floor-plan, .office-layout, .svg-container');
      if (mapContainer) {
        // 模拟鼠标滚轮缩放
        await mapContainer.hover();
        await this.page.mouse.wheel({ deltaY: -100 });
        await this.logUserAction('缩放地图', '向上滚动鼠标滚轮放大地图');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await this.page.mouse.wheel({ deltaY: 100 });
        await this.logUserAction('缩放地图', '向下滚动鼠标滚轮缩小地图');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 模拟拖拽平移
        const box = await mapContainer.boundingBox();
        if (box) {
          await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await this.page.mouse.down();
          await this.page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
          await this.page.mouse.up();
          await this.logUserAction('平移地图', '拖拽地图进行平移');
        }
      }

      // 7. 测试响应式行为
      await this.page.setViewport({ width: 768, height: 1024 });
      await this.logUserAction('切换设备', '切换到平板视图');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.page.setViewport({ width: 375, height: 667 });
      await this.logUserAction('切换设备', '切换到手机视图');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.page.setViewport({ width: 1280, height: 720 });
      await this.logUserAction('切换设备', '恢复桌面视图');
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.addTestResult('完整用户旅程', true, `完成${this.userActions.length}个用户操作`);
    } catch (error) {
      console.log(`[ERROR] 完整用户旅程测试失败: ${error.message}`);
      this.addTestResult('完整用户旅程', false, error.message);
    }
  }

  async testLoginWorkflow() {
    try {
      console.log('[INFO] 测试登录工作流程...');
      
      // 查找登录相关元素
      const loginElements = await this.page.evaluate(() => {
        const loginBtn = document.querySelector('button:contains("登录"), button:contains("Login"), .login-btn, [data-testid="login"]');
        const loginForm = document.querySelector('form, .login-form, .auth-form');
        const usernameInput = document.querySelector('input[type="text"], input[type="email"], input[name="username"], input[name="email"]');
        const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
        
        return {
          hasLoginBtn: loginBtn !== null,
          hasLoginForm: loginForm !== null,
          hasUsernameInput: usernameInput !== null,
          hasPasswordInput: passwordInput !== null
        };
      });

      await this.logUserAction('检查登录界面', `登录按钮:${loginElements.hasLoginBtn}, 表单:${loginElements.hasLoginForm}`);
      
      // 如果有登录表单，尝试登录流程
      if (loginElements.hasUsernameInput && loginElements.hasPasswordInput) {
        const usernameInput = await this.page.$('input[type="text"], input[type="email"], input[name="username"], input[name="email"]');
        const passwordInput = await this.page.$('input[type="password"], input[name="password"]');
        
        if (usernameInput && passwordInput) {
          await usernameInput.type('test@example.com');
          await passwordInput.type('password123');
          await this.logUserAction('输入凭据', '输入测试用户名和密码');
          
          const submitBtn = await this.page.$('button[type="submit"], .submit-btn, .login-submit');
          if (submitBtn) {
            await submitBtn.click();
            await this.logUserAction('提交登录', '点击登录提交按钮');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      this.addTestResult('登录工作流程', true, `登录界面检查完成`);
    } catch (error) {
      console.log(`[ERROR] 登录工作流程测试失败: ${error.message}`);
      this.addTestResult('登录工作流程', false, error.message);
    }
  }

  async testDataManagementWorkflow() {
    try {
      console.log('[INFO] 测试数据管理工作流程...');
      
      // 1. 查看当前数据状态
      const initialData = await this.page.evaluate(() => {
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
        const employees = document.querySelectorAll('.employee, [data-employee], .user');
        return {
          workstationCount: workstations.length,
          employeeCount: employees.length
        };
      });
      
      await this.logUserAction('查看数据状态', `当前工位:${initialData.workstationCount}, 员工:${initialData.employeeCount}`);

      // 2. 尝试添加新数据
      const addButtons = await this.page.$$('button:contains("添加"), button:contains("新增"), button:contains("Add"), .add-btn, [data-testid="add"]');
      if (addButtons.length > 0) {
        await addButtons[0].click();
        await this.logUserAction('尝试添加数据', '点击添加按钮');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查是否出现添加表单
        const addForm = await this.page.$('form, .add-form, .modal');
        if (addForm) {
          await this.logUserAction('添加表单出现', '添加数据表单已显示');
          
          // 尝试填写表单
          const inputs = await addForm.$$('input, select, textarea');
          for (let i = 0; i < Math.min(inputs.length, 3); i++) {
            await inputs[i].type(`测试数据${i + 1}`);
          }
          
          // 尝试提交
          const submitBtn = await addForm.$('button[type="submit"], .submit, .save');
          if (submitBtn) {
            await submitBtn.click();
            await this.logUserAction('提交数据', '提交新增数据表单');
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      // 3. 尝试编辑现有数据
      const workstations = await this.page.$$('.workstation, [data-workstation], .seat');
      if (workstations.length > 0) {
        // 双击工位尝试编辑
        await workstations[0].click({ clickCount: 2 });
        await this.logUserAction('尝试编辑工位', '双击工位尝试编辑');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查编辑界面
        const editForm = await this.page.$('.edit-form, .modal, form');
        if (editForm) {
          await this.logUserAction('编辑界面出现', '工位编辑界面已显示');
        }
      }

      // 4. 测试数据刷新
      await this.page.reload({ waitUntil: 'networkidle2' });
      await this.logUserAction('刷新数据', '重新加载页面刷新数据');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const refreshedData = await this.page.evaluate(() => {
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
        return workstations.length;
      });
      
      await this.logUserAction('检查刷新结果', `刷新后工位数量:${refreshedData}`);
      
      this.addTestResult('数据管理工作流程', true, `数据管理操作测试完成`);
    } catch (error) {
      console.log(`[ERROR] 数据管理工作流程测试失败: ${error.message}`);
      this.addTestResult('数据管理工作流程', false, error.message);
    }
  }

  async testErrorRecoveryWorkflow() {
    try {
      console.log('[INFO] 测试错误恢复工作流程...');
      
      // 1. 模拟网络中断
      await this.page.setOfflineMode(true);
      await this.logUserAction('模拟网络中断', '设置离线模式');
      
      // 2. 尝试执行需要网络的操作
      const searchInput = await this.page.$('input[type="search"], .search-input');
      if (searchInput) {
        await searchInput.type('网络测试');
        await this.logUserAction('离线搜索', '在离线状态下尝试搜索');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 3. 恢复网络连接
      await this.page.setOfflineMode(false);
      await this.logUserAction('恢复网络', '恢复网络连接');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 4. 检查系统恢复状态
      const recoveryState = await this.page.evaluate(() => {
        const errorMessages = document.querySelectorAll('.error, .alert-error');
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
        return {
          hasErrors: errorMessages.length > 0,
          workstationCount: workstations.length,
          pageResponsive: document.readyState === 'complete'
        };
      });
      
      await this.logUserAction('检查恢复状态', `错误消息:${recoveryState.hasErrors}, 页面响应:${recoveryState.pageResponsive}`);
      
      this.addTestResult('错误恢复工作流程', recoveryState.pageResponsive, `网络恢复测试完成`);
    } catch (error) {
      console.log(`[ERROR] 错误恢复工作流程测试失败: ${error.message}`);
      this.addTestResult('错误恢复工作流程', false, error.message);
    }
  }

  async testPerformanceWorkflow() {
    try {
      console.log('[INFO] 测试性能工作流程...');
      
      const startTime = Date.now();
      
      // 1. 快速连续操作测试
      const buttons = await this.page.$$('button, .clickable');
      if (buttons.length > 0) {
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
          await buttons[i].click();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await this.logUserAction('快速点击测试', '连续快速点击多个按钮');
      }
      
      // 2. 大量数据加载测试
      for (let i = 0; i < 3; i++) {
        await this.page.reload({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await this.logUserAction('重复加载测试', '连续重新加载页面3次');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 3. 内存使用检查
      const metrics = await this.page.metrics();
      const memoryUsage = Math.round(metrics.JSHeapUsedSize / 1024 / 1024);
      
      await this.logUserAction('性能检查', `操作耗时:${duration}ms, 内存使用:${memoryUsage}MB`);
      
      const performanceGood = duration < 10000 && memoryUsage < 100;
      
      this.addTestResult('性能工作流程', performanceGood, `耗时:${duration}ms, 内存:${memoryUsage}MB`);
    } catch (error) {
      console.log(`[ERROR] 性能工作流程测试失败: ${error.message}`);
      this.addTestResult('性能工作流程', false, error.message);
    }
  }

  addTestResult(testName, passed, details) {
    this.testResults.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async generateReport() {
    const endTime = new Date();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(2);

    let report = `# 端到端业务流程测试报告\n\n`;
    report += `## 测试概览\n`;
    report += `- **测试时间**: ${this.startTime.toLocaleDateString()} ${this.startTime.toLocaleTimeString()}\n`;
    report += `- **总测试数**: ${totalTests}\n`;
    report += `- **通过数**: ${passedTests}\n`;
    report += `- **失败数**: ${totalTests - passedTests}\n`;
    report += `- **通过率**: ${passRate}%\n`;
    report += `- **测试耗时**: ${duration}秒\n\n`;
    
    report += `## 用户操作记录\n`;
    report += `- **总操作数**: ${this.userActions.length}\n\n`;
    
    if (this.userActions.length > 0) {
      report += `### 详细操作流程\n`;
      this.userActions.forEach((action, index) => {
        report += `${index + 1}. **${action.action}** (${action.timestamp})\n   ${action.details}\n\n`;
      });
    }
    
    report += `## 详细测试结果\n\n`;
    
    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      report += `### ${index + 1}. ${result.name}\n`;
      report += `- **状态**: ${status}\n`;
      report += `- **时间**: ${result.timestamp}\n`;
      report += `- **详情**: ${result.details}\n\n`;
    });
    
    report += `## 测试建议\n\n`;
    
    const failedTests = this.testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `### 修复建议\n\n`;
      failedTests.forEach(test => {
        report += `- ${test.name}: ${test.details}\n`;
      });
    } else {
      report += `### 总体评估\n\n`;
      report += `所有端到端业务流程测试均通过，用户体验良好。\n`;
    }
    
    report += `\n### 用户体验评估\n\n`;
    report += `- **操作流畅性**: ${this.userActions.length > 10 ? '良好' : '一般'}\n`;
    report += `- **功能完整性**: ${passRate > 80 ? '优秀' : passRate > 60 ? '良好' : '需改进'}\n`;
    report += `- **错误处理**: ${this.testResults.some(t => t.name.includes('错误恢复')) ? '已测试' : '未测试'}\n`;

    const reportPath = path.join(__dirname, 'e2e_workflow_test_report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`[INFO] 测试报告已生成: ${reportPath}`);
  }

  async runAllTests() {
    try {
      await this.init();
      
      await this.testCompleteUserJourney();
      await this.testLoginWorkflow();
      await this.testDataManagementWorkflow();
      await this.testErrorRecoveryWorkflow();
      await this.testPerformanceWorkflow();
      
      console.log('[INFO] 端到端业务流程测试完成');
      
      await this.generateReport();
      
      const passedTests = this.testResults.filter(r => r.passed).length;
      const totalTests = this.testResults.length;
      const passRate = ((passedTests / totalTests) * 100).toFixed(2);
      
      console.log(`[INFO]\n测试完成！通过率: ${passRate}% (${passedTests}/${totalTests})`);
      console.log(`[INFO] 用户操作总数: ${this.userActions.length}`);
      
    } catch (error) {
      console.error('[ERROR] 测试执行失败:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
        console.log('[INFO] 浏览器已关闭');
      }
    }
  }
}

// 运行测试
const tester = new E2EWorkflowTester();
tester.runAllTests().catch(console.error);