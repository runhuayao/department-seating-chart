# 部门地图系统 (Department Map System)

一个现代化的企业部门地图和工位管理系统，提供直观的可视化界面和强大的管理功能。

## 🚀 项目概述

部门地图系统是一个全栈Web应用，旨在帮助企业高效管理部门结构、员工信息和工位分配。系统采用现代化的技术栈，提供实时数据同步、响应式设计和直观的用户界面。

### 核心功能

- 📍 **部门地图可视化** - 直观展示部门布局和工位分布
- 👥 **员工信息管理** - 完整的员工档案和搜索功能
- 🪑 **工位分配管理** - 实时工位状态监控和分配
- 🔐 **用户权限管理** - 基于角色的访问控制
- 🔄 **实时数据同步** - WebSocket支持的实时更新
- 📊 **统计分析** - 部门和工位使用情况统计

## 🛠️ 技术栈

### 前端
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 现代化构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **Zustand** - 轻量级状态管理
- **React Router** - 客户端路由

### 后端
- **Node.js** - JavaScript运行时
- **Express** - Web应用框架
- **TypeScript** - 服务端类型安全
- **WebSocket** - 实时通信
- **bcrypt** - 密码加密
- **JWT** - 身份验证

### 数据库
- **PostgreSQL** - 生产环境数据库
- **内存数据库** - 开发和测试环境
- **数据迁移脚本** - 数据库版本管理

## 📁 项目结构

```
部门地图/
├── src/                          # 前端源代码
│   ├── components/               # React组件
│   │   ├── DepartmentMap.tsx    # 部门地图主组件
│   │   ├── EmployeeSearch.tsx   # 员工搜索组件
│   │   └── DataSyncManager.tsx  # 数据同步管理器
│   ├── pages/                   # 页面组件
│   │   ├── Login.tsx           # 登录页面
│   │   ├── Dashboard.tsx       # 仪表板
│   │   └── M1ServerManagement.tsx # M1服务器管理
│   ├── hooks/                   # 自定义React Hooks
│   ├── utils/                   # 工具函数
│   ├── types/                   # TypeScript类型定义
│   └── App.tsx                  # 应用主组件
├── api/                         # 后端API代码
│   ├── routes/                  # API路由
│   │   ├── auth.ts             # 认证路由
│   │   ├── departments.ts      # 部门管理路由
│   │   ├── employees.ts        # 员工管理路由
│   │   └── desks.ts           # 工位管理路由
│   ├── models/                  # 数据模型
│   │   └── database.ts         # 数据库模型
│   ├── database/               # 数据库相关
│   │   ├── memory.ts          # 内存数据库实现
│   │   └── dao.ts             # 数据访问对象
│   ├── middleware/             # 中间件
│   │   └── auth.ts            # 认证中间件
│   └── server.ts              # 服务器入口
├── scripts/                    # 脚本文件
│   ├── enhanced_postgresql_init.sql # PostgreSQL初始化脚本
│   └── export-memory-data.sql  # 数据迁移脚本
├── shared/                     # 共享类型定义
│   └── types.ts               # 前后端共享类型
├── public/                     # 静态资源
├── package.json               # 项目依赖配置
├── vite.config.ts            # Vite配置
├── tailwind.config.js        # Tailwind配置
├── tsconfig.json             # TypeScript配置
├── CHANGELOG.md              # 更新日志
└── README.md                 # 项目说明文档
```

## 🔧 核心文件说明

### 前端核心文件

- **`src/App.tsx`** - 应用程序主入口，配置路由和全局状态
- **`src/components/DepartmentMap.tsx`** - 部门地图可视化组件，处理地图渲染和交互
- **`src/components/DataSyncManager.tsx`** - 数据同步管理器，处理WebSocket连接和实时更新
- **`src/pages/M1ServerManagement.tsx`** - M1服务器管理页面，包含工位管理等功能
- **`src/utils/websocket.ts`** - WebSocket客户端工具类

### 后端核心文件

- **`api/server.ts`** - Express服务器主入口，配置中间件和路由
- **`api/models/database.ts`** - 数据库操作模型，提供统一的数据访问接口
- **`api/database/memory.ts`** - 内存数据库实现，用于开发和测试
- **`api/routes/`** - API路由定义，处理HTTP请求和响应
- **`api/middleware/auth.ts`** - 身份验证中间件

### 配置文件

- **`package.json`** - 项目依赖和脚本配置
- **`vite.config.ts`** - Vite构建工具配置
- **`tsconfig.json`** - TypeScript编译器配置
- **`tailwind.config.js`** - Tailwind CSS样式配置

### 数据库脚本

- **`scripts/enhanced_postgresql_init.sql`** - PostgreSQL数据库初始化脚本
- **`scripts/export-memory-data.sql`** - 内存数据库数据导出脚本

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0 或 pnpm >= 7.0.0
- PostgreSQL >= 13.0 (生产环境)

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm (推荐)
pnpm install
```

### 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置数据库连接等参数：
```env
# 数据库配置
DATABASE_MODE=memory  # 开发环境使用内存数据库
# DATABASE_MODE=sqlite  # 或使用SQLite
# DATABASE_MODE=postgresql  # 生产环境使用PostgreSQL

# PostgreSQL配置 (生产环境)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=department_map
DB_USER=your_username
DB_PASSWORD=your_password

# JWT密钥
JWT_SECRET=your_jwt_secret_key

# 服务器配置
PORT=8080
CLIENT_PORT=5173
```

### 数据库初始化

#### 开发环境 (内存数据库)
开发环境默认使用内存数据库，无需额外配置。

#### 生产环境 (PostgreSQL)
```bash
# 1. 创建数据库
createdb department_map

# 2. 运行初始化脚本
psql -d department_map -f scripts/enhanced_postgresql_init.sql
```

### 启动开发服务器

```bash
# 启动后端服务器
npm run server:dev

# 启动前端开发服务器 (新终端)
npm run client:dev
```

### 构建生产版本

```bash
# 构建前端
npm run build

# 启动生产服务器
npm run start
```

## 📝 可用脚本

- `npm run client:dev` - 启动前端开发服务器
- `npm run server:dev` - 启动后端开发服务器
- `npm run dev` - 同时启动前后端开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run check` - TypeScript类型检查
- `npm run lint` - 代码规范检查
- `npm run test` - 运行测试

## 🔐 默认用户账号

系统预置了以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | 123456 | 管理员 | 系统管理员，拥有所有权限 |
| manager | admin123 | 经理 | 部门经理，拥有部门管理权限 |

## 🌐 API 文档

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/profile` - 获取用户信息

### 部门管理
- `GET /api/departments` - 获取部门列表
- `POST /api/departments` - 创建部门
- `PUT /api/departments/:id` - 更新部门信息
- `DELETE /api/departments/:id` - 删除部门

### 员工管理
- `GET /api/employees` - 获取员工列表
- `GET /api/employees/search` - 搜索员工
- `POST /api/employees` - 添加员工
- `PUT /api/employees/:id` - 更新员工信息
- `DELETE /api/employees/:id` - 删除员工

### 工位管理
- `GET /api/desks` - 获取工位列表
- `POST /api/desks` - 创建工位
- `PUT /api/desks/:id` - 更新工位信息
- `POST /api/desks/:id/assign` - 分配工位
- `DELETE /api/desks/:id/assign` - 取消工位分配

## 🔄 实时功能

系统支持WebSocket实时通信，提供以下实时功能：

- **部门数据同步** - 部门信息变更实时推送
- **员工状态更新** - 员工信息变更实时同步
- **工位状态监控** - 工位分配状态实时更新
- **系统通知** - 重要操作实时通知

### WebSocket连接

```javascript
// 连接WebSocket
const ws = new WebSocket('ws://localhost:8080');

// 监听消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到实时更新:', data);
};
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm run test

# 运行前端测试
npm run test:client

# 运行后端测试
npm run test:server

# 生成测试覆盖率报告
npm run test:coverage
```

### 测试结构

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
├── e2e/           # 端到端测试
└── fixtures/      # 测试数据
```

## 🚀 部署

### Docker部署

```bash
# 构建Docker镜像
docker build -t department-map .

# 运行容器
docker run -p 8080:8080 -e DATABASE_MODE=postgresql department-map
```

### 生产环境部署

1. **环境准备**
   - 安装Node.js和PostgreSQL
   - 配置环境变量
   - 初始化数据库

2. **构建应用**
   ```bash
   npm run build
   ```

3. **启动服务**
   ```bash
   npm run start
   ```

4. **配置反向代理** (推荐使用Nginx)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

1. **Fork** 项目仓库
2. **创建** 功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 更改 (`git commit -m 'Add some AmazingFeature'`)
4. **推送** 到分支 (`git push origin feature/AmazingFeature`)
5. **创建** Pull Request

### 代码规范

- 使用TypeScript进行类型安全开发
- 遵循ESLint配置的代码规范
- 编写清晰的提交信息
- 添加必要的测试用例
- 更新相关文档

### Git提交规范

```
type(scope): subject

body

footer
```

**Type类型：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持与反馈

如果您遇到问题或有建议，请通过以下方式联系我们：

- 📧 **邮箱**: support@company.com
- 🐛 **问题反馈**: [GitHub Issues](https://github.com/your-repo/issues)
- 📖 **文档**: [项目Wiki](https://github.com/your-repo/wiki)
- 💬 **讨论**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**最后更新**: 2024-12-19
**版本**: v1.0.0