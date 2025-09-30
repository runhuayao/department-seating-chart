# 部门地图管理系统 (Department Map System)

[![Version](https://img.shields.io/badge/version-v3.2.0-blue.svg)](https://gitlab.com/runhuayao/department-map-system)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18+-blue.svg)](https://reactjs.org/)

企业部门地图管理系统 - 基于React + TypeScript + Node.js的全栈应用，支持员工工位管理、实时数据同步、PostgreSQL数据库和Redis缓存。

## 🚀 项目特性

### 核心功能
- 📍 **部门地图可视化** - 交互式部门地图展示
- 👥 **员工工位管理** - 完整的CRUD操作
- 🔍 **智能搜索功能** - 支持员工和工位搜索
- 📊 **实时数据同步** - WebSocket实时更新
- 🔐 **用户认证系统** - JWT认证和权限管理

### 技术特性
- 💾 **Redis缓存系统** - 提升查询性能
- 🗄️ **混合数据库架构** - PostgreSQL + 内存备用
- 🔄 **API容错机制** - 优雅的错误处理和降级
- 📈 **性能监控** - 系统状态和健康检查
- 🛠️ **开发工具集成** - Context7上下文保留

## 🏗️ 技术架构

### 前端技术栈
- **React 18+** - 用户界面框架
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 快速构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **Lucide React** - 现代图标库

### 后端技术栈
- **Node.js 18+** - JavaScript运行时
- **Express.js** - Web应用框架
- **PostgreSQL** - 主数据库
- **Redis** - 缓存和会话存储
- **JWT** - 身份认证

### 开发工具
- **Context7** - 上下文保留系统
- **Git** - 版本控制
- **ESLint** - 代码质量检查
- **TypeScript** - 静态类型检查

## 📦 项目结构

```
部门地图/
├── api/                    # 后端API服务
│   ├── config/            # 配置文件
│   │   ├── database.ts    # 数据库配置
│   │   └── database.js    # 数据库连接
│   ├── middleware/        # 中间件
│   │   └── auth.ts        # 认证中间件
│   ├── models/           # 数据模型
│   │   └── database.ts   # 数据库模型
│   ├── routes/           # API路由
│   │   ├── workstations.ts  # 工位管理
│   │   ├── departments.ts   # 部门管理
│   │   ├── employees.ts     # 员工管理
│   │   └── search.ts        # 搜索功能
│   ├── services/         # 业务服务
│   │   └── cache.ts      # Redis缓存服务
│   └── server.ts         # 服务器入口
├── src/                  # 前端源码
│   ├── components/       # React组件
│   ├── pages/           # 页面组件
│   ├── utils/           # 工具函数
│   └── App.tsx          # 应用入口
├── shared/              # 共享类型定义
│   └── types.ts         # TypeScript类型
├── context7.json        # Context7配置
├── CHANGELOG.md         # 版本更新日志
└── README.md           # 项目说明
```

## 🚀 快速开始

### 环境要求
- Node.js 18.0.0 或更高版本
- PostgreSQL 12+ (可选，系统有内存备用模式)
- Redis 6+ (可选，系统会自动启动本地Redis)
- Git

### ⚡ 一键启动 (推荐)

**最简单的启动方式**:
```bash
# 自动检查服务 + 启动开发环境
npm run dev
```
系统会自动：
- ✅ 检查并启动Redis服务
- ✅ 检查数据库连接
- ✅ 启动前端服务 (http://localhost:5173)
- ✅ 启动后端API (http://localhost:8080)

**其他启动选项**:
```bash
# Windows PowerShell - 项目一键启动脚本
.\start-project.ps1

# 启动服务器管理模式 (包含M1管理界面)
.\start-project.ps1 -ServerManagement
# 或使用npm命令
npm run dev:all

# 生产模式预览
.\start-project.ps1 -ProductionMode
```

### 🔧 服务管理命令

**Redis服务管理**:
```bash
# 检查Redis状态并自动启动
npm run redis:start

# 强制重启Redis (PowerShell)
npm run redis:start-force

# 检查所有服务状态
npm run services:check

# 启动所有必需服务
npm run services:start
```

**开发服务管理**:
```bash
# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev

# 启动前端+后端 (自动启动Redis)
npm run dev

# 启动全部服务 (前端+后端+M1管理界面)
npm run dev:all
```

### 📋 手动启动步骤 (高级用户)

1. **克隆项目**
```bash
git clone https://gitlab.com/runhuayao/department-map-system.git
cd department-map-system
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量 (可选)
  # 配置数据库连接、Redis连接等
  ```

### 📊 服务状态监控

**实时服务状态**:
```bash
# 检查所有服务运行状态
npm run services:check

# 查看Redis进程信息
Get-Process -Name "redis-server"

# 测试API健康状态
curl http://localhost:8080/api/health

# 测试数据库连接
curl http://localhost:8080/api/database/status
```

**端口使用情况**:
- `5173` - 前端开发服务器
- `5174` - M1服务器管理界面 (dev:all模式)
- `8080` - 后端API服务器
- `3002` - M1管理界面静态服务
- `6379` - Redis缓存服务
- `5432` - PostgreSQL数据库 (如果使用)

4. **手动启动服务** (如果自动启动失败)
```bash
# 启动Redis (Windows)
.\Redis\redis-server.exe .\Redis\redis.windows.conf

# 启动后端服务
npm run server:dev

# 启动前端服务
npm run client:dev
```

### 🌐 访问地址

启动成功后，您可以访问：
- **前端应用**: http://localhost:5173
- **后端API**: http://localhost:8080/api
- **M1服务器管理**: http://localhost:3002 (如果启用)
- **API健康检查**: http://localhost:8080/api/health

### 🔍 Redis自动启动详细说明

项目已配置完整的Redis自动启动机制：

**自动启动流程**:
1. 运行 `npm run dev` 时触发 `predev` 钩子
2. 执行 `npm run services:start` 检查服务状态
3. 如果Redis未运行，自动启动本地Redis实例
4. 验证Redis连接是否成功
5. 继续启动前端和后端服务

**Redis配置文件**:
- **配置文件**: `Redis/redis.windows.conf`
- **默认端口**: 6379
- **启动脚本**: `scripts/start-redis-simple.cmd` (主要)
- **高级脚本**: `scripts/start-redis.ps1` (PowerShell版本)

**故障排除**:
```bash
# 如果自动启动失败，手动启动Redis
.\Redis\redis-server.exe .\Redis\redis.windows.conf

# 检查Redis进程
Get-Process -Name "redis-server"

# 测试Redis连接
npm run redis:start
```

### 🛠️ 开发模式说明

**标准开发模式**:
```bash
npm run dev
# 启动: 前端(5173) + 后端(8080) + 自动Redis检查
```

**完整开发模式**:
```bash
npm run dev:all  
# 启动: 前端(5173) + 后端(8080) + M1管理界面(5174) + 自动Redis检查
```

**服务器管理模式**:
```bash
npm run server-management:dev
# 仅启动: M1服务器管理界面(5174)
```
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
# 配置数据库连接、Redis连接等
```

4. **启动服务**

启动Redis服务 (Windows):
```bash
.\Redis\redis-server.exe .\Redis\redis.windows.conf
```

启动后端服务:
```bash
npm run server:dev
```

启动前端服务:
```bash
npm run client:dev
```

### 访问应用
- **前端应用**: http://localhost:5173
- **后端API**: http://localhost:8080/api
- **M1服务器管理**: http://localhost:3002 (静态服务)
- **API健康检查**: http://localhost:8080/api/health

### 🔄 自动化服务管理

**项目启动时的自动化流程**:
1. **依赖检查**: 自动检查Node.js依赖包完整性
2. **Redis启动**: 智能检测并启动Redis服务
3. **数据库连接**: 测试PostgreSQL连接，失败时使用内存模式
4. **服务启动**: 并发启动前端和后端服务
5. **状态验证**: 验证所有服务正常运行

**自动启动脚本**:
- `scripts/start-redis-simple.cmd` - Redis自动启动 (批处理)
- `scripts/start-redis.ps1` - Redis高级启动 (PowerShell)
- `scripts/check-services.ps1` - 完整服务检查
- `start-project.ps1` - 项目一键启动脚本

**npm脚本集成**:
```json
{
  "predev": "npm run services:start",
  "redis:start": "scripts\\start-redis-simple.cmd",
  "services:check": "scripts\\start-redis-simple.cmd",
  "services:start": "scripts\\start-redis-simple.cmd"
}
```

## 📋 API 端点

### 核心API
| 方法 | 端点 | 描述 | 状态 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | ✅ |
| GET | `/api/database/status` | 数据库状态 | ✅ |
| GET | `/api/workstations` | 获取工位列表 | ✅ |
| POST | `/api/workstations` | 创建新工位 | ✅ |
| GET | `/api/departments` | 获取部门列表 | ✅ |
| GET | `/api/search` | 搜索功能 | ✅ |

### API 使用示例

**获取工位列表**
```bash
curl http://localhost:8080/api/workstations
```

**创建新工位**
```bash
curl -X POST http://localhost:8080/api/workstations \
  -H "Content-Type: application/json" \
  -d '{"name":"开发部-001","department":"开发部","status":"available"}'
```

**搜索功能**
```bash
curl "http://localhost:8080/api/search?q=开发"
```

## 🔧 配置说明

### 数据库配置
系统支持混合数据库模式：
- **PostgreSQL** - 主数据库，用于生产环境
- **内存数据库** - 备用模式，用于开发和测试

### Redis缓存配置
- **缓存策略**: TTL 5分钟
- **缓存键**: `workstations:all`
- **自动清除**: 数据修改时清除相关缓存

### 环境变量
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=department_map
DB_USER=postgres
DB_PASSWORD=password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your-secret-key

# 服务器配置
PORT=8080
NODE_ENV=development
```

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行API测试
npm run test:api

# 运行前端测试
npm run test:client
```

### API测试
项目包含完整的API测试套件，验证所有端点功能。

## 📈 性能优化

### 缓存策略
- **Redis缓存**: 工位数据缓存5分钟
- **内存缓存**: 部门配置数据
- **查询优化**: 数据库索引和查询优化

### 错误处理
- **优雅降级**: PostgreSQL不可用时使用内存数据库
- **重试机制**: API请求失败自动重试
- **错误监控**: 完整的错误日志和监控

## 🔄 部署

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
# 构建项目
npm run build

# 启动生产服务
npm start
```

### Docker部署
```bash
# 构建镜像
docker build -t department-map-system .

# 运行容器
docker run -p 8080:8080 -p 5173:5173 department-map-system
```

## 📝 版本历史

### v3.2.0 (2024-12-28) - 生产就绪版本
- ✅ 完整的Redis缓存系统
- ✅ API功能全面优化
- ✅ 混合数据库架构完善
- ✅ 所有核心功能验证通过

### v3.1.2 (2024-12-28) - 数据库和依赖升级
- ✅ 完全重构数据库访问层
- ✅ 安装所有必需依赖包
- ✅ Context7上下文保留系统

### v3.1.1 (2024-12-28) - 基础修复
- ✅ 修复数据库模型导入错误
- ✅ 完善认证中间件
- ✅ 优化API路由系统

查看完整版本历史: [CHANGELOG.md](CHANGELOG.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- **项目链接**: https://gitlab.com/runhuayao/department-map-system
- **问题反馈**: https://gitlab.com/runhuayao/department-map-system/issues

## 🙏 致谢

- React 团队提供的优秀框架
- Node.js 社区的技术支持
- PostgreSQL 和 Redis 的强大功能
- Context7 的上下文保留技术

---

**部门地图管理系统** - 让企业工位管理更简单、更高效！ 🚀