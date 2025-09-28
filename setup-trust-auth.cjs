#!/usr/bin/env node

/**
 * PostgreSQL Trust认证设置脚本
 * 临时设置trust认证以解决MCP连接问题
 */

const fs = require('fs');
const path = require('path');

// PostgreSQL数据目录路径
const PG_HBA_PATH = 'D:\\PostgreSQL\\data\\data\\pg_hba.conf';

function setupTrustAuth() {
  console.log('🔧 设置PostgreSQL Trust认证...');
  
  if (!fs.existsSync(PG_HBA_PATH)) {
    console.error('❌ 未找到 pg_hba.conf 文件:', PG_HBA_PATH);
    return false;
  }
  
  // 备份原文件
  const backupPath = `${PG_HBA_PATH}.trust.backup.${Date.now()}`;
  fs.copyFileSync(PG_HBA_PATH, backupPath);
  console.log(`📋 备份文件: ${backupPath}`);
  
  // 读取原文件
  let content = fs.readFileSync(PG_HBA_PATH, 'utf8');
  
  // 创建新的配置内容
  const lines = content.split('\n');
  const newLines = [];
  
  for (let line of lines) {
    // 跳过注释和空行
    if (line.trim().startsWith('#') || !line.trim()) {
      newLines.push(line);
      continue;
    }
    
    // 替换本地连接为trust认证
    if (line.match(/^\s*local\s+all\s+all\s+/)) {
      newLines.push('local   all             all                                     trust');
      continue;
    }
    
    // 替换IPv4本地连接为trust认证
    if (line.match(/^\s*host\s+all\s+all\s+127\.0\.0\.1\/32\s+/)) {
      newLines.push('host    all             all             127.0.0.1/32            trust');
      continue;
    }
    
    // 替换IPv6本地连接为trust认证
    if (line.match(/^\s*host\s+all\s+all\s+::1\/128\s+/)) {
      newLines.push('host    all             all             ::1/128                 trust');
      continue;
    }
    
    // 保持其他行不变
    newLines.push(line);
  }
  
  // 写入新配置
  const newContent = newLines.join('\n');
  fs.writeFileSync(PG_HBA_PATH, newContent, 'utf8');
  
  console.log('✅ Trust认证配置完成!');
  console.log('\n📖 新的认证配置:');
  
  // 显示相关配置行
  const updatedLines = newContent.split('\n');
  updatedLines.forEach((line, index) => {
    if (line.trim() && !line.trim().startsWith('#') && 
        (line.includes('local') || line.includes('127.0.0.1') || line.includes('::1'))) {
      console.log(`${index + 1}: ${line}`);
    }
  });
  
  return true;
}

function restoreMd5Auth() {
  console.log('\n🔄 恢复MD5认证配置...');
  
  // 读取当前文件
  let content = fs.readFileSync(PG_HBA_PATH, 'utf8');
  
  // 替换trust为md5
  content = content.replace(/trust/g, 'md5');
  
  // 写入文件
  fs.writeFileSync(PG_HBA_PATH, content, 'utf8');
  
  console.log('✅ MD5认证配置恢复完成!');
}

function main() {
  console.log('🚀 PostgreSQL认证配置管理');
  console.log('\n选择操作:');
  console.log('1. 设置Trust认证（临时解决方案）');
  console.log('2. 恢复MD5认证');
  
  // 默认设置trust认证
  const success = setupTrustAuth();
  
  if (success) {
    console.log('\n⚠️  重要提示:');
    console.log('1. Trust认证允许无密码连接，仅用于测试');
    console.log('2. 生产环境请使用MD5或SCRAM认证');
    console.log('3. 需要重启PostgreSQL服务以使配置生效');
    console.log('4. 可以运行 restart-postgresql.ps1 脚本重启服务');
    
    console.log('\n🔗 MCP连接配置:');
    console.log('DATABASE_URL: postgresql://postgres@localhost:5432/department_map');
    console.log('PGUSER: postgres');
    console.log('PGPASSWORD: (可以为空)');
  }
}

// 运行脚本
main();