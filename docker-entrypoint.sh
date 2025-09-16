#!/bin/sh
set -e

# 颜色输出函数
red() { echo "\033[31m$1\033[0m"; }
green() { echo "\033[32m$1\033[0m"; }
yellow() { echo "\033[33m$1\033[0m"; }
blue() { echo "\033[34m$1\033[0m"; }

echo "$(blue '=== 部门地图系统启动脚本 ===')"
echo "$(blue '版本: v3.1.0')"
echo "$(blue '时间:')" $(date)
echo ""

# 等待数据库连接
wait_for_db() {
    echo "$(yellow '等待数据库连接...')"
    
    if [ -z "$DATABASE_URL" ]; then
        echo "$(red '错误: DATABASE_URL 环境变量未设置')"
        exit 1
    fi
    
    # 从DATABASE_URL解析连接信息
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        echo "$(red '错误: 无法解析数据库连接信息')"
        exit 1
    fi
    
    echo "$(blue '数据库地址:')" $DB_HOST:$DB_PORT
    
    # 等待数据库可用
    for i in $(seq 1 30); do
        if nc -z $DB_HOST $DB_PORT; then
            echo "$(green '数据库连接成功!')"
            return 0
        fi
        echo "$(yellow '等待数据库连接... ($i/30)')"
        sleep 2
    done
    
    echo "$(red '错误: 数据库连接超时')"
    exit 1
}

# 等待Redis连接
wait_for_redis() {
    echo "$(yellow '等待Redis连接...')"
    
    REDIS_HOST=${REDIS_HOST:-localhost}
    REDIS_PORT=${REDIS_PORT:-6379}
    
    echo "$(blue 'Redis地址:')" $REDIS_HOST:$REDIS_PORT
    
    # 等待Redis可用
    for i in $(seq 1 15); do
        if nc -z $REDIS_HOST $REDIS_PORT; then
            echo "$(green 'Redis连接成功!')"
            return 0
        fi
        echo "$(yellow '等待Redis连接... ($i/15)')"
        sleep 2
    done
    
    echo "$(red '错误: Redis连接超时')"
    exit 1
}

# 运行数据库迁移
run_migrations() {
    echo "$(yellow '运行数据库迁移...')"
    
    if [ -d "./migrations" ]; then
        echo "$(blue '发现迁移文件，开始执行...')"
        
        # 这里应该调用实际的迁移脚本
        # 由于使用Supabase，迁移通过API执行
        if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
            echo "$(blue '使用Supabase执行迁移')"
            # 实际的迁移逻辑会在应用启动时执行
        else
            echo "$(yellow '警告: Supabase配置未找到，跳过迁移')"
        fi
    else
        echo "$(yellow '未发现迁移文件，跳过迁移')"
    fi
}

# 初始化日志目录
init_logging() {
    echo "$(yellow '初始化日志系统...')"
    
    # 创建日志目录
    mkdir -p /app/logs
    
    # 设置日志轮转
    if [ ! -f "/app/logs/app.log" ]; then
        touch /app/logs/app.log
    fi
    
    echo "$(green '日志系统初始化完成')"
}

# 健康检查
health_check() {
    echo "$(yellow '执行启动前健康检查...')"
    
    # 检查必要的环境变量
    required_vars="NODE_ENV DATABASE_URL JWT_SECRET"
    for var in $required_vars; do
        if [ -z "$(eval echo \$$var)" ]; then
            echo "$(red '错误: 必需的环境变量')" $var "$(red '未设置')"
            exit 1
        fi
    done
    
    # 检查文件权限
    if [ ! -r "/app/package.json" ]; then
        echo "$(red '错误: 无法读取package.json')"
        exit 1
    fi
    
    echo "$(green '健康检查通过')"
}

# 设置信号处理
setup_signal_handlers() {
    # 优雅关闭处理
    trap 'echo "$(yellow "收到终止信号，正在优雅关闭...")" && kill -TERM $PID && wait $PID' TERM INT
}

# 主启动流程
main() {
    echo "$(blue '开始启动流程...')"
    
    # 设置信号处理
    setup_signal_handlers
    
    # 健康检查
    health_check
    
    # 等待依赖服务
    wait_for_db
    wait_for_redis
    
    # 初始化系统
    init_logging
    run_migrations
    
    echo "$(green '系统初始化完成，启动应用...')"
    echo ""
    
    # 启动应用
    exec "$@" &
    PID=$!
    wait $PID
}

# 如果是直接运行脚本
if [ "$1" = "pnpm" ] || [ "$1" = "npm" ] || [ "$1" = "node" ]; then
    main "$@"
else
    # 直接执行传入的命令
    exec "$@"
fi