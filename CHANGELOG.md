# 更新日志

本文档记录了M1服务器管理平台的所有重要更改。

## [v1.3.0-M1_工位自主管理系统] - 2025-01-13

### 新增功能
- **工位自主管理系统**: 实现用户自主添加工位功能
- **工位管理API**: 新增完整的RESTful API接口
  - `POST /api/workstations` - 用户添加工位
  - `GET /api/workstations` - 获取工位列表
  - `PUT /api/workstations/:id` - 管理员修改工位
  - `DELETE /api/workstations/:id` - 管理员删除工位
  - `GET /api/workstations/search` - 搜索工位
- **数据库扩展**: 创建workstations表存储工位信息
- **前端组件**: WorkstationManagement组件，支持工位的增删改查
- **云函数服务**: workstationService实现安全的数据传输
- **权限控制**: 集成RBAC系统，区分用户和管理员权限
- **数据验证**: 前后端双重数据校验机制
- **搜索功能**: 支持按工位名称、IP地址、部门等条件搜索
- **响应式设计**: 适配移动端和桌面端的用户界面

### 技术改进
- 实现数据加密传输
- 添加操作日志记录
- 优化用户体验和加载状态处理
- 完善错误处理机制

### 文件变更
- 新增: `api/routes/workstations.ts` - 工位管理API路由
- 新增: `migrations/003_create_workstations_table.sql` - 数据库迁移脚本
- 新增: `src/components/WorkstationManagement.tsx` - 工位管理前端组件
- 新增: `src/services/workstationService.ts` - 工位服务
- 新增: `src/types/workstation.ts` - 工位类型定义
- 新增: `src/utils/security.ts` - 安全工具函数
- 新增: `src/utils/validation.ts` - 数据验证工具
- 修改: `api/app.ts` - 集成工位管理路由
- 修改: `package.json` - 更新项目版本和依赖
- 修改: `src/components/M1ServerManagement.tsx` - 集成工位管理入口

### 安全性
- 实现基于角色的访问控制(RBAC)
- 添加API请求加密
- 用户身份验证机制
- 数据完整性校验

---

## [v1.2.0] - 之前版本
- M1服务器管理平台基础功能
- 部门地图可视化
- 用户权限管理