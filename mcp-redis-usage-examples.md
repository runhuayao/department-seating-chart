# MCP Redis 使用示例

## 概述

现在Redis服务器已经正常运行，MCP配置也工作正常。本文档展示如何在模型对话中通过MCP调用Redis功能。

## 当前配置状态

✅ **Redis服务器**: 运行在 localhost:6379  
✅ **MCP连接**: 正常工作  
✅ **版本**: Redis 3.0.504 (Windows)  
✅ **测试状态**: 所有操作测试通过  

## 可用的Redis操作

### 1. 基本键值操作
```
模型可以执行:
- SET key value: 设置键值
- GET key: 获取值
- DEL key: 删除键
- EXISTS key: 检查键是否存在
- EXPIRE key seconds: 设置过期时间
- TTL key: 查看剩余生存时间
```

### 2. 列表操作
```
- LPUSH key value: 从左侧插入
- RPUSH key value: 从右侧插入
- LPOP key: 从左侧弹出
- RPOP key: 从右侧弹出
- LRANGE key start stop: 获取范围内元素
- LLEN key: 获取列表长度
```

### 3. 哈希操作
```
- HSET key field value: 设置哈希字段
- HGET key field: 获取哈希字段值
- HGETALL key: 获取所有字段
- HDEL key field: 删除哈希字段
- HEXISTS key field: 检查字段是否存在
```

### 4. 集合操作
```
- SADD key member: 添加成员
- SMEMBERS key: 获取所有成员
- SREM key member: 删除成员
- SISMEMBER key member: 检查成员是否存在
- SCARD key: 获取集合大小
```

### 5. 有序集合操作
```
- ZADD key score member: 添加带分数的成员
- ZRANGE key start stop: 按分数排序获取
- ZREVRANGE key start stop: 按分数倒序获取
- ZSCORE key member: 获取成员分数
- ZCARD key: 获取有序集合大小
```

## 模型使用示例

### 示例1: 存储用户会话数据
```
用户: "请帮我在Redis中存储用户会话信息"

模型可以执行:
1. HSET user:session:12345 user_id "12345"
2. HSET user:session:12345 login_time "2024-01-17 10:30:00"
3. HSET user:session:12345 ip_address "192.168.1.100"
4. EXPIRE user:session:12345 3600  # 1小时后过期
```

### 示例2: 管理任务队列
```
用户: "创建一个任务队列系统"

模型可以执行:
1. LPUSH task:queue "process_order_001"
2. LPUSH task:queue "send_email_002"
3. RPOP task:queue  # 获取下一个任务
4. LLEN task:queue  # 查看队列长度
```

### 示例3: 缓存计算结果
```
用户: "缓存一些计算结果"

模型可以执行:
1. SET cache:calculation:sum_1_100 "5050"
2. EXPIRE cache:calculation:sum_1_100 300  # 5分钟缓存
3. GET cache:calculation:sum_1_100  # 获取缓存结果
```

### 示例4: 统计和排行榜
```
用户: "创建用户积分排行榜"

模型可以执行:
1. ZADD user:scores 1500 "Alice"
2. ZADD user:scores 1200 "Bob"
3. ZADD user:scores 1800 "Charlie"
4. ZREVRANGE user:scores 0 9  # 获取前10名
```

## 实际对话示例

**用户**: "请帮我在Redis中存储部门信息，包括部门名称、员工数量和负责人"

**模型响应**: "我来帮您在Redis中存储部门信息。我将使用哈希结构来组织这些数据。"

*模型通过MCP执行*:
```
HSET dept:001 name "技术部"
HSET dept:001 employee_count "25"
HSET dept:001 manager "张三"
HSET dept:002 name "市场部"
HSET dept:002 employee_count "15"
HSET dept:002 manager "李四"
```

**模型**: "部门信息已成功存储到Redis中。您可以随时查询或更新这些信息。"

## 配置验证命令

### 检查Redis服务状态
```powershell
# 检查Redis进程
Get-Process -Name "redis-server" -ErrorAction SilentlyContinue

# 测试连接
node test-redis-mcp.js
```

### 手动连接测试
```powershell
# 使用Redis CLI连接
./Redis/redis-cli.exe ping
# 应该返回: PONG
```

## 故障排除

### 如果MCP连接失败
1. **检查Redis服务器**:
   ```powershell
   ./Redis/redis-server.exe ./Redis/redis.windows.conf
   ```

2. **验证端口监听**:
   ```powershell
   netstat -an | findstr :6379
   ```

3. **重启MCP服务**: 在IDE中重新加载MCP配置

### 常见问题
- **连接超时**: 检查防火墙设置
- **权限错误**: 确保Redis配置文件权限正确
- **端口冲突**: 确认6379端口未被其他程序占用

## 安全建议

1. **生产环境配置**:
   - 设置密码认证
   - 绑定特定IP地址
   - 禁用危险命令

2. **数据保护**:
   - 定期备份数据
   - 设置合适的过期时间
   - 监控内存使用

## 下一步操作

1. ✅ Redis服务器已启动并运行
2. ✅ MCP配置已验证正常工作
3. ✅ 所有基本操作测试通过
4. 🎯 **现在可以开始使用**: 在对话中直接请求模型执行Redis操作

---

**状态**: 🟢 Redis MCP配置完成，可以正常使用  
**最后更新**: 2024-01-17  
**Redis版本**: 3.0.504  
**测试状态**: 全部通过 ✅