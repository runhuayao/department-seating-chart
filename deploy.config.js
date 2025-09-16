// 部署配置文件 - 基于系统架构关联逻辑文档优化

module.exports = {
  // 环境配置
  environments: {
    development: {
      ports: {
        frontend: 5173,        // 部门地图系统
        management: 3000,      // 服务器管理系统
        api: 8080             // 后端API服务
      },
      database: {
        host: 'localhost',
        port: 5432,
        database: 'department_map',
        maxConnections: 20,
        minConnections: 5,
        idleTimeout: 30000,
        connectionTimeout: 5000
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100
      },
      websocket: {
        maxConnections: 1000,
        maxConnectionsPerIP: 10,
        heartbeatInterval: 30000,
        connectionTimeout: 300000
      }
    },
    production: {
      ports: {
        frontend: 5173,
        management: 3000,
        api: 8080
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'department_map',
        maxConnections: 50,
        minConnections: 10,
        idleTimeout: 30000,
        connectionTimeout: 10000
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100
      },
      websocket: {
        maxConnections: 5000,
        maxConnectionsPerIP: 50,
        heartbeatInterval: 30000,
        connectionTimeout: 300000
      }
    }
  },

  // 系统架构配置
  architecture: {
    // 微前端架构配置
    microfrontend: {
      systems: [
        {
          name: '部门地图系统',
          port: 5173,
          entry: 'src/main.tsx',
          responsibilities: ['地图展示', '人员搜索', '工位管理'],
          pageType: '完整功能页面'
        },
        {
          name: '服务器管理系统',
          port: 3000,
          entry: 'src/server-management-main.tsx',
          responsibilities: ['服务器监控', '系统管理'],
          pageType: '完整M1服务器管理页面'
        },
        {
          name: '后端API服务',
          port: 8080,
          entry: 'api/server.ts',
          responsibilities: ['数据接口', '业务逻辑'],
          pageType: '仅API调用监控界面'
        }
      ]
    },

    // 数据流配置
    dataFlow: {
      // 主要数据流程（A→I）
      primary: {
        source: '3000端口服务器管理系统',
        target: '5173端口前端展示',
        steps: [
          '用户操作触发',
          '数据验证处理',
          '数据库更新',
          '变更事件触发',
          '缓存层同步',
          '实时推送',
          '前端接收',
          '状态同步',
          '界面刷新'
        ],
        maxLatency: 500 // ms
      },
      // 辅助数据流程
      auxiliary: [
        {
          name: '用户登录流程',
          source: '5173端口用户登录',
          target: '8080端口记录登录信息'
        },
        {
          name: '工位数据同步',
          source: '5173端口工位填写',
          target: '8080端口同步工位数据'
        }
      ]
    }
  },

  // 部署脚本配置
  deployment: {
    // 开发环境启动脚本
    development: {
      scripts: [
        'npm run dev:frontend',    // 启动5173端口
        'npm run dev:management',  // 启动3000端口
        'npm run dev:api'         // 启动8080端口
      ],
      healthCheck: {
        endpoints: [
          'http://localhost:5173/health',
          'http://localhost:3000/health',
          'http://localhost:8080/api/health'
        ],
        interval: 30000,
        timeout: 5000
      }
    },

    // 生产环境部署配置
    production: {
      buildCommands: [
        'npm run build:frontend',
        'npm run build:management',
        'npm run build:api'
      ],
      startCommands: [
        'pm2 start ecosystem.config.js --env production'
      ],
      healthCheck: {
        endpoints: [
          '/health',
          '/api/health',
          '/management/health'
        ],
        interval: 60000,
        timeout: 10000
      }
    }
  },

  // 监控配置
  monitoring: {
    metrics: {
      // 系统指标
      system: [
        'cpu_usage',
        'memory_usage',
        'disk_usage',
        'network_io'
      ],
      // 应用指标
      application: [
        'api_response_time',
        'api_success_rate',
        'websocket_connections',
        'database_connections'
      ],
      // 业务指标
      business: [
        'user_login_count',
        'search_requests',
        'data_sync_events'
      ]
    },
    alerts: {
      cpu: { threshold: 80, severity: 'warning' },
      memory: { threshold: 85, severity: 'warning' },
      api_response_time: { threshold: 2000, severity: 'critical' },
      database_connections: { threshold: 40, severity: 'warning' }
    }
  },

  // 安全配置
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 限制每个IP 15分钟内最多100个请求
      message: 'Too many requests from this IP'
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:']
        }
      }
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined',
    rotation: {
      maxSize: '10m',
      maxFiles: 5
    },
    destinations: [
      {
        type: 'file',
        filename: 'logs/app.log'
      },
      {
        type: 'console',
        colorize: true
      }
    ]
  }
};