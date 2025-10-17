# PostgreSQL Docker 启动脚本
# 专为Windows PowerShell环境设计

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status,
    [switch]$Help,
    [switch]$Force
)

$ContainerName = "department-map-postgres"
$ImageName = "postgres:15-alpine"

if ($Help) {
    Write-Host "🐳 PostgreSQL Docker 管理工具" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Cyan
    Write-Host "  .\start-postgres-docker.ps1           # 启动PostgreSQL容器" -ForegroundColor White
    Write-Host "  .\start-postgres-docker.ps1 -Stop     # 停止容器" -ForegroundColor White
    Write-Host "  .\start-postgres-docker.ps1 -Restart  # 重启容器" -ForegroundColor White
    Write-Host "  .\start-postgres-docker.ps1 -Status   # 检查容器状态" -ForegroundColor White
    Write-Host "  .\start-postgres-docker.ps1 -Force    # 强制重新创建容器" -ForegroundColor White
    Write-Host "  .\start-postgres-docker.ps1 -Help     # 显示帮助" -ForegroundColor White
    Write-Host ""
    Write-Host "数据库配置:" -ForegroundColor Yellow
    Write-Host "  数据库名: department_map" -ForegroundColor Gray
    Write-Host "  用户名: postgres" -ForegroundColor Gray
    Write-Host "  密码: 113464" -ForegroundColor Gray
    Write-Host "  端口: 5432" -ForegroundColor Gray
    exit
}

Write-Host "🐳 PostgreSQL Docker 管理工具" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 检查Docker是否安装
function Test-DockerInstalled {
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Docker已安装: $dockerVersion" -ForegroundColor Green
            return $true
        }
    } catch {
        # Docker命令不存在
    }
    
    Write-Host "❌ Docker未安装或未启动" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 请先安装Docker Desktop:" -ForegroundColor Yellow
    Write-Host "   1. 访问: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "   2. 下载并安装Docker Desktop for Windows" -ForegroundColor Cyan
    Write-Host "   3. 启动Docker Desktop应用程序" -ForegroundColor Cyan
    Write-Host "   4. 等待Docker完全启动后重新运行此脚本" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 替代方案: 使用Windows PostgreSQL服务" -ForegroundColor Yellow
    Write-Host "   运行: .\postgresql-helper.ps1" -ForegroundColor Cyan
    return $false
}

# 检查容器状态
function Get-ContainerStatus {
    try {
        $containerInfo = docker ps -a --filter "name=$ContainerName" --format "{{.Status}}" 2>$null
        if ($LASTEXITCODE -eq 0 -and $containerInfo) {
            return $containerInfo
        }
    } catch {
        # 容器不存在或Docker命令失败
    }
    return $null
}

# 检查Docker安装
if (-not (Test-DockerInstalled)) {
    exit 1
}

# 获取容器状态
$containerStatus = Get-ContainerStatus

# 处理不同的操作
if ($Status) {
    Write-Host "📊 检查PostgreSQL Docker容器状态..." -ForegroundColor Cyan
    
    if ($containerStatus) {
        Write-Host "🔍 容器状态: $containerStatus" -ForegroundColor Green
        
        # 检查端口占用
        $portCheck = netstat -ano | findstr :5432
        if ($portCheck) {
            Write-Host "🌐 端口5432状态: 已占用" -ForegroundColor Green
            Write-Host "   $portCheck" -ForegroundColor Gray
        } else {
            Write-Host "🌐 端口5432状态: 未占用" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ 容器不存在" -ForegroundColor Red
    }
    exit
}

if ($Stop) {
    Write-Host "⏹️  停止PostgreSQL容器..." -ForegroundColor Yellow
    
    if ($containerStatus) {
        docker stop $ContainerName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 容器已停止" -ForegroundColor Green
        } else {
            Write-Host "❌ 停止容器失败" -ForegroundColor Red
        }
    } else {
        Write-Host "ℹ️  容器不存在或已停止" -ForegroundColor Blue
    }
    exit
}

if ($Restart -or $Force) {
    Write-Host "🔄 重启PostgreSQL容器..." -ForegroundColor Cyan
    
    # 停止并删除现有容器
    if ($containerStatus) {
        Write-Host "⏹️  停止现有容器..." -ForegroundColor Yellow
        docker stop $ContainerName 2>$null
        docker rm $ContainerName 2>$null
    }
}

# 启动容器
Write-Host "🚀 启动PostgreSQL Docker容器..." -ForegroundColor Cyan

# 检查是否已有运行中的容器
if ($containerStatus -and $containerStatus.Contains("Up")) {
    Write-Host "ℹ️  容器已在运行中" -ForegroundColor Blue
    Write-Host "   状态: $containerStatus" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 如需重启，请使用: .\start-postgres-docker.ps1 -Restart" -ForegroundColor Yellow
    exit
}

# 如果容器存在但未运行，先启动它
if ($containerStatus -and $containerStatus.Contains("Exited")) {
    Write-Host "▶️  启动现有容器..." -ForegroundColor Cyan
    docker start $ContainerName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 容器启动成功" -ForegroundColor Green
    } else {
        Write-Host "❌ 启动失败，尝试重新创建..." -ForegroundColor Yellow
        docker rm $ContainerName 2>$null
        $containerStatus = $null
    }
}

# 创建新容器
if (-not $containerStatus) {
    Write-Host "📦 创建新的PostgreSQL容器..." -ForegroundColor Cyan
    
    # PowerShell格式的Docker命令（单行）
    $dockerCmd = "docker run -d --name $ContainerName " +
                 "-e POSTGRES_DB=department_map " +
                 "-e POSTGRES_USER=postgres " +
                 "-e POSTGRES_PASSWORD=113464 " +
                 "-p 5432:5432 " +
                 "-v postgres_data:/var/lib/postgresql/data " +
                 "$ImageName"
    
    Write-Host "执行命令: $dockerCmd" -ForegroundColor Gray
    
    # 执行Docker命令
    Invoke-Expression $dockerCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 容器创建成功" -ForegroundColor Green
    } else {
        Write-Host "❌ 容器创建失败" -ForegroundColor Red
        exit 1
    }
}

# 等待容器启动
Write-Host "⏳ 等待PostgreSQL启动..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 验证容器状态
$finalStatus = Get-ContainerStatus
if ($finalStatus -and $finalStatus.Contains("Up")) {
    Write-Host "✅ PostgreSQL容器运行成功!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 连接信息:" -ForegroundColor Yellow
    Write-Host "   主机: localhost" -ForegroundColor White
    Write-Host "   端口: 5432" -ForegroundColor White
    Write-Host "   数据库: department_map" -ForegroundColor White
    Write-Host "   用户名: postgres" -ForegroundColor White
    Write-Host "   密码: 113464" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 测试连接:" -ForegroundColor Yellow
    Write-Host "   docker exec -it $ContainerName psql -U postgres -d department_map -c `"SELECT version();`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 启动项目:" -ForegroundColor Yellow
    Write-Host "   node check_db_structure.cjs  # 验证数据库连接" -ForegroundColor Cyan
    Write-Host "   npm run dev                  # 启动开发服务器" -ForegroundColor Cyan
} else {
    Write-Host "❌ 容器启动失败" -ForegroundColor Red
    Write-Host "当前状态: $finalStatus" -ForegroundColor Gray
    
    # 显示容器日志
    Write-Host ""
    Write-Host "📋 容器日志:" -ForegroundColor Yellow
    docker logs $ContainerName --tail 10
}