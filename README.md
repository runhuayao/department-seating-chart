# M1服务器管理平台 - 工位自主管理系统

## 项目概述

M1服务器管理平台是一个集成了工位自主管理功能的企业级管理系统。用户可以自主添加工位信息，管理员可以对工位进行全面管理，支持搜索、编辑和删除操作。

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: SQLite (可扩展至PostgreSQL/MySQL)
- **状态管理**: Zustand
- **权限控制**: RBAC (基于角色的访问控制)
- **UI组件**: Lucide React Icons

## 项目结构

```
部门地图/
├── api/                          # 后端API服务
│   ├── routes/
│   │   └── workstations.ts       # 工位管理API路由
│   ├── app.ts                    # Express应用配置
│   └── server.ts                 # 服务器启动文件
├── migrations/                   # 数据库迁移脚本
│   └── 003_create_workstations_table.sql
├── src/                          # 前端源码
│   ├── components/
│   │   ├── WorkstationManagement.tsx  # 工位管理主组件
│   │   ├── M1ServerManagement.tsx     # M1服务器管理
│   │   └── DeptMap.tsx               # 部门地图
│   ├── services/
│   │   └── workstationService.ts     # 工位服务API调用
│   ├── types/
│   │   └── workstation.ts            # 工位类型定义
│   ├── utils/
│   │   ├── security.ts              # 安全工具函数
│   │   └── validation.ts            # 数据验证工具
│   ├── App.tsx                      # 主应用组件
│   └── main.tsx                     # 应用入口
├── CHANGELOG.md                     # 版本更新日志
├── package.json                     # 项目依赖配置
└── README.md                        # 项目说明文档
```

## 核心功能

### 工位管理
- **用户功能**:
  - 自主添加工位信息
  - 查看工位列表
  - 搜索工位
- **管理员功能**:
  - 编辑工位信息
  - 删除工位
  - 查看操作日志

### 数据字段
- 工位名称
- IP地址
- 用户名
- 部门信息
- 位置信息(楼层、房间号)
- 设备信息
- 硬件规格(CPU、内存、存储、显卡)
- 网络信息
- 标签分类
- 备注信息

### 权限控制
- **普通用户**: 只能添加和查看工位
- **管理员**: 拥有完整的增删改查权限
- **超级管理员**: 系统配置和用户管理权限

## 安装和运行

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
这将同时启动前端开发服务器(端口5173)和后端API服务器(端口3002)。

### 生产构建
```bash
npm run build
```

## API接口

### 工位管理接口
- `POST /api/workstations` - 创建工位
- `GET /api/workstations` - 获取工位列表
- `GET /api/workstations/:id` - 获取单个工位详情
- `PUT /api/workstations/:id` - 更新工位信息
- `DELETE /api/workstations/:id` - 删除工位
- `GET /api/workstations/search` - 搜索工位

## 数据库

### workstations表结构
```sql
CREATE TABLE workstations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    username TEXT NOT NULL,
    department TEXT NOT NULL,
    floor TEXT,
    room_number TEXT,
    device_type TEXT,
    cpu TEXT,
    memory TEXT,
    storage TEXT,
    graphics_card TEXT,
    network_type TEXT,
    network_speed TEXT,
    tags TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 安全特性

- **数据加密**: API请求和响应数据加密传输
- **身份验证**: 用户登录状态验证
- **权限控制**: 基于角色的操作权限限制
- **数据验证**: 前后端双重数据格式验证
- **操作日志**: 记录所有关键操作

## 版本历史

- **v1.3.0** - 工位自主管理系统
- **v1.2.0** - M1服务器管理平台基础功能
- **v1.1.0** - 部门地图可视化
- **v1.0.0** - 项目初始版本

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
