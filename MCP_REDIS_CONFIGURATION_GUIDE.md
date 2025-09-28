# MCP Redis 配置指导

本文档提供了详细的 MCP (Model Context Protocol) Redis 服务器配置指导，帮助您将 Redis 集成到支持 MCP 的应用程序中。

## 前置要求

### 系统要求
- Windows 10/11 或 Linux/macOS
- Node.js 16+ 和 npm
- Redis 服务器 3.0+

### 依赖安装
```powershell
# 使用 npx（推荐，无需安装）
npx -y @modelcontextprotocol/server-redis redis://localhost:6379

# 或全局安装
npm install -g @modelcontextprotocol/server-redis
```

## 配置方式

### 方式一：NPX + 直接URL（推荐）⭐
```json
{
  "mcpServers": {
    "Redis": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-redis",
        "redis://localhost:6379"
      ],
      "env": {}
    }
  }
}
```

**优势：**
- ✅ 配置极简，一行搞定
- ✅ 标准Redis URL格式
- ✅ 无需环境变量管理
- ✅ 易于调试和维护
- ✅ 支持完整连接参数

**URL格式说明：**
```
redis://[username:password@]host:port[/database]

示例：
- 基本连接：redis://localhost:6379
- 带密码：redis://:password123@localhost:6379
- 指定数据库：redis://localhost:6379/1
- 完整格式：redis://:mypass@localhost:6379/2
```

### 方式二：NPX + 环境变量（传统方式）
```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-redis"
      ],
      "env": {
        "REDIS_URL": "redis://localhost:6379/0"
      }
    }
  }
}
```

## 当前状态分析

### ✅ 问题已解决
- **Redis服务器正常运行**: 成功启动在端口6379
- **MCP连接正常**: 所有Redis操作测试通过
- **版本信息**: Redis 3.0.504 (Windows版本)

### ✅ 连接状态
```
✅ Redis连接成功
📝 测试基本操作: SET/GET正常
🗂️ 测试哈希操作: 正常
🎯 测试集合操作: 正常
📊 测试有序集合: 正常
🔍 键模式匹配: 正常
📈 服务器信息: redis_version:3.0.504
```

**当前状态**:
- Redis服务器运行正常
- 所有基本操作测试通过
- MCP配置工作正常

## 解决方案步骤

### 步骤1：安装Redis服务器

#### 方法A：使用官方Windows版本（推荐）
1. 访问 [Redis官方下载页面](https://redis.io/download)
2. 下载Windows版本或使用以下命令：
```powershell
# 使用winget安装
winget install Redis.Redis

# 或者下载预编译版本
Invoke-WebRequest -Uri "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.msi" -OutFile "Redis-x64-3.0.504.msi"
Start-Process msiexec.exe -Wait -ArgumentList '/I Redis-x64-3.0.504.msi /quiet'
```

#### 方法B：使用Docker（替代方案）
```powershell
# 拉取Redis镜像
docker pull redis:latest

# 运行Redis容器
docker run -d --name redis-server -p 6379:6379 redis:latest redis-server --appendonly yes
```

### 步骤2：启动Redis服务

#### Windows服务方式
```powershell
# 启动Redis服务
net start Redis

# 检查服务状态
Get-Service Redis
```

#### 手动启动方式
```powershell
# 使用项目配置文件启动
redis-server.exe redis.conf

# 或使用默认配置启动
redis-server.exe
```

### 步骤3：验证Redis连接

#### 使用Redis CLI测试
```powershell
# 连接Redis
redis-cli.exe

# 测试基本命令
ping
set test "Hello Redis"
get test
exit
```

#### 使用项目测试脚本
```powershell
# 运行测试脚本
node test-redis-mcp.js
```

## MCP配置详解

### 当前MCP配置
根据错误日志，当前MCP配置为：
```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-redis"
      ],
      "env": {
        "REDIS_URL": "redis://localhost:6379/0"
      }
    }
  }
}
```

### 配置文件位置
MCP配置文件通常位于：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- 或项目根目录的 `.mcp-config.json`

### 完整MCP配置示例
```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-redis"
      ],
      "env": {
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "REDIS_DB": "0",
        "REDIS_PASSWORD": ""
      }
    }
  }
}
```

### 带密码的配置
如果Redis设置了密码：
```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-redis"
      ],
      "env": {
        "REDIS_URL": "redis://:your_password@localhost:6379/0"
      }
    }
  }
}
```

## 模型通过MCP使用Redis

### 可用的Redis操作
通过MCP，模型可以执行以下Redis操作：

1. **基本键值操作**
   - `SET key value` - 设置键值
   - `GET key` - 获取值
   - `DEL key` - 删除键
   - `EXISTS key` - 检查键是否存在

2. **列表操作**
   - `LPUSH key value` - 左侧插入
   - `RPUSH key value` - 右侧插入
   - `LRANGE key start stop` - 获取范围

3. **哈希操作**
   - `HSET key field value` - 设置哈希字段
   - `HGET key field` - 获取哈希字段
   - `HGETALL key` - 获取所有字段

4. **集合操作**
   - `SADD key member` - 添加成员
   - `SMEMBERS key` - 获取所有成员
   - `SISMEMBER key member` - 检查成员

5. **有序集合操作**
   - `ZADD key score member` - 添加成员
   - `ZRANGE key start stop` - 获取范围
   - `ZRANK key member` - 获取排名

### 使用示例
```javascript
// 模型可以通过MCP执行这些操作
// 存储用户会话
SET user:1001:session "active"

// 存储用户信息
HSET user:1001:profile name "张三" department "技术部" role "工程师"

// 添加到在线用户列表
SADD online_users "user:1001"

// 记录用户活动
ZADD user_activity 1640995200 "user:1001:login"
```

## 配置验证和测试

### 1. 检查Redis服务状态
```powershell
# 检查Redis进程
Get-Process -Name redis-server -ErrorAction SilentlyContinue

# 检查端口占用
netstat -an | findstr :6379

# 测试连接
Test-NetConnection -ComputerName localhost -Port 6379
```

### 2. 验证MCP配置
```powershell
# 检查MCP服务器是否可用
npx @modelcontextprotocol/server-redis --help

# 测试MCP连接
node -e "console.log('Testing MCP Redis connection...')"
```

### 3. 运行完整测试
```powershell
# 运行项目测试脚本
node test-redis-mcp.js
```

## 故障排除

### 常见问题及解决方案

1. **连接被拒绝 (ECONNREFUSED)**
   - 确认Redis服务正在运行
   - 检查端口6379是否被占用
   - 验证防火墙设置

2. **认证失败**
   - 检查Redis密码配置
   - 确认MCP配置中的密码正确

3. **MCP服务器启动失败**
   - 确认已安装 `@modelcontextprotocol/server-redis`
   - 检查Node.js版本兼容性
   - 验证环境变量设置

4. **权限问题**
   - 以管理员身份运行命令
   - 检查Redis数据目录权限

### 调试命令
```powershell
# 查看Redis日志
Get-Content "C:\Program Files\Redis\Logs\redis.log" -Tail 50

# 检查Redis配置
redis-cli.exe CONFIG GET "*"

# 监控Redis命令
redis-cli.exe MONITOR
```

## 安全建议

### 生产环境配置
1. **设置密码**
   ```
   requirepass your_strong_password
   ```

2. **绑定特定IP**
   ```
   bind 127.0.0.1
   ```

3. **禁用危险命令**
   ```
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG "CONFIG_9f2ka83jd"
   ```

4. **启用TLS**
   ```
   tls-port 6380
   tls-cert-file redis.crt
   tls-key-file redis.key
   ```

## 下一步操作

1. **立即执行**：安装Redis服务器
2. **配置启动**：使用项目redis.conf启动服务
3. **验证连接**：运行测试脚本确认工作正常
4. **更新MCP**：确保MCP配置与Redis设置匹配
5. **测试功能**：验证模型可以通过MCP操作Redis

---

**注意**：完成Redis安装和启动后，MCP将能够正常连接并提供Redis功能给模型使用。