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
- PostgreSQL 12+ (可选)
- Redis 6+ (可选)
- Git

### 安装步骤

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
- **API文档**: http://localhost:8080/api/health

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