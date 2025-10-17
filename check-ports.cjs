const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function checkPorts() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  const ports = [
    { url: 'http://localhost:5173/', name: '5173-main' },
    { url: 'http://localhost:5173/server-management', name: '5173-server-management' },
    { url: 'http://localhost:3001/', name: '3001-main' },
    { url: 'http://localhost:8080/', name: '8080-main' }
  ];

  const results = {};

  for (const port of ports) {
    console.log(`正在检查 ${port.url}...`);
    
    try {
      const page = await context.newPage();
      
      // 设置较长的超时时间
      await page.goto(port.url, { waitUntil: 'networkidle', timeout: 10000 });
      
      // 等待页面加载完成
      await page.waitForTimeout(2000);
      
      // 获取页面标题
      const title = await page.title();
      
      // 获取页面HTML内容
      const content = await page.content();
      
      // 获取页面URL（可能有重定向）
      const currentUrl = page.url();
      
      // 截图
      const screenshotPath = path.join(__dirname, `screenshot-${port.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // 获取页面中的主要元素
      const bodyText = await page.evaluate(() => {
        return document.body ? document.body.innerText.substring(0, 500) : '';
      });
      
      // 检查是否有Vue应用
      const hasVueApp = await page.evaluate(() => {
        return !!document.querySelector('#app') || !!window.Vue || !!window.__VUE__;
      });
      
      // 检查网络请求
      const requests = [];
      page.on('request', request => {
        requests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType()
        });
      });
      
      results[port.name] = {
        url: port.url,
        currentUrl,
        title,
        bodyText,
        hasVueApp,
        screenshotPath,
        contentLength: content.length,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✓ ${port.name}: ${title} (${currentUrl})`);
      
      await page.close();
      
    } catch (error) {
      console.error(`✗ ${port.name}: ${error.message}`);
      results[port.name] = {
        url: port.url,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 保存结果到JSON文件
  const resultPath = path.join(__dirname, 'port-check-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  
  console.log('\n=== 检查结果 ===');
  for (const [name, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`${name}: 错误 - ${result.error}`);
    } else {
      console.log(`${name}: ${result.title} | ${result.currentUrl}`);
      console.log(`  内容长度: ${result.contentLength} | Vue应用: ${result.hasVueApp}`);
      console.log(`  截图: ${result.screenshotPath}`);
    }
  }
  
  await browser.close();
  return results;
}

checkPorts().catch(console.error);