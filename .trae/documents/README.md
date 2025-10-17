# 部门地图项目 (Department Map) - v3.2.1

## 📋 项目概述

部门地图项目是一个基于React + TypeScript的企业级座位管理系统，提供部门地图可视化、人员搜索定位和服务器管理功能。项目采用多端口分离架构，确保功能模块化和系统安全性。

## 🏗️ 系统架构

### 架构图

```mermaid
graph TD
    A[部门地图系统<br/>:5173] --> C[后端API服务<br/>:8080]
    B[M1服务器管理系统<br/>:3001] --> C
    C --> D[(PostgreSQL)]
    C --> E[(Redis)]
    
    subgraph "前端层"
        A
        B
    end
    
    subgraph "服务层"
        C
    end
    
    subgraph "数据层"
        D
        E
    end
```

### 端口配置

| 端口   | 系统        | 功能                  | 访问地址                                           |
| ---- | --------- | ------------------- | ---------------------------------------------- |
| 5173 | 部门地图系统    | 地图展示、人员搜索、工位管理      | <http://localhost:5173/>                       |
| 3001 | M1服务器管理系统 | 服务器监控、用户管理、系统管理     | <http://localhost:3001/server-management.html> |
| 8080 | 后端API服务   | 数据接口、业务逻辑、WebSocket | <http://localhost:8080/api/>\*                 |

## 🚀 快速开始

### 环境要求

* Node.js >= 18.0.0

* npm >= 9.0.0

* PostgreSQL >= 15.0

* Redis >= 7.0

### 安装依赖

```bash
# 安装项目依赖
npm install

# 安装数据库依赖
npm run db:setup
```

### 启动服务

```bash
# 启动部门地图系统 (5173端口)
npm run client:dev

# 启动M1服务器管理系统 (3001端口)
npm run server-management:dev

# 启动后端API服务 (8080端口)
npm run server:dev

# 同时启动所有服务
npm run dev:all
```

### 验证安装

访问以下地址确认服务正常运行：

* 部门地图系统：<http://localhost:5173/>

* M1服务器管理系统：<http://localhost:3001/server-management.html>

* API健康检查：<http://localhost:8080/api/health>

## 📁 项目结构

```
部门地图/
├── src/                          # 前端源码
│   ├── main.tsx                  # 部门地图系统入口 (5173端口)
│   ├── server-main.tsx           # M1服务器管理系统入口 (3001端口)
│   ├── App.tsx                   # 部门地图主组件
│   ├── ServerApp.tsx             # M1服务器管理主组件
│   ├── components/               # 共享组件
│   ├── contexts/                 # React上下文
│   ├── hooks/                    # 自定义Hooks
│   ├── pages/                    # 页面组件
│   └── utils/                    # 工具函数
├── api/                          # 后端API (8080端口)
│   ├── server.ts                 # API服务器入口
│   ├── routes/                   # 路由定义
│   ├── controllers/              # 控制器
│   ├── services/                 # 业务逻辑
│   ├── models/                   # 数据模型
│   └── database/                 # 数据库管理
├── public/                       # 静态资源
├── dist/                         # 部门地图系统构建输出
├── dist-server-management/       # M1服务器管理系统构建输出
├── .trae/                        # 项目文档
│   └── documents/                # 技术文档
├── vite.config.ts                # 部门地图系统配置 (5173端口)
├── vite.server-management.config.ts # M1服务器管理系统配置 (3001端口)
├── package.json                  # 项目配置和脚本
├── CHANGELOG.md                  # 版本更新日志
└── README.md                     # 项目说明
```

## 🔧 技术栈

### 前端技术栈

* **React 18** - 用户界面框架

* **TypeScript** - 类型安全的JavaScript

* **Vite** - 快速构建工具

* **Tailwind CSS** - 实用优先的CSS框架

* **Lucide React** - 图标库

* **React Router DOM** - 前端路由

* **Zustand** - 状态管理

### 后端技术栈

* **Node.js** - JavaScript运行时

* **Express.js** - Web应用框架

* **TypeScript** - 类型安全的JavaScript

* **PostgreSQL** - 关系型数据库

* **Redis** - 内存数据库/缓存

* **Socket.io** - 实时通信

* **JWT** - 身份认证

### 开发工具

* **ESLint** - 代码质量检查

* **Prettier** - 代码格式化

* **Git** - 版本控制

* **npm** - 包管理器

## 🗄️ 本地数据库部署指南

### 📋 部署前准备

在开始部署本地数据库之前，请确保：

1. 已安装 Node.js 18+ 环境
2. 具备管理员权限（Windows）或 sudo 权限（Linux）
3. 网络连接正常，可访问软件下载源

### 🔴 Redis 本地部署

#### Windows 环境

**方法一：使用项目内置脚本（推荐）**

```powershell
# 1. 使用项目自带的Redis启动脚本
npm run redis:start

# 2. 如果需要强制重启
npm run redis:start-force

# 3. 验证Redis服务状态
Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
```

**方法二：手动安装Redis**

```powershell
# 1. 下载Redis for Windows
Invoke-WebRequest -Uri "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.msi" -OutFile "Redis-x64-5.0.14.1.msi"

# 2. 安装Redis
Start-Process -FilePath "Redis-x64-5.0.14.1.msi" -Wait

# 3. 启动Redis服务
Start-Service Redis

# 4. 设置开机自启
Set-Service -Name Redis -StartupType Automatic

# 5. 测试连接
redis-cli ping
```

**方法三：使用MCP工具安装**

```powershell
# 1. 安装Redis MCP服务器
npx -y @modelcontextprotocol/server-redis redis://127.0.0.1:6379

# 2. 启动MCP Redis服务
.\scripts\ensure-redis-and-start-mcp.ps1 -RedisUrl "redis://127.0.0.1:6379"
```

#### Linux 环境

**Ubuntu/Debian:**

```bash
# 1. 更新包管理器
sudo apt update

# 2. 安装Redis
sudo apt install redis-server -y

# 3. 启动Redis服务
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 4. 验证安装
redis-cli ping
```

**CentOS/RHEL:**

```bash
# 1. 安装EPEL仓库
sudo yum install epel-release -y

# 2. 安装Redis
sudo yum install redis -y

# 3. 启动服务
sudo systemctl start redis
sudo systemctl enable redis

# 4. 验证安装
redis-cli ping
```

**使用Docker（跨平台）:**

```bash
# 1. 拉取Redis镜像
docker pull redis:7-alpine

# 2. 启动Redis容器
docker run -d --name department-map-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# 3. 验证连接
docker exec -it department-map-redis redis-cli ping
```

### 🐘 PostgreSQL 本地部署

#### Windows 环境

**方法一：官方安装包**

```powershell
# 1. 下载PostgreSQL 15
Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64.exe" -OutFile "postgresql-15.8-1-windows-x64.exe"

# 2. 静默安装（需要管理员权限）
Start-Process -FilePath "postgresql-15.8-1-windows-x64.exe" -ArgumentList "--mode unattended --superpassword 113464 --servicename postgresql-x64-15 --servicepassword 113464" -Wait

# 3. 添加到系统PATH
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::Machine)

# 4. 验证安装
psql --version
```

**方法二：使用MCP工具**

```powershell
# 1. 安装PostgreSQL MCP服务器
npx -y @modelcontextprotocol/server-postgres

# 2. 配置连接参数
$env:POSTGRES_CONNECTION_STRING = "postgresql://postgres:113464@localhost:5432/department_map"
```

#### Linux 环境

**Ubuntu/Debian:**

```bash
# 1. 安装PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# 2. 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. 设置postgres用户密码
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '113464';"

# 4. 创建项目数据库
sudo -u postgres createdb department_map
```

**CentOS/RHEL:**

```bash
# 1. 安装PostgreSQL仓库
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 2. 安装PostgreSQL
sudo yum install -y postgresql15-server postgresql15

# 3. 初始化数据库
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# 4. 启动服务
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15

# 5. 设置密码和创建数据库
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '113464';"
sudo -u postgres createdb department_map
```

**使用Docker（跨平台）:**

```bash
# 1. 启动PostgreSQL容器
docker run -d --name department-map-postgres \
  -e POSTGRES_DB=department_map \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=113464 \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# 2. 验证连接
docker exec -it department-map-postgres psql -U postgres -d department_map -c "SELECT version();"
```

### ⚙️ 项目配置修改

#### 环境变量配置

编辑项目根目录的 `.env` 文件：

```bash
# PostgreSQL数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=department_map
DB_USER=postgres
DB_PASSWORD=113464
DB_SSL=false

# 数据库模式配置
DATABASE_MODE=postgresql
FORCE_POSTGRESQL=true

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 连接池配置
CONNECTION_POOL_MIN=2
CONNECTION_POOL_MAX=20
DB_CONNECTION_TIMEOUT=10000
DB_IDLE_TIMEOUT=30000

# Redis连接池配置
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_RETRY_DELAY_ON_FAILURE=100
REDIS_MAX_RETRY_DELAY=3000
REDIS_RETRY_TIMES=3
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
REDIS_KEEP_ALIVE=30000
```

#### 数据库初始化

```bash
# 1. 运行数据库迁移脚本
node init-db.mjs

# 2. 或者手动执行SQL脚本
psql -U postgres -d department_map -f api/sql/init_postgresql.sql

# 3. 验证表结构
psql -U postgres -d department_map -c "\dt"
```

### 🔍 服务验证

#### Redis 服务验证

```bash
# Windows PowerShell
# 1. 检查Redis进程
Get-Process -Name "redis-server" -ErrorAction SilentlyContinue

# 2. 测试连接
redis-cli ping
# 期望输出: PONG

# 3. 检查Redis信息
redis-cli info server

# Linux/macOS
# 1. 检查服务状态
sudo systemctl status redis

# 2. 测试连接
redis-cli ping

# 3. 检查内存使用
redis-cli info memory
```

#### PostgreSQL 服务验证

```bash
# Windows PowerShell
# 1. 检查服务状态
Get-Service -Name "postgresql*"

# 2. 测试数据库连接
psql -U postgres -d department_map -c "SELECT version();"

# 3. 检查数据库列表
psql -U postgres -l

# Linux/macOS
# 1. 检查服务状态
sudo systemctl status postgresql

# 2. 测试连接
psql -U postgres -d department_map -c "SELECT NOW();"

# 3. 检查连接数
psql -U postgres -d department_map -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 项目连接验证

```bash
# 1. 启动项目测试连接
npm run server:dev

# 2. 检查日志输出，应该看到：
# ✅ Redis连接已建立
# ✅ 数据库连接测试成功
# 🚀 服务器启动成功，端口: 8080

# 3. 测试API端点
curl http://localhost:8080/api/health

# 4. 测试WebSocket连接
# 访问 http://localhost:5173 查看实时连接状态
```

### 🚨 故障排除

#### Redis 常见问题

**问题1: Redis服务无法启动**

```bash
# Windows解决方案
# 1. 检查端口占用
netstat -ano | findstr :6379

# 2. 结束占用进程
taskkill /PID <进程ID> /F

# 3. 重新启动Redis
npm run redis:start-force

# Linux解决方案
# 1. 检查端口占用
sudo lsof -i :6379

# 2. 重启Redis服务
sudo systemctl restart redis
```

**问题2: Redis连接被拒绝**

```bash
# 1. 检查Redis配置文件
# Windows: Redis\redis.windows.conf
# Linux: /etc/redis/redis.conf

# 2. 确保bind配置正确
bind 127.0.0.1 ::1

# 3. 检查防火墙设置
# Windows
New-NetFirewallRule -DisplayName "Redis" -Direction Inbound -Protocol TCP -LocalPort 6379 -Action Allow

# Linux
sudo ufw allow 6379
```

**问题3: Redis内存不足**

```bash
# 1. 检查内存使用
redis-cli info memory

# 2. 清理缓存
redis-cli flushall

# 3. 调整maxmemory配置
redis-cli config set maxmemory 256mb
redis-cli config set maxmemory-policy allkeys-lru
```

#### PostgreSQL 常见问题

**问题1: PostgreSQL服务无法启动**

```bash
# Windows解决方案
# 1. 重启PostgreSQL服务
.\restart-postgresql.ps1

# 2. 手动重启服务
Restart-Service postgresql-x64-15

# Linux解决方案
# 1. 检查服务状态
sudo systemctl status postgresql

# 2. 查看错误日志
sudo journalctl -u postgresql -f

# 3. 重启服务
sudo systemctl restart postgresql
```

**问题2: 连接认证失败**

```bash
# 1. 修复认证配置
node fix-postgresql-auth.cjs

# 2. 手动修改pg_hba.conf
# Windows: C:\Program Files\PostgreSQL\15\data\pg_hba.conf
# Linux: /etc/postgresql/15/main/pg_hba.conf

# 添加或修改以下行：
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5

# 3. 重启PostgreSQL服务
```

**问题3: 数据库不存在**

```bash
# 1. 创建数据库
createdb -U postgres department_map

# 2. 或使用SQL命令
psql -U postgres -c "CREATE DATABASE department_map;"

# 3. 验证数据库创建
psql -U postgres -l | grep department_map
```

**问题4: 端口冲突**

```bash
# 1. 检查端口占用
# Windows
netstat -ano | findstr :5432

# Linux
sudo lsof -i :5432

# 2. 修改PostgreSQL端口
# 编辑postgresql.conf文件，修改port配置
port = 5433

# 3. 更新项目配置
# 修改.env文件中的DB_PORT
DB_PORT=5433
```

### 🔄 完整部署流程

#### 从零开始的本地部署

```bash
# 1. 克隆项目（如果需要）
git clone <项目地址>
cd 部门地图

# 2. 安装项目依赖
npm install

# 3. 部署Redis
# Windows
npm run redis:start
# Linux
sudo apt install redis-server -y && sudo systemctl start redis

# 4. 部署PostgreSQL
# Windows
# 下载并安装PostgreSQL 15，设置密码为 113464
# Linux
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '113464';"
sudo -u postgres createdb department_map

# 5. 验证服务状态
redis-cli ping  # 应返回 PONG
psql -U postgres -d department_map -c "SELECT version();"  # 应返回版本信息

# 6. 初始化数据库
node init-db.mjs

# 7. 启动项目
npm run dev:all

# 8. 验证部署
# 访问 http://localhost:5173 - 部门地图系统
# 访问 http://localhost:3001/server-management - M1管理系统
# 访问 http://localhost:8080/api/health - API健康检查
```

#### 服务启动顺序

1. **Redis服务**: 优先启动，提供缓存支持
2. **PostgreSQL服务**: 主数据库服务
3. **后端API服务**: 依赖数据库连接
4. **前端开发服务器**: 最后启动，连接后端API

#### 验证清单

* [ ] Redis服务正常运行 (`redis-cli ping` 返回 PONG)

* [ ] PostgreSQL服务正常运行 (`psql -U postgres -l` 显示数据库列表)

* [ ] 项目数据库已创建 (`department_map` 数据库存在)

* [ ] 数据库表结构已初始化 (`\dt` 显示表列表)

* [ ] 后端API服务启动成功 (端口8080)

* [ ] 前端服务启动成功 (端口5173和3001)

* [ ] WebSocket连接正常 (实时数据同步)

#### 性能监控

```bash
# Redis性能监控
redis-cli --latency-history -i 1

# PostgreSQL性能监控
psql -U postgres -d department_map -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# 系统资源监控
# Windows
Get-Counter "\Processor(_Total)\% Processor Time"
Get-Counter "\Memory\Available MBytes"

# Linux
top -p $(pgrep -d',' -f redis-server)
top -p $(pgrep -d',' -f postgres)
```

## 🔧 端口访问规范

### 访问控制机制

**5173端口 - 部门地图系统**

* ✅ 允许访问：`/`, `/login`, `/map/*`

* 🎯 主要功能：部门地图展示、工位管理、人员搜索

* 🛡️ 防护措施：用户认证、路径控制中间件

**3001端口 - M1服务器管理系统**

* ✅ 允许访问：`/server-management.html`

* 🎯 主要功能：用户管理、服务器监控、系统管理

* 🔄 自动重定向：根路径 `/` → `/server-management.html`

* 🛡️ 防护措施：管理员权限验证

**8080端口 - 后端API服务**

* ✅ 允许访问：`/api/*`, `/health`, `/monitor`

* 🎯 主要功能：数据接口、业务逻辑、WebSocket通信

* 🔐 需要认证：JWT令牌验证

* 🛡️ 防护措施：API访问频率限制、CORS策略

### 安全注意事项

1. **端口隔离**：不同端口承担不同职责，严禁跨端口访问
2. **权限控制**：每个系统都有独立的认证机制
3. **数据保护**：敏感数据传输使用HTTPS加密
4. **访问日志**：所有访问都会记录在日志中

## 🔍 故障排除指南

### 常见问题

#### 问题1：端口内容重复

**症状**：不同端口显示相同内容

**可能原因**：

* 访问控制中间件失效

* Vite配置文件错误

* 路由配置冲突

**解决步骤**：

```bash
# 1. 检查Vite配置
cat vite.config.ts
cat vite.server-management.config.ts

# 2. 重启服务
npm run dev:stop
npm run dev:all

# 3. 清除缓存
npm run cache:clear
```

#### 问题2：端口无法访问

**症状**：浏览器显示"连接被拒绝"

**可能原因**：

* 服务未启动

* 端口被占用

* 防火墙阻止

**解决步骤**：

```bash
# 1. 检查端口占用
netstat -ano | findstr :5173
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# 2. 杀死占用进程
taskkill /PID <进程ID> /F

# 3. 重新启动服务
npm run client:dev
npm run server-management:dev
npm run server:dev
```

#### 问题3：API调用失败

**症状**：前端无法获取数据

**可能原因**：

* 后端服务未启动

* 数据库连接失败

* CORS配置错误

**解决步骤**：

```bash
# 1. 检查后端服务
curl http://localhost:8080/api/health

# 2. 检查数据库连接
npm run db:test

# 3. 查看错误日志
npm run logs:api
```

### 诊断工具

```bash
# 系统健康检查
npm run health:check

# 端口连通性测试
npm run test:ports

# 数据库连接测试
npm run test:db

# 完整系统测试
npm run test:system
```

### 日志查看

```bash
# 查看所有服务日志
npm run logs:all

# 查看特定服务日志
npm run logs:client      # 5173端口日志
npm run logs:management  # 3001端口日志
npm run logs:api         # 8080端口日志

# 实时监控日志
npm run logs:watch
```

## 📚 相关文档

### 核心文档

* [系统架构关联逻辑文档](./系统架构关联逻辑文档.md) - 详细的系统架构说明

* [端口配置文档](./端口配置文档.md) - 端口配置和安全策略

* [CHANGELOG](../../CHANGELOG.md) - 版本更新记录

### M1阶段文档

* [M1\_部门地图技术架构文档](./M1/M1_部门地图技术架构文档.md)

* [M1\_部门地图产品需求文档](./M1/M1_部门地图产品需求文档.md)

* [M1\_数据库设计文档](./M1/M1_数据库设计文档.md)

* [M1\_API接口文档](./M1/M1_API接口文档.md)

* [M1\_部署运维文档](./M1/M1_部署运维文档.md)

## 🛠️ 开发规范

### Git提交规范

```bash
# 提交格式
git commit -m "<type>: <description>"

# 类型说明
feat:     新功能
fix:      修复bug
docs:     文档更新
style:    代码格式调整
refactor: 代码重构
test:     测试相关
chore:    构建过程或辅助工具的变动
```

### 代码规范

* 使用TypeScript进行类型检查

* 遵循ESLint和Prettier配置

* 组件命名使用PascalCase

* 文件命名使用kebab-case

* 常量使用UPPER\_SNAKE\_CASE

### 版本管理

* 遵循语义化版本控制（SemVer）

* 主版本号.次版本号.修订号

* 每次发布前更新CHANGELOG.md

## 🤝 贡献指南

1. Fork项目到个人仓库
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'feat: add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建Pull Request

## 📞 技术支持

如果遇到问题，请按以下顺序寻求帮助：

1. 查看本文档的故障排除指南
2. 检查[CHANGELOG](../../CHANGELOG.md)中的已知问题
3. 搜索项目Issues中的相关问题
4. 创建新的Issue并提供详细信息

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。

***

***

**项目版本**：v3.2.1\
**最后更新**：2025-10-17 16:46:40 CST\
**维护团队**：部门地图开发团队

## 🔗 快速链接

* **部门地图系统**：<http://localhost:5173/>

* **M1服务器管理**：<http://localhost:3001/server-management.html>

* **API健康检查**：<http://localhost:8080/api/health>

* **项目仓库**：[GitHub Repository](https://github.com/your-org/department-map)

* **技术文档**：[.trae/documents/](.trae/documents/)

## 📊 项目统计

* **代码行数**：\~15,000+ 行

* **组件数量**：50+ 个React组件

* **API端点**：20+ 个RESTful接口

* **数据库表**：10+ 张PostgreSQL表

* **测试覆盖率**：85%+

