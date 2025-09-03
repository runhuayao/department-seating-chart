# 部门地图系统

一个基于React+Express的内网2D室内地图应用，用于显示部门工位分布和员工在岗状态。

## 技术架构

### 前端技术栈
- **React 18** + **TypeScript 5** - 现代化前端框架
- **Vite 4** - 快速构建工具
- **TailwindCSS 3** - 原子化CSS框架
- **d3-zoom 3** - 地图缩放交互
- **Zustand 5** - 轻量级状态管理
- **React Router 7** - 路由管理

### 后端技术栈
- **Express 4** + **TypeScript 5** - Node.js服务框架
- **Zod 3** - 数据验证
- **Prisma 5** - 现代化ORM
- **CORS** - 跨域支持

## 项目结构

```
├── .trae/                    # 项目文档和配置
│   ├── documents/           # 产品需求和技术架构文档
│   └── rules/              # 项目规则配置
├── api/                     # 后端API服务
│   ├── app.ts              # Express应用配置
│   ├── server.ts           # 服务器启动文件
│   ├── index.ts            # API入口文件
│   └── routes/             # API路由定义
├── src/                     # 前端源码
│   ├── components/         # React组件
│   ├── pages/              # 页面组件
│   ├── hooks/              # 自定义Hooks
│   ├── lib/                # 工具函数
│   └── assets/             # 静态资源
├── public/                  # 公共静态文件
├── package.json            # 项目依赖配置
├── vite.config.ts          # Vite构建配置
├── tailwind.config.js      # TailwindCSS配置
├── tsconfig.json           # TypeScript配置
├── CHANGELOG.md            # 版本更新日志
└── README.md               # 项目说明文档
```

## 核心功能

1. **地图显示** - 支持SVG/PNG格式的部门地图
2. **工位管理** - 显示工位分布和占用状态
3. **人员搜索** - 快速查找员工位置
4. **状态同步** - 实时更新员工在岗状态
5. **缩放交互** - 支持地图缩放和拖拽

## 开发指南

### 环境要求
- Node.js >= 18
- npm >= 8

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
# 同时启动前端和后端开发服务器
npm run dev

# 仅启动前端开发服务器
npm run client:dev

# 仅启动后端开发服务器
npm run server:dev
```

### 构建部署
```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 代码检查
```bash
# ESLint代码检查
npm run lint

# TypeScript类型检查
npm run check
```

## API接口

### 核心接口
- `GET /api/map?dept=Engineering` - 获取部门地图数据
- `GET /api/desks?dept=Engineering` - 获取工位信息
- `GET /api/findUser?name=张三` - 搜索员工
- `GET /api/status?dept=Engineering` - 获取状态更新
- `POST /api/heartbeat` - 心跳上报

## 版本管理

项目采用语义化版本控制，详细更改记录请查看 [CHANGELOG.md](./CHANGELOG.md)。

## 开发规范

1. **提交规范** - 使用有意义的提交信息
2. **代码规范** - 遵循ESLint配置
3. **类型安全** - 充分利用TypeScript类型系统
4. **组件设计** - 遵循React最佳实践

## 部署说明

支持Vercel一键部署，配置文件已包含在项目中。
