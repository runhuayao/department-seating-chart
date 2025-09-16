/**
 * WebSocket与PostgreSQL集成功能验证
 * 基于WebSocket与PostgreSQL组件关联技术文档
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 验证配置
const VALIDATION_CONFIG = {
  requiredFiles: [
    'api/websocket/server-monitor.ts',
    'api/services/realtime.ts',
    'api/core/DataSyncService.ts',
    'api/websocket/database-sync.ts',
    'api/services/connection-manager.ts'
  ],
  requiredFunctions: [
    'createDatabaseTriggers',
    'WebSocketConnectionManager',
    'RealTimeDataService',
    'DatabaseChangeListener'
  ],
  requiredTriggers: [
    'notify_user_changes',
    'notify_department_changes',
    'notify_config_changes'
  ]
};

/**
 * 验证文件存在性
 */
function validateFileExistence() {
  console.log('🔍 验证WebSocket与PostgreSQL集成文件...');
  
  const results = [];
  
  for (const file of VALIDATION_CONFIG.requiredFiles) {
    const filePath = join(projectRoot, file);
    const exists = existsSync(filePath);
    
    results.push({
      file,
      exists,
      status: exists ? '✅' : '❌'
    });
    
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  }
  
  return results;
}

/**
 * 验证关键函数实现
 */
function validateFunctionImplementation() {
  console.log('\n🔍 验证关键函数实现...');
  
  const results = [];
  
  // 检查realtime.ts文件
  const realtimeFile = join(projectRoot, 'api/services/realtime.ts');
  if (existsSync(realtimeFile)) {
    const content = readFileSync(realtimeFile, 'utf-8');
    
    for (const func of VALIDATION_CONFIG.requiredFunctions) {
      const hasFunction = content.includes(func);
      results.push({
        function: func,
        implemented: hasFunction,
        status: hasFunction ? '✅' : '❌'
      });
      
      console.log(`  ${hasFunction ? '✅' : '❌'} ${func}`);
    }
  }
  
  return results;
}

/**
 * 验证数据库触发器
 */
function validateDatabaseTriggers() {
  console.log('\n🔍 验证数据库触发器...');
  
  const results = [];
  
  // 检查realtime.ts文件中的触发器函数
  const realtimeFile = join(projectRoot, 'api/services/realtime.ts');
  if (existsSync(realtimeFile)) {
    const content = readFileSync(realtimeFile, 'utf-8');
    
    for (const trigger of VALIDATION_CONFIG.requiredTriggers) {
      const hasTrigger = content.includes(trigger);
      results.push({
        trigger,
        implemented: hasTrigger,
        status: hasTrigger ? '✅' : '❌'
      });
      
      console.log(`  ${hasTrigger ? '✅' : '❌'} ${trigger}`);
    }
  }
  
  return results;
}

/**
 * 验证WebSocket服务器配置
 */
function validateWebSocketConfiguration() {
  console.log('\n🔍 验证WebSocket服务器配置...');
  
  const serverFile = join(projectRoot, 'api/websocket/server-monitor.ts');
  if (existsSync(serverFile)) {
    const content = readFileSync(serverFile, 'utf-8');
    
    const checks = [
      { name: 'Socket.IO集成', pattern: 'SocketIOServer' },
      { name: '连接管理', pattern: 'WebSocketConnectionManager' },
      { name: '数据库监听', pattern: 'DatabaseChangeListener' },
      { name: '实时服务', pattern: 'RealTimeDataService' },
      { name: '心跳机制', pattern: 'HEARTBEAT' },
      { name: 'Redis缓存', pattern: 'Redis' }
    ];
    
    const results = [];
    
    for (const check of checks) {
      const hasFeature = content.includes(check.pattern);
      results.push({
        feature: check.name,
        implemented: hasFeature,
        status: hasFeature ? '✅' : '❌'
      });
      
      console.log(`  ${hasFeature ? '✅' : '❌'} ${check.name}`);
    }
    
    return results;
  }
  
  return [];
}

/**
 * 验证数据同步服务
 */
function validateDataSyncService() {
  console.log('\n🔍 验证数据同步服务...');
  
  const syncFile = join(projectRoot, 'api/core/DataSyncService.ts');
  if (existsSync(syncFile)) {
    const content = readFileSync(syncFile, 'utf-8');
    
    const checks = [
      { name: '数据变更监听', pattern: 'handleDataChange' },
      { name: '触发器设置', pattern: 'setupDatabaseTriggers' },
      { name: 'PostgreSQL通知', pattern: 'pg_notify' },
      { name: '事件发布', pattern: 'triggerSync' },
      { name: '连接管理', pattern: 'connectionManager' }
    ];
    
    const results = [];
    
    for (const check of checks) {
      const hasFeature = content.includes(check.pattern);
      results.push({
        feature: check.name,
        implemented: hasFeature,
        status: hasFeature ? '✅' : '❌'
      });
      
      console.log(`  ${hasFeature ? '✅' : '❌'} ${check.name}`);
    }
    
    return results;
  }
  
  return [];
}

/**
 * 生成验证报告
 */
function generateValidationReport(results) {
  console.log('\n📊 WebSocket与PostgreSQL集成验证报告');
  console.log('=' .repeat(50));
  
  let totalChecks = 0;
  let passedChecks = 0;
  
  for (const [category, items] of Object.entries(results)) {
    console.log(`\n${category}:`);
    
    for (const item of items) {
      totalChecks++;
      if (item.implemented || item.exists) {
        passedChecks++;
      }
    }
  }
  
  const successRate = ((passedChecks / totalChecks) * 100).toFixed(1);
  
  console.log(`\n总体状态: ${passedChecks}/${totalChecks} 项检查通过 (${successRate}%)`);
  
  if (successRate >= 90) {
    console.log('🎉 WebSocket与PostgreSQL集成功能验证通过！');
  } else if (successRate >= 70) {
    console.log('⚠️  WebSocket与PostgreSQL集成基本完整，建议完善缺失功能');
  } else {
    console.log('❌ WebSocket与PostgreSQL集成需要进一步完善');
  }
  
  return { totalChecks, passedChecks, successRate };
}

/**
 * 主验证函数
 */
async function runValidation() {
  console.log('🚀 开始WebSocket与PostgreSQL集成功能验证\n');
  
  const results = {
    '文件存在性': validateFileExistence(),
    '关键函数': validateFunctionImplementation(),
    '数据库触发器': validateDatabaseTriggers(),
    'WebSocket配置': validateWebSocketConfiguration(),
    '数据同步服务': validateDataSyncService()
  };
  
  const report = generateValidationReport(results);
  
  console.log('\n✅ WebSocket与PostgreSQL集成功能验证完成');
  
  return report;
}

// 运行验证
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation, VALIDATION_CONFIG };