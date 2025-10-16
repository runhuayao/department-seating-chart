# 系统架构文档

## 概述

部门地图系统是一个基于 WebSocket 和 PostgreSQL 的企业级实时座位管理系统，采用领域驱动设计(DDD)和事件驱动架构，支持百万级座位空间索引、分布式座位锁和实时数据同步。

## 架构原则

### 设计原则
- **高可用性**: 99.9% 可用性保证，支持故障自动恢复
- **高性能**: 楼层渲染 ≤800ms，座位查询 p99 ≤120ms
- **可扩展性**: 支持水平扩展，最大 10,000 并发连接
- **安全性**: 端到端加密，多层级权限控制
- **可维护性**: 模块化设计，完整测试覆盖

### 技术原则
- **领域驱动设计**: 清晰的业务边界和领域模型
- **事件驱动架构**: 松耦合的组件通信
- **依赖注入**: 可测试的组件设计
- **配置外部化**: 环境变量集中管理
- **监控优先**: 全链路监控和告警

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端层 (Client Layer)                    │
├─────────────────────────────────────────────────────────────────┤
│  Vue3 + Canvas/SVG  │  Figma Plugin  │  Mobile App  │  Admin UI │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        网关层 (Gateway Layer)                     │
├─────────────────────────────────────────────────────────────────┤
│           Nginx/Kong API Gateway + Load Balancer                │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       应用层 (Application Layer)                  │
├─────────────────────────────────────────────────────────────────┤
│  NestJS Application Server (Node.js + TypeScript)               │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐ │
│  │   WebSocket     │   GraphQL API   │      REST API           │ │
│  │   Manager       │   Resolver      │      Controller         │ │
│  └─────────────────┴─────────────────┴─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        核心层 (Core Layer)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐   │
│  │  WebSocket  │  Messaging  │  Security   │  Data Sync      │   │
│  │  Pool Mgr   │  Processor  │  Manager    │  Service        │   │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┬─────────────────────────────────┐   │
│  │    PostgreSQL 13+       │         Redis 6+                │   │
│  │    + PostGIS            │         + Cluster               │   │
│  │  ┌─────────────────────┐│  ┌─────────────────────────────┐ │   │
│  │  │ Seats, Floors,      ││  │ Session Cache,              │ │   │
│  │  │ Users, Permissions  ││  │ Seat Locks,                 │ │   │
│  │  │ Spatial Indexes     ││  │ Pub/Sub Channels            │ │   │
│  │  └─────────────────────┘│  └─────────────────────────────┘ │   │
│  └─────────────────────────┴─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. WebSocket 连接池管理器

#### 职责
- 管理 WebSocket 连接的生命周期
- 实现负载均衡和连接分发
- 提供健康检查和故障恢复
- 统计连接指标和性能监控

#### 核心特性
```typescript
interface WebSocketPoolManager {
  // 连接管理
  handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void>
  removeConnection(connectionId: string): Promise<void>
  
  // 消息处理
  broadcastMessage(message: any, filter?: ConnectionFilter): Promise<void>
  sendToUser(userId: string, message: any): Promise<boolean>
  
  // 健康检查
  performHealthCheck(): Promise<HealthCheckResult>
  sendHeartbeat(): Promise<void>
  
  // 统计信息
  getConnectionStats(): ConnectionStats
  getMessageStats(): MessageStats
}
```

#### 配置参数
```typescript
interface PoolConfig {
  maxConnections: number        // 最大连接数 (10,000)
  heartbeatInterval: number     // 心跳间隔 (30s)
  connectionTimeout: number     // 连接超时 (60s)
  maxMessageSize: number        // 最大消息大小 (1MB)
  compressionThreshold: number  // 压缩阈值 (1KB)
}
```

### 2. 消息批处理器

#### 职责
- 实现消息的批量处理和发送
- 提供优先级队列和去重机制
- 支持消息压缩和重试机制
- 监控批处理性能和指标

#### 批处理策略
```typescript
interface BatchConfig {
  maxBatchSize: number      // 最大批次大小 (100)
  flushInterval: number     // 刷新间隔 (500ms)
  maxRetries: number        // 最大重试次数 (3)
  retryDelay: number        // 重试延迟 (1s)
  deduplicationWindow: number // 去重窗口 (30s)
}
```

#### 优先级定义
- **HIGH**: 座位抢占、紧急通知
- **MEDIUM**: 座位释放、状态更新
- **LOW**: 统计信息、日志消息

### 3. 实时数据同步服务

#### 职责
- 同步 PostgreSQL 和 WebSocket 客户端数据
- 处理数据库变更事件
- 管理订阅和取消订阅
- 提供冲突检测和解决机制

#### 同步机制
```typescript
interface SyncService {
  // 客户端消息处理
  handleSeatSelect(message: SeatSelectMessage): Promise<void>
  handleSeatRelease(message: SeatReleaseMessage): Promise<void>
  handleFloorChange(message: FloorChangeMessage): Promise<void>
  
  // 数据库事件处理
  handleDatabaseChange(event: DatabaseChangeEvent): Promise<void>
  
  // 订阅管理
  subscribe(connectionId: string, topics: string[]): Promise<void>
  unsubscribe(connectionId: string, topics: string[]): Promise<void>
}
```

### 4. 安全管理器

#### 认证机制
- **JWT 双令牌**: 访问令牌 (1h) + 刷新令牌 (7d)
- **会话管理**: Redis 存储会话状态
- **权限控制**: 基于角色的访问控制 (RBAC)

#### 加密服务
```typescript
interface EncryptionService {
  // 敏感数据加密
  encryptSeatCoordinates(coordinates: Coordinates): string
  encryptEmployeeId(employeeId: string): string
  encryptPersonalInfo(info: PersonalInfo): string
  
  // WebSocket 消息加密
  encryptWebSocketMessage(message: any): string
  decryptWebSocketMessage(encryptedMessage: string): any
  
  // 密钥管理
  generateApiKey(): string
  rotateMasterKey(): Promise<void>
}
```

#### 速率限制
```typescript
interface RateLimitRule {
  name: string
  windowMs: number      // 时间窗口
  maxRequests: number   // 最大请求数
  skipSuccessfulRequests: boolean
  skipFailedRequests: boolean
  keyGenerator: (req: any) => string
}
```

## 数据模型

### 数据库设计

#### 核心表结构
```sql
-- 楼层表
CREATE TABLE floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  building_id UUID NOT NULL,
  floor_number INTEGER NOT NULL,
  floor_plan GEOMETRY(POLYGON, 4326),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 座位表
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_number VARCHAR(50) NOT NULL,
  floor_id UUID REFERENCES floors(id),
  coordinates GEOMETRY(POINT, 4326) NOT NULL,
  status seat_status DEFAULT 'available',
  occupied_by UUID REFERENCES users(id),
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 空间索引
CREATE INDEX idx_seats_coordinates ON seats USING GIST (coordinates);
CREATE INDEX idx_floors_plan ON floors USING GIST (floor_plan);
```

#### 座位状态枚举
```sql
CREATE TYPE seat_status AS ENUM (
  'available',    -- 可用
  'occupied',     -- 已占用
  'reserved',     -- 已预订
  'maintenance',  -- 维护中
  'disabled'      -- 已禁用
);
```

### Redis 数据结构

#### 座位锁
```redis
# 座位锁 (30分钟过期)
seat:lock:{seat_id} = {
  "user_id": "uuid",
  "locked_at": "timestamp",
  "expires_at": "timestamp",
  "salt": "random_string"
}
```

#### 用户会话
```redis
# 用户会话 (7天过期)
session:{session_id} = {
  "user_id": "uuid",
  "permissions": ["seat:read", "seat:write"],
  "created_at": "timestamp",
  "last_activity": "timestamp"
}
```

#### 实时订阅
```redis
# 用户订阅 (WebSocket 连接期间有效)
subscription:{connection_id} = {
  "user_id": "uuid",
  "topics": ["floor:1", "seat:updates"],
  "filters": {"floor_id": "uuid"}
}
```

## 性能优化

### 数据库优化

#### 索引策略
```sql
-- 座位查询优化
CREATE INDEX idx_seats_status_floor ON seats (status, floor_id);
CREATE INDEX idx_seats_user ON seats (occupied_by) WHERE occupied_by IS NOT NULL;

-- 楼层查询优化
CREATE INDEX idx_floors_building ON floors (building_id);

-- 用户权限查询优化
CREATE INDEX idx_user_permissions_user ON user_permissions (user_id);
```

#### 查询优化
- **预处理语句**: 减少 SQL 解析开销
- **批量查询**: 减少网络往返次数
- **连接池**: 复用数据库连接
- **读写分离**: 读操作使用只读副本

### 缓存策略

#### 多层缓存
1. **应用缓存**: 内存中的热点数据
2. **Redis 缓存**: 分布式缓存层
3. **CDN 缓存**: 静态资源缓存

#### 缓存模式
- **Cache-Aside**: 应用控制缓存更新
- **Write-Through**: 同步写入缓存和数据库
- **Write-Behind**: 异步写入数据库

### WebSocket 优化

#### 连接管理
- **连接池**: 复用 WebSocket 连接
- **负载均衡**: 均匀分发连接负载
- **心跳检测**: 及时发现断开连接
- **优雅关闭**: 避免连接泄漏

#### 消息优化
- **批量发送**: 减少网络开销
- **消息压缩**: 减少传输数据量
- **优先级队列**: 重要消息优先处理
- **去重机制**: 避免重复消息

## 安全架构

### 认证授权

#### JWT 令牌结构
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "iat": 1640995200,
    "exp": 1640998800,
    "permissions": ["seat:read", "seat:write"],
    "session_id": "session_uuid"
  }
}
```

#### 权限模型
```typescript
interface Permission {
  resource: string    // 资源类型 (seat, floor, user)
  action: string      // 操作类型 (read, write, delete)
  conditions?: any    // 条件限制
}

interface Role {
  name: string
  permissions: Permission[]
  inherits?: string[] // 继承其他角色
}
```

### 数据保护

#### 加密算法
- **对称加密**: AES-256-GCM (数据加密)
- **非对称加密**: RSA-2048 (密钥交换)
- **哈希算法**: bcrypt (密码哈希)
- **消息认证**: HMAC-SHA256 (消息完整性)

#### 敏感数据处理
```typescript
interface SensitiveData {
  seatCoordinates: EncryptedString    // 座位坐标
  employeeId: EncryptedString         // 员工工号
  personalInfo: EncryptedString       // 个人信息
  apiKeys: EncryptedString            // API 密钥
}
```

### 网络安全

#### 传输安全
- **HTTPS**: 所有 HTTP 通信加密
- **WSS**: WebSocket 连接加密
- **HSTS**: 强制 HTTPS 访问
- **CSP**: 内容安全策略

#### 攻击防护
- **SQL 注入**: 参数化查询
- **XSS 攻击**: 输入验证和输出编码
- **CSRF 攻击**: CSRF 令牌验证
- **DDoS 攻击**: 速率限制和流量清洗

## 监控告警

### 监控指标

#### 应用指标
```typescript
interface ApplicationMetrics {
  // WebSocket 指标
  wsConnectionsTotal: number
  wsMessagesPerSecond: number
  wsConnectionDuration: number
  
  // 数据库指标
  dbConnectionsActive: number
  dbQueryDuration: number
  dbSlowQueries: number
  
  // 缓存指标
  redisMemoryUsage: number
  redisHitRate: number
  redisConnectionsActive: number
  
  // 业务指标
  seatLockRatio: number
  seatOccupancyRate: number
  userActiveCount: number
}
```

#### 系统指标
- **CPU 使用率**: 应用和数据库服务器
- **内存使用率**: 堆内存和非堆内存
- **磁盘 I/O**: 读写速率和延迟
- **网络 I/O**: 带宽使用和连接数

### 告警规则

#### 关键告警
```yaml
alerts:
  - name: HighErrorRate
    condition: error_rate > 0.01
    duration: 5m
    severity: critical
    
  - name: DatabaseSlowQuery
    condition: db_query_duration_p99 > 500ms
    duration: 2m
    severity: warning
    
  - name: RedisMemoryHigh
    condition: redis_memory_usage > 0.8
    duration: 5m
    severity: warning
    
  - name: WebSocketConnectionsHigh
    condition: ws_connections_total > 9000
    duration: 1m
    severity: info
```

### 日志管理

#### 日志级别
- **ERROR**: 系统错误和异常
- **WARN**: 警告信息和性能问题
- **INFO**: 重要业务事件
- **DEBUG**: 调试信息 (仅开发环境)

#### 结构化日志
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "websocket-manager",
  "traceId": "abc123",
  "userId": "user-456",
  "action": "seat_select",
  "seatId": "seat-789",
  "duration": 120,
  "success": true
}
```

## 部署架构

### 容器化部署

#### Docker 镜像
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000 8080
CMD ["npm", "run", "start:prod"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
      
  postgres:
    image: postgis/postgis:13-3.1
    environment:
      POSTGRES_DB: seating_chart
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:6-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
```

### Kubernetes 部署

#### 部署清单
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seating-chart-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: seating-chart
  template:
    metadata:
      labels:
        app: seating-chart
    spec:
      containers:
      - name: app
        image: seating-chart:v2.1.0
        ports:
        - containerPort: 3000
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

#### 服务配置
```yaml
apiVersion: v1
kind: Service
metadata:
  name: seating-chart-service
spec:
  selector:
    app: seating-chart
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 8080
    targetPort: 8080
  type: LoadBalancer
```

## 扩展性设计

### 水平扩展

#### 无状态设计
- **应用服务器**: 无状态，支持多实例部署
- **会话存储**: Redis 集群存储会话数据
- **文件存储**: 对象存储服务 (S3/OSS)

#### 负载均衡
- **应用层**: Nginx/Kong 负载均衡
- **数据库层**: 读写分离，读副本扩展
- **缓存层**: Redis 集群分片

### 微服务架构

#### 服务拆分
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   User Service  │  │  Seat Service   │  │ Floor Service   │
│                 │  │                 │  │                 │
│ - Authentication│  │ - Seat CRUD     │  │ - Floor CRUD    │
│ - Authorization │  │ - Seat Locking  │  │ - Spatial Query │
│ - User Profile  │  │ - Status Sync   │  │ - Floor Plan    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌─────────────────┐
                    │ Gateway Service │
                    │                 │
                    │ - API Gateway   │
                    │ - Load Balance  │
                    │ - Rate Limiting │
                    └─────────────────┘
```

#### 服务通信
- **同步通信**: gRPC/HTTP API
- **异步通信**: 消息队列 (RabbitMQ/Kafka)
- **服务发现**: Consul/Eureka
- **配置中心**: Apollo/Nacos

## 技术决策记录 (ADR)

### ADR-001: 选择 WebSocket 作为实时通信协议

**状态**: 已接受

**背景**: 需要实现座位状态的实时同步

**决策**: 使用 WebSocket 协议

**理由**:
- 低延迟双向通信
- 浏览器原生支持
- 成熟的生态系统

**后果**:
- 需要处理连接管理复杂性
- 需要实现心跳和重连机制

### ADR-002: 选择 PostgreSQL + PostGIS 作为主数据库

**状态**: 已接受

**背景**: 需要存储座位的空间位置信息

**决策**: 使用 PostgreSQL + PostGIS

**理由**:
- 强大的空间数据支持
- ACID 事务保证
- 丰富的索引类型

**后果**:
- 需要学习 PostGIS 空间函数
- 数据库迁移相对复杂

### ADR-003: 选择 Redis 作为缓存和会话存储

**状态**: 已接受

**背景**: 需要高性能的缓存和分布式锁

**决策**: 使用 Redis

**理由**:
- 高性能内存存储
- 丰富的数据结构
- 支持分布式锁

**后果**:
- 需要考虑数据持久化
- 内存使用需要监控

---

**文档维护者**: 架构团队  
**最后更新**: 2024-01-XX  
**版本**: v2.1.0