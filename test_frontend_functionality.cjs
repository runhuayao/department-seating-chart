const puppeteer = require('puppeteer');
const fs = require('fs');

// 测试配置
const frontendURL = 'http://localhost:5173';
const testTimeout = 30000;

// 测试结果
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, status, details, error = null) {
  const test = { 
    name, 
    status, 
    details, 
    error: error?.message, 
    timestamp: new Date().toISOString() 
  };
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

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runFrontendTests() {
  let browser;
  let page;
  
  try {
    console.log('🚀 开始前端功能测试\n');
    
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: false, // 设为false以便观察测试过程
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // 设置页面超时
    page.setDefaultTimeout(testTimeout);
    
    // 监听控制台错误
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // 监听页面错误
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // 1. 测试页面加载
    console.log('🌐 测试页面加载...');
    try {
      await page.goto(frontendURL, { waitUntil: 'networkidle2' });
      const title = await page.title();
      logTest('页面加载', 'PASS', `页面成功加载，标题: ${title}`);
    } catch (error) {
      logTest('页面加载', 'FAIL', '页面加载失败', error);
      return;
    }
    
    // 2. 测试登录功能
    console.log('\n🔐 测试用户登录...');
    try {
      // 查找登录表单元素
      await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 5000 });
      await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 5000 });
      
      // 填写登录信息
      await page.type('input[type="text"], input[name="username"]', 'admin');
      await page.type('input[type="password"], input[name="password"]', 'admin123');
      
      // 点击登录按钮
      await page.click('button[type="submit"], button:contains("登录"), .login-btn');
      
      // 等待登录完成
      await wait(2000);
      
      // 检查是否登录成功（查找登录后的元素）
      const isLoggedIn = await page.$('.dashboard, .main-content, .user-info') !== null;
      
      if (isLoggedIn) {
        logTest('用户登录', 'PASS', '登录功能正常');
      } else {
        logTest('用户登录', 'FAIL', '登录后未找到预期元素');
      }
    } catch (error) {
      logTest('用户登录', 'FAIL', '登录功能测试失败', error);
    }
    
    // 3. 测试部门选择
    console.log('\n🏢 测试部门选择...');
    try {
      // 查找部门选择器
      const departmentSelector = await page.$('select, .department-select, .dept-dropdown');
      if (departmentSelector) {
        await page.select('select', '开发部');
        await wait(1000);
        logTest('部门选择', 'PASS', '部门选择功能正常');
      } else {
        logTest('部门选择', 'FAIL', '未找到部门选择器');
      }
    } catch (error) {
      logTest('部门选择', 'FAIL', '部门选择功能测试失败', error);
    }
    
    // 4. 测试地图显示
    console.log('\n🗺️ 测试地图显示...');
    try {
      // 查找地图容器
      await page.waitForSelector('.map-container, #map, .floor-plan', { timeout: 5000 });
      const mapElement = await page.$('.map-container, #map, .floor-plan');
      
      if (mapElement) {
        const mapVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, mapElement);
        
        if (mapVisible) {
          logTest('地图显示', 'PASS', '地图容器正常显示');
        } else {
          logTest('地图显示', 'FAIL', '地图容器不可见');
        }
      } else {
        logTest('地图显示', 'FAIL', '未找到地图容器');
      }
    } catch (error) {
      logTest('地图显示', 'FAIL', '地图显示测试失败', error);
    }
    
    // 5. 测试工位显示
    console.log('\n💺 测试工位显示...');
    try {
      // 查找工位元素
      const workstations = await page.$$('.workstation, .desk, .seat');
      if (workstations.length > 0) {
        logTest('工位显示', 'PASS', `发现 ${workstations.length} 个工位元素`);
      } else {
        logTest('工位显示', 'FAIL', '未找到工位元素');
      }
    } catch (error) {
      logTest('工位显示', 'FAIL', '工位显示测试失败', error);
    }
    
    // 6. 测试搜索功能
    console.log('\n🔍 测试搜索功能...');
    try {
      // 查找搜索框
      const searchInput = await page.$('input[type="search"], .search-input, input[placeholder*="搜索"]');
      if (searchInput) {
        await page.type('input[type="search"], .search-input, input[placeholder*="搜索"]', '张三');
        await wait(1000);
        
        // 检查搜索结果
        const searchResults = await page.$('.search-results, .search-list');
        if (searchResults) {
          logTest('搜索功能', 'PASS', '搜索功能正常');
        } else {
          logTest('搜索功能', 'PARTIAL', '搜索框存在但未找到结果容器');
        }
      } else {
        logTest('搜索功能', 'FAIL', '未找到搜索框');
      }
    } catch (error) {
      logTest('搜索功能', 'FAIL', '搜索功能测试失败', error);
    }
    
    // 7. 测试响应式设计
    console.log('\n📱 测试响应式设计...');
    try {
      // 测试移动端视口
      await page.setViewport({ width: 375, height: 667 });
      await wait(1000);
      
      // 检查移动端布局
      const isMobileResponsive = await page.evaluate(() => {
        const body = document.body;
        return window.innerWidth <= 768 && body.offsetWidth <= window.innerWidth;
      });
      
      if (isMobileResponsive) {
        logTest('响应式设计', 'PASS', '移动端响应式布局正常');
      } else {
        logTest('响应式设计', 'FAIL', '移动端响应式布局异常');
      }
      
      // 恢复桌面端视口
      await page.setViewport({ width: 1280, height: 720 });
    } catch (error) {
      logTest('响应式设计', 'FAIL', '响应式设计测试失败', error);
    }
    
    // 8. 测试页面性能
    console.log('\n⚡ 测试页面性能...');
    try {
      const metrics = await page.metrics();
      const loadTime = metrics.TaskDuration;
      
      if (loadTime < 3000) { // 3秒内加载完成
        logTest('页面性能', 'PASS', `页面加载时间: ${loadTime.toFixed(2)}ms`);
      } else {
        logTest('页面性能', 'FAIL', `页面加载时间过长: ${loadTime.toFixed(2)}ms`);
      }
    } catch (error) {
      logTest('页面性能', 'FAIL', '页面性能测试失败', error);
    }
    
    // 9. 检查控制台错误
    console.log('\n🐛 检查控制台错误...');
    if (consoleErrors.length === 0 && pageErrors.length === 0) {
      logTest('控制台错误', 'PASS', '无控制台错误');
    } else {
      const errorCount = consoleErrors.length + pageErrors.length;
      logTest('控制台错误', 'FAIL', `发现 ${errorCount} 个错误`, 
        new Error([...consoleErrors, ...pageErrors].join('; ')));
    }
    
  } catch (error) {
    console.error('测试执行失败:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // 生成报告
  generateFrontendReport();
}

function generateFrontendReport() {
  const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(2) : '0.00';
  
  const report = `# 前端功能测试报告

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

${results.failed > 0 ? '发现问题，需要修复失败的功能。' : '所有前端功能测试通过。'}

## 建议

1. 确保所有交互元素都有适当的选择器
2. 优化页面加载性能
3. 修复控制台错误
4. 改进响应式设计
5. 增强用户体验
`;
  
  fs.writeFileSync('frontend_test_report.md', report);
  console.log('\n📄 前端测试报告已生成: frontend_test_report.md');
  
  console.log(`\n📊 前端测试总结:`);
  console.log(`   总计: ${results.total} 项测试`);
  console.log(`   通过: ${results.passed} 项`);
  console.log(`   失败: ${results.failed} 项`);
  console.log(`   成功率: ${successRate}%`);
}

// 运行测试
runFrontendTests().catch(console.error);