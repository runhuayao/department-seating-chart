# 部门地图项目新架构设计

## 1. 架构总览

基于技术文档要求，采用四层网络模型 + 三层业务架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    表示层 (Presentation Layer)                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Vue3 Client   │  │  Canvas/SVG     │  │  Figma Plugin   │ │
│  │   (Port 5173)   │  │   Renderer      │  │   Integration   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  WebSocket API  │  │   REST API      │  │  GraphQL API    │ │
│  │   (Port 8080)   │  │  (Port 3000)    │  │  (Port 4000)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    业务层 (Business Layer)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ WebSocket Pool  │  │ Message Batch   │  │ Seat Manager    │ │
│  │   Manager       │  │   Processor     │  │   Service       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data Layer)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  PostgreSQL     │  │     Redis       │  │   File System   │ │
│  │ (Port 5432)     │  │  (Port 6379)    │  │   (Logs/Cache)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 2. 目录结构重构

```
部门地图/
├── src/
│   ├── client/                     # 前端应用
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/
│   │   └── utils/
│   ├── server/                     # 后端服务
│   │   ├── core/                   # 核心业务层
│   │   │   ├── websocket/          # WebSocket管理
│   │   │   │   ├── manager.ts      # WebSocket连接池管理器
│   │   │   │   ├── connection.ts   # 连接生命周期管理
│   │   │   │   └── events.ts       # 事件处理器
│   │   │   ├── database/           # 数据库层
│   │   │   │   ├── pool.ts         # PostgreSQL连接池
│   │   │   │   ├── sync.ts         # 数据同步服务
│   │   │   │   └── models/         # 数据模型
│   │   │   ├── messaging/          # 消息处理
│   │   │   │   ├── batch.ts        # 批处理器
│   │   │   │   ├── queue.ts        # 消息队列
│   │   │   │   └── publisher.ts    # 消息发布器
│   │   │   └── security/           # 安全模块
│   │   │       ├── auth.ts         # JWT认证
│   │   │       ├── validator.ts    # 数据验证
│   │   │       └── encryption.ts   # 加密服务
│   │   ├── api/                    # API层
│   │   │   ├── rest/               # REST API
│   │   │   ├── graphql/            # GraphQL API
│   │   │   └── websocket/          # WebSocket API
│   │   ├── services/               # 业务服务层
│   │   │   ├── seat.service.ts     # 座位管理服务
│   │   │   ├── realtime.service.ts # 实时数据服务
│   │   │   └── monitoring.service.ts # 监控服务
│   │   └── infrastructure/         # 基础设施层
│   │       ├── config/             # 配置管理
│   │       ├── logging/            # 日志系统
│   │       └── monitoring/         # 监控系统
│   ├── shared/                     # 共享代码
│   │   ├── types/                  # TypeScript类型定义
│   │   ├── constants/              # 常量定义
│   │   └── utils/                  # 工具函数
│   └── tests/                      # 测试代码
│       ├── unit/                   # 单元测试
│       ├── integration/            # 集成测试
│       ├── performance/            # 性能测试
│       └── security/               # 安全测试
├── docs/                           # 文档
│   ├── api/                        # API文档
│   ├── architecture/               # 架构文档
│   └── deployment/                 # 部署文档
├── scripts/                        # 脚本文件
│   ├── build/                      # 构建脚本
│   ├── deploy/                     # 部署脚本
│   └── migration/                  # 数据迁移脚本
└── config/                         # 配置文件
    ├── development/                # 开发环境配置
    ├── production/                 # 生产环境配置
    └── testing/                    # 测试环境配置
```

## 3. 核心组件设计

### 3.1 WebSocket连接池管理器

```typescript
interface WebSocketPoolManager {
  // 连接池管理
  initializePool(config: PoolConfig): Promise<void>;
  getConnection(userId: string): WebSocketConnection | null;
  releaseConnection(connectionId: string): void;
  
  // 负载均衡
  distributeLoad(): void;
  getPoolStats(): PoolStats;
  
  // 健康检查
  healthCheck(): Promise<HealthStatus>;
  cleanup(): Promise<void>;
}
```

### 3.2 PostgreSQL连接池

```typescript
interface DatabaseConnectionPool {
  // 连接管理
  acquire(): Promise<PoolClient>;
  release(client: PoolClient): void;
  
  // 事务管理
  withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  
  // 监控
  getStats(): ConnectionPoolStats;
  healthCheck(): Promise<boolean>;
}
```

### 3.3 消息批处理器

```typescript
interface MessageBatchProcessor {
  // 批处理配置
  setBatchSize(size: number): void;
  setFlushInterval(interval: number): void;
  
  // 消息处理
  addMessage(message: Message): void;
  flush(): Promise<void>;
  
  // 监控
  getMetrics(): BatchMetrics;
}
```

## 4. 性能优化策略

### 4.1 连接池优化
- WebSocket连接池：最大1000并发连接
- PostgreSQL连接池：20个连接，空闲超时30秒
- Redis连接池：10个连接，支持集群模式

### 4.2 消息批处理
- 批处理大小：100条消息或500ms间隔
- 压缩算法：gzip压缩大于1KB的消息
- 优先级队列：紧急消息优先处理

### 4.3 缓存策略
- Redis缓存：座位状态缓存5分钟
- 内存缓存：连接状态缓存1分钟
- CDN缓存：静态资源缓存24小时

## 5. 安全机制

### 5.1 认证授权
- JWT Token：24小时有效期，支持刷新
- 权限控制：基于角色的访问控制(RBAC)
- API限流：每用户每分钟100次请求

### 5.2 数据安全
- 传输加密：TLS 1.3加密
- 数据加密：敏感数据AES-256加密
- SQL注入防护：参数化查询

## 6. 监控告警

### 6.1 性能监控
- WebSocket连接数：实时监控
- 数据库性能：查询时间、连接数
- 内存使用：堆内存、连接池内存

### 6.2 告警机制
- 连接数超过800：发送告警
- 响应时间超过500ms：发送告警
- 错误率超过1%：发送告警

## 7. 部署架构

### 7.1 容器化部署
```yaml
services:
  app:
    image: seat-map:latest
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
  
  postgres:
    image: postgres:15
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

### 7.2 负载均衡
- Nginx反向代理
- WebSocket粘性会话
- 数据库读写分离

## 8. 迁移计划

### 阶段1：核心架构重构（1-2周）
1. 重构WebSocket管理器
2. 优化PostgreSQL连接池
3. 实现消息批处理

### 阶段2：功能完善（2-3周）
1. 实现安全机制
2. 完善监控系统
3. 添加测试覆盖

### 阶段3：性能优化（1周）
1. 性能测试和调优
2. 部署优化
3. 文档完善

## 9. 风险评估

### 高风险
- 数据迁移可能导致数据丢失
- WebSocket连接中断影响用户体验

### 中风险
- 性能优化可能引入新bug
- 第三方依赖升级兼容性问题

### 低风险
- 文档更新滞后
- 测试覆盖不完整

## 10. 成功指标

### 性能指标
- WebSocket连接建立时间 < 100ms
- 座位状态查询响应时间 < 120ms
- 系统可用性 > 99.9%

### 质量指标
- 代码测试覆盖率 > 80%
- 安全漏洞数量 = 0
- 文档完整性 > 95%