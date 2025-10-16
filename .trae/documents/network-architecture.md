# 网络架构图解文档

## 四层网络模型架构图

### 系统整体架构

```mermaid
graph TB
    subgraph "应用层 (Application Layer)"
        A1[前端应用<br/>React + TypeScript<br/>Port: 5173]
        A2[后端API<br/>Node.js + Express<br/>Port: 8080]
        A3[M1管理界面<br/>Server Management<br/>Port: 5174]
        A4[GitLab CI/CD<br/>版本控制 & 部署]
    end
    
    subgraph "传输层 (Transport Layer)"
        T1[HTTP/HTTPS<br/>RESTful API]
        T2[WebSocket<br/>实时通信]
        T3[TCP连接<br/>数据库通信]
        T4[Redis协议<br/>缓存通信]
    end
    
    subgraph "网络层 (Network Layer)"
        N1[本地回环<br/>127.0.0.1/localhost]
        N2[局域网通信<br/>192.168.x.x/24]
        N3[路由转发<br/>端口映射]
        N4[防火墙规则<br/>端口访问控制]
    end
    
    subgraph "网络接口层 (Network Interface Layer)"
        I1[以太网接口<br/>物理网卡]
        I2[虚拟网络接口<br/>Docker Bridge]
        I3[本地回环接口<br/>Loopback]
    end
    
    subgraph "数据存储层"
        D1[(PostgreSQL<br/>主数据库<br/>Port: 5432)]
        D2[(Redis缓存<br/>内存数据库<br/>Port: 6379)]
        D3[内存备用模式<br/>SQLite/Memory]
    end
    
    %% 应用层连接
    A1 -->|HTTP请求| T1
    A2 -->|API响应| T1
    A1 -->|WebSocket| T2
    A2 -->|实时推送| T2
    A3 -->|管理接口| T1
    A4 -->|CI/CD部署| A2
    
    %% 传输层到网络层
    T1 --> N1
    T2 --> N1
    T3 --> N1
    T4 --> N1
    
    %% 网络层到接口层
    N1 --> I3
    N2 --> I1
    N3 --> I1
    N4 --> I1
    
    %% 数据库连接
    A2 -->|SQL查询| T3
    T3 --> D1
    A2 -->|缓存操作| T4
    T4 --> D2
    A2 -.->|降级模式| D3
    
    %% 样式定义
    classDef appLayer fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef transportLayer fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef networkLayer fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef interfaceLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef dataLayer fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    
    class A1,A2,A3,A4 appLayer
    class T1,T2,T3,T4 transportLayer
    class N1,N2,N3,N4 networkLayer
    class I1,I2,I3 interfaceLayer
    class D1,D2,D3 dataLayer
```

### 端口通信流向图

```mermaid
graph LR
    subgraph "客户端浏览器"
        Browser[Web Browser<br/>用户界面]
    end
    
    subgraph "前端服务 (localhost:5173)"
        Frontend[React应用<br/>Vite开发服务器]
    end
    
    subgraph "后端服务 (localhost:8080)"
        API[Express API服务器<br/>业务逻辑处理]
    end
    
    subgraph "管理界面 (localhost:5174)"
        Management[M1服务器管理<br/>系统监控]
    end
    
    subgraph "数据存储"
        Redis[(Redis缓存<br/>localhost:6379)]
        PostgreSQL[(PostgreSQL<br/>localhost:5432)]
    end
    
    subgraph "版本控制"
        GitLab[GitLab仓库<br/>CI/CD流水线]
    end
    
    %% 通信流向
    Browser -->|HTTP GET/POST| Frontend
    Frontend -->|API调用<br/>HTTP/HTTPS| API
    Browser -->|直接访问| Management
    Management -->|监控API| API
    
    API -->|数据查询<br/>SQL| PostgreSQL
    API -->|缓存读写<br/>Redis协议| Redis
    
    GitLab -->|代码推送<br/>Webhook| API
    GitLab -.->|自动部署| Frontend
    GitLab -.->|自动部署| Management
    
    %% 端口标注
    Frontend -.->|Port: 5173| Browser
    API -.->|Port: 8080| Frontend
    Management -.->|Port: 5174| Browser
    Redis -.->|Port: 6379| API
    PostgreSQL -.->|Port: 5432| API
```

### 局域网通信架构

```mermaid
graph TB
    subgraph "开发环境 (192.168.1.0/24)"
        subgraph "开发机 (192.168.1.100)"
            Dev1[前端开发<br/>:5173]
            Dev2[后端开发<br/>:8080]
            Dev3[Redis<br/>:6379]
            Dev4[PostgreSQL<br/>:5432]
        end
        
        subgraph "测试机 (192.168.1.101)"
            Test1[测试环境<br/>前端:5173]
            Test2[测试环境<br/>后端:8080]
        end
        
        subgraph "数据库服务器 (192.168.1.102)"
            DB1[(生产PostgreSQL<br/>:5432)]
            DB2[(Redis集群<br/>:6379-6381)]
        end
    end
    
    subgraph "生产环境 (192.168.2.0/24)"
        subgraph "Web服务器 (192.168.2.10)"
            Prod1[Nginx反向代理<br/>:80/:443]
            Prod2[Node.js应用<br/>:8080]
        end
        
        subgraph "数据库集群 (192.168.2.20-22)"
            ProdDB1[(PostgreSQL主库<br/>:5432)]
            ProdDB2[(PostgreSQL从库<br/>:5432)]
            ProdRedis[(Redis集群<br/>:6379)]
        end
    end
    
    subgraph "GitLab服务器 (192.168.3.10)"
        GitLabServer[GitLab CE<br/>:80/:22]
        GitLabRunner[GitLab Runner<br/>CI/CD执行器]
    end
    
    %% 网络连接
    Dev1 -->|开发调试| Dev2
    Dev2 -->|数据访问| Dev3
    Dev2 -->|数据访问| Dev4
    
    Test1 -->|测试API| Test2
    Test2 -->|测试数据| DB1
    Test2 -->|缓存测试| DB2
    
    Prod1 -->|负载均衡| Prod2
    Prod2 -->|生产数据| ProdDB1
    ProdDB1 -->|主从复制| ProdDB2
    Prod2 -->|缓存访问| ProdRedis
    
    GitLabServer -->|代码推送| Dev2
    GitLabRunner -->|自动部署| Prod2
    GitLabRunner -->|测试部署| Test2
    
    %% 跨网段通信
    Dev1 -.->|远程访问| Prod1
    Test2 -.->|集成测试| Prod2
```

## 技术栈详细说明

### 协议层级说明

#### 应用层协议
- **HTTP/HTTPS**: RESTful API通信协议
  - 前端与后端API交互
  - 支持GET、POST、PUT、DELETE等方法
  - 使用JSON格式数据交换
  
- **WebSocket**: 实时双向通信协议
  - 实时数据推送
  - 用户状态同步
  - 系统通知推送

- **GraphQL**: 查询语言和运行时（可选）
  - 灵活的数据查询
  - 减少网络请求次数
  - 类型安全的API

#### 传输层协议
- **TCP**: 可靠的传输控制协议
  - 数据库连接 (PostgreSQL)
  - Redis缓存连接
  - HTTP/HTTPS底层传输

- **TLS/SSL**: 传输层安全协议
  - HTTPS加密通信
  - 数据库连接加密
  - 证书验证

#### 网络层协议
- **IPv4**: 网络层协议
  - 本地回环: 127.0.0.1
  - 局域网: 192.168.x.x
  - 子网掩码: /24 (255.255.255.0)

- **ICMP**: 网络控制消息协议
  - 网络连通性测试 (ping)
  - 网络故障诊断

#### 数据链路层
- **以太网**: 局域网通信标准
  - MAC地址识别
  - 帧格式数据传输
  - 冲突检测机制

### GitLab集成架构

#### GitLab工作流程

```mermaid
graph LR
    subgraph "开发流程"
        A[本地开发] --> B[代码提交]
        B --> C[推送到GitLab]
        C --> D[触发CI/CD]
    end
    
    subgraph "GitLab CI/CD"
        D --> E[代码检查]
        E --> F[单元测试]
        F --> G[构建应用]
        G --> H[部署测试环境]
        H --> I[集成测试]
        I --> J[部署生产环境]
    end
    
    subgraph "部署目标"
        J --> K[前端部署<br/>Nginx/CDN]
        J --> L[后端部署<br/>Node.js服务器]
        J --> M[数据库迁移<br/>PostgreSQL]
    end
```

#### GitLab配置文件

**.gitlab-ci.yml 示例**:
```yaml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"
  POSTGRES_DB: "department_map"
  REDIS_URL: "redis://localhost:6379"

# 测试阶段
test:
  stage: test
  image: node:18
  services:
    - postgres:13
    - redis:6
  script:
    - npm install
    - npm run test
    - npm run test:e2e
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'

# 构建阶段
build:
  stage: build
  image: node:18
  script:
    - npm install
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

# 部署阶段
deploy:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache rsync openssh
    - rsync -avz dist/ user@server:/var/www/html/
  only:
    - main
```

### 网络安全配置

#### 防火墙规则
```bash
# Windows防火墙规则
New-NetFirewallRule -DisplayName "Node.js API" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
New-NetFirewallRule -DisplayName "React Dev Server" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
New-NetFirewallRule -DisplayName "Redis" -Direction Inbound -Protocol TCP -LocalPort 6379 -Action Allow
New-NetFirewallRule -DisplayName "PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow

# Linux iptables规则
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
iptables -A INPUT -p tcp --dport 5173 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT
```

#### 网络监控
```bash
# 端口监听状态
netstat -tulpn | grep -E ':(5173|8080|6379|5432)'

# 网络连接状态
ss -tuln | grep -E ':(5173|8080|6379|5432)'

# 实时网络流量监控
iftop -i eth0
```

### 性能优化配置

#### Redis性能调优
```conf
# redis.conf 性能配置
tcp-backlog 511
timeout 0
tcp-keepalive 300
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### PostgreSQL性能调优
```sql
-- postgresql.conf 关键配置
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 100
```

#### Nginx反向代理配置
```nginx
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 80;
    server_name department-map.local;
    
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 网络故障排除

### 常见网络问题诊断

#### 连接性测试
```bash
# 测试端口连通性
telnet localhost 8080
telnet localhost 5173
telnet localhost 6379
telnet localhost 5432

# 使用PowerShell测试
Test-NetConnection -ComputerName localhost -Port 8080
Test-NetConnection -ComputerName localhost -Port 5173

# 使用curl测试API
curl -I http://localhost:8080/api/health
curl -I http://localhost:5173
```

#### 网络延迟测试
```bash
# ping测试
ping -c 4 localhost
ping -c 4 192.168.1.1

# 路由跟踪
traceroute 192.168.1.1
tracert 192.168.1.1  # Windows
```

#### 带宽测试
```bash
# 使用iperf3测试带宽
iperf3 -s  # 服务器端
iperf3 -c 192.168.1.100  # 客户端

# 网络吞吐量测试
dd if=/dev/zero bs=1M count=1000 | nc 192.168.1.100 8080
```

### 监控和日志

#### 系统监控
```bash
# 实时系统监控
htop
top

# 网络接口监控
watch -n 1 'cat /proc/net/dev'

# 连接数监控
watch -n 1 'netstat -an | wc -l'
```

#### 日志分析
```bash
# Nginx访问日志
tail -f /var/log/nginx/access.log

# Node.js应用日志
tail -f logs/app.log

# PostgreSQL日志
tail -f /var/log/postgresql/postgresql-13-main.log

# Redis日志
tail -f /var/log/redis/redis-server.log
```

---

*本文档描述了部门地图管理系统的完整网络架构，包括四层网络模型、技术栈说明、GitLab集成方式以及性能优化配置。*