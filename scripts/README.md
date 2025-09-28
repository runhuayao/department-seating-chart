# 服务自动化启动解决方案

## 概述

本解决方案为部门地图项目提供了自动化的服务启动功能，解决了每次运行 `npm run client:dev` 前需要手动启动 PostgreSQL 和 Redis 服务的问题。

## 功能特性

- ✅ **跨平台支持**: 支持 Windows、macOS 和 Linux
- ✅ **自动检测**: 智能检测服务运行状态
- ✅ **自动启动**: 自动启动未运行的服务
- ✅ **健康检查**: 详细的服务健康状态报告
- ✅ **手动控制**: 提供手动启动和停止服务的工具
- ✅ **错误处理**: 完善的错误处理和用户提示

## 脚本文件说明

### 1. `start-services.cjs` - 自动启动脚本
主要的服务启动脚本，集成到 `npm run client:dev` 中使用。

**功能**:
- 检测 PostgreSQL 和 Redis 服务状态
- 自动启动未运行的服务
- 验证服务启动成功
- 提供详细的状态报告

### 2. `check-services.cjs` - 健康检查脚本
详细的服务健康检查工具。

**功能**:
- 检查服务运行状态
- 检查端口连通性
- 测试数据库连接
- 获取服务版本信息
- 生成健康报告

### 3. `start-services-manual.cjs` - 手动启动工具
交互式的服务管理工具。

**功能**:
- 交互式菜单界面
- 选择性启动服务
- 实时状态检查
- 用户友好的操作体验

### 4. `stop-services.cjs` - 停止服务工具
安全停止服务的工具。

**功能**:
- 优雅停止服务
- 强制停止选项（谨慎使用）
- 交互式确认
- 详细的操作日志

## 使用方法

### 一键启动开发环境
```bash
# 自动启动服务并运行前端开发服务器
npm run client:dev

# 自动启动服务并运行前端+后端
npm run dev

# 自动启动服务并运行完整开发环境
npm run dev:all
```

### 服务管理命令
```bash
# 检查服务健康状态
npm run services:check

# 手动启动服务（交互式）
npm run services:start

# 停止服务（交互式）
npm run services:stop

# 仅运行自动启动脚本
npm run services:auto
```

### 传统方式（不自动启动服务）
```bash
# 直接启动前端，不检查服务
npm run client:dev:force
```

## 服务配置要求

### PostgreSQL
- **Windows**: 服务名 `postgresql-x64-16`
- **macOS**: 通过 Homebrew 安装 `postgresql@16`
- **Linux**: 系统服务 `postgresql`
- **端口**: 5432
- **用户**: postgres
- **密码**: postgres

### Redis
- **Windows**: 服务名 `Redis`
- **macOS**: 通过 Homebrew 安装 `redis`
- **Linux**: 系统服务 `redis-server`
- **端口**: 6379

## 安装和配置

### Windows 用户

1. **PostgreSQL 安装**:
   - 下载并安装 PostgreSQL 16
   - 确保服务名为 `postgresql-x64-16`
   - 设置用户名/密码为 `postgres/postgres`

2. **Redis 安装**:
   ```bash
   # 使用 Chocolatey 安装
   choco install redis-64
   
   # 或下载 Redis for Windows
   # https://github.com/microsoftarchive/redis/releases
   ```

3. **权限要求**:
   - 以管理员身份运行命令提示符或 PowerShell
   - 或确保当前用户有启动服务的权限

### macOS 用户

```bash
# 安装 PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# 安装 Redis
brew install redis
brew services start redis
```

### Linux 用户

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql redis-server

# CentOS/RHEL
sudo yum install postgresql-server redis

# 启动服务
sudo systemctl start postgresql
sudo systemctl start redis-server

# 设置开机自启
sudo systemctl enable postgresql
sudo systemctl enable redis-server
```

## 故障排除

### 常见问题

1. **权限不足**
   - Windows: 以管理员身份运行
   - Linux/macOS: 确保用户有 sudo 权限

2. **服务名不匹配**
   - 检查实际的服务名称
   - 修改脚本中的服务名配置

3. **端口被占用**
   - 检查端口使用情况: `netstat -an | findstr :5432`
   - 停止占用端口的进程

4. **服务未安装**
   - 按照上述安装指南安装相应服务
   - 确保服务正确配置

### 调试模式

如果遇到问题，可以单独运行各个脚本进行调试：

```bash
# 详细健康检查
node scripts/check-services.cjs

# 手动启动测试
node scripts/start-services-manual.cjs

# 查看服务状态
# Windows
sc query postgresql-x64-16
sc query Redis

# Linux/macOS
sudo systemctl status postgresql
sudo systemctl status redis-server
```

## 自定义配置

如果你的服务配置与默认不同，可以修改脚本中的配置：

1. 编辑 `scripts/start-services.cjs`
2. 修改服务名称、端口号等配置
3. 保存并测试

## 注意事项

- ⚠️ **数据安全**: 强制停止服务可能导致数据丢失
- ⚠️ **权限要求**: 启动系统服务需要管理员权限
- ⚠️ **网络安全**: 确保数据库和 Redis 的安全配置
- ✅ **备份**: 定期备份重要数据
- ✅ **监控**: 定期检查服务运行状态

## 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 初始版本发布
- ✅ 支持 PostgreSQL 和 Redis 自动启动
- ✅ 跨平台兼容性
- ✅ 健康检查功能
- ✅ 手动管理工具

## 贡献

如果你发现问题或有改进建议，请：
1. 创建 Issue 描述问题
2. 提交 Pull Request
3. 更新文档

## 许可证

本项目遵循 MIT 许可证。