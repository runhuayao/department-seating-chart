# 部门地图系统 (Department Map System)

一个基于React + Express.js的现代化部门地图管理系统，支持工位管理、用户认证、实时数据同步等功能。

## 🚀 功能特性

### 核心功能
- 📍 **交互式地图** - 可视化部门布局和工位分布
- 👥 **工位管理** - 支持工位的增删改查操作
- 🔍 **智能搜索** - 按人名或工位快速定位
- 🔐 **用户认证** - JWT基础的安全认证系统
- 📊 **管理后台** - 完整的后台管理界面
- 🔄 **实时同步** - WebSocket实现数据实时更新

### 技术特性
- 🛡️ **安全机制** - API认证、数据加密、SQL注入防护
- 📱 **响应式设计** - 支持桌面端和移动端
- 🔧 **模块化架构** - 前后端分离，易于维护和扩展
- 📈 **性能优化** - 连接池、缓存、错误处理

## 🏗️ 项目结构

```
部门地图/
├── src/                          # 前端源码目录
│   ├── components/               # React组件
│   │   ├── Map/                 # 地图相关组件
│   │   ├── WorkStation/         # 工位管理组件
│   │   ├── Search/              # 搜索功能组件
│   │   └── Admin/               # 管理后台组件
│   ├── contexts/                # React上下文
│   │   └── AuthContext.tsx     # 用户认证上下文
│   ├── hooks/                   # 自定义React钩子
│   ├── pages/                   # 页面组件
│   │   ├── Login.tsx           # 登录页面
│   │   ├── Dashboard.tsx       # 主仪表板
│   │   └── Admin.tsx           # 管理后台
│   ├── utils/                   # 工具函数
│   │   ├── api.ts              # API调用封装
│   │   └── helpers.ts          # 辅助函数
│   ├── types/                   # TypeScript类型定义
│   ├── App.tsx                  # 主应用组件
│   └── main.tsx                # 应用入口
├── api/                         # 后端服务器目录
│   ├── config/                  # 配置文件
│   │   ├── database.ts         # 数据库配置和连接
│   │   └── auth.ts             # 认证配置
│   ├── middleware/              # 中间件
│   │   ├── auth.ts             # 认证中间件
│   │   ├── cors.ts             # CORS配置
│   │   └── security.ts         # 安全中间件
│   ├── routes/                  # API路由
│   │   ├── auth.ts             # 认证相关API
│   │   ├── workstations.ts     # 工位管理API
│   │   ├── users.ts            # 用户管理API
│   │   └── departments.ts      # 部门管理API
│   ├── models/                  # 数据模型
│   ├── utils/                   # 后端工具函数
│   └── server.ts               # 服务器主文件
├── shared/                      # 前后端共享类型定义
├── public/                      # 静态资源
├── docs/                        # 项目文档
├── package.json                 # 项目依赖和脚本
├── vite.config.ts              # Vite配置
├── tsconfig.json               # TypeScript配置
├── tailwind.config.js          # Tailwind CSS配置
├── CHANGELOG.md                # 版本更新日志
└── README.md                   # 项目说明文档
```

## 🛠️ 技术栈

### 前端技术
- **React 18** - 用户界面库
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 快速的构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **Zustand** - 轻量级状态管理
- **React Router** - 客户端路由

### 后端技术
- **Node.js** - JavaScript运行时
- **Express.js** - Web应用框架
- **MySQL** - 关系型数据库
- **JWT** - JSON Web Token认证
- **bcrypt** - 密码加密
- **WebSocket** - 实时通信

### 开发工具
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Git** - 版本控制
- **npm/pnpm** - 包管理器

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0 或 pnpm >= 7.0.0
- MySQL >= 8.0 (可选，支持内存模式)

### 安装依赖

```bash
# 使用npm
npm install

# 或使用pnpm
pnpm install
```

### 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 配置环境变量：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=department_map

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=8080
NODE_ENV=development
```

### 启动开发服务器

```bash
# 启动前端开发服务器 (默认端口: 5173)
npm run dev

# 启动后端服务器 (默认端口: 8080)
npm run server:dev

# 同时启动前后端
npm run dev:full
```

### 构建生产版本

```bash
# 构建前端
npm run build

# 构建后端
npm run build:server

# 构建完整项目
npm run build:all
```

## 📖 API文档

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/refresh` - 刷新Token
- `POST /api/auth/logout` - 用户登出

### 工位管理
- `GET /api/workstations` - 获取工位列表
- `POST /api/workstations` - 创建新工位
- `PUT /api/workstations/:id` - 更新工位信息
- `DELETE /api/workstations/:id` - 删除工位

### 用户管理
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户

### 部门管理
- `GET /api/departments` - 获取部门列表
- `POST /api/departments` - 创建新部门
- `PUT /api/departments/:id` - 更新部门信息
- `DELETE /api/departments/:id` - 删除部门

## 🔐 安全特性

### 认证与授权
- JWT Token认证
- 基于角色的访问控制(RBAC)
- Token自动刷新机制
- 安全的密码存储(bcrypt)

### 数据安全
- SQL注入防护
- XSS攻击防护
- CSRF保护
- 数据传输加密

### 服务器安全
- CORS配置
- 安全HTTP头
- 请求频率限制
- 输入验证和清理

## 🧪 测试

```bash
# 运行单元测试
npm run test

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage
```

## 📦 部署

### Docker部署

```bash
# 构建Docker镜像
docker build -t department-map .

# 运行容器
docker run -p 8080:8080 department-map
```

### 传统部署

```bash
# 构建生产版本
npm run build:all

# 启动生产服务器
npm start
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 代码规范
- 使用TypeScript进行类型检查
- 遵循ESLint和Prettier配置
- 编写清晰的提交信息
- 添加必要的测试用例
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果您遇到问题或有任何疑问，请：

1. 查看 [FAQ](docs/FAQ.md)
2. 搜索现有的 [Issues](../../issues)
3. 创建新的 [Issue](../../issues/new)
4. 联系维护团队

## 📊 项目状态

- ✅ 核心功能完成
- ✅ 安全机制实现
- ✅ 文档完善
- 🔄 持续优化中

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户。

---

**版本**: v2.0.0  
**最后更新**: 2024-01-15  
**维护者**: 开发团队