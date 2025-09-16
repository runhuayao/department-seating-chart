#!/bin/bash

# 部门地图系统 v3.1.0 部署脚本
# 支持开发、测试、生产环境部署

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
APP_NAME="department-map"
APP_VERSION="v3.1.0"
DOCKER_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
DOCKER_NAMESPACE="your-namespace"
ENVIRONMENT=${1:-"development"}
ACTION=${2:-"deploy"}

# 环境配置
case $ENVIRONMENT in
    "development")
        COMPOSE_FILE="docker-compose.yml"
        ENV_FILE=".env.development"
        REPLICAS=1
        ;;
    "testing")
        COMPOSE_FILE="docker-compose.test.yml"
        ENV_FILE=".env.testing"
        REPLICAS=2
        ;;
    "production")
        COMPOSE_FILE="docker-compose.prod.yml"
        ENV_FILE=".env.production"
        REPLICAS=3
        ;;
    *)
        log_error "未知环境: $ENVIRONMENT"
        log_info "支持的环境: development, testing, production"
        exit 1
        ;;
esac

# 显示帮助信息
show_help() {
    cat << EOF
部门地图系统 v3.1.0 部署脚本

用法: $0 [环境] [操作]

环境:
  development  开发环境 (默认)
  testing      测试环境
  production   生产环境

操作:
  deploy       部署应用 (默认)
  build        构建镜像
  push         推送镜像
  pull         拉取镜像
  start        启动服务
  stop         停止服务
  restart      重启服务
  logs         查看日志
  status       查看状态
  clean        清理资源
  backup       备份数据
  restore      恢复数据
  update       更新应用
  rollback     回滚版本
  health       健康检查
  monitor      监控状态
  help         显示帮助

示例:
  $0 development deploy    # 部署到开发环境
  $0 production build      # 构建生产环境镜像
  $0 testing logs          # 查看测试环境日志
  $0 production backup     # 备份生产环境数据

EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Git
    if ! command -v git &> /dev/null; then
        log_warning "Git未安装，某些功能可能不可用"
    fi
    
    log_success "依赖检查完成"
}

# 检查环境文件
check_env_file() {
    log_info "检查环境配置文件..."
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.example" ]; then
            log_warning "环境文件 $ENV_FILE 不存在，从模板创建"
            cp .env.example "$ENV_FILE"
            log_warning "请编辑 $ENV_FILE 文件，配置正确的环境变量"
        else
            log_error "环境文件 $ENV_FILE 和模板文件 .env.example 都不存在"
            exit 1
        fi
    fi
    
    # 检查必要的环境变量
    source "$ENV_FILE"
    
    required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "SUPABASE_URL" "SUPABASE_ANON_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "环境变量 $var 未设置，请检查 $ENV_FILE 文件"
            exit 1
        fi
    done
    
    log_success "环境配置检查完成"
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    # 构建应用镜像
    docker build -t "$APP_NAME:$APP_VERSION" .
    docker build -t "$APP_NAME:latest" .
    
    # 如果是生产环境，添加registry标签
    if [ "$ENVIRONMENT" = "production" ]; then
        docker tag "$APP_NAME:$APP_VERSION" "$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$APP_NAME:$APP_VERSION"
        docker tag "$APP_NAME:latest" "$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$APP_NAME:latest"
    fi
    
    log_success "镜像构建完成"
}

# 推送镜像
push_image() {
    log_info "推送Docker镜像到仓库..."
    
    if [ "$ENVIRONMENT" != "production" ]; then
        log_warning "非生产环境，跳过镜像推送"
        return
    fi
    
    # 登录Docker仓库
    docker login "$DOCKER_REGISTRY"
    
    # 推送镜像
    docker push "$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$APP_NAME:$APP_VERSION"
    docker push "$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$APP_NAME:latest"
    
    log_success "镜像推送完成"
}

# 拉取镜像
pull_image() {
    log_info "拉取Docker镜像..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker pull "$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$APP_NAME:$APP_VERSION"
    else
        log_info "开发/测试环境使用本地镜像"
    fi
    
    log_success "镜像拉取完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 创建必要的目录
    mkdir -p logs uploads temp backups
    
    # 设置权限
    chmod 755 logs uploads temp backups
    
    # 启动服务
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    check_health
    
    log_success "服务启动完成"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    
    log_success "服务停止完成"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    
    stop_services
    sleep 5
    start_services
    
    log_success "服务重启完成"
}

# 查看日志
view_logs() {
    log_info "查看服务日志..."
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=100
}

# 查看状态
check_status() {
    log_info "检查服务状态..."
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    
    echo ""
    log_info "Docker镜像信息:"
    docker images | grep "$APP_NAME" || true
    
    echo ""
    log_info "容器资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# 健康检查
check_health() {
    log_info "执行健康检查..."
    
    # 检查主应用
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "主应用健康检查通过"
    else
        log_error "主应用健康检查失败"
        return 1
    fi
    
    # 检查数据库
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready > /dev/null 2>&1; then
        log_success "数据库健康检查通过"
    else
        log_error "数据库健康检查失败"
        return 1
    fi
    
    # 检查Redis
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis健康检查通过"
    else
        log_error "Redis健康检查失败"
        return 1
    fi
    
    log_success "所有服务健康检查通过"
}

# 清理资源
clean_resources() {
    log_info "清理Docker资源..."
    
    # 停止并删除容器
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --remove-orphans
    
    # 清理未使用的镜像
    docker image prune -f
    
    # 清理未使用的卷
    docker volume prune -f
    
    # 清理未使用的网络
    docker network prune -f
    
    log_success "资源清理完成"
}

# 备份数据
backup_data() {
    log_info "备份数据..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份数据库
    log_info "备份PostgreSQL数据库..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres department_map > "$BACKUP_DIR/database.sql"
    
    # 备份Redis数据
    log_info "备份Redis数据..."
    docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli BGSAVE
    docker cp $(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis.rdb"
    
    # 备份上传文件
    log_info "备份上传文件..."
    if [ -d "uploads" ]; then
        tar -czf "$BACKUP_DIR/uploads.tar.gz" uploads/
    fi
    
    # 备份配置文件
    log_info "备份配置文件..."
    cp "$ENV_FILE" "$BACKUP_DIR/"
    cp docker-compose*.yml "$BACKUP_DIR/" 2>/dev/null || true
    
    log_success "数据备份完成: $BACKUP_DIR"
}

# 恢复数据
restore_data() {
    if [ -z "$3" ]; then
        log_error "请指定备份目录"
        log_info "用法: $0 $ENVIRONMENT restore <backup_directory>"
        exit 1
    fi
    
    BACKUP_DIR="$3"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "备份目录不存在: $BACKUP_DIR"
        exit 1
    fi
    
    log_info "从备份恢复数据: $BACKUP_DIR"
    
    # 恢复数据库
    if [ -f "$BACKUP_DIR/database.sql" ]; then
        log_info "恢复PostgreSQL数据库..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d department_map < "$BACKUP_DIR/database.sql"
    fi
    
    # 恢复Redis数据
    if [ -f "$BACKUP_DIR/redis.rdb" ]; then
        log_info "恢复Redis数据..."
        docker-compose -f "$COMPOSE_FILE" stop redis
        docker cp "$BACKUP_DIR/redis.rdb" $(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/dump.rdb
        docker-compose -f "$COMPOSE_FILE" start redis
    fi
    
    # 恢复上传文件
    if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
        log_info "恢复上传文件..."
        tar -xzf "$BACKUP_DIR/uploads.tar.gz"
    fi
    
    log_success "数据恢复完成"
}

# 更新应用
update_app() {
    log_info "更新应用..."
    
    # 拉取最新代码
    if [ -d ".git" ]; then
        git pull origin main
    fi
    
    # 重新构建镜像
    build_image
    
    # 重启服务
    restart_services
    
    log_success "应用更新完成"
}

# 回滚版本
rollback_version() {
    log_info "回滚到上一个版本..."
    
    # 这里需要根据实际的版本管理策略实现
    log_warning "回滚功能需要根据实际版本管理策略实现"
}

# 监控状态
monitor_status() {
    log_info "监控系统状态..."
    
    while true; do
        clear
        echo "=== 部门地图系统监控 - $(date) ==="
        echo ""
        
        # 服务状态
        echo "服务状态:"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
        
        # 资源使用
        echo "资源使用:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
        echo ""
        
        # 健康检查
        echo "健康检查:"
        if check_health > /dev/null 2>&1; then
            echo "✅ 所有服务正常"
        else
            echo "❌ 部分服务异常"
        fi
        
        echo ""
        echo "按 Ctrl+C 退出监控"
        
        sleep 10
    done
}

# 完整部署流程
deploy_app() {
    log_info "开始部署 $APP_NAME v$APP_VERSION 到 $ENVIRONMENT 环境"
    
    check_dependencies
    check_env_file
    
    if [ "$ENVIRONMENT" = "production" ]; then
        pull_image
    else
        build_image
    fi
    
    start_services
    
    log_success "部署完成！"
    log_info "应用访问地址: http://localhost:3000"
    log_info "监控面板地址: http://localhost:3001"
    log_info "Prometheus地址: http://localhost:9090"
}

# 主函数
main() {
    case $ACTION in
        "deploy")
            deploy_app
            ;;
        "build")
            check_dependencies
            build_image
            ;;
        "push")
            check_dependencies
            push_image
            ;;
        "pull")
            check_dependencies
            pull_image
            ;;
        "start")
            check_dependencies
            check_env_file
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            view_logs
            ;;
        "status")
            check_status
            ;;
        "health")
            check_health
            ;;
        "clean")
            clean_resources
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$@"
            ;;
        "update")
            update_app
            ;;
        "rollback")
            rollback_version
            ;;
        "monitor")
            monitor_status
            ;;
        "help")
            show_help
            ;;
        *)
            log_error "未知操作: $ACTION"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"