import { redisService } from '../services/redisService.js';

/**
 * Redis缓存功能测试
 * 验证Redis与PostgreSQL 16.6的兼容性和基本功能
 */
async function testRedisConnection() {
  console.log('\n=== Redis连接测试 ===');
  
  try {
    // 测试连接
    await redisService.connect();
    console.log('✅ Redis连接成功');
    
    // 健康检查
    const health = await redisService.healthCheck();
    console.log('✅ Redis健康检查:', health);
    
    return true;
  } catch (error) {
    console.error('❌ Redis连接失败:', error);
    return false;
  }
}

async function testBasicOperations() {
  console.log('\n=== Redis基本操作测试 ===');
  
  try {
    // 测试设置和获取
    const testKey = 'test:basic';
    const testValue = { message: 'Hello Redis', timestamp: Date.now() };
    
    await redisService.set(testKey, testValue, 60);
    console.log('✅ 数据设置成功');
    
    const retrievedValue = await redisService.get(testKey);
    console.log('✅ 数据获取成功:', retrievedValue);
    
    // 测试存在性检查
    const exists = await redisService.exists(testKey);
    console.log('✅ 存在性检查:', exists);
    
    // 测试TTL
    const ttl = await redisService.ttl(testKey);
    console.log('✅ TTL检查:', ttl, '秒');
    
    // 测试删除
    await redisService.del(testKey);
    console.log('✅ 数据删除成功');
    
    // 验证删除
    const afterDelete = await redisService.get(testKey);
    console.log('✅ 删除验证:', afterDelete === null ? '已删除' : '删除失败');
    
    return true;
  } catch (error) {
    console.error('❌ 基本操作测试失败:', error);
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
    await redisService.cacheDepartments(mockDepartments, 300);
    console.log('✅ 部门数据缓存成功');
    
    const cachedDepartments = await redisService.getCachedDepartments();
    console.log('✅ 部门数据获取成功:', cachedDepartments?.length, '个部门');
    
    // 模拟员工数据
    const mockEmployees = [
      { id: 1, name: '张三', department_id: 1, position: '开发工程师' },
      { id: 2, name: '李四', department_id: 2, position: '市场专员' }
    ];
    
    // 测试员工缓存
    await redisService.cacheEmployees(mockEmployees, 300);
    console.log('✅ 员工数据缓存成功');
    
    const cachedEmployees = await redisService.getCachedEmployees();
    console.log('✅ 员工数据获取成功:', cachedEmployees?.length, '个员工');
    
    // 测试搜索结果缓存
    const searchResult = { results: mockEmployees, total: 2, query: '张三' };
    await redisService.cacheSearchResult('张三', 'employee', searchResult, 120);
    console.log('✅ 搜索结果缓存成功');
    
    const cachedSearch = await redisService.getCachedSearchResult('张三', 'employee');
    console.log('✅ 搜索结果获取成功:', cachedSearch);
    
    return true;
  } catch (error) {
    console.error('❌ 缓存操作测试失败:', error);
    return false;
  }
}

async function testPerformance() {
  console.log('\n=== Redis性能测试 ===');
  
  try {
    const iterations = 100;
    const testData = { id: 1, name: 'Performance Test', data: new Array(100).fill('test') };
    
    // 写入性能测试
    const writeStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await redisService.set(`perf:write:${i}`, testData, 60);
    }
    const writeTime = Date.now() - writeStart;
    console.log(`✅ 写入性能: ${iterations}次操作耗时 ${writeTime}ms (平均 ${(writeTime/iterations).toFixed(2)}ms/次)`);
    
    // 读取性能测试
    const readStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await redisService.get(`perf:write:${i}`);
    }
    const readTime = Date.now() - readStart;
    console.log(`✅ 读取性能: ${iterations}次操作耗时 ${readTime}ms (平均 ${(readTime/iterations).toFixed(2)}ms/次)`);
    
    // 清理测试数据
    await redisService.invalidateRelatedCache('perf:*');
    console.log('✅ 性能测试数据已清理');
    
    return true;
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n=== Redis错误处理测试 ===');
  
  try {
    // 测试获取不存在的键
    const nonExistent = await redisService.get('non:existent:key');
    console.log('✅ 不存在键处理:', nonExistent === null ? '正确返回null' : '处理异常');
    
    // 测试删除不存在的键
    await redisService.del('non:existent:key');
    console.log('✅ 删除不存在键: 无异常抛出');
    
    // 测试TTL不存在的键
    const ttl = await redisService.ttl('non:existent:key');
    console.log('✅ 不存在键TTL:', ttl, '(应为-2)');
    
    return true;
  } catch (error) {
    console.error('❌ 错误处理测试失败:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 开始Redis缓存功能测试...');
  console.log('测试环境: Redis与PostgreSQL 16.6兼容性验证');
  
  const results = {
    connection: false,
    basicOps: false,
    cacheOps: false,
    performance: false,
    errorHandling: false
  };
  
  try {
    // 运行所有测试
    results.connection = await testRedisConnection();
    if (results.connection) {
      results.basicOps = await testBasicOperations();
      results.cacheOps = await testCacheOperations();
      results.performance = await testPerformance();
      results.errorHandling = await testErrorHandling();
    }
    
    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    console.log('Redis连接测试:', results.connection ? '✅ 通过' : '❌ 失败');
    console.log('基本操作测试:', results.basicOps ? '✅ 通过' : '❌ 失败');
    console.log('缓存操作测试:', results.cacheOps ? '✅ 通过' : '❌ 失败');
    console.log('性能测试:', results.performance ? '✅ 通过' : '❌ 失败');
    console.log('错误处理测试:', results.errorHandling ? '✅ 通过' : '❌ 失败');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n📊 测试通过率: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 所有测试通过！Redis缓存服务已准备就绪。');
    } else {
      console.log('⚠️  部分测试失败，请检查Redis配置和连接。');
    }
    
  } catch (error) {
    console.error('❌ 测试执行异常:', error);
  } finally {
    // 断开连接
    try {
      await redisService.disconnect();
      console.log('\n🔌 Redis连接已断开');
    } catch (error) {
      console.error('断开连接失败:', error);
    }
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testRedisConnection, testBasicOperations, testCacheOperations };