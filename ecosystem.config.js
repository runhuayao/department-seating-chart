// PM2 生产环境配置文件
// 基于系统架构关联逻辑文档的微前端架构设计

module.exports = {
  apps: [
    {
      name: 'department-map-api',
      script: 'api/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 8080,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'department_map',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_PORT: process.env.DB_PORT || 5432,
        DB_NAME: process.env.DB_NAME || 'department_map',
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        REDIS_HOST: process.env.REDIS_HOST || 'localhost',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        JWT_SECRET: process.env.JWT_SECRET,
        CORS_ORIGIN: process.env.CORS_ORIGIN
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_file: 'logs/api-combined.log',
      time: true,
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 8000,
      health_check_grace_period: 3000
    },
    {
      name: 'department-map-frontend',
      script: 'serve',
      args: '-s dist -l 5173',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/frontend-error.log',
      out_file: 'logs/frontend-out.log',
      log_file: 'logs/frontend-combined.log',
      time: true,
      max_memory_restart: '200M',
      watch: false,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'server-management-system',
      script: 'serve',
      args: '-s server-management-dist -l 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/management-error.log',
      out_file: 'logs/management-out.log',
      log_file: 'logs/management-combined.log',
      time: true,
      max_memory_restart: '200M',
      watch: false,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ],

  // 部署配置
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server'],
      ref: 'origin/master',
      repo: 'git@github.com:your-repo/department-map.git',
      path: '/var/www/department-map',
      'post-deploy': 'npm install && npm run build:all && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },
    staging: {
      user: 'deploy',
      host: ['staging-server'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/department-map.git',
      path: '/var/www/department-map-staging',
      'post-deploy': 'npm install && npm run build:all && pm2 reload ecosystem.config.js --env staging'
    }
  },

  // 监控配置
  monitoring: {
    // PM2 Plus 监控配置
    pmx: true,
    network: true,
    ports: true
  }
};