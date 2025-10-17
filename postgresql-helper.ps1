# PostgreSQL管理员启动脚本
# 自动以管理员权限启动PostgreSQL服务

param(
    [switch]$Force,
    [switch]$Docker,
    [switch]$Status,
    [switch]$Help
)

if ($Help) {
    Write-Host "🚀 PostgreSQL管理助手" -ForegroundColor Green
    Write-Host "=====================" -ForegroundColor Green
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Cyan
    Write-Host "  .\postgresql-helper.ps1           # 启动PostgreSQL服务" -ForegroundColor White
    Write-Host "  .\postgresql-helper.ps1 -Force    # 强制重启服务" -ForegroundColor White
    Write-Host "  .\postgresql-helper.ps1 -Docker   # 使用Docker启动" -ForegroundColor White
    Write-Host "  .\postgresql-helper.ps1 -Status   # 检查服务状态" -ForegroundColor White
    Write-Host "  .\postgresql-helper.ps1 -Help     # 显示帮助" -ForegroundColor White
    Write-Host ""
    Write-Host "示例:" -ForegroundColor Yellow
    Write-Host "  .\postgresql-helper.ps1 -Docker   # 推荐：使用Docker" -ForegroundColor Gray
    exit
}

Write-Host "🚀 PostgreSQL管理助手" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green

# 检查是否以管理员权限运行
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 仅检查状态
if ($Status) {
    Write-Host "📊 检查PostgreSQL状态..." -ForegroundColor Cyan
    
    # 检查Windows服务
    $services = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue
    if ($services) {
        Write-Host "🔍 Windows服务状态:" -ForegroundColor Green
        if ($services -is [array]) {
            foreach ($service in $services) {
                Write-Host "   - $($service.Name): $($service.Status)" -ForegroundColor White
            }
        } else {
            Write-Host "   - $($services.Name): $($services.Status)" -ForegroundColor White
        }
    } else {
        Write-Host "❌ 未找到PostgreSQL Windows服务" -ForegroundColor Red
    }
    
    # 检查Docker容器
    try {
        $dockerContainers = docker ps -a --filter "name=postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        if ($dockerContainers -and $dockerContainers.Count -gt 1) {
            Write-Host "🐳 Docker容器状态:" -ForegroundColor Green
            Write-Host $dockerContainers -ForegroundColor White
        } else {
            Write-Host "🐳 未找到PostgreSQL Docker容器" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "🐳 Docker未安装或未启动" -ForegroundColor Yellow
    }
    
    # 测试连接
    Write-Host "🔍 测试数据库连接..." -ForegroundColor Cyan
    try {
        # 这里可以添加实际的连接测试
        Write-Host "💡 请手动测试连接: psql -h localhost -U postgres -d department_map" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠️  连接测试需要psql客户端" -ForegroundColor Yellow
    }
    
    exit
}

# 如果使用Docker选项
if ($Docker) {
    Write-Host "🐳 使用Docker启动PostgreSQL..." -ForegroundColor Cyan
    
    # 检查Docker是否安装
    try {
        $dockerVersion = docker --version 2>$null
        Write-Host "✅ Docker已安装: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker未安装或未启动" -ForegroundColor Red
        Write-Host "💡 请先安装Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        Write-Host "💡 或者尝试Windows服务方式: .\postgresql-helper.ps1" -ForegroundColor Yellow
        exit 1
    }
    
    # 检查现有容器
    Write-Host "🔍 检查现有PostgreSQL容器..." -ForegroundColor Cyan
    $existingContainer = docker ps -a --filter "name=postgres-db" --format "{{.Names}}" 2>$null
    
    if ($existingContainer) {
        $containerStatus = docker ps --filter "name=postgres-db" --format "{{.Status}}" 2>$null
        if ($containerStatus) {
            Write-Host "✅ PostgreSQL容器已在运行!" -ForegroundColor Green
            if ($Force) {
                Write-Host "🔄 强制重启容器..." -ForegroundColor Yellow
                docker restart postgres-db
            } else {
                Write-Host "💡 如需重启，请使用 -Force 参数" -ForegroundColor Yellow
            }
        } else {
            Write-Host "▶️  启动现有容器..." -ForegroundColor Cyan
            docker start postgres-db
        }
    } else {
        # 创建新容器
        Write-Host "🆕 创建新的PostgreSQL容器..." -ForegroundColor Cyan
        docker run --name postgres-db `
            -e POSTGRES_PASSWORD=113464 `
            -e POSTGRES_DB=department_map `
            -e POSTGRES_USER=postgres `
            -p 5432:5432 `
            -d postgres:16
    }
    
    # 等待容器启动
    Write-Host "⏳ 等待容器启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # 检查容器状态
    $containerStatus = docker ps --filter "name=postgres-db" --format "{{.Status}}" 2>$null
    if ($containerStatus) {
        Write-Host "✅ PostgreSQL Docker容器运行成功!" -ForegroundColor Green
        Write-Host "📊 容器状态: $containerStatus" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔗 连接信息:" -ForegroundColor Cyan
        Write-Host "   连接字符串: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor White
        Write-Host "   主机: localhost" -ForegroundColor White
        Write-Host "   端口: 5432" -ForegroundColor White
        Write-Host "   用户: postgres" -ForegroundColor White
        Write-Host "   密码: 113464" -ForegroundColor White
        Write-Host "   数据库: department_map" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 容器管理命令:" -ForegroundColor Yellow
        Write-Host "   查看日志: docker logs postgres-db" -ForegroundColor White
        Write-Host "   停止容器: docker stop postgres-db" -ForegroundColor White
        Write-Host "   启动容器: docker start postgres-db" -ForegroundColor White
        Write-Host "   删除容器: docker rm postgres-db" -ForegroundColor White
        Write-Host "   进入容器: docker exec -it postgres-db psql -U postgres -d department_map" -ForegroundColor White
    } else {
        Write-Host "❌ Docker容器启动失败!" -ForegroundColor Red
        Write-Host "🔍 查看错误日志: docker logs postgres-db" -ForegroundColor Yellow
    }
    exit
}

# Windows服务方式启动
Write-Host "🔍 使用Windows服务启动PostgreSQL..." -ForegroundColor Cyan

# 检查管理员权限
if (-not (Test-Administrator)) {
    Write-Host "⚠️  需要管理员权限来管理Windows服务" -ForegroundColor Yellow
    Write-Host "🔄 正在以管理员权限重新启动..." -ForegroundColor Cyan
    
    try {
        # 以管理员权限重新运行脚本
        $arguments = "-File `"$PSCommandPath`""
        if ($Force) { $arguments += " -Force" }
        
        Start-Process PowerShell -Verb RunAs -ArgumentList $arguments -Wait
        exit
    } catch {
        Write-Host "❌ 无法以管理员权限启动" -ForegroundColor Red
        Write-Host "🔧 手动解决方案:" -ForegroundColor Cyan
        Write-Host "   1. 右键点击PowerShell图标" -ForegroundColor White
        Write-Host "   2. 选择'以管理员身份运行'" -ForegroundColor White
        Write-Host "   3. 然后运行: .\postgresql-helper.ps1" -ForegroundColor White
        Write-Host ""
        Write-Host "🐳 推荐使用Docker方案: .\postgresql-helper.ps1 -Docker" -ForegroundColor Yellow
        exit 1
    }
}

# 查找PostgreSQL服务
Write-Host "🔍 查找PostgreSQL服务..." -ForegroundColor Cyan
$services = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue

if (-not $services) {
    Write-Host "❌ 未找到PostgreSQL服务!" -ForegroundColor Red
    Write-Host "💡 可能的解决方案:" -ForegroundColor Yellow
    Write-Host "   1. 安装PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "   2. 使用Docker: .\postgresql-helper.ps1 -Docker" -ForegroundColor White
    Write-Host "   3. 使用便携版PostgreSQL" -ForegroundColor White
    exit 1
}

# 显示找到的服务
if ($services -is [array]) {
    Write-Host "🔍 找到多个PostgreSQL服务:" -ForegroundColor Green
    foreach ($service in $services) {
        Write-Host "   - $($service.Name): $($service.Status)" -ForegroundColor White
    }
    $serviceName = $services[0].Name
} else {
    $serviceName = $services.Name
    Write-Host "🔍 找到PostgreSQL服务: $serviceName ($($services.Status))" -ForegroundColor Green
}

# 启动服务
try {
    $currentService = Get-Service -Name $serviceName
    
    if ($currentService.Status -eq "Running") {
        if ($Force) {
            Write-Host "🔄 强制重启服务..." -ForegroundColor Yellow
            Stop-Service -Name $serviceName -Force
            Start-Sleep -Seconds 3
        } else {
            Write-Host "✅ PostgreSQL服务已在运行!" -ForegroundColor Green
            Write-Host "💡 如需重启，请使用 -Force 参数" -ForegroundColor Yellow
        }
    }
    
    if ($currentService.Status -ne "Running" -or $Force) {
        Write-Host "▶️  启动PostgreSQL服务..." -ForegroundColor Cyan
        Start-Service -Name $serviceName
        Start-Sleep -Seconds 5
        
        $service = Get-Service -Name $serviceName
        if ($service.Status -eq "Running") {
            Write-Host "✅ PostgreSQL服务启动成功!" -ForegroundColor Green
        } else {
            Write-Host "❌ PostgreSQL服务启动失败!" -ForegroundColor Red
            Write-Host "📊 当前状态: $($service.Status)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ 服务操作失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "🔧 建议尝试Docker方案: .\postgresql-helper.ps1 -Docker" -ForegroundColor Yellow
}

# 显示连接信息
Write-Host ""
Write-Host "📝 连接信息:" -ForegroundColor Cyan
Write-Host "🔗 连接字符串: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor Cyan
Write-Host "🌐 管理界面: http://localhost:8080 (需要启动后端服务)" -ForegroundColor Cyan

Write-Host ""
Write-Host "🛠️  其他有用命令:" -ForegroundColor Yellow
Write-Host "   检查状态: .\postgresql-helper.ps1 -Status" -ForegroundColor White
Write-Host "   测试连接: psql -h localhost -U postgres -d department_map" -ForegroundColor White
Write-Host "   Docker方案: .\postgresql-helper.ps1 -Docker" -ForegroundColor White
Write-Host "   显示帮助: .\postgresql-helper.ps1 -Help" -ForegroundColor White