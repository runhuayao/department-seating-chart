# 更新日志

本文档记录部门地图项目的所有重要更改。

## [v0.1.0] - 2024-01-01

### 新增
- 初始化React+TypeScript+Express全栈项目
- 配置Vite构建工具
- 集成TailwindCSS样式框架
- 添加Zustand状态管理
- 添加d3-zoom地图缩放功能
- 配置Express后端服务
- 添加Zod数据验证
- 集成Prisma ORM
- 创建基础项目结构
- 配置ESLint代码规范
- 添加TypeScript类型支持

### 技术栈
- Frontend: React@18 + TypeScript@5 + Vite@4 + TailwindCSS@3 + d3-zoom@3 + Zustand@5
- Backend: Express@4 + TypeScript@5 + Zod@3 + Prisma@5
- Tools: ESLint + Prettier + Nodemon

### 项目结构
```
├── api/          # 后端API服务
├── src/          # 前端源码
├── public/       # 静态资源
├── .trae/        # 项目文档
└── package.json  # 项目配置
```