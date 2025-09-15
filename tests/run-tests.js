#!/usr/bin/env node
// 测试运行器 - 统一执行所有单元测试
// 提供详细的测试报告和日志记录

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

// 测试配置
const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const TEST_CONFIG = {
  testDir: 'D:\\HuaweiMoveData\\Users\\11346\\Desktop\\部门地图\\tests',
  reportDir: 'D:\\HuaweiMoveData\\Users\\11346\\Desktop\\部门地图\\tests\\reports',
  logFile: 'D:\\HuaweiMoveData\\Users\\11346\\Desktop\\部门地图\\tests\\test-execution.log',
  timeout: 30000,
  maxRetries: 2
};

// 测试套件定义
const TEST_SUITES = [
  {
    name: '搜索功能测试',
    description: '测试搜索栏数据请求、API调用和数据库查询功能',
    file: 'search.test.js',
    priority: 'high',
    timeout: 15000
  },
  {
    name: 'WebSocket连接管理测试',
    description: '测试WebSocket单实例连接控制和状态管理',
    file: 'websocket.test.js',
    priority: 'high',
    timeout: 20000
  },
  {
    name: '数据库操作测试',
    description: '测试SQLite和PostgreSQL数据库连接、查询和错误处理',
    file: 'database.test.js',
    priority: 'medium',
    timeout: 25000
  }
];

// 日志记录类
class TestLogger {
  constructor(logFile) {
    this.logFile = logFile;
    this.logs = [];
  }
  
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // 控制台输出
    const colorMap = {
      INFO: '\x1b[36m',    // 青色
      SUCCESS: '\x1b[32m', // 绿色
      WARNING: '\x1b[33m', // 黄色
      ERROR: '\x1b[31m',   // 红色
      RESET: '\x1b[0m'     // 重置
    };
    
    const color = colorMap[level] || colorMap.RESET;
    console.log(`${color}[${timestamp}] ${level}: ${message}${colorMap.RESET}`);
    
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
  
  async saveToFile() {
    try {
      const logContent = this.logs.map(log => 
        `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
      ).join('\n');
      
      await fs.writeFile(this.logFile, logContent, 'utf8');
      this.log('INFO', `测试日志已保存到: ${this.logFile}`);
    } catch (err) {
      this.log('ERROR', '保存测试日志失败', err.message);
    }
  }
}

// 测试结果统计类
class TestResults {
  constructor() {
    this.suites = [];
    this.startTime = Date.now();
    this.endTime = null;
  }
  
  addSuite(suite) {
    this.suites.push(suite);
  }
  
  finish() {
    this.endTime = Date.now();
  }
  
  getSummary() {
    const totalSuites = this.suites.length;
    const passedSuites = this.suites.filter(s => s.status === 'passed').length;
    const failedSuites = this.suites.filter(s => s.status === 'failed').length;
    const skippedSuites = this.suites.filter(s => s.status === 'skipped').length;
    
    const totalTests = this.suites.reduce((sum, s) => sum + (s.testCount || 0), 0);
    const passedTests = this.suites.reduce((sum, s) => sum + (s.passedTests || 0), 0);
    const failedTests = this.suites.reduce((sum, s) => sum + (s.failedTests || 0), 0);
    
    const duration = this.endTime - this.startTime;
    
    return {
      duration,
      suites: {
        total: totalSuites,
        passed: passedSuites,
        failed: failedSuites,
        skipped: skippedSuites
      },
      tests: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests
      },
      coverage: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    };
  }
}

// 测试运行器类
class TestRunner {
  constructor(config) {
    this.config = config;
    this.logger = new TestLogger(config.logFile);
    this.results = new TestResults();
  }
  
  async setup() {
    try {
      // 创建报告目录
      await fs.mkdir(this.config.reportDir, { recursive: true });
      
      // 清理旧的日志文件
      try {
        await fs.unlink(this.config.logFile);
      } catch (err) {
        // 文件不存在，忽略错误
      }
      
      this.logger.log('INFO', '测试环境初始化完成');
    } catch (err) {
      this.logger.log('ERROR', '测试环境初始化失败', err.message);
      throw err;
    }
  }
  
  async runSuite(suite) {
    this.logger.log('INFO', `开始执行测试套件: ${suite.name}`);
    
    const suiteResult = {
      name: suite.name,
      file: suite.file,
      description: suite.description,
      priority: suite.priority,
      startTime: Date.now(),
      endTime: null,
      status: 'running',
      output: '',
      error: null,
      testCount: 0,
      passedTests: 0,
      failedTests: 0
    };
    
    try {
      const testFile = path.join(this.config.testDir, suite.file);
      
      // 检查测试文件是否存在
      await fs.access(testFile);
      
      // 运行测试文件
      const result = await this.executeTest(testFile);
      
      suiteResult.status = result.success ? 'passed' : 'failed';
      suiteResult.output = result.output;
      suiteResult.error = result.error;
      suiteResult.testCount = result.testCount || 0;
      suiteResult.passedTests = result.passedTests || 0;
      suiteResult.failedTests = result.failedTests || 0;
      
      if (result.success) {
        this.logger.log('SUCCESS', `测试套件通过: ${suite.name}`);
      } else {
        this.logger.log('ERROR', `测试套件失败: ${suite.name}`, result.error);
      }
      
    } catch (err) {
      suiteResult.status = 'failed';
      suiteResult.error = err.message;
      this.logger.log('ERROR', `测试套件执行异常: ${suite.name}`, err.message);
    }
    
    suiteResult.endTime = Date.now();
    suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
    
    this.results.addSuite(suiteResult);
    return suiteResult;
  }
  
  async executeTest(testFile) {
    return new Promise((resolve) => {
      const child = spawn('node', [testFile], {
        cwd: this.config.testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output,
          error: '测试执行超时',
          testCount: 0,
          passedTests: 0,
          failedTests: 1
        });
      }, this.config.timeout);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        
        // 解析测试结果
        const testCount = this.parseTestCount(output);
        const passedTests = this.parsePassedTests(output);
        const failedTests = this.parseFailedTests(output);
        
        resolve({
          success: code === 0,
          output,
          error: error || null,
          testCount,
          passedTests,
          failedTests
        });
      });
    });
  }
  
  parseTestCount(output) {
    const match = output.match(/总测试用例[：:]\s*(\d+)个/);
    return match ? parseInt(match[1]) : 0;
  }
  
  parsePassedTests(output) {
    const match = output.match(/通过[：:]\s*(\d+)个/);
    return match ? parseInt(match[1]) : 0;
  }
  
  parseFailedTests(output) {
    const match = output.match(/失败[：:]\s*(\d+)个/);
    return match ? parseInt(match[1]) : 0;
  }
  
  async generateReport() {
    const summary = this.results.getSummary();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      suites: this.results.suites
    };
    
    // 生成JSON报告
    const jsonReportPath = path.join(this.config.reportDir, 'test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
    
    // 生成HTML报告
    const htmlReport = this.generateHTMLReport(report);
    const htmlReportPath = path.join(this.config.reportDir, 'test-report.html');
    await fs.writeFile(htmlReportPath, htmlReport);
    
    this.logger.log('INFO', `测试报告已生成:`);
    this.logger.log('INFO', `- JSON: ${jsonReportPath}`);
    this.logger.log('INFO', `- HTML: ${htmlReportPath}`);
    
    return report;
  }
  
  generateHTMLReport(report) {
    const { summary, suites } = report;
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>部门地图系统 - 单元测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .suite-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .suite-content { padding: 15px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background-color: #28a745; }
        .status-failed { background-color: #dc3545; }
        .status-skipped { background-color: #ffc107; }
        .output { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9em; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>部门地图系统 - 单元测试报告</h1>
            <p>生成时间: ${report.timestamp}</p>
            <p>执行时长: ${Math.round(summary.duration / 1000)}秒</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>测试套件</h3>
                <div class="value">${summary.suites.total}</div>
                <div>总数</div>
            </div>
            <div class="summary-card">
                <h3>通过套件</h3>
                <div class="value passed">${summary.suites.passed}</div>
                <div>通过</div>
            </div>
            <div class="summary-card">
                <h3>失败套件</h3>
                <div class="value failed">${summary.suites.failed}</div>
                <div>失败</div>
            </div>
            <div class="summary-card">
                <h3>测试用例</h3>
                <div class="value">${summary.tests.total}</div>
                <div>总数</div>
            </div>
            <div class="summary-card">
                <h3>覆盖率</h3>
                <div class="value">${summary.coverage}%</div>
                <div>通过率</div>
            </div>
        </div>
        
        <h2>测试套件详情</h2>
        ${suites.map(suite => `
            <div class="suite">
                <div class="suite-header">
                    <h3>${suite.name} <span class="status-badge status-${suite.status}">${suite.status.toUpperCase()}</span></h3>
                    <p>${suite.description}</p>
                    <p><strong>文件:</strong> ${suite.file} | <strong>优先级:</strong> ${suite.priority} | <strong>耗时:</strong> ${Math.round(suite.duration / 1000)}秒</p>
                </div>
                <div class="suite-content">
                    <p><strong>测试统计:</strong> 总计 ${suite.testCount} 个，通过 ${suite.passedTests} 个，失败 ${suite.failedTests} 个</p>
                    ${suite.output ? `<div class="output">${suite.output}</div>` : ''}
                    ${suite.error ? `<div class="output error"><strong>错误信息:</strong>\n${suite.error}</div>` : ''}
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }
  
  async run() {
    try {
      this.logger.log('INFO', '开始执行单元测试');
      
      await this.setup();
      
      // 按优先级排序测试套件
      const sortedSuites = TEST_SUITES.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      // 执行所有测试套件
      for (const suite of sortedSuites) {
        await this.runSuite(suite);
      }
      
      this.results.finish();
      
      // 生成测试报告
      const report = await this.generateReport();
      
      // 保存日志
      await this.logger.saveToFile();
      
      // 输出总结
      this.printSummary(report.summary);
      
      return report;
      
    } catch (err) {
      this.logger.log('ERROR', '测试执行失败', err.message);
      throw err;
    }
  }
  
  printSummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试执行总结');
    console.log('='.repeat(60));
    console.log(`⏱️  执行时长: ${Math.round(summary.duration / 1000)}秒`);
    console.log(`📦 测试套件: ${summary.suites.total}个 (通过: ${summary.suites.passed}, 失败: ${summary.suites.failed})`);
    console.log(`🧪 测试用例: ${summary.tests.total}个 (通过: ${summary.tests.passed}, 失败: ${summary.tests.failed})`);
    console.log(`📈 通过率: ${summary.coverage}%`);
    
    if (summary.suites.failed > 0) {
      console.log('\n❌ 存在失败的测试套件，请检查详细报告');
      process.exit(1);
    } else {
      console.log('\n✅ 所有测试套件执行成功！');
    }
  }
}

// 主函数
async function main() {
  const runner = new TestRunner(TEST_CONFIG);
  
  try {
    await runner.run();
  } catch (err) {
    console.error('测试执行失败:', err.message);
    process.exit(1);
  }
}

// 直接执行主函数
main().catch(err => {
  console.error('测试执行失败:', err.message);
  process.exit(1);
});

export {
  TestRunner,
  TestLogger,
  TestResults,
  TEST_CONFIG,
  TEST_SUITES
};

export default TestRunner;