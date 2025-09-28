import { createClient } from 'redis';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379/0'
});

client.on('error', (err) => console.log('Redis Client Error', err));

async function testRedisMCP() {
  console.log('🔍 开始测试Redis MCP配置...');
  
  try {
    // 连接Redis
    await client.connect();
    console.log('✅ Redis连接成功');
    
    // 测试基本操作
    console.log('\n📝 测试基本操作:');
    await client.set('test:mcp:basic', 'Hello MCP Redis!');
    const basicValue = await client.get('test:mcp:basic');
    console.log(`   SET/GET: ${basicValue}`);
    
    // 测试过期时间
    console.log('\n⏰ 测试过期时间:');
    await client.setEx('test:mcp:expire', 5, 'This will expire in 5 seconds');
    const ttl = await client.ttl('test:mcp:expire');
    console.log(`   TTL: ${ttl} seconds`);
    
    // 测试列表操作
    console.log('\n📋 测试列表操作:');
    await client.lPush('test:mcp:list', 'item1', 'item2', 'item3');
    const listItems = await client.lRange('test:mcp:list', 0, -1);
    console.log(`   List items: ${listItems.join(', ')}`);
    
    // 测试哈希操作 (兼容Redis 3.0)
    console.log('\n🗂️ 测试哈希操作:');
    await client.hSet('test:mcp:hash', 'name', '部门地图系统');
    await client.hSet('test:mcp:hash', 'version', '1.0.0');
    await client.hSet('test:mcp:hash', 'status', 'active');
    const hashData = await client.hGetAll('test:mcp:hash');
    console.log('   Hash data:', hashData);
    
    // 测试集合操作
    console.log('\n🎯 测试集合操作:');
    await client.sAdd('test:mcp:set', 'user1', 'user2', 'user3', 'user1'); // user1重复
    const setMembers = await client.sMembers('test:mcp:set');
    console.log(`   Set members: ${setMembers.join(', ')}`);
    
    // 测试有序集合
    console.log('\n📊 测试有序集合:');
    await client.zAdd('test:mcp:zset', [
      { score: 100, value: 'Alice' },
      { score: 85, value: 'Bob' },
      { score: 92, value: 'Charlie' }
    ]);
    const zsetMembers = await client.zRangeWithScores('test:mcp:zset', 0, -1);
    console.log('   Sorted set (by score):');
    zsetMembers.forEach(member => {
      console.log(`     ${member.value}: ${member.score}`);
    });
    
    // 测试键模式匹配
    console.log('\n🔍 测试键模式匹配:');
    const testKeys = await client.keys('test:mcp:*');
    console.log(`   Found ${testKeys.length} test keys:`);
    testKeys.forEach(key => console.log(`     - ${key}`));
    
    // 测试数据库信息
    console.log('\n📈 Redis服务器信息:');
    const info = await client.info('server');
    const lines = info.split('\r\n').filter(line => 
      line.includes('redis_version') || 
      line.includes('uptime_in_seconds') ||
      line.includes('connected_clients')
    );
    lines.forEach(line => {
      if (line.trim()) console.log(`   ${line}`);
    });
    
    console.log('\n🧹 清理测试数据...');
    // 清理测试数据
    const keysToDelete = await client.keys('test:mcp:*');
    if (keysToDelete.length > 0) {
      await client.del(keysToDelete);
      console.log(`   已删除 ${keysToDelete.length} 个测试键`);
    }
    
    console.log('\n✅ 所有测试通过！MCP Redis配置正常工作。');
    
  } catch (error) {
    console.error('❌ Redis MCP测试失败:', error.message);
    console.error('   请检查:');
    console.error('   1. Redis服务器是否正在运行');
    console.error('   2. 连接配置是否正确');
    console.error('   3. 网络连接是否正常');
  } finally {
    await client.disconnect();
    console.log('\n🔌 Redis连接已断开');
  }
}

// 运行测试
testRedisMCP().catch(console.error);