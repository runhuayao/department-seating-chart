# Redis和PostgreSQL服务启动指南

## 服务状态检查结果

### ✅ PostgreSQL服务状态
- **状态**: 正在运行
- **端口**: 5432 (正常监听)
- **连接**: 有活跃连接
- **MCP状态**: ❌ 配置问题 (用户认证错误)

### ✅ Redis服务状态  
- **状态**: 已启动并运行
- **端口**: 6379 (正常监听)
- **版本**: Redis 3.0.504
- **连接测试**: PONG (正常响应)

## MCP服务器依赖关系

根据项目配置文件分析，**MCP调用确实需要这两个服务在本地运行**：

### Redis MCP服务器
```json
{
  "Redis": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-redis",
      "redis://localhost:6379"
    ]
  }
}
```
**要求**: Redis服务器必须运行在 `localhost:6379`

### PostgreSQL MCP服务器
```json
{
  "PostgreSQL": {
    "command": "npx",
    "args": [
      "-y", 
      "@modelcontextprotocol/server-postgres"
    ],
    "env": {
      "DATABASE_URL": "postgresql://postgres@localhost:5432/department_map"
    }
  }
}
```
**要求**: PostgreSQL服务器必须运行在 `localhost:5432`

## 启动服务的具体步骤

### 1. 启动Redis服务器

#### 方法一：使用项目配置文件（推荐）
```powershell
# 在项目根目录执行
.\Redis\redis-server.exe .\Redis\redis.windows.conf
```

#### 方法二：使用默认配置
```powershell
# 在项目根目录执行
.\Redis\redis-server.exe
```

#### 验证Redis启动
```powershell
# 检查端口监听
netstat -an | findstr :6379

# 测试连接
.\Redis\redis-cli.exe ping
# 应该返回: PONG
```

### 2. PostgreSQL服务管理

PostgreSQL已经在运行，但MCP连接有认证问题。

#### 检查PostgreSQL服务状态
```powershell
# 检查端口监听
netstat -an | findstr :5432

# 检查服务状态
Get-Service -Name "*postgresql*"
```

#### 修复PostgreSQL MCP认证问题

**选项1：使用现有修复脚本**
```powershell
# 运行认证修复脚本
node fix-postgresql-auth.cjs
```

**选项2：手动创建MCP用户**
```sql
-- 连接到PostgreSQL
psql -U postgres -d department_map

-- 创建MCP用户
CREATE USER mcp_user WITH PASSWORD '113464';
GRANT ALL PRIVILEGES ON DATABASE department_map TO mcp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
```

**选项3：使用Trust认证（仅测试环境）**
```powershell
# 运行trust认证设置脚本
node setup-trust-auth.cjs

# 重启PostgreSQL服务
.\restart-postgresql.ps1
```

### 3. 验证MCP连接

#### 测试Redis MCP
```powershell
# 运行Redis MCP测试
node test-redis-mcp.js
```

#### 测试PostgreSQL MCP
```powershell
# 运行PostgreSQL连接测试
node test-postgresql-connection.cjs
```

## 服务启动顺序建议

1. **启动PostgreSQL** (通常作为系统服务自动启动)
2. **启动Redis** (需要手动启动)
3. **验证两个服务都在运行**
4. **重启Trae AI** (重新加载MCP配置)

## 常见问题解决

### Redis相关问题

**问题**: Redis启动失败
```powershell
# 检查端口是否被占用
netstat -an | findstr :6379

# 如果端口被占用，找到并终止进程
Get-Process -Name "*redis*" | Stop-Process -Force
```

**问题**: Redis连接超时
```powershell
# 检查防火墙设置
# 确保6379端口允许本地连接
```

### PostgreSQL相关问题

**问题**: MCP认证失败
- 运行 `fix-postgresql-auth.cjs` 脚本
- 或使用 `setup-trust-auth.cjs` 设置临时trust认证

**问题**: 数据库连接被拒绝
```powershell
# 检查PostgreSQL服务状态
Get-Service -Name "*postgresql*"

# 重启PostgreSQL服务
Restart-Service postgresql*
```

## 自动化启动脚本

### 创建Redis启动脚本
```powershell
# 创建 start-redis.ps1
@"
Write-Host "启动Redis服务器..."
Start-Process -FilePath ".\Redis\redis-server.exe" -ArgumentList ".\Redis\redis.windows.conf" -WindowStyle Minimized
Start-Sleep -Seconds 2
.\Redis\redis-cli.exe ping
Write-Host "Redis服务器启动完成"
"@ | Out-File -FilePath "start-redis.ps1" -Encoding UTF8
```

### 创建服务检查脚本
```powershell
# 创建 check-services.ps1
@"
Write-Host "=== 服务状态检查 ==="
Write-Host "PostgreSQL (5432):"
netstat -an | findstr :5432
Write-Host "Redis (6379):"
netstat -an | findstr :6379
Write-Host "Redis连接测试:"
.\Redis\redis-cli.exe ping
"@ | Out-File -FilePath "check-services.ps1" -Encoding UTF8
```

## 当前状态总结

- ✅ **PostgreSQL**: 运行中，端口5432正常
- ✅ **Redis**: 已启动，端口6379正常，连接测试通过
- ❌ **PostgreSQL MCP**: 认证配置需要修复
- ✅ **Redis MCP**: 准备就绪

## 下一步操作

1. **立即可用**: Redis MCP已经可以正常使用
2. **需要修复**: PostgreSQL MCP认证问题
3. **建议操作**: 运行 `fix-postgresql-auth.cjs` 修复认证
4. **最终验证**: 重启Trae AI以重新加载MCP配置

---

**生成时间**: 2024年1月24日 12:58  
**Redis状态**: 🟢 正常运行  
**PostgreSQL状态**: 🟡 运行中但MCP认证需修复