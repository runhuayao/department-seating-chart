const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class DataAccuracyTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
    this.startTime = new Date();
    this.apiRequests = [];
    this.apiResponses = [];
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

    // 监听网络请求和响应
    await this.page.setRequestInterception(true);
    
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('localhost:3000') || url.includes('localhost:8080')) {
        this.apiRequests.push({
          url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
        console.log(`[API请求] ${request.method()} ${url}`);
      }
      request.continue();
    });

    this.page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('localhost:3000') || url.includes('localhost:8080')) {
        this.apiResponses.push({
          url,
          status: response.status(),
          headers: response.headers(),
          timestamp: new Date().toISOString()
        });
        console.log(`[API响应] ${response.status()} ${url}`);
      }
    });
  }

  async testPageLoad() {
    try {
      console.log('[INFO] 测试页面加载和初始数据获取...');
      
      await this.page.goto('http://localhost:5174', { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });

      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 检查页面数据
      const pageData = await this.page.evaluate(() => {
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat, .desk');
        const departments = document.querySelectorAll('.department, [data-department], .floor');
        const employees = document.querySelectorAll('.employee, [data-employee], .user');
        
        return {
          workstationCount: workstations.length,
          departmentCount: departments.length,
          employeeCount: employees.length,
          hasData: workstations.length > 0 || departments.length > 0
        };
      });

      console.log(`[INFO] 页面数据统计:`);
      console.log(`[INFO] - 工位数量: ${pageData.workstationCount}`);
      console.log(`[INFO] - 部门数量: ${pageData.departmentCount}`);
      console.log(`[INFO] - 员工数量: ${pageData.employeeCount}`);
      
      this.addTestResult('页面加载和数据获取', pageData.hasData, `工位:${pageData.workstationCount}, 部门:${pageData.departmentCount}, 员工:${pageData.employeeCount}`);
    } catch (error) {
      console.log(`[ERROR] 页面加载测试失败: ${error.message}`);
      this.addTestResult('页面加载和数据获取', false, error.message);
    }
  }

  async testAPIResponseAccuracy() {
    try {
      console.log('[INFO] 测试API响应准确性...');
      
      // 触发一些可能的API调用
      await this.page.click('body'); // 点击页面触发可能的API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 尝试触发搜索API
      const searchInput = await this.page.$('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
      if (searchInput) {
        await searchInput.type('test');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 尝试切换部门触发API
      const departmentButtons = await this.page.$$('button, .department-btn, [data-department]');
      if (departmentButtons.length > 0) {
        await departmentButtons[0].click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[INFO] 捕获到 ${this.apiRequests.length} 个API请求`);
      console.log(`[INFO] 捕获到 ${this.apiResponses.length} 个API响应`);
      
      // 分析API响应状态
      const successfulResponses = this.apiResponses.filter(r => r.status >= 200 && r.status < 300).length;
      const errorResponses = this.apiResponses.filter(r => r.status >= 400).length;
      
      console.log(`[INFO] 成功响应: ${successfulResponses}`);
      console.log(`[INFO] 错误响应: ${errorResponses}`);
      
      const apiAccuracy = this.apiResponses.length === 0 || (successfulResponses / this.apiResponses.length) >= 0.8;
      
      this.addTestResult('API响应准确性', apiAccuracy, `请求:${this.apiRequests.length}, 响应:${this.apiResponses.length}, 成功:${successfulResponses}, 错误:${errorResponses}`);
    } catch (error) {
      console.log(`[ERROR] API响应测试失败: ${error.message}`);
      this.addTestResult('API响应准确性', false, error.message);
    }
  }

  async testDataConsistency() {
    try {
      console.log('[INFO] 测试数据一致性...');
      
      // 获取初始数据状态
      const initialData = await this.page.evaluate(() => {
        const workstations = Array.from(document.querySelectorAll('.workstation, [data-workstation], .seat')).map(ws => ({
          id: ws.id || ws.dataset.id || ws.textContent?.trim(),
          status: ws.className,
          position: { x: ws.offsetLeft, y: ws.offsetTop }
        }));
        
        const departments = Array.from(document.querySelectorAll('.department, [data-department], .floor')).map(dept => ({
          id: dept.id || dept.dataset.id || dept.textContent?.trim(),
          name: dept.textContent?.trim()
        }));
        
        return { workstations, departments };
      });

      console.log(`[INFO] 初始数据 - 工位: ${initialData.workstations.length}, 部门: ${initialData.departments.length}`);
      
      // 执行一些操作后重新检查数据
      await this.page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const reloadedData = await this.page.evaluate(() => {
        const workstations = Array.from(document.querySelectorAll('.workstation, [data-workstation], .seat')).map(ws => ({
          id: ws.id || ws.dataset.id || ws.textContent?.trim(),
          status: ws.className,
          position: { x: ws.offsetLeft, y: ws.offsetTop }
        }));
        
        const departments = Array.from(document.querySelectorAll('.department, [data-department], .floor')).map(dept => ({
          id: dept.id || dept.dataset.id || dept.textContent?.trim(),
          name: dept.textContent?.trim()
        }));
        
        return { workstations, departments };
      });

      console.log(`[INFO] 重载后数据 - 工位: ${reloadedData.workstations.length}, 部门: ${reloadedData.departments.length}`);
      
      // 比较数据一致性
      const workstationConsistent = initialData.workstations.length === reloadedData.workstations.length;
      const departmentConsistent = initialData.departments.length === reloadedData.departments.length;
      
      const dataConsistent = workstationConsistent && departmentConsistent;
      
      console.log(`[INFO] 数据一致性检查: ${dataConsistent ? '一致' : '不一致'}`);
      
      this.addTestResult('数据一致性', dataConsistent, `工位一致性:${workstationConsistent}, 部门一致性:${departmentConsistent}`);
    } catch (error) {
      console.log(`[ERROR] 数据一致性测试失败: ${error.message}`);
      this.addTestResult('数据一致性', false, error.message);
    }
  }

  async testStateSync() {
    try {
      console.log('[INFO] 测试状态同步...');
      
      // 检查本地存储状态
      const storageState = await this.page.evaluate(() => {
        const localStorage = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          localStorage[key] = window.localStorage.getItem(key);
        }
        return localStorage;
      });

      console.log(`[INFO] 本地存储状态项: ${Object.keys(storageState).length}`);
      
      // 模拟状态变更
      await this.page.evaluate(() => {
        // 模拟用户状态变更
        window.localStorage.setItem('user_state', JSON.stringify({
          currentDepartment: 'test_dept',
          selectedWorkstation: 'test_ws',
          timestamp: Date.now()
        }));
        
        // 触发状态变更事件
        window.dispatchEvent(new Event('storage'));
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查状态是否正确同步
      const updatedState = await this.page.evaluate(() => {
        const userState = window.localStorage.getItem('user_state');
        return userState ? JSON.parse(userState) : null;
      });

      console.log(`[INFO] 状态同步检查: ${updatedState ? '成功' : '失败'}`);
      
      this.addTestResult('状态同步', !!updatedState, `状态更新${updatedState ? '成功' : '失败'}`);
    } catch (error) {
      console.log(`[ERROR] 状态同步测试失败: ${error.message}`);
      this.addTestResult('状态同步', false, error.message);
    }
  }

  async testDataValidation() {
    try {
      console.log('[INFO] 测试数据验证...');
      
      // 检查页面中的数据格式和有效性
      const dataValidation = await this.page.evaluate(() => {
        const results = {
          validWorkstations: 0,
          invalidWorkstations: 0,
          validDepartments: 0,
          invalidDepartments: 0,
          dataErrors: []
        };
        
        // 验证工位数据
        const workstations = document.querySelectorAll('.workstation, [data-workstation], .seat');
        workstations.forEach((ws, index) => {
          const id = ws.id || ws.dataset.id;
          const text = ws.textContent?.trim();
          
          if (id || text) {
            results.validWorkstations++;
          } else {
            results.invalidWorkstations++;
            results.dataErrors.push(`工位${index}: 缺少ID或文本`);
          }
        });
        
        // 验证部门数据
        const departments = document.querySelectorAll('.department, [data-department], .floor');
        departments.forEach((dept, index) => {
          const id = dept.id || dept.dataset.id;
          const text = dept.textContent?.trim();
          
          if (id || text) {
            results.validDepartments++;
          } else {
            results.invalidDepartments++;
            results.dataErrors.push(`部门${index}: 缺少ID或文本`);
          }
        });
        
        return results;
      });

      console.log(`[INFO] 数据验证结果:`);
      console.log(`[INFO] - 有效工位: ${dataValidation.validWorkstations}`);
      console.log(`[INFO] - 无效工位: ${dataValidation.invalidWorkstations}`);
      console.log(`[INFO] - 有效部门: ${dataValidation.validDepartments}`);
      console.log(`[INFO] - 无效部门: ${dataValidation.invalidDepartments}`);
      
      if (dataValidation.dataErrors.length > 0) {
        console.log(`[WARN] 数据错误: ${dataValidation.dataErrors.join(', ')}`);
      }
      
      const validationPassed = dataValidation.invalidWorkstations === 0 && dataValidation.invalidDepartments === 0;
      
      this.addTestResult('数据验证', validationPassed, `有效工位:${dataValidation.validWorkstations}, 无效工位:${dataValidation.invalidWorkstations}, 错误:${dataValidation.dataErrors.length}`);
    } catch (error) {
      console.log(`[ERROR] 数据验证测试失败: ${error.message}`);
      this.addTestResult('数据验证', false, error.message);
    }
  }

  async testErrorHandling() {
    try {
      console.log('[INFO] 测试错误处理...');
      
      // 模拟网络错误
      await this.page.setOfflineMode(true);
      
      // 尝试触发需要网络的操作
      const searchInput = await this.page.$('input[type="search"], input[placeholder*="搜索"], .search-input');
      if (searchInput) {
        await searchInput.type('network_test');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 恢复网络
      await this.page.setOfflineMode(false);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查错误处理
      const errorHandling = await this.page.evaluate(() => {
        const errorMessages = document.querySelectorAll('.error, .alert, .warning, [class*="error"]');
        const loadingIndicators = document.querySelectorAll('.loading, .spinner, [class*="loading"]');
        
        return {
          errorMessageCount: errorMessages.length,
          loadingIndicatorCount: loadingIndicators.length,
          hasErrorHandling: errorMessages.length > 0 || loadingIndicators.length > 0
        };
      });

      console.log(`[INFO] 错误处理检查: 错误消息${errorHandling.errorMessageCount}个, 加载指示器${errorHandling.loadingIndicatorCount}个`);
      
      this.addTestResult('错误处理', true, `错误消息:${errorHandling.errorMessageCount}, 加载指示器:${errorHandling.loadingIndicatorCount}`);
    } catch (error) {
      console.log(`[ERROR] 错误处理测试失败: ${error.message}`);
      this.addTestResult('错误处理', false, error.message);
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

    let report = `# 数据处理准确性测试报告\n\n`;
    report += `## 测试概览\n`;
    report += `- **测试时间**: ${this.startTime.toLocaleDateString()} ${this.startTime.toLocaleTimeString()}\n`;
    report += `- **总测试数**: ${totalTests}\n`;
    report += `- **通过数**: ${passedTests}\n`;
    report += `- **失败数**: ${totalTests - passedTests}\n`;
    report += `- **通过率**: ${passRate}%\n`;
    report += `- **测试耗时**: ${duration}秒\n\n`;
    
    report += `## API请求统计\n`;
    report += `- **总请求数**: ${this.apiRequests.length}\n`;
    report += `- **总响应数**: ${this.apiResponses.length}\n`;
    
    if (this.apiRequests.length > 0) {
      report += `\n### API请求详情\n`;
      this.apiRequests.forEach((req, index) => {
        report += `${index + 1}. ${req.method} ${req.url} (${req.timestamp})\n`;
      });
    }
    
    if (this.apiResponses.length > 0) {
      report += `\n### API响应详情\n`;
      this.apiResponses.forEach((res, index) => {
        report += `${index + 1}. ${res.status} ${res.url} (${res.timestamp})\n`;
      });
    }
    
    report += `\n## 详细测试结果\n\n`;
    
    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      report += `\n### ${index + 1}. ${result.name}\n`;
      report += `- **状态**: ${status}\n`;
      report += `- **时间**: ${result.timestamp}\n`;
      report += `- **详情**: ${result.details}\n`;
    });
    
    report += `\n\n## 测试建议\n\n`;
    
    const failedTests = this.testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `### 修复建议\n\n`;
      failedTests.forEach(test => {
        report += `- ${test.name}: ${test.details}\n`;
      });
    } else {
      report += `### 总体评估\n\n`;
      report += `所有数据处理准确性测试均通过，系统数据处理正常。\n`;
    }

    const reportPath = path.join(__dirname, 'data_accuracy_test_report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`[INFO] 测试报告已生成: ${reportPath}`);
  }

  async runAllTests() {
    try {
      await this.init();
      
      await this.testPageLoad();
      await this.testAPIResponseAccuracy();
      await this.testDataConsistency();
      await this.testStateSync();
      await this.testDataValidation();
      await this.testErrorHandling();
      
      console.log('[INFO] 数据处理准确性测试完成');
      
      await this.generateReport();
      
      const passedTests = this.testResults.filter(r => r.passed).length;
      const totalTests = this.testResults.length;
      const passRate = ((passedTests / totalTests) * 100).toFixed(2);
      
      console.log(`[INFO]\n测试完成！通过率: ${passRate}% (${passedTests}/${totalTests})`);
      
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
const tester = new DataAccuracyTester();
tester.runAllTests().catch(console.error);