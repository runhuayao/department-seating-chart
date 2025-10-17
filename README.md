# 部门地图 · Seating Chart v3.2.1

一个基于 WebSocket 和 PostgreSQL 的企业级实时座位管理系统，支持百万级座位空间索引、分布式座位锁和实时数据同步。

## ✨ 核心特性

- 🗺️ **实时座位地图** - 支持多楼层、多区域座位管理
- 👥 **智能座位分配** - 基于部门、角色的自动分配算法
- 🔄 **实时数据同步** - WebSocket 实现毫秒级状态更新
- 🔐 **权限管理系统** - 基于角色的访问控制 (RBAC)
- 📊 **数据可视化** - 实时统计图表和热力图
- 🚀 **高性能架构** - 支持千人并发，响应时间 < 100ms
- 💾 **Redis缓存系统** - 提升查询性能
- 🗄️ **混合数据库架构** - PostgreSQL + 内存备用
- 📱 **响应式设计** - 支持桌面端和移动端
- 🔧 **M1服务器管理** - 集成服务器监控和管理功能

## 🛠️ 技术栈

### 前端技术
- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 极速构建工具
- **Tailwind CSS** - 原子化CSS框架
- **Socket.io Client** - 实时通信
- **Zustand** - 轻量级状态管理
- **React Router** - 路由管理

### 后端技术
- **Node.js** + **Express.js** - 服务端框架
- **TypeScript** - 类型安全
- **Socket.io** - WebSocket实时通信
- **PostgreSQL** - 主数据库
- **Redis** - 缓存和会话存储
- **JWT** - 身份认证

### 开发工具
- **ESLint** + **Prettier** - 代码规范
- **Husky** - Git钩子
- **Docker** - 容器化部署

## 📁 项目结构

```
部门地图/
├── src/                    # 前端源码 (部门地图系统)
│   ├── components/         # React组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义Hook
│   ├── utils/             # 工具函数
│   └── types/             # TypeScript类型定义
├── server-management/      # M1服务器管理系统前端
│   ├── src/               # 管理系统源码
│   └── dist-server-management/ # 构建输出
├── api/                   # 后端API服务
│   ├── routes/            # 路由定义
│   ├── models/            # 数据模型
│   ├── middleware/        # 中间件
│   ├── config/            # 配置文件
│   │   ├── database.ts    # PostgreSQL配置
│   │   └── cache.ts      # Redis缓存服务
│   └── sql/              # SQL脚本
├── scripts/              # 自动化脚本
├── .trae/documents/      # 项目文档
└── dist/                 # 前端构建输出
```

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 pnpm
- PostgreSQL 12+ (可选，系统有内存备用模式)
- Redis 6+ (可选，系统会自动启动本地Redis)

### 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install
```

**Redis服务管理**:
```bash
# 检查Redis状态并自动启动
npm run redis:start

# 强制重启Redis (PowerShell)
npm run redis:start-force

# 启动Redis MCP服务器 (全局模式)
npx -y @modelcontextprotocol/server-redis redis://127.0.0.1:6379
```

### 启动开发服务器

```bash
# 启动所有服务 (推荐)
npm run dev:all

# 或分别启动各个服务
npm run client:dev      # 前端开发服务器 (端口 5173)
npm run server:dev      # 后端API服务器 (端口 8080)
npm run server-management:dev  # M1管理系统 (端口 3001)

# 启动前端+后端 (自动启动Redis)
npm run dev

# 启动完整系统 (前端+后端+管理系统+Redis)
npm run dev:all
```

### 访问地址

- **部门地图系统**: http://localhost:5173
- **M1服务器管理**: http://localhost:3001/server-management
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/api-docs

## 📚 详细文档

如需了解详细的本地数据库部署指南、故障排除和高级配置，请参考：

📖 **[完整技术文档](.trae/documents/README.md)** - 包含详细的Redis和PostgreSQL本地部署指南

### 🔧 快速本地部署

```bash
# 1. 安装依赖
npm install

# 2. 启动Redis (项目内置)
npm run redis:start

# 3. 配置PostgreSQL (可选，系统有内存备用模式)
# 详见 .trae/documents/README.md 中的完整部署指南

# 4. 启动所有服务
npm run dev:all
```

## 🔧 配置说明

### 环境变量

```bash
# 配置数据库连接、Redis连接等
cp .env.example .env
```

### 端口配置

- `5173` - 部门地图前端服务
- `3001` - M1服务器管理系统
- `8080` - 后端API服务
- `6379` - Redis缓存服务
- `5432` - PostgreSQL数据库 (如果使用)

### 开发工具

启动Redis (Windows):
```cmd
.\Redis\redis-server.exe .\Redis\redis.windows.conf
```

## 📝 开发指南

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 和 Prettier 配置
- 提交前运行 `npm run lint` 和 `npm run type-check`

### 测试

```bash
# 运行单元测试
npm run test

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage
```

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 🚀 部署说明

### 生产环境部署

1. **环境准备**: 确保服务器已安装 Node.js、PostgreSQL、Redis
2. **Redis启动**: 智能检测并启动Redis服务
3. **数据库连接**: 测试PostgreSQL连接，失败时使用内存模式
4. **服务启动**: 按顺序启动各个服务

### 自动化脚本

- `scripts/start-redis-simple.cmd` - Redis自动启动 (批处理)
- `scripts/start-redis.ps1` - Redis高级启动 (PowerShell)
- `scripts/migrate-static-data.js` - 数据迁移脚本

### NPM 脚本

```json
{
  "scripts": {
    "dev": "concurrently \"npm run client:dev\" \"npm run server:dev\"",
    "dev:all": "concurrently \"npm run client:dev\" \"npm run server:dev\" \"npm run server-management:dev\"",
    "client:dev": "vite --port 5173",
    "server:dev": "nodemon api/server.ts",
    "server-management:dev": "vite --config vite.server-management.config.ts --port 3001",
    "build": "npm run build:client && npm run build:server-management",
    "build:client": "vite build",
    "build:server-management": "vite build --config vite.server-management.config.ts",
    "redis:start": "scripts\\start-redis-simple.cmd",
    "services:check": "scripts\\start-redis-simple.cmd",
    "services:start": "scripts\\start-redis-simple.cmd"
  }
}
```

## 🏗️ 系统架构

### 技术架构

- **前端架构**: React + TypeScript + Vite
- **后端架构**: Node.js + Express + TypeScript  
- **数据库架构**: PostgreSQL (主) + Redis (缓存)
- **实时通信**: Socket.io WebSocket
- **状态管理**: Zustand (前端) + Redis (后端)

### 数据流

1. **用户操作** → 前端组件
2. **状态更新** → Zustand Store
3. **API请求** → Express路由
4. **数据持久化** → PostgreSQL
5. **缓存更新** → Redis
6. **实时推送** → Socket.io → 所有客户端

### 缓存策略

- **PostgreSQL** - 主数据库，用于生产环境
- **内存数据库** - 开发环境备用方案，无需额外配置
- **Redis缓存** - 提升查询性能，缓存热点数据

### Redis缓存配置

```typescript
// 缓存配置示例
const cacheConfig = {
  // 座位数据缓存5分钟
  seatData: { ttl: 300 },
  // 用户会话缓存1小时  
  userSession: { ttl: 3600 },
  // 部门数据缓存10分钟
  departmentData: { ttl: 600 }
}
```

### 环境变量配置

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=department_map
DB_USER=postgres
DB_PASSWORD=113464

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# API配置
PORT=8080
NODE_ENV=development
JWT_SECRET=your-secret-key
```

## 🔄 系统特性

### 核心功能

- **实时座位管理**: WebSocket实现毫秒级状态同步
- **智能座位分配**: 基于部门和角色的自动分配算法  
- **权限管理系统**: 完整的RBAC权限控制
- **数据可视化**: 实时统计图表和座位热力图
- **优雅降级**: PostgreSQL不可用时使用内存数据库
- **高性能缓存**: Redis缓存热点数据，提升查询效率

### 性能指标

- **并发支持**: 1000+ 用户同时在线
- **响应时间**: API响应 < 100ms
- **实时同步**: WebSocket延迟 < 50ms  
- **Redis缓存**: 工位数据缓存5分钟
- **数据库连接池**: 2-20个连接，支持高并发

### 监控告警

- **服务监控**: 自动检测Redis、PostgreSQL服务状态
- **性能监控**: API响应时间、数据库查询性能
- **错误监控**: 自动记录和上报系统异常
- **资源监控**: CPU、内存、磁盘使用率监控

## 📋 功能清单

### 已完成功能 ✅

- ✅ 实时座位地图显示和交互
- ✅ 用户认证和权限管理系统
- ✅ 部门和座位的CRUD操作
- ✅ WebSocket实时数据同步
- ✅ 响应式设计，支持多设备访问
- ✅ 数据可视化图表和统计面板
- ✅ 完整的Redis缓存系统
- ✅ PostgreSQL数据库集成
- ✅ M1服务器管理系统
- ✅ 用户管理模块（统计、列表、权限、操作）
- ✅ 自动化部署脚本和配置
- ✅ 完整的错误处理和日志系统

### 开发中功能 🚧

- 🚧 高级权限管理和审计日志
- 🚧 数据导入导出功能
- 🚧 移动端原生应用
- 🚧 多语言国际化支持

### 计划功能 📋

- 📋 AI智能座位推荐
- 📋 与企业OA系统集成
- 📋 高级数据分析和报表
- 📋 微服务架构重构

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

- **项目链接**: https://gitlab.com/runhuayao/department-map-system
- **问题反馈**: https://gitlab.com/runhuayao/department-map-system/issues

## 📚 文档结构

- **README.md** - 快速入门指南 (本文档)
- **COMPREHENSIVE_PROJECT_DOCUMENTATION.md** - 完整项目文档
- **CHANGELOG.md** - 版本更新历史
- **DEPLOYMENT.md** - 部署指南
- **.trae/documents/** - 开发规范和故障排除指南

详细的技术架构、功能实现和测试报告请参考 [综合项目文档](./.trae/documents/reports/COMPREHENSIVE_PROJECT_DOCUMENTATION.md)。

---

**部门地图管理系统** - 让企业工位管理更简单、更高效！ 🚀