# 部门地图项目 (Department Map System)

一个基于React + TypeScript + Express的部门地图可视化系统，用于实时显示员工工位分布和在线状态。

## 🚀 项目概述

本项目实现了一个交互式的部门地图系统，支持：
- 2D地图可视化显示部门布局
- 实时员工工位状态监控
- 交互式地图缩放和平移
- 员工搜索和定位功能
- 响应式Web界面设计

## 📋 当前状态 - M0 里程碑 ✅

**已完成功能：**
- ✅ 基础项目架构搭建
- ✅ DeptMap核心组件实现
- ✅ d3-zoom地图交互功能
- ✅ 模拟数据和工位渲染
- ✅ 响应式UI界面
- ✅ Git版本控制系统

## 🛠️ 技术栈

### 前端技术
- **React 18** - 用户界面框架
- **TypeScript 5** - 类型安全的JavaScript
- **Vite 4** - 快速构建工具
- **TailwindCSS 3** - 原子化CSS框架
- **d3-zoom 3** - 地图缩放和平移交互
- **d3-selection** - DOM操作和事件处理
- **Zustand** - 轻量级状态管理

### 后端技术
- **Express 4** - Node.js Web框架
- **TypeScript 5** - 后端类型安全
- **Zod 3** - 数据验证库
- **Prisma 5** - 数据库ORM（待集成）

### 开发工具
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Nodemon** - 后端热重载
- **Concurrently** - 并发运行前后端服务

## 📁 项目结构详解

```
部门地图/
├── 📂 api/                    # 后端API服务目录
│   ├── 📂 routes/             # API路由定义
│   ├── 📂 middleware/         # Express中间件
│   ├── 📂 models/             # 数据模型定义
│   ├── 📄 server.ts           # Express服务器入口文件
│   └── 📄 types.ts            # 后端类型定义
├── 📂 src/                    # 前端源码目录
│   ├── 📂 components/         # React组件库
│   │   └── 📄 DeptMap.tsx     # 核心地图组件
│   ├── 📂 hooks/              # 自定义React Hooks
│   ├── 📂 pages/              # 页面级组件
│   ├── 📂 utils/              # 工具函数库
│   ├── 📄 App.tsx             # 主应用组件
│   ├── 📄 main.tsx            # React应用入口
│   └── 📄 index.css           # 全局样式文件
├── 📂 public/                 # 静态资源目录
├── 📂 .trae/                  # 项目文档目录
│   └── 📂 documents/          # 需求和架构文档
├── 📄 package.json            # 项目依赖和脚本配置
├── 📄 vite.config.ts          # Vite构建配置
├── 📄 tailwind.config.js      # TailwindCSS配置
├── 📄 tsconfig.json           # TypeScript编译配置
├── 📄 nodemon.json            # Nodemon热重载配置
├── 📄 CHANGELOG.md            # 版本更新日志
└── 📄 README.md               # 项目说明文档
```

## 🔧 开发指南

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git >= 2.30.0

### 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd 部门地图
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```
访问 http://localhost:5173 查看前端界面
访问 http://localhost:3001 查看后端API

4. **构建生产版本**
```bash
npm run build
```

### 可用脚本

- `npm run dev` - 启动前后端开发服务器
- `npm run client:dev` - 仅启动前端开发服务器
- `npm run server:dev` - 仅启动后端开发服务器
- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建
- `npm run lint` - 运行ESLint检查

## 🎯 核心功能说明

### DeptMap组件 (`src/components/DeptMap.tsx`)
- **地图渲染**：基于SVG的2D地图可视化
- **工位显示**：圆形工位图标，颜色表示状态
- **交互功能**：点击工位查看详情，支持缩放平移
- **状态管理**：实时更新员工在线/离线状态

### 状态颜色说明
- 🟢 **绿色** - 员工在线
- 🔴 **红色** - 员工离线
- ⚪ **灰色** - 工位空闲

### 模拟数据结构
```typescript
interface Desk {
  id: string;           // 工位唯一标识
  x: number;            // X坐标位置
  y: number;            // Y坐标位置
  employee?: Employee;  // 分配的员工信息
}

interface Employee {
  id: string;           // 员工ID
  name: string;         // 员工姓名
  department: string;   // 所属部门
  isOnline: boolean;    // 在线状态
}
```

## 🔄 Git版本管理规范

### 提交信息格式
```
<type>: <description>

type类型：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建工具或辅助工具的变动
```

### 版本标签规范
- 采用语义化版本控制 (Semantic Versioning)
- 格式：`v<major>.<minor>.<patch>_<description>`
- 示例：`v1.0.1_地图图层优化`

## 📈 开发路线图

### M1 里程碑 (计划中)
- [ ] 后端API接口实现
- [ ] PostgreSQL数据库集成
- [ ] Prisma ORM配置
- [ ] 用户认证系统
- [ ] 实时WebSocket连接

### M2 里程碑 (计划中)
- [ ] 人员搜索功能
- [ ] 管理员面板
- [ ] 数据导入导出
- [ ] 移动端适配

## 🐛 问题排查

### 常见问题
1. **端口占用**：确保5173和3001端口未被占用
2. **依赖安装失败**：删除node_modules后重新安装
3. **TypeScript错误**：检查tsconfig.json配置
4. **Git命令失败**：确保Git已正确安装并配置PATH

### 调试技巧
- 使用浏览器开发者工具查看控制台错误
- 检查网络请求状态
- 查看终端输出的详细错误信息

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

**项目状态**: 🚧 开发中 | **当前版本**: v1.0.0 | **最后更新**: 2025-01-24
