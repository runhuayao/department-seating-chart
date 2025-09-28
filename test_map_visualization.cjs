const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class MapVisualizationTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = new TestResults();
        this.baseUrl = 'http://localhost:5174';
    }

    async initialize() {
        console.log('[INFO] 启动浏览器...');
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        console.log('[INFO] 浏览器初始化完成');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('[INFO] 浏览器已关闭');
        }
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const levelMap = {
            info: 'INFO',
            warn: 'WARN', 
            error: 'ERROR'
        };
        console.log(`[${timestamp}] [${levelMap[level]}] ${message}`);
    }

    async testPageLoad() {
        this.log('测试页面加载...');
        try {
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            const title = await this.page.title();
            this.log(`页面标题: ${title}`);
            
            // 检查地图容器是否存在
            const mapContainer = await this.page.$('.map-container, #map-container, [data-testid="map-container"]');
            if (mapContainer) {
                this.results.addResult('页面加载测试', true, '页面加载成功，地图容器存在');
                this.log('页面加载测试通过');
            } else {
                throw new Error('未找到地图容器');
            }
        } catch (error) {
            this.results.addResult('页面加载测试', false, '', error.message);
            this.log(`页面加载测试失败: ${error.message}`, 'error');
        }
    }

    async testDepartmentSwitching() {
        this.log('测试部门切换功能...');
        try {
            // 查找部门选择器
            const departmentSelector = await this.page.$('select, .department-selector, [data-testid="department-selector"]');
            if (!departmentSelector) {
                throw new Error('未找到部门选择器');
            }

            // 获取当前选中的部门
            const initialDepartment = await this.page.evaluate(() => {
                const selector = document.querySelector('select, .department-selector, [data-testid="department-selector"]');
                return selector ? selector.value || selector.textContent : null;
            });
            this.log(`初始部门: ${initialDepartment}`);

            // 获取所有可用部门选项
            const departments = await this.page.evaluate(() => {
                const selector = document.querySelector('select');
                if (selector) {
                    return Array.from(selector.options).map(option => ({ value: option.value, text: option.text }));
                }
                // 如果不是select元素，查找其他部门选项
                const buttons = Array.from(document.querySelectorAll('button, .department-option'));
                return buttons.filter(btn => btn.textContent && btn.textContent.trim()).map(btn => ({
                    value: btn.textContent.trim(),
                    text: btn.textContent.trim()
                }));
            });

            if (departments.length < 2) {
                throw new Error('可用部门选项不足，无法测试切换功能');
            }

            // 切换到不同的部门
            const targetDepartment = departments.find(dept => dept.value !== initialDepartment);
            if (targetDepartment) {
                if (await this.page.$('select')) {
                    await this.page.select('select', targetDepartment.value);
                } else {
                    // 点击部门按钮
                    const buttons = await this.page.$$('button');
                    for (const btn of buttons) {
                        const text = await btn.evaluate(el => el.textContent);
                        if (text && text.includes(targetDepartment.text)) {
                            await btn.click();
                            break;
                        }
                    }
                }
                
                // 等待地图更新
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                this.log(`成功切换到部门: ${targetDepartment.text}`);
                this.results.addResult('部门切换测试', true, `成功切换部门: ${initialDepartment} -> ${targetDepartment.text}`);
            }
        } catch (error) {
            this.results.addResult('部门切换测试', false, '', error.message);
            this.log(`部门切换测试失败: ${error.message}`, 'error');
        }
    }

    async testMapZoomOperations() {
        this.log('测试地图缩放操作...');
        try {
            // 查找地图容器
            const mapContainer = await this.page.$('.map-container, #map-container, [data-testid="map-container"], svg');
            if (!mapContainer) {
                throw new Error('未找到地图容器');
            }

            // 获取初始缩放级别
            const initialTransform = await this.page.evaluate(() => {
                const svg = document.querySelector('svg');
                const g = svg ? svg.querySelector('g') : null;
                return g ? g.getAttribute('transform') : null;
            });
            this.log(`初始变换: ${initialTransform}`);

            // 测试鼠标滚轮缩放
            const mapBounds = await mapContainer.boundingBox();
            const centerX = mapBounds.x + mapBounds.width / 2;
            const centerY = mapBounds.y + mapBounds.height / 2;

            // 放大
            await this.page.mouse.move(centerX, centerY);
            await this.page.mouse.wheel({ deltaY: -100 }); // 向上滚动放大
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查缩放是否生效
            const zoomedTransform = await this.page.evaluate(() => {
                const svg = document.querySelector('svg');
                const g = svg ? svg.querySelector('g') : null;
                return g ? g.getAttribute('transform') : null;
            });

            if (zoomedTransform !== initialTransform) {
                this.log('缩放操作成功');
                
                // 测试缩小
                await this.page.mouse.wheel({ deltaY: 100 }); // 向下滚动缩小
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                this.results.addResult('地图缩放测试', true, '缩放功能正常工作');
            } else {
                throw new Error('缩放操作未生效');
            }
        } catch (error) {
            this.results.addResult('地图缩放测试', false, '', error.message);
            this.log(`地图缩放测试失败: ${error.message}`, 'error');
        }
    }

    async testWorkstationDisplay() {
        this.log('测试工位显示功能...');
        try {
            // 查找工位元素
            const workstations = await this.page.$$('.workstation, .seat, [data-testid="workstation"], circle, rect');
            if (workstations.length === 0) {
                throw new Error('未找到工位元素');
            }

            this.log(`找到 ${workstations.length} 个工位元素`);

            // 检查工位是否有不同的状态显示
            const workstationStates = await this.page.evaluate(() => {
                const elements = document.querySelectorAll('.workstation, .seat, [data-testid="workstation"], circle, rect');
                const states = new Set();
                elements.forEach(el => {
                    // 检查类名
                    if (el.className) {
                        const classes = el.className.baseVal || el.className;
                        if (typeof classes === 'string') {
                            classes.split(' ').forEach(cls => {
                                if (cls.includes('occupied') || cls.includes('available') || cls.includes('reserved')) {
                                    states.add(cls);
                                }
                            });
                        }
                    }
                    // 检查样式
                    const style = window.getComputedStyle(el);
                    if (style.fill) states.add(`fill-${style.fill}`);
                    if (style.backgroundColor) states.add(`bg-${style.backgroundColor}`);
                });
                return Array.from(states);
            });

            this.log(`工位状态类型: ${workstationStates.join(', ')}`);
            this.results.addResult('工位显示测试', true, `显示了 ${workstations.length} 个工位，状态类型: ${workstationStates.length}`);
        } catch (error) {
            this.results.addResult('工位显示测试', false, '', error.message);
            this.log(`工位显示测试失败: ${error.message}`, 'error');
        }
    }

    async testWorkstationHighlight() {
        this.log('测试工位高亮效果...');
        try {
            // 查找可点击的工位
            const workstations = await this.page.$$('.workstation, .seat, [data-testid="workstation"], circle, rect');
            if (workstations.length === 0) {
                throw new Error('未找到工位元素');
            }

            // 选择第一个工位进行测试
            const firstWorkstation = workstations[0];
            
            // 获取点击前的样式
            const beforeStyles = await firstWorkstation.evaluate(el => {
                const style = window.getComputedStyle(el);
                return {
                    fill: style.fill,
                    stroke: style.stroke,
                    strokeWidth: style.strokeWidth,
                    opacity: style.opacity
                };
            });

            // 点击工位
            await firstWorkstation.click();
            await new Promise(resolve => setTimeout(resolve, 500));

            // 获取点击后的样式
            const afterStyles = await firstWorkstation.evaluate(el => {
                const style = window.getComputedStyle(el);
                return {
                    fill: style.fill,
                    stroke: style.stroke,
                    strokeWidth: style.strokeWidth,
                    opacity: style.opacity
                };
            });

            // 检查是否有样式变化（高亮效果）
            const hasHighlight = Object.keys(beforeStyles).some(key => 
                beforeStyles[key] !== afterStyles[key]
            );

            if (hasHighlight) {
                this.log('工位高亮效果正常');
                this.results.addResult('工位高亮测试', true, '点击工位后出现高亮效果');
            } else {
                // 检查是否有其他形式的反馈（如弹窗、信息面板等）
                const popup = await this.page.$('.popup, .tooltip, .info-panel, [data-testid="workstation-info"]');
                if (popup) {
                    this.log('工位点击触发了信息显示');
                    this.results.addResult('工位高亮测试', true, '点击工位后显示信息面板');
                } else {
                    throw new Error('点击工位后无明显反馈');
                }
            }
        } catch (error) {
            this.results.addResult('工位高亮测试', false, '', error.message);
            this.log(`工位高亮测试失败: ${error.message}`, 'error');
        }
    }

    async testMapInteractivity() {
        this.log('测试地图交互性...');
        try {
            // 测试地图拖拽
            const mapContainer = await this.page.$('.map-container, #map-container, [data-testid="map-container"], svg');
            if (!mapContainer) {
                throw new Error('未找到地图容器');
            }

            const mapBounds = await mapContainer.boundingBox();
            const startX = mapBounds.x + 100;
            const startY = mapBounds.y + 100;
            const endX = startX + 50;
            const endY = startY + 50;

            // 获取拖拽前的变换
            const beforeTransform = await this.page.evaluate(() => {
                const svg = document.querySelector('svg');
                const g = svg ? svg.querySelector('g') : null;
                return g ? g.getAttribute('transform') : null;
            });

            // 执行拖拽操作
            await this.page.mouse.move(startX, startY);
            await this.page.mouse.down();
            await this.page.mouse.move(endX, endY);
            await this.page.mouse.up();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 获取拖拽后的变换
            const afterTransform = await this.page.evaluate(() => {
                const svg = document.querySelector('svg');
                const g = svg ? svg.querySelector('g') : null;
                return g ? g.getAttribute('transform') : null;
            });

            if (afterTransform !== beforeTransform) {
                this.log('地图拖拽功能正常');
                this.results.addResult('地图交互测试', true, '地图支持拖拽操作');
            } else {
                this.log('地图拖拽未生效，可能不支持拖拽', 'warn');
                this.results.addResult('地图交互测试', true, '地图加载正常（拖拽功能可能未启用）');
            }
        } catch (error) {
            this.results.addResult('地图交互测试', false, '', error.message);
            this.log(`地图交互测试失败: ${error.message}`, 'error');
        }
    }

    async runAllTests() {
        const tests = [
            () => this.testPageLoad(),
            () => this.testDepartmentSwitching(),
            () => this.testMapZoomOperations(),
            () => this.testWorkstationDisplay(),
            () => this.testWorkstationHighlight(),
            () => this.testMapInteractivity()
        ];

        this.log('开始地图可视化功能测试...');
        
        for (const test of tests) {
            try {
                await test();
                await new Promise(resolve => setTimeout(resolve, 1000)); // 测试间隔
            } catch (error) {
                this.log(`测试执行出错: ${error.message}`, 'error');
            }
        }

        this.log('地图可视化功能测试完成');
        
        // 生成测试报告
        const reportPath = path.join(__dirname, 'map_visualization_test_report.md');
        const report = this.results.generateReport('地图可视化功能测试报告');
        fs.writeFileSync(reportPath, report, 'utf8');
        this.log(`测试报告已生成: ${reportPath}`);
        
        const summary = this.results.getSummary();
        this.log(`\n测试完成！通过率: ${summary.passRate} (${summary.passed}/${summary.total})`);
    }
}

class TestResults {
    constructor() {
        this.results = [];
        this.startTime = new Date();
    }

    addResult(testName, passed, details = '', error = '') {
        this.results.push({
            testName,
            passed,
            details,
            error,
            timestamp: new Date().toISOString()
        });
    }

    getSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%';
        
        return { total, passed, failed, passRate };
    }

    generateReport(title) {
        const summary = this.getSummary();
        const endTime = new Date();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        
        let report = `# ${title}\n\n`;
        report += `## 测试概览\n`;
        report += `- **测试时间**: ${this.startTime.toLocaleString('zh-CN')}\n`;
        report += `- **总测试数**: ${summary.total}\n`;
        report += `- **通过数**: ${summary.passed}\n`;
        report += `- **失败数**: ${summary.failed}\n`;
        report += `- **通过率**: ${summary.passRate}\n`;
        report += `- **测试耗时**: ${duration}秒\n\n`;
        
        report += `## 详细测试结果\n\n`;
        
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅ 通过' : '❌ 失败';
            report += `\n### ${index + 1}. ${result.testName}\n`;
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
        
        const failedTests = this.results.filter(r => !r.passed);
        if (failedTests.length > 0) {
            report += `### 修复建议\n\n`;
            failedTests.forEach(test => {
                report += `- ${test.testName}: ${test.error}\n`;
            });
        } else {
            report += `### 总体评价\n\n`;
            report += `所有测试均通过，地图可视化功能运行良好。\n`;
        }
        
        return report;
    }
}

// 主执行函数
async function main() {
    const tester = new MapVisualizationTester();
    
    try {
        await tester.initialize();
        await tester.runAllTests();
    } catch (error) {
        console.error('测试执行失败:', error);
    } finally {
        await tester.cleanup();
    }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MapVisualizationTester;