# PostgreSQL 启动故障排除指南

## 🚨 常见问题诊断

### 问题1: "无法打开计算机'.'上的 postgresql-x64-16 服务"

**原因分析:**
- PowerShell 没有管理员权限
- PostgreSQL 服务名称不匹配
- PostgreSQL 服务未正确安装

**解决方案:**

#### 方案1: 使用管理员权限 (推荐)
1. **右键点击 PowerShell** → 选择 "以管理员身份运行"
2. 导航到项目目录:
   ```powershell
   cd "D:\HuaweiMoveData\Users\11346\Desktop\部门地图"
   ```
3. 运行启动脚本:
   ```powershell
   .\restart-postgresql.ps1
   ```

#### 方案2: 使用 PostgreSQL 助手脚本
```powershell
# 检查服务状态
.\postgresql-helper.ps1 -Status

# 启动服务
.\postgresql-helper.ps1

# 强制重启
.\postgresql-helper.ps1 -Force
```

#### 方案3: 使用 Docker (最简单)
```powershell
# 使用Docker启动PostgreSQL
.\postgresql-helper.ps1 -Docker

# 或者使用专用脚本
.\start-postgresql-admin.ps1 -Docker
```

## 🔧 详细解决步骤

### 步骤1: 检查当前状态
```powershell
# 检查PostgreSQL服务
Get-Service -Name "*postgresql*" | Format-Table -AutoSize

# 检查端口占用
netstat -ano | findstr :5432

# 检查管理员权限
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

### 步骤2: 服务管理
```powershell
# 手动启动服务 (需要管理员权限)
Start-Service -Name "postgresql-x64-16"

# 停止服务
Stop-Service -Name "postgresql-x64-16"

# 重启服务
Restart-Service -Name "postgresql-x64-16"
```

### 步骤3: Docker 替代方案
如果Windows服务有问题，推荐使用Docker:

```powershell
# 1. 安装Docker Desktop (如果未安装)
# 下载: https://www.docker.com/products/docker-desktop

# 2. 启动PostgreSQL容器
docker run --name postgres-db \
  -e POSTGRES_PASSWORD=113464 \
  -e POSTGRES_DB=department_map \
  -p 5432:5432 \
  -d postgres:16

# 3. 验证容器运行
docker ps

# 4. 连接测试
docker exec -it postgres-db psql -U postgres -d department_map
```

## 🛠️ 可用工具脚本

### 1. restart-postgresql.ps1
- **功能**: 重启PostgreSQL Windows服务
- **要求**: 管理员权限
- **用法**: `.\restart-postgresql.ps1`

### 2. postgresql-helper.ps1
- **功能**: 多功能PostgreSQL管理工具
- **特点**: 自动权限检查、多种启动方式
- **用法**: 
  ```powershell
  .\postgresql-helper.ps1 -Help     # 查看帮助
  .\postgresql-helper.ps1 -Status   # 检查状态
  .\postgresql-helper.ps1           # 启动服务
  .\postgresql-helper.ps1 -Docker   # 使用Docker
  ```

### 3. start-postgresql-admin.ps1
- **功能**: 管理员权限启动工具
- **特点**: 支持Windows服务和Docker两种方式
- **用法**: 
  ```powershell
  .\start-postgresql-admin.ps1        # Windows服务
  .\start-postgresql-admin.ps1 -Docker # Docker方式
  ```

## 🔍 连接测试

### 测试数据库连接
```powershell
# 使用psql (如果已安装)
psql -h localhost -p 5432 -U postgres -d department_map

# 使用Node.js测试脚本
node check_db_structure.cjs
```

### 验证服务运行
```powershell
# 检查端口监听
netstat -ano | findstr :5432

# 测试连接
Test-NetConnection -ComputerName localhost -Port 5432
```

## 📋 环境配置检查

### .env 文件配置
确保项目根目录的 `.env` 文件包含正确的数据库配置:
```env
# PostgreSQL 配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=department_map
DB_USER=postgres
DB_PASSWORD=113464

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 数据库初始化
```powershell
# 运行数据库迁移
node init-db.mjs

# 检查数据库结构
node check_db_structure.cjs
```

## 🚀 快速启动流程

### 推荐流程 (Docker方式)
1. 确保Docker Desktop已安装并运行
2. 运行: `.\postgresql-helper.ps1 -Docker`
3. 等待容器启动完成
4. 运行: `node check_db_structure.cjs` 验证连接
5. 启动项目: `npm run dev`

### 传统流程 (Windows服务)
1. 以管理员身份运行PowerShell
2. 运行: `.\restart-postgresql.ps1`
3. 验证服务状态: `.\postgresql-helper.ps1 -Status`
4. 运行: `node check_db_structure.cjs` 验证连接
5. 启动项目: `npm run dev`

## ❓ 常见问题 FAQ

**Q: 为什么需要管理员权限?**
A: Windows服务的启动/停止需要管理员权限。使用Docker可以避免这个问题。

**Q: Docker方式有什么优势?**
A: 不需要管理员权限，环境隔离，配置简单，跨平台兼容。

**Q: 如何确认PostgreSQL正在运行?**
A: 运行 `.\postgresql-helper.ps1 -Status` 或 `netstat -ano | findstr :5432`

**Q: 数据会丢失吗?**
A: Windows服务方式数据持久化，Docker方式需要配置数据卷持久化。

**Q: 端口冲突怎么办?**
A: 检查 `netstat -ano | findstr :5432`，停止占用端口的进程或修改配置使用其他端口。

## 📞 获取帮助

如果以上方案都无法解决问题，请提供以下信息:
1. PowerShell错误信息截图
2. `Get-Service -Name "*postgresql*"` 输出
3. `docker ps` 输出 (如果使用Docker)
4. Windows版本和PostgreSQL版本信息