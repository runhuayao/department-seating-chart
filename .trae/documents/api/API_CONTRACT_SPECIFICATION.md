# API契约规范 - 部门地图管理系统

**版本**: v3.2.0  
**创建时间**: 2024-12-29  
**适用范围**: 所有API端点  
**设计原则**: RESTful架构 + 标准化响应

---

## 📋 API设计标准

### 🎯 设计原则

1. **RESTful架构**: 遵循REST设计原则
2. **统一响应格式**: 标准化的JSON响应结构
3. **语义化HTTP方法**: 正确使用GET、POST、PUT、DELETE
4. **标准状态码**: 遵循HTTP状态码语义
5. **向后兼容**: 保证API版本兼容性

---

## 🔗 HTTP方法规范

### GET - 数据查询
```http
GET /api/workstations          # 获取工位列表
GET /api/workstations/:id      # 获取特定工位
GET /api/employees             # 获取员工列表
GET /api/departments           # 获取部门列表
GET /api/search?q=keyword      # 搜索功能
```

**特点**:
- 幂等操作，多次调用结果相同
- 不修改服务器状态
- 支持查询参数过滤和分页

### POST - 资源创建
```http
POST /api/workstations         # 创建新工位
POST /api/employees            # 创建新员工
POST /api/auth/login           # 用户登录
POST /api/database/sync        # 触发数据同步
```

**特点**:
- 创建新资源
- 非幂等操作
- 返回创建的资源信息

### PUT - 资源更新
```http
PUT /api/workstations/:id      # 更新工位信息
PUT /api/employees/:id         # 更新员工信息
```

**特点**:
- 完整资源更新
- 幂等操作
- 需要完整的资源数据

### DELETE - 资源删除
```http
DELETE /api/workstations/:id   # 删除工位
DELETE /api/employees/:id      # 删除员工
```

**特点**:
- 删除指定资源
- 幂等操作
- 返回删除确认

---

## 📊 HTTP状态码标准

### 2xx 成功响应
- **200 OK**: 请求成功，返回数据
- **201 Created**: 资源创建成功
- **204 No Content**: 操作成功，无返回内容

### 4xx 客户端错误
- **400 Bad Request**: 请求参数错误
- **401 Unauthorized**: 未认证
- **403 Forbidden**: 权限不足
- **404 Not Found**: 资源不存在
- **409 Conflict**: 资源冲突
- **422 Unprocessable Entity**: 数据验证失败
- **429 Too Many Requests**: 请求频率超限

### 5xx 服务器错误
- **500 Internal Server Error**: 服务器内部错误
- **502 Bad Gateway**: 网关错误
- **503 Service Unavailable**: 服务不可用
- **504 Gateway Timeout**: 网关超时

---

## 📝 请求响应结构标准

### 标准成功响应
```json
{
  "success": true,
  "data": {
    // 实际数据内容
  },
  "message": "操作成功",
  "timestamp": "2024-12-29T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

### 标准错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": {
      "field": "name",
      "reason": "字段不能为空"
    }
  },
  "timestamp": "2024-12-29T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

### 分页响应结构
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "message": "查询成功",
  "timestamp": "2024-12-29T10:30:00.000Z"
}
```

---

## 🛡️ 错误处理机制

### 错误分类

#### 1. 验证错误 (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据验证失败",
    "details": {
      "fields": {
        "name": "姓名不能为空",
        "email": "邮箱格式不正确"
      }
    }
  }
}
```

#### 2. 认证错误 (401)
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "认证失败，请重新登录",
    "details": {
      "reason": "token_expired"
    }
  }
}
```

#### 3. 权限错误 (403)
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "权限不足，无法执行此操作",
    "details": {
      "required_role": "admin",
      "current_role": "user"
    }
  }
}
```

#### 4. 资源错误 (404)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "请求的资源不存在",
    "details": {
      "resource": "workstation",
      "id": "ws_123"
    }
  }
}
```

#### 5. 服务器错误 (500)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "服务器内部错误",
    "details": {
      "errorId": "err_123456789"
    }
  }
}
```

---

## 📚 API端点规范

### 健康检查端点
```http
GET /api/health              # 完整健康检查
GET /api/health/simple       # 简单健康检查
GET /api/health/ready        # 就绪检查
GET /api/health/live         # 存活检查
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "up",
      "redis": "up",
      "websocket": "up"
    },
    "uptime": 3600,
    "version": "v3.2.0"
  }
}
```

### 工位管理端点
```http
GET /api/workstations                    # 获取工位列表
GET /api/workstations/:id               # 获取特定工位
POST /api/workstations                  # 创建新工位
PUT /api/workstations/:id               # 更新工位信息
DELETE /api/workstations/:id            # 删除工位
```

**创建工位请求**:
```json
{
  "name": "开发部-001",
  "department": "开发部",
  "ipAddress": "192.168.1.100",
  "position": {
    "x": 100,
    "y": 200,
    "width": 80,
    "height": 60
  },
  "equipment": {
    "monitor": "双显示器",
    "computer": "台式机"
  }
}
```

**工位信息响应**:
```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "开发部-001",
    "department": "开发部",
    "status": "available",
    "employee": null,
    "position": {
      "x": 100,
      "y": 200,
      "width": 80,
      "height": 60
    },
    "createdAt": "2024-12-29T10:00:00.000Z",
    "updatedAt": "2024-12-29T10:00:00.000Z"
  }
}
```

### 员工管理端点
```http
GET /api/employees                      # 获取员工列表
GET /api/employees/:id                  # 获取特定员工
POST /api/employees                     # 创建新员工
PUT /api/employees/:id                  # 更新员工信息
DELETE /api/employees/:id               # 删除员工
```

### 搜索端点
```http
GET /api/search?q=keyword               # 全局搜索
GET /api/search?q=keyword&type=employee # 员工搜索
GET /api/search?q=keyword&type=workstation # 工位搜索
```

**搜索响应**:
```json
{
  "success": true,
  "data": {
    "employees": [...],
    "workstations": [...],
    "total": 15,
    "query": "张三",
    "searchTime": 45
  }
}
```

---

## 🔐 认证和授权

### JWT Token格式
```json
{
  "sub": "user_123",
  "name": "张三",
  "role": "admin",
  "department": "开发部",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### 权限级别
- **admin**: 系统管理员，所有权限
- **manager**: 部门管理员，部门内权限
- **user**: 普通用户，只读权限

### 认证头部
```http
Authorization: Bearer <jwt_token>
```

---

## 🚀 性能和缓存

### 缓存策略
- **工位列表**: 5分钟TTL
- **员工信息**: 10分钟TTL
- **部门配置**: 30分钟TTL
- **搜索结果**: 2分钟TTL

### 性能指标
- **API响应时间**: P99 < 120ms
- **数据库查询**: P95 < 50ms
- **缓存命中率**: > 80%
- **并发支持**: 1000+ 请求/秒

---

## 📡 WebSocket规范

### 连接端点
```
ws://localhost:8080/socket.io
```

### 消息格式
```json
{
  "type": "workstation_update",
  "data": {
    "id": "ws_123",
    "status": "occupied",
    "employee": "张三"
  },
  "timestamp": "2024-12-29T10:30:00.000Z",
  "messageId": "msg_123456789"
}
```

### 事件类型
- `workstation_update`: 工位状态更新
- `employee_update`: 员工信息更新
- `system_notification`: 系统通知
- `heartbeat`: 心跳检测

---

## 🧪 API测试规范

### 测试用例结构
```javascript
describe('API端点测试', () => {
  test('GET /api/workstations - 获取工位列表', async () => {
    const response = await request(app)
      .get('/api/workstations')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### 测试覆盖要求
- **功能测试**: 100%端点覆盖
- **错误处理**: 所有错误场景
- **性能测试**: 响应时间验证
- **安全测试**: 认证和权限验证

---

## 🐳 Docker容器化规范

### Dockerfile标准
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### 环境变量
```env
NODE_ENV=production
PORT=8080
DB_HOST=postgres
DB_PORT=5432
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

### 健康检查
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health/simple || exit 1
```

---

## 📈 监控和日志

### 日志格式
```json
{
  "timestamp": "2024-12-29T10:30:00.000Z",
  "level": "info",
  "message": "API请求处理",
  "method": "GET",
  "url": "/api/workstations",
  "statusCode": 200,
  "responseTime": 45,
  "userAgent": "Mozilla/5.0...",
  "ip": "127.0.0.1"
}
```

### 监控指标
- **请求计数**: 按端点统计
- **响应时间**: P50, P95, P99
- **错误率**: 4xx, 5xx错误统计
- **并发连接**: WebSocket连接数

---

## 🔧 开发和调试

### 本地开发
```bash
# 启动开发服务器
npm run server:dev

# 测试API端点
curl http://localhost:8080/api/health/simple

# 查看日志
tail -f logs/api.log
```

### 调试工具
- **Postman**: API测试和调试
- **curl**: 命令行测试
- **Chrome DevTools**: 网络请求分析
- **Node.js Inspector**: 后端调试

---

## 📋 API契约检查清单

### 设计检查
- [ ] HTTP方法语义正确
- [ ] 状态码使用标准
- [ ] 响应格式统一
- [ ] 错误处理完善
- [ ] 认证授权正确

### 实现检查
- [ ] 参数验证完整
- [ ] 数据库操作安全
- [ ] 缓存策略合理
- [ ] 日志记录完整
- [ ] 性能指标达标

### 测试检查
- [ ] 单元测试覆盖
- [ ] 集成测试通过
- [ ] 性能测试达标
- [ ] 安全测试通过
- [ ] 兼容性测试通过

---

**API契约规范确保了系统的可维护性、可扩展性和开发者友好性** ✅