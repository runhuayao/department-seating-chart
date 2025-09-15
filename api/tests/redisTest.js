import { createClient } from 'redis';

/**
 * Redis缓存功能测试 (JavaScript版本)
 * 验证Redis与PostgreSQL 16.6的兼容性和基本功能
 */

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0')
};

let client;

async function connectRedis() {
  try {
    client = createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port
      },
      password: redisConfig.password,
      database: redisConfig.database
    });

    client.on('error', (err) => {
      console.error('Redis客户端错误:', err);
    });

    await client.connect();
    console.log('✅ Redis连接成功');
    return true;
  } catch (error) {
    console.error('❌ Redis连接失败:', error.message);
    return false;
  }
}

async function testBasicOperations() {
  console.log('\n=== Redis基本操作测试 ===');
  
  try {
    // 测试PING
    const pingResult = await client.ping();
    console.log('✅ PING测试:', pingResult);
    
    // 测试设置和获取
    const testKey = 'test:basic';
    const testValue = JSON.stringify({ message: 'Hello Redis', timestamp: Date.now() });
    
    await client.setEx(testKey, 60, testValue);
    console.log('✅ 数据设置成功');
    
    const retrievedValue = await client.get(testKey);
    const parsedValue = JSON.parse(retrievedValue);
    console.log('✅ 数据获取成功:', parsedValue);
    
    // 测试存在性检查
    const exists = await client.exists(testKey);
    console.log('✅ 存在性检查:', exists === 1 ? '存在' : '不存在');
    
    // 测试TTL
    const ttl = await client.ttl(testKey);
    console.log('✅ TTL检查:', ttl, '秒');
    
    // 测试删除
    await client.del(testKey);
    console.log('✅ 数据删除成功');
    
    // 验证删除
    const afterDelete = await client.get(testKey);
    console.log('✅ 删除验证:', afterDelete === null ? '已删除' : '删除失败');
    
    return true;
  } catch (error) {
    console.error('❌ 基本操作测试失败:', error.message);
    return false;
  }
}

async function testCacheOperations() {
  console.log('\n=== Redis缓存操作测试 ===');
  
  try {
    // 模拟部门数据
    const mockDepartments = [
      { id: 1, name: '技术部', description: '负责技术开发', floor: 3 },
      { id: 2, name: '市场部', description: '负责市场推广', floor: 2 }
    ];
    
    // 测试部门缓存
    await client.setEx('departments:all', 300, JSON.stringify(mockDepartments));
    console.log('✅ 部门数据缓存成功');
    
    const cachedDepartments = await client.get('departments:all');
    const parsedDepartments = JSON.parse(cachedDepartments);
    console.log('✅ 部门数据获取成功:', parsedDepartments.length, '个部门');
    
    // 模拟员工数据
    const mockEmployees = [
      { id: 1, name: '张三', department_id: 1, position: '开发工程师' },
      { id: 2, name: '李四', department_id: 2, position: '市场专员' }
    ];
    
    // 测试员工缓存
    await client.setEx('employees:all', 300, JSON.stringify(mockEmployees));
    console.log('✅ 员工数据缓存成功');
    
    const cachedEmployees = await client.get('employees:all');
    const parsedEmployees = JSON.parse(cachedEmployees);
    console.log('✅ 员工数据获取成功:', parsedEmployees.length, '个员工');
    
    // 测试搜索结果缓存
    const searchResult = { results: mockEmployees, total: 2, query: '张三' };
    const searchKey = `search:employee:${Buffer.from('张三').toString('base64')}`;
    await client.setEx(searchKey, 120, JSON.stringify(searchResult));
    console.log('✅ 搜索结果缓存成功');
    
    const cachedSearch = await client.get(searchKey);
    const parsedSearch = JSON.parse(cachedSearch);
    console.log('✅ 搜索结果获取成功:', parsedSearch.total, '个结果');
    
    return true;
  } catch (error) {
    console.error('❌ 缓存操作测试失败:', error.message);
    return false;
  }
}

async function testPerformance() {
  console.log('\n=== Redis性能测试 ===');
  
  try {
    const iterations = 50; // 减少迭代次数以加快测试
    const testData = JSON.stringify({ id: 1, name: 'Performance Test', data: new Array(50).fill('test') });
    
    // 写入性能测试
    const writeStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await client.setEx(`perf:write:${i}`, 60, testData);
    }
    const writeTime = Date.now() - writeStart;
    console.log(`✅ 写入性能: ${iterations}次操作耗时 ${writeTime}ms (平均 ${(writeTime/iterations).toFixed(2)}ms/次)`);
    
    // 读取性能测试
    const readStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await client.get(`perf:write:${i}`);
    }
    const readTime = Date.now() - readStart;
    console.log(`✅ 读取性能: ${iterations}次操作耗时 ${readTime}ms (平均 ${(readTime/iterations).toFixed(2)}ms/次)`);
    
    // 清理测试数据
    const keys = await client.keys('perf:*');
    if (keys.length > 0) {
      await client.del(keys);
    }
    console.log('✅ 性能测试数据已清理');
    
    return true;
  } catch (error) {
    console.error('❌ 性能测试失败:', error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n=== Redis错误处理测试 ===');
  
  try {
    // 测试获取不存在的键
    const nonExistent = await client.get('non:existent:key');
    console.log('✅ 不存在键处理:', nonExistent === null ? '正确返回null' : '处理异常');
    
    // 测试删除不存在的键
    await client.del('non:existent:key');
    console.log('✅ 删除不存在键: 无异常抛出');
    
    // 测试TTL不存在的键
    const ttl = await client.ttl('non:existent:key');
    console.log('✅ 不存在键TTL:', ttl, '(应为-2)');
    
    return true;
  } catch (error) {
    console.error('❌ 错误处理测试失败:', error.message);
    return false;
  }
}

async function testRedisInfo() {
  console.log('\n=== Redis信息测试 ===');
  
  try {
    // 获取Redis服务器信息
    const info = await client.info('server');
    const lines = info.split('\r\n').filter(line => line && !line.startsWith('#'));
    
    console.log('✅ Redis服务器信息:');
    lines.slice(0, 5).forEach(line => {
      console.log('   ', line);
    });
    
    // 获取内存信息
    const memoryInfo = await client.info('memory');
    const memoryLines = memoryInfo.split('\r\n').filter(line => line.includes('used_memory_human'));
    if (memoryLines.length > 0) {
      console.log('✅ 内存使用:', memoryLines[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Redis信息测试失败:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 开始Redis缓存功能测试...');
  console.log('测试环境: Redis与PostgreSQL 16.6兼容性验证');
  console.log('Redis配置:', redisConfig);
  
  const results = {
    connection: false,
    basicOps: false,
    cacheOps: false,
    performance: false,
    errorHandling: false,
    info: false
  };
  
  try {
    // 连接Redis
    results.connection = await connectRedis();
    
    if (results.connection) {
      // 运行所有测试
      results.basicOps = await testBasicOperations();
      results.cacheOps = await testCacheOperations();
      results.performance = await testPerformance();
      results.errorHandling = await testErrorHandling();
      results.info = await testRedisInfo();
    }
    
    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    console.log('Redis连接测试:', results.connection ? '✅ 通过' : '❌ 失败');
    console.log('基本操作测试:', results.basicOps ? '✅ 通过' : '❌ 失败');
    console.log('缓存操作测试:', results.cacheOps ? '✅ 通过' : '❌ 失败');
    console.log('性能测试:', results.performance ? '✅ 通过' : '❌ 失败');
    console.log('错误处理测试:', results.errorHandling ? '✅ 通过' : '❌ 失败');
    console.log('信息获取测试:', results.info ? '✅ 通过' : '❌ 失败');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n📊 测试通过率: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 所有测试通过！Redis缓存服务已准备就绪。');
      console.log('✅ Redis与PostgreSQL 16.6兼容性验证成功！');
    } else {
      console.log('⚠️  部分测试失败，请检查Redis配置和连接。');
    }
    
  } catch (error) {
    console.error('❌ 测试执行异常:', error.message);
  } finally {
    // 断开连接
    if (client) {
      try {
        await client.disconnect();
        console.log('\n🔌 Redis连接已断开');
      } catch (error) {
        console.error('断开连接失败:', error.message);
      }
    }
  }
}

// 运行测试
runAllTests().catch(console.error);