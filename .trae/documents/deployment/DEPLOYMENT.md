# 部门地图系统部署指南

## 版本信息
- 当前版本: v3.1.0
- 最后更新: 2024年

## 系统架构

本系统采用前后端分离架构：
- **前端**: React + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL
- **实时通信**: WebSocket (Socket.IO)
- **认证**: JWT + RBAC权限控制

## 部署环境要求

### 基础环境
- Node.js >= 18.0.0
- npm >= 8.0.0 或 pnpm >= 7.0.0
- PostgreSQL >= 13.0

### 生产环境推荐
- CPU: 2核心以上
- 内存: 4GB以上
- 存储: 20GB以上
- 网络: 稳定的互联网连接

## 本地开发部署

### 1. 环境准备
```bash
# 克隆项目
git clone <repository-url>
cd department-map

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env
```

### 2. 数据库配置
```bash
# 创建PostgreSQL数据库
createdb department_map

# 运行数据库迁移
npm run db:setup
```

### 3. 启动开发服务
```bash
# 启动前端和后端服务
npm run dev

# 或分别启动
npm run client:dev  # 前端服务 (端口: 5173)
npm run server:dev  # 后端服务 (端口: 3001)
```

## 云端部署 (Vercel)

### 1. 准备工作
- 确保项目已推送到Git仓库
- 安装Vercel CLI: `npm i -g vercel`

### 2. 环境变量配置
在Vercel控制台或通过CLI配置以下环境变量：
```
DB_HOST=your_postgres_host
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

### 3. 部署命令
```bash
# 预览部署
npm run deploy:preview

# 生产部署
npm run deploy:vercel
```

## Docker部署

### 1. 创建Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### 2. Docker Compose配置
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    depends_on:
      - postgres
  
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: department_map
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 系统监控与维护

### 健康检查
- API健康检查: `GET /api/health`
- 数据库连接检查: `npm run db:status`

### 日志管理
- 应用日志位置: `./logs/`
- 错误日志: `./logs/error.log`
- 访问日志: `./logs/access.log`

### 性能监控
- WebSocket连接数监控
- 数据库查询性能监控
- API响应时间监控

## 安全配置

### 1. HTTPS配置
生产环境必须启用HTTPS，确保数据传输安全。

### 2. 防火墙设置
- 仅开放必要端口 (80, 443, 数据库端口)
- 限制数据库访问来源

### 3. 环境变量安全
- 使用强密码和复杂的JWT密钥
- 定期轮换敏感凭据
- 不要在代码中硬编码敏感信息

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数
   - 确认网络连通性

2. **WebSocket连接异常**
   - 检查防火墙设置
   - 验证CORS配置
   - 确认端口可用性

3. **认证失败**
   - 检查JWT密钥配置
   - 验证token有效期
   - 确认用户权限设置

### 调试命令
```bash
# 检查系统状态
npm run db:status

# 验证数据完整性
npm run db:validate

# 运行集成测试
node api/tests/websocket-database-integration.test.cjs
```

## 版本更新

### 更新流程
1. 备份数据库
2. 拉取最新代码
3. 安装新依赖
4. 运行数据库迁移
5. 重启服务
6. 验证功能

### 回滚策略
如遇问题，可快速回滚到上一个稳定版本：
```bash
git checkout <previous-stable-tag>
npm install
npm run db:rollback
npm restart
```

## 技术支持

如遇部署问题，请检查：
1. 系统日志文件
2. 数据库连接状态
3. 环境变量配置
4. 网络连通性

更多技术细节请参考项目文档目录中的相关技术文档。