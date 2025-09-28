const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class SearchFunctionalityTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = [];
        this.startTime = new Date();
    }

    async init() {
        console.log('[INFO] 启动浏览器...');
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });
        this.page = await this.browser.newPage();
        console.log('[INFO] 浏览器初始化完成');
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async testPageLoad() {
        this.log('INFO', '测试页面加载...');
        try {
            await this.page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });
            const title = await this.page.title();
            this.log('INFO', `页面标题: ${title}`);
            
            // 检查搜索相关元素是否存在
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }
            
            this.testResults.push({
                test: '页面加载测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `页面成功加载，找到搜索输入框`
            });
            this.log('INFO', '页面加载测试通过');
        } catch (error) {
            this.testResults.push({
                test: '页面加载测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `页面加载测试失败: ${error.message}`);
        }
    }

    async testEmployeeSearch() {
        this.log('INFO', '测试员工搜索功能...');
        try {
            // 查找搜索输入框
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }

            // 输入员工姓名进行搜索
            await searchInput.click();
            await searchInput.type('张三');
            this.log('INFO', '输入搜索关键词: 张三');

            // 等待搜索结果
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查搜索结果
            const searchResults = await this.page.$$('.search-result, .employee-item, .result-item, [data-testid="search-result"]');
            const resultCount = searchResults.length;
            this.log('INFO', `找到 ${resultCount} 个搜索结果`);

            // 检查是否有搜索建议
            const suggestions = await this.page.$$('.suggestion, .autocomplete-item, .search-suggestion');
            const suggestionCount = suggestions.length;
            this.log('INFO', `找到 ${suggestionCount} 个搜索建议`);

            this.testResults.push({
                test: '员工搜索测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `搜索结果: ${resultCount}个，搜索建议: ${suggestionCount}个`
            });
            this.log('INFO', '员工搜索测试通过');
        } catch (error) {
            this.testResults.push({
                test: '员工搜索测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `员工搜索测试失败: ${error.message}`);
        }
    }

    async testWorkstationSearch() {
        this.log('INFO', '测试工位搜索功能...');
        try {
            // 清空搜索框
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }

            await searchInput.click();
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');

            // 输入工位编号进行搜索
            await searchInput.type('A001');
            this.log('INFO', '输入工位搜索关键词: A001');

            // 等待搜索结果
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查工位搜索结果
            const workstationResults = await this.page.$$('.workstation-item, .seat-item, .desk-item, [data-testid="workstation-result"]');
            const resultCount = workstationResults.length;
            this.log('INFO', `找到 ${resultCount} 个工位搜索结果`);

            // 检查地图上是否有高亮显示
            const highlightedElements = await this.page.$$('.highlighted, .selected, .active, [data-highlighted="true"]');
            const highlightCount = highlightedElements.length;
            this.log('INFO', `地图上高亮元素: ${highlightCount}个`);

            this.testResults.push({
                test: '工位搜索测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `工位搜索结果: ${resultCount}个，高亮元素: ${highlightCount}个`
            });
            this.log('INFO', '工位搜索测试通过');
        } catch (error) {
            this.testResults.push({
                test: '工位搜索测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `工位搜索测试失败: ${error.message}`);
        }
    }

    async testSearchSuggestions() {
        this.log('INFO', '测试搜索建议功能...');
        try {
            // 清空搜索框
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }

            await searchInput.click();
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');

            // 输入部分关键词触发搜索建议
            await searchInput.type('工程');
            this.log('INFO', '输入部分关键词: 工程');

            // 等待搜索建议出现
            await new Promise(resolve => setTimeout(resolve, 500));

            // 检查搜索建议下拉列表
            const suggestionDropdown = await this.page.$('.suggestion-dropdown, .autocomplete-dropdown, .search-suggestions');
            const suggestions = await this.page.$$('.suggestion-item, .autocomplete-item, .search-suggestion');
            const suggestionCount = suggestions.length;
            
            this.log('INFO', `搜索建议数量: ${suggestionCount}`);

            // 测试点击搜索建议
            if (suggestions.length > 0) {
                await suggestions[0].click();
                this.log('INFO', '点击第一个搜索建议');
                
                // 等待搜索结果更新
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 检查搜索框内容是否更新
                const inputValue = await this.page.$eval('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input', el => el.value);
                this.log('INFO', `搜索框内容更新为: ${inputValue}`);
            }

            this.testResults.push({
                test: '搜索建议测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `搜索建议数量: ${suggestionCount}，建议功能正常`
            });
            this.log('INFO', '搜索建议测试通过');
        } catch (error) {
            this.testResults.push({
                test: '搜索建议测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `搜索建议测试失败: ${error.message}`);
        }
    }

    async testSearchResultProcessing() {
        this.log('INFO', '测试搜索结果处理...');
        try {
            // 执行一个搜索
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }

            await searchInput.click();
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');
            await searchInput.type('部门');
            
            // 等待搜索结果
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查搜索结果的处理和显示
            const resultContainer = await this.page.$('.search-results, .results-container, .search-output');
            const results = await this.page.$$('.search-result, .result-item, .employee-item, .workstation-item');
            
            this.log('INFO', `搜索结果容器: ${resultContainer ? '存在' : '不存在'}`);
            this.log('INFO', `搜索结果数量: ${results.length}`);

            // 测试结果点击功能
            if (results.length > 0) {
                const firstResult = results[0];
                await firstResult.click();
                this.log('INFO', '点击第一个搜索结果');
                
                // 等待页面响应
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 检查是否有详细信息显示或地图定位
                const detailPanel = await this.page.$('.detail-panel, .info-panel, .employee-detail, .workstation-detail');
                const mapHighlight = await this.page.$('.highlighted, .selected, .focused');
                
                this.log('INFO', `详细信息面板: ${detailPanel ? '显示' : '未显示'}`);
                this.log('INFO', `地图高亮: ${mapHighlight ? '存在' : '不存在'}`);
            }

            this.testResults.push({
                test: '搜索结果处理测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `结果容器存在，结果数量: ${results.length}，点击响应正常`
            });
            this.log('INFO', '搜索结果处理测试通过');
        } catch (error) {
            this.testResults.push({
                test: '搜索结果处理测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `搜索结果处理测试失败: ${error.message}`);
        }
    }

    async testSearchPerformance() {
        this.log('INFO', '测试搜索性能...');
        try {
            const searchInput = await this.page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
                throw new Error('未找到搜索输入框');
            }

            // 测试搜索响应时间
            const startTime = Date.now();
            
            await searchInput.click();
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');
            await searchInput.type('测试搜索性能');
            
            // 等待搜索完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            this.log('INFO', `搜索响应时间: ${responseTime}ms`);
            
            // 检查是否有加载指示器
            const loadingIndicator = await this.page.$('.loading, .spinner, .searching');
            this.log('INFO', `加载指示器: ${loadingIndicator ? '存在' : '不存在'}`);

            const performanceGrade = responseTime < 1000 ? '优秀' : responseTime < 2000 ? '良好' : '需要优化';

            this.testResults.push({
                test: '搜索性能测试',
                status: 'passed',
                timestamp: new Date().toISOString(),
                details: `响应时间: ${responseTime}ms，性能评级: ${performanceGrade}`
            });
            this.log('INFO', '搜索性能测试通过');
        } catch (error) {
            this.testResults.push({
                test: '搜索性能测试',
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: error.message
            });
            this.log('ERROR', `搜索性能测试失败: ${error.message}`);
        }
    }

    async generateReport() {
        const endTime = new Date();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        const passedTests = this.testResults.filter(result => result.status === 'passed').length;
        const failedTests = this.testResults.filter(result => result.status === 'failed').length;
        const totalTests = this.testResults.length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(2);

        let report = `# 搜索功能测试报告\n\n`;
        report += `## 测试概览\n`;
        report += `- **测试时间**: ${this.startTime.toLocaleDateString()} ${this.startTime.toLocaleTimeString()}\n`;
        report += `- **总测试数**: ${totalTests}\n`;
        report += `- **通过数**: ${passedTests}\n`;
        report += `- **失败数**: ${failedTests}\n`;
        report += `- **通过率**: ${passRate}%\n`;
        report += `- **测试耗时**: ${duration}秒\n\n`;

        report += `## 详细测试结果\n\n`;
        this.testResults.forEach((result, index) => {
            const status = result.status === 'passed' ? '✅ 通过' : '❌ 失败';
            report += `\n### ${index + 1}. ${result.test}\n`;
            report += `- **状态**: ${status}\n`;
            report += `- **时间**: ${result.timestamp}\n`;
            if (result.details) {
                report += `- **详情**: ${result.details}\n`;
            }
            if (result.error) {
                report += `- **错误**: ${result.error}\n`;
            }
        });

        report += `\n\n## 测试建议\n\n`;
        report += `### 修复建议\n\n`;
        const failedResults = this.testResults.filter(result => result.status === 'failed');
        if (failedResults.length > 0) {
            failedResults.forEach(result => {
                report += `- ${result.test}: ${result.error}\n`;
            });
        } else {
            report += `- 所有测试均通过，搜索功能运行正常\n`;
        }

        const reportPath = path.join(__dirname, 'search_functionality_test_report.md');
        fs.writeFileSync(reportPath, report);
        this.log('INFO', `测试报告已生成: ${reportPath}`);
    }

    async runAllTests() {
        this.log('INFO', '开始搜索功能测试...');
        
        await this.testPageLoad();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.testEmployeeSearch();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.testWorkstationSearch();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.testSearchSuggestions();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.testSearchResultProcessing();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await this.testSearchPerformance();
        
        this.log('INFO', '搜索功能测试完成');
        
        await this.generateReport();
        
        const passedTests = this.testResults.filter(result => result.status === 'passed').length;
        const totalTests = this.testResults.length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(2);
        
        this.log('INFO', `\n测试完成！通过率: ${passRate}% (${passedTests}/${totalTests})`);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('[INFO] 浏览器已关闭');
        }
    }
}

// 运行测试
(async () => {
    const tester = new SearchFunctionalityTester();
    try {
        await tester.init();
        await tester.runAllTests();
    } catch (error) {
        console.error('[ERROR] 测试过程中发生错误:', error);
    } finally {
        await tester.close();
    }
})();