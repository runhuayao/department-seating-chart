#!/usr/bin/env node

/**
 * PostgreSQL pg_hba.conf 修复脚本
 * 修改认证方法从scram-sha-256到md5以解决MCP连接问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// PostgreSQL数据目录路径
const PG_DATA_PATHS = [
  'D:\\PostgreSQL\\data\\data',
  'D:\\PostgreSQL\\data',
  'C:\\Program Files\\PostgreSQL\\15\\data',
  'C:\\Program Files\\PostgreSQL\\14\\data',
  'C:\\Program Files\\PostgreSQL\\13\\data'
];

function findPgHbaConf() {
  for (const dataPath of PG_DATA_PATHS) {
    const pgHbaPath = path.join(dataPath, 'pg_hba.conf');
    if (fs.existsSync(pgHbaPath)) {
      console.log(`✅ 找到 pg_hba.conf: ${pgHbaPath}`);
      return pgHbaPath;
    }
  }
  return null;
}

function backupFile(filePath) {
  const backupPath = `${filePath}.backup.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`📋 备份文件: ${backupPath}`);
  return backupPath;
}

function modifyPgHba(pgHbaPath) {
  console.log('🔧 修改 pg_hba.conf...');
  
  // 读取原文件
  let content = fs.readFileSync(pgHbaPath, 'utf8');
  
  console.log('\n📖 当前配置:');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.trim() && !line.trim().startsWith('#')) {
      console.log(`${index + 1}: ${line}`);
    }
  });
  
  // 修改认证方法
  const originalContent = content;
  
  // 替换 scram-sha-256 为 md5
  content = content.replace(/scram-sha-256/g, 'md5');
  
  // 确保本地连接使用md5
  const newLines = [];
  const processedLines = content.split('\n');
  
  let foundLocalConnections = false;
  
  for (let line of processedLines) {
    if (line.trim().startsWith('# TYPE') || line.trim().startsWith('# "local"')) {
      newLines.push(line);
      continue;
    }
    
    // 处理本地连接配置
    if (line.match(/^\s*local\s+all\s+all\s+/)) {
      newLines.push('local   all             all                                     md5');
      foundLocalConnections = true;
      continue;
    }
    
    // 处理IPv4本地连接
    if (line.match(/^\s*host\s+all\s+all\s+127\.0\.0\.1\/32\s+/)) {
      newLines.push('host    all             all             127.0.0.1/32            md5');
      continue;
    }
    
    // 处理IPv6本地连接
    if (line.match(/^\s*host\s+all\s+all\s+::1\/128\s+/)) {
      newLines.push('host    all             all             ::1/128                 md5');
      continue;
    }
    
    newLines.push(line);
  }
  
  // 如果没有找到本地连接配置，添加它们
  if (!foundLocalConnections) {
    newLines.push('');
    newLines.push('# Local connections for MCP');
    newLines.push('local   all             all                                     md5');
    newLines.push('host    all             all             127.0.0.1/32            md5');
    newLines.push('host    all             all             ::1/128                 md5');
  }
  
  const newContent = newLines.join('\n');
  
  if (newContent !== originalContent) {
    // 写入修改后的文件
    fs.writeFileSync(pgHbaPath, newContent, 'utf8');
    console.log('\n✅ pg_hba.conf 修改完成!');
    
    console.log('\n📖 新配置:');
    const updatedLines = newContent.split('\n');
    updatedLines.forEach((line, index) => {
      if (line.trim() && !line.trim().startsWith('#')) {
        console.log(`${index + 1}: ${line}`);
      }
    });
    
    return true;
  } else {
    console.log('\n⚠️  配置文件无需修改');
    return false;
  }
}

function reloadPostgreSQL() {
  console.log('\n🔄 重新加载PostgreSQL配置...');
  
  try {
    // 尝试使用pg_ctl reload
    execSync('pg_ctl reload', { stdio: 'inherit' });
    console.log('✅ PostgreSQL配置重新加载成功!');
  } catch (error) {
    console.log('⚠️  无法使用pg_ctl reload，尝试其他方法...');
    
    try {
      // 尝试使用SQL命令重新加载
      execSync('psql -U postgres -c "SELECT pg_reload_conf();"', { stdio: 'inherit' });
      console.log('✅ PostgreSQL配置重新加载成功!');
    } catch (sqlError) {
      console.log('❌ 无法重新加载配置，请手动重启PostgreSQL服务');
      console.log('可以使用以下命令:');
      console.log('net stop postgresql-x64-15');
      console.log('net start postgresql-x64-15');
    }
  }
}

async function main() {
  console.log('🔧 PostgreSQL pg_hba.conf 修复开始...');
  
  // 查找pg_hba.conf文件
  const pgHbaPath = findPgHbaConf();
  
  if (!pgHbaPath) {
    console.error('❌ 未找到 pg_hba.conf 文件');
    console.error('请检查PostgreSQL安装路径');
    process.exit(1);
  }
  
  try {
    // 备份原文件
    backupFile(pgHbaPath);
    
    // 修改配置
    const modified = modifyPgHba(pgHbaPath);
    
    if (modified) {
      // 重新加载配置
      reloadPostgreSQL();
      
      console.log('\n🎉 修复完成!');
      console.log('\n📝 建议:');
      console.log('1. 现在可以尝试重新连接PostgreSQL');
      console.log('2. 如果仍有问题，请重启PostgreSQL服务');
      console.log('3. MCP配置应该使用: postgresql://postgres:113464@localhost:5432/department_map');
    }
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
  }
}

// 运行修复
main().catch(console.error);