# Redis服务管理指南

## 概述
本文档提供Redis缓存服务的完整管理指南，确保与PostgreSQL 16.6数据库的兼容性和最佳性能。

## 安装信息
- **Redis版本**: 3.0.504 (Windows兼容版本)
- **安装路径**: `C:\Redis`
- **配置文件**: `C:\Redis\redis-custom.conf`
- **数据目录**: `C:\Redis\data`
- **日志目录**: `C:\Redis\logs`

## 服务管理命令

### 启动Redis服务
```powershell
# 使用默认配置启动
C:\Redis\redis-server.exe

# 使用自定义配置文件启动
C:\Redis\redis-server.exe C:\Redis\redis-custom.conf

# 后台启动（推荐用于生产环境）
Start-Process -FilePath "C:\Redis\redis-server.exe" -ArgumentList "C:\Redis\redis-custom.conf" -WindowStyle Hidden
```

### 连接Redis客户端
```powershell
# 连接到本地Redis服务
C:\Redis\redis-cli.exe

# 连接到指定主机和端口
C:\Redis\redis-cli.exe -h localhost -p 6379

# 使用密码连接（如果配置了密码）
C:\Redis\redis-cli.exe -h localhost -p 6379 -a your_password
```

### 基本Redis命令
```bash
# 测试连接
PING

# 设置键值对
SET key "value"

# 获取值
GET key

# 设置带过期时间的键值对
SETEX key 300 "value"  # 300秒后过期

# 检查键是否存在
EXISTS key

# 删除键
DEL key

# 查看所有键
KEYS *

# 清空当前数据库
FLUSHDB

# 清空所有数据库
FLUSHALL

# 查看Redis信息
INFO

# 查看内存使用情况
INFO memory

# 退出客户端
QUIT
```

## 配置文件说明

### 主要配置参数 (`C:\Redis\redis-custom.conf`)
```ini
# 网络配置
bind 127.0.0.1                    # 绑定IP地址
port 6379                         # 监听端口
timeout 0                         # 客户端空闲超时时间

# 内存配置
maxmemory 256mb                   # 最大内存使用量
maxmemory-policy allkeys-lru      # 内存淘汰策略

# 持久化配置
save 900 1                        # 900秒内至少1个键变化时保存
save 300 10                       # 300秒内至少10个键变化时保存
save 60 10000                     # 60秒内至少10000个键变化时保存

dir C:\Redis\data                 # 数据文件目录
dbfilename dump.rdb               # RDB文件名

# 日志配置
loglevel notice                   # 日志级别
logfile C:\Redis\logs\redis.log   # 日志文件路径

# 安全配置
# requirepass your_password       # 设置密码（可选）

# 性能配置
tcp-keepalive 60                  # TCP保活时间
tcp-backlog 511                   # TCP监听队列长度
```

## 环境变量配置

### .env文件配置
```env
# Redis连接配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
REDIS_DB=0
```

### 应用程序配置
确保应用程序能够正确读取这些环境变量：
- `REDIS_HOST`: Redis服务器地址
- `REDIS_PORT`: Redis服务器端口
- `REDIS_PASSWORD`: Redis密码（如果设置）
- `REDIS_URL`: 完整的Redis连接URL
- `REDIS_DB`: 使用的数据库编号（0-15）

## 性能优化建议

### 1. 内存优化
```bash
# 查看内存使用情况
INFO memory

# 查看键的内存使用
MEMORY USAGE key_name

# 设置合适的内存淘汰策略
CONFIG SET maxmemory-policy allkeys-lru
```

### 2. 持久化优化
```bash
# 手动触发RDB保存
BGSAVE

# 查看最后保存时间
LASTSAVE

# 禁用自动保存（仅内存缓存）
CONFIG SET save ""
```

### 3. 连接优化
```bash
# 查看连接信息
INFO clients

# 设置最大连接数
CONFIG SET maxclients 1000
```

## 监控和维护

### 1. 健康检查
```powershell
# 检查Redis服务状态
C:\Redis\redis-cli.exe ping

# 查看服务器信息
C:\Redis\redis-cli.exe info server

# 查看统计信息
C:\Redis\redis-cli.exe info stats
```

### 2. 性能监控
```bash
# 实时监控Redis命令
MONITOR

# 查看慢查询日志
SLOWLOG GET 10

# 重置统计信息
CONFIG RESETSTAT
```

### 3. 备份和恢复
```powershell
# 创建数据备份
C:\Redis\redis-cli.exe --rdb backup.rdb

# 复制RDB文件进行备份
Copy-Item "C:\Redis\data\dump.rdb" "C:\Backup\redis_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').rdb"
```

## 故障排除

### 常见问题及解决方案

#### 1. 连接被拒绝
```powershell
# 检查Redis服务是否运行
Get-Process redis-server -ErrorAction SilentlyContinue

# 检查端口是否被占用
netstat -an | findstr :6379

# 重启Redis服务
Stop-Process -Name "redis-server" -Force
C:\Redis\redis-server.exe C:\Redis\redis-custom.conf
```

#### 2. 内存不足
```bash
# 查看内存使用情况
INFO memory

# 清理过期键
EXPIRE key_name 1

# 手动垃圾回收
MEMORY PURGE
```

#### 3. 性能问题
```bash
# 查看慢查询
SLOWLOG GET

# 分析键空间
INFO keyspace

# 优化数据结构
MEMORY USAGE key_name
```

## 与PostgreSQL 16.6集成

### 缓存策略
1. **查询结果缓存**: 缓存频繁查询的数据库结果
2. **会话缓存**: 存储用户会话信息
3. **计算结果缓存**: 缓存复杂计算的结果
4. **页面缓存**: 缓存渲染后的页面内容

### 缓存键命名规范
```
# 部门数据
departments:all
departments:floor:{floor_number}
departments:id:{department_id}

# 员工数据
employees:all
employees:department:{department_id}
employees:id:{employee_id}

# 搜索结果
search:employee:{base64_encoded_query}
search:department:{base64_encoded_query}

# 会话数据
session:{session_id}
user:{user_id}:profile
```

### 缓存过期策略
- **静态数据**: 10-30分钟
- **动态数据**: 2-5分钟
- **搜索结果**: 1-2分钟
- **会话数据**: 30分钟-2小时

## 安全建议

### 1. 网络安全
```ini
# 只绑定本地地址
bind 127.0.0.1

# 设置密码保护
requirepass your_strong_password

# 禁用危险命令
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_9a8b7c6d5e4f"
```

### 2. 文件权限
```powershell
# 设置Redis目录权限（仅管理员和当前用户可访问）
icacls "C:\Redis" /grant:r "Administrators:(OI)(CI)F" /grant:r "$env:USERNAME:(OI)(CI)F" /inheritance:r
```

## 日常维护清单

### 每日检查
- [ ] 检查Redis服务状态
- [ ] 查看内存使用情况
- [ ] 检查错误日志
- [ ] 验证连接性能

### 每周维护
- [ ] 备份RDB文件
- [ ] 清理过期日志
- [ ] 分析慢查询日志
- [ ] 检查磁盘空间

### 每月维护
- [ ] 更新配置优化
- [ ] 性能基准测试
- [ ] 安全审计
- [ ] 文档更新

## 联系支持

如遇到问题，请按以下步骤操作：
1. 查看Redis日志文件：`C:\Redis\logs\redis.log`
2. 运行健康检查脚本：`node api/tests/redisTest.js`
3. 收集系统信息：Redis版本、错误信息、配置文件
4. 参考官方文档：https://redis.io/documentation

---

**注意**: 本指南基于Redis 3.0.504版本，与PostgreSQL 16.6完全兼容。在生产环境中使用前，请确保进行充分的测试。