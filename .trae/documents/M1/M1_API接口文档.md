# 部门地图 M1 阶段 API接口文档

***

**文档版本**: M1.1.0\
**创建日期**: 2025-09-7\
**最后更新**: 2024-09-7\
**更新内容**: 完善API接口定义和错误处理规范
--------------------------

## 1. API概述

### 1.1 基础信息

* **Base URL**: `http://localhost:3000/api`

* **API版本**: v1

* **数据格式**: JSON

* **字符编码**: UTF-8

* **认证方式**: JWT Bearer Token

### 1.2 通用响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;           // 请求是否成功
  data?: T;                  // 响应数据
  message?: string;          // 响应消息
  error?: {                  // 错误信息
    code: string;            // 错误代码
    message: string;         // 错误描述
    details?: any;           // 错误详情
  };
  pagination?: {             // 分页信息
    page: number;            // 当前页码
    limit: number;           // 每页数量
    total: number;           // 总记录数
    totalPages: number;      // 总页数
  };
  timestamp: number;         // 响应时间戳
}
```

### 1.3 HTTP状态码规范

| 状态码 | 含义                    | 使用场景     |
| --- | --------------------- | -------- |
| 200 | OK                    | 请求成功     |
| 201 | Created               | 资源创建成功   |
| 400 | Bad Request           | 请求参数错误   |
| 401 | Unauthorized          | 未认证或认证失败 |
| 403 | Forbidden             | 权限不足     |
| 404 | Not Found             | 资源不存在    |
| 409 | Conflict              | 资源冲突     |
| 422 | Unprocessable Entity  | 数据验证失败   |
| 500 | Internal Server Error | 服务器内部错误  |

## 2. 认证相关API

### 2.1 用户登录

**接口地址**: `POST /auth/login`

**请求参数**:

```typescript
interface LoginRequest {
  username: string;    // 用户名，必填，3-50字符
  password: string;    // 密码，必填，6-100字符
  remember?: boolean;  // 是否记住登录，可选，默认false
}
```

**响应数据**:

```typescript
interface LoginResponse {
  user: {
    id: number;
    username: string;
    name: string;
    email?: string;
    role: 'admin' | 'user';
  };
  token: string;       // JWT访问令牌
  refreshToken: string; // 刷新令牌
  expiresIn: number;   // 令牌过期时间(秒)
}
```

**请求示例**:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "123456",
    "remember": true
  }'
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "name": "管理员",
      "email": "admin@company.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  },
  "message": "登录成功",
  "timestamp": 1642694400000
}
```

### 2.2 刷新令牌

**接口地址**: `POST /auth/refresh`

**请求参数**:

```typescript
interface RefreshRequest {
  refreshToken: string;  // 刷新令牌
}
```

**响应数据**:

```typescript
interface RefreshResponse {
  token: string;         // 新的访问令牌
  expiresIn: number;     // 令牌过期时间
}
```

### 2.3 用户登出

**接口地址**: `POST /auth/logout`

**请求头**: `Authorization: Bearer {token}`

**响应数据**: 无特殊数据，仅返回成功状态

## 3. 地图数据API

### 3.1 获取地图列表

**接口地址**: `GET /maps`

**查询参数**:

```typescript
interface MapsQuery {
  deptId?: number;     // 部门ID筛选
  type?: 'svg' | 'png' | 'json';  // 地图类型筛选
  page?: number;       // 页码，默认1
  limit?: number;      // 每页数量，默认10
}
```

**响应数据**:

```typescript
interface Map {
  id: string;          // 地图ID
  type: 'svg' | 'png' | 'json';  // 地图类型
  url: string;         // 地图文件URL
  deptId?: number;     // 关联部门ID
  deptName?: string;   // 部门名称
  createdAt: string;   // 创建时间
  updatedAt: string;   // 更新时间
}

type MapsResponse = Map[];
```

**请求示例**:

```bash
curl -X GET "http://localhost:3000/api/maps?deptId=1&type=svg" \
  -H "Authorization: Bearer {token}"
```

### 3.2 获取指定地图

**接口地址**: `GET /maps/:id`

**路径参数**:

* `id`: 地图ID

**响应数据**: 单个地图对象

### 3.3 上传地图文件

**接口地址**: `POST /maps`

**请求类型**: `multipart/form-data`

**请求参数**:

```typescript
interface UploadMapRequest {
  file: File;          // 地图文件
  deptId?: number;     // 关联部门ID
  type: 'svg' | 'png' | 'json';  // 地图类型
}
```

**响应数据**: 创建的地图对象

## 4. 部门管理API

### 4.1 获取部门列表

**接口地址**: `GET /departments`

**查询参数**:

```typescript
interface DepartmentsQuery {
  floor?: string;      // 楼层筛选
  includeStats?: boolean;  // 是否包含统计信息
  page?: number;
  limit?: number;
}
```

**响应数据**:

```typescript
interface Department {
  id: number;
  name: string;
  floor?: string;
  mapId?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {            // 统计信息（当includeStats=true时）
    totalDesks: number;
    occupiedDesks: number;
    onlineEmployees: number;
    totalEmployees: number;
  };
}

type DepartmentsResponse = Department[];
```

### 4.2 获取部门详情

**接口地址**: `GET /departments/:id`

**路径参数**:

* `id`: 部门ID

**查询参数**:

```typescript
interface DepartmentDetailQuery {
  includeDesks?: boolean;     // 是否包含工位信息
  includeEmployees?: boolean; // 是否包含员工信息
  includeMap?: boolean;       // 是否包含地图信息
}
```

## 5. 工位管理API

### 5.1 获取工位列表

**接口地址**: `GET /desks`

**查询参数**:

```typescript
interface DesksQuery {
  deptId?: number;     // 部门ID筛选
  status?: 'occupied' | 'vacant';  // 工位状态筛选
  include?: string;    // 关联查询，逗号分隔：employee,assignment,department
  page?: number;
  limit?: number;
}
```

**响应数据**:

```typescript
interface Desk {
  id: string;
  label: string;
  deptId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: string;
  // 关联数据（根据include参数）
  department?: Department;
  employee?: Employee;
  assignment?: Assignment;
  status?: 'online' | 'offline' | 'vacant';
}

type DesksResponse = Desk[];
```

### 5.2 按部门获取工位

**接口地址**: `GET /desks/by-dept/:deptId`

**路径参数**:

* `deptId`: 部门ID

**查询参数**:

```typescript
interface DesksByDeptQuery {
  include?: string;    // 关联查询：employee,assignment,status
  activeOnly?: boolean; // 仅返回有效分配的工位
}
```

**请求示例**:

```bash
curl -X GET "http://localhost:3000/api/desks/by-dept/1?include=employee,assignment&activeOnly=true" \
  -H "Authorization: Bearer {token}"
```

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": "ENG-001",
      "label": "E01",
      "deptId": 1,
      "x": 100,
      "y": 100,
      "w": 60,
      "h": 40,
      "employee": {
        "id": 1,
        "name": "张三",
        "title": "前端工程师",
        "email": "zhangsan@company.com"
      },
      "assignment": {
        "id": 1,
        "active": true,
        "assignedAt": "2024-01-15T08:00:00Z"
      },
      "status": "online"
    }
  ],
  "timestamp": 1642694400000
}
```

### 5.3 创建工位

**接口地址**: `POST /desks`

**请求参数**:

```typescript
interface CreateDeskRequest {
  id: string;          // 工位ID，必填
  label: string;       // 工位标签，必填
  deptId: number;      // 部门ID，必填
  x: number;           // X坐标，必填
  y: number;           // Y坐标，必填
  w?: number;          // 宽度，可选，默认60
  h?: number;          // 高度，可选，默认40
}
```

### 5.4 更新工位信息

**接口地址**: `PUT /desks/:id`

**路径参数**:

* `id`: 工位ID

**请求参数**: 与创建工位相同，但所有字段都是可选的

### 5.5 删除工位

**接口地址**: `DELETE /desks/:id`

**路径参数**:

* `id`: 工位ID

## 6. 员工管理API

### 6.1 获取员工列表

**接口地址**: `GET /employees`

**查询参数**:

```typescript
interface EmployeesQuery {
  deptId?: number;     // 部门ID筛选
  status?: 'online' | 'offline';  // 在线状态筛选
  hasDesk?: boolean;   // 是否已分配工位
  include?: string;    // 关联查询：department,desk,assignment
  page?: number;
  limit?: number;
}
```

**响应数据**:

```typescript
interface Employee {
  id: number;
  name: string;
  deptId: number;
  title?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  // 关联数据
  department?: Department;
  desk?: Desk;
  assignment?: Assignment;
  status?: 'online' | 'offline';
}

type EmployeesResponse = Employee[];
```

### 6.2 员工搜索

**接口地址**: `GET /employees/search`

**查询参数**:

```typescript
interface EmployeeSearchQuery {
  q: string;           // 搜索关键词，必填
  deptId?: number;     // 部门ID筛选
  fields?: string;     // 搜索字段，逗号分隔：name,title,email
  limit?: number;      // 结果数量限制，默认10
}
```

**响应数据**:

```typescript
interface EmployeeSearchResult {
  id: number;
  name: string;
  title?: string;
  department: string;
  deskId?: string;
  x?: number;          // 工位X坐标
  y?: number;          // 工位Y坐标
  status: 'online' | 'offline';
  matchField: string;  // 匹配的字段
}

type EmployeeSearchResponse = EmployeeSearchResult[];
```

**请求示例**:

```bash
curl -X GET "http://localhost:3000/api/employees/search?q=张三&deptId=1&limit=5" \
  -H "Authorization: Bearer {token}"
```

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "张三",
      "title": "前端工程师",
      "department": "Engineering",
      "deskId": "ENG-001",
      "x": 100,
      "y": 100,
      "status": "online",
      "matchField": "name"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 1,
    "totalPages": 1
  },
  "timestamp": 1642694400000
}
```

### 6.3 获取员工详情

**接口地址**: `GET /employees/:id`

**路径参数**:

* `id`: 员工ID

**查询参数**:

```typescript
interface EmployeeDetailQuery {
  include?: string;    // 关联查询：department,desk,assignment,history
}
```

### 6.4 创建员工

**接口地址**: `POST /employees`

**请求参数**:

```typescript
interface CreateEmployeeRequest {
  name: string;        // 姓名，必填，2-50字符
  deptId: number;      // 部门ID，必填
  title?: string;      // 职位，可选，最大100字符
  email?: string;      // 邮箱，可选，有效邮箱格式
  phone?: string;      // 电话，可选，有效电话格式
}
```

### 6.5 更新员工信息

**接口地址**: `PUT /employees/:id`

**路径参数**:

* `id`: 员工ID

**请求参数**: 与创建员工相同，但所有字段都是可选的

### 6.6 删除员工

**接口地址**: `DELETE /employees/:id`

**路径参数**:

* `id`: 员工ID

## 7. 工位分配API

### 7.1 分配工位

**接口地址**: `POST /assignments`

**请求参数**:

```typescript
interface CreateAssignmentRequest {
  employeeId: number;  // 员工ID，必填
  deskId: string;      // 工位ID，必填
  active?: boolean;    // 是否激活，可选，默认true
}
```

**响应数据**:

```typescript
interface Assignment {
  id: number;
  employeeId: number;
  deskId: string;
  active: boolean;
  assignedAt: string;
  employee?: Employee;
  desk?: Desk;
}
```

### 7.2 取消工位分配

**接口地址**: `DELETE /assignments/:id`

**路径参数**:

* `id`: 分配记录ID

### 7.3 获取分配历史

**接口地址**: `GET /assignments/history`

**查询参数**:

```typescript
interface AssignmentHistoryQuery {
  employeeId?: number; // 员工ID筛选
  deskId?: string;     // 工位ID筛选
  active?: boolean;    // 是否激活筛选
  dateFrom?: string;   // 开始日期
  dateTo?: string;     // 结束日期
  page?: number;
  limit?: number;
}
```

## 8. 状态同步API

### 8.1 心跳上报

**接口地址**: `POST /status/heartbeat`

**请求参数**:

```typescript
interface HeartbeatRequest {
  userId: number;      // 用户ID，必填
  deskId?: string;     // 当前工位ID，可选
  status?: 'online' | 'busy' | 'away';  // 状态，可选，默认online
  metadata?: {         // 额外信息，可选
    userAgent?: string;
    ipAddress?: string;
    location?: {
      lat: number;
      lng: number;
    };
  };
}
```

**响应数据**:

```typescript
interface HeartbeatResponse {
  userId: number;
  status: string;
  lastSeen: number;    // 时间戳
  deskId?: string;
  ttl: number;         // 缓存过期时间(秒)
}
```

### 8.2 获取在线状态

**接口地址**: `GET /status/online`

**查询参数**:

```typescript
interface OnlineStatusQuery {
  deptId?: number;     // 部门ID筛选
  userIds?: string;    // 用户ID列表，逗号分隔
}
```

**响应数据**:

```typescript
interface OnlineStatus {
  userId: number;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen: number;
  deskId?: string;
  name?: string;
  department?: string;
}

type OnlineStatusResponse = OnlineStatus[];
```

### 8.3 获取部门状态统计

**接口地址**: `GET /status/dept/:id`

**路径参数**:

* `id`: 部门ID

**响应数据**:

```typescript
interface DepartmentStatus {
  deptId: number;
  deptName: string;
  total: number;       // 总员工数
  online: number;      // 在线员工数
  offline: number;     // 离线员工数
  busy: number;        // 忙碌员工数
  away: number;        // 离开员工数
  occupiedDesks: number;  // 已占用工位数
  totalDesks: number;     // 总工位数
  lastUpdated: number;    // 最后更新时间
}
```

## 9. 系统管理API

### 9.1 健康检查

**接口地址**: `GET /health`

**响应数据**:

```typescript
interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: number;
  uptime: number;      // 运行时间(秒)
  version: string;     // API版本
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    storage: 'ok' | 'error';
  };
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}
```

### 9.2 系统信息

**接口地址**: `GET /system/info`

**权限要求**: 管理员

**响应数据**:

```typescript
interface SystemInfo {
  version: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  loadAverage: number[];
}
```

## 10. 错误处理

### 10.1 错误代码规范

| 错误代码          | HTTP状态码 | 描述      | 示例        |
| ------------- | ------- | ------- | --------- |
| AUTH\_001     | 401     | 认证失败    | 用户名或密码错误  |
| AUTH\_002     | 401     | Token无效 | JWT令牌已过期  |
| AUTH\_003     | 403     | 权限不足    | 需要管理员权限   |
| VALID\_001    | 400     | 参数验证失败  | 用户名不能为空   |
| VALID\_002    | 422     | 数据格式错误  | 邮箱格式不正确   |
| RESOURCE\_001 | 404     | 资源不存在   | 员工不存在     |
| RESOURCE\_002 | 409     | 资源冲突    | 工位已被占用    |
| SYSTEM\_001   | 500     | 数据库错误   | 数据库连接失败   |
| SYSTEM\_002   | 500     | 缓存错误    | Redis连接失败 |

### 10.2 错误响应示例

**参数验证错误**:

```json
{
  "success": false,
  "error": {
    "code": "VALID_001",
    "message": "参数验证失败",
    "details": {
      "field": "name",
      "value": "",
      "constraint": "姓名不能为空"
    }
  },
  "timestamp": 1642694400000
}
```

**资源不存在错误**:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_001",
    "message": "员工不存在",
    "details": {
      "employeeId": 999
    }
  },
  "timestamp": 1642694400000
}
```

## 11. 数据验证规则

### 11.1 通用验证规则

```typescript
// 字符串长度验证
interface StringValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  required?: boolean;
}

// 数字范围验证
interface NumberValidation {
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
}

// 邮箱验证
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 电话验证
const phonePattern = /^1[3-9]\d{9}$/;
```

### 11.2 具体字段验证

| 字段          | 类型     | 验证规则           |
| ----------- | ------ | -------------- |
| username    | string | 3-50字符，字母数字下划线 |
| password    | string | 6-100字符        |
| name        | string | 2-50字符，非空      |
| email       | string | 有效邮箱格式         |
| phone       | string | 11位手机号码        |
| deskId      | string | 3-20字符，字母数字连字符 |
| coordinates | number | x,y坐标 >= 0     |
| dimensions  | number | w,h尺寸 > 0      |

## 12. 性能要求

### 12.1 响应时间要求

| API类型    | 响应时间要求  | 备注     |
| -------- | ------- | ------ |
| 认证API    | < 100ms | 高频调用   |
| 查询API    | < 200ms | 一般查询   |
| 搜索API    | < 300ms | 复杂查询   |
| 创建/更新API | < 500ms | 数据写入   |
| 文件上传API  | < 2s    | 依赖文件大小 |

### 12.2 并发要求

* 支持100个并发用户

* 心跳API支持500次/分钟

* 搜索API限制10次/分钟/用户

* 文件上传限制5次/分钟/用户

### 12.3 缓存策略

| 数据类型   | 缓存时间 | 缓存键格式                   |
| ------ | ---- | ----------------------- |
| 用户在线状态 | 5分钟  | `presence:{userId}`     |
| 部门工位数据 | 10分钟 | `dept:{deptId}:desks`   |
| 员工信息   | 30分钟 | `employee:{employeeId}` |
| 部门统计   | 5分钟  | `stats:dept:{deptId}`   |

***

**API接口约束**：

* 所有API必须实现认证和授权

* 响应时间不得超过规定要求

* 必须提供完整的错误处理

* 支持API版本控制

* 实现请求限流和防护机制

* 提供完整的API文档和测试用例

