# PostgreSQL 状态检查和启动脚本
# 适配用户现有的本地 PostgreSQL 环境

Write-Host "🔍 PostgreSQL 状态检查工具" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 检查 PostgreSQL 服务状态
function Check-PostgreSQLService {
    Write-Host "🔍 检查 PostgreSQL 服务..." -ForegroundColor Cyan
    
    $services = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue
    
    if (-not $services) {
        Write-Host "❌ 未找到 PostgreSQL 服务" -ForegroundColor Red
        return $false
    }
    
    if ($services -is [array]) {
        Write-Host "🔍 找到多个 PostgreSQL 服务:" -ForegroundColor Green
        foreach ($service in $services) {
            $status = if ($service.Status -eq "Running") { "✅ 运行中" } else { "⏹️ 已停止" }
            Write-Host "   - $($service.Name): $status" -ForegroundColor White
        }
        return $services[0]
    } else {
        $status = if ($services.Status -eq "Running") { "✅ 运行中" } else { "⏹️ 已停止" }
        Write-Host "🔍 找到 PostgreSQL 服务: $($services.Name) - $status" -ForegroundColor Green
        return $services
    }
}

# 测试数据库连接
function Test-DatabaseConnection {
    Write-Host "🔗 测试数据库连接..." -ForegroundColor Cyan
    
    # 从 .env 文件读取配置
    $envFile = ".\.env"
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile
        $dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
        $dbPort = ($envContent | Where-Object { $_ -match "^DB_PORT=" }) -replace "DB_PORT=", ""
        $dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
        $dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
        $dbPassword = ($envContent | Where-Object { $_ -match "^DB_PASSWORD=" }) -replace "DB_PASSWORD=", ""
        
        Write-Host "📋 数据库配置:" -ForegroundColor Yellow
        Write-Host "   主机: $dbHost" -ForegroundColor White
        Write-Host "   端口: $dbPort" -ForegroundColor White
        Write-Host "   数据库: $dbName" -ForegroundColor White
        Write-Host "   用户: $dbUser" -ForegroundColor White
        Write-Host "   密码: ****" -ForegroundColor White
        
        # 检查端口是否开放
        try {
            $connection = Test-NetConnection -ComputerName $dbHost -Port $dbPort -WarningAction SilentlyContinue
            if ($connection.TcpTestSucceeded) {
                Write-Host "✅ 端口 $dbPort 连接成功" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ 端口 $dbPort 连接失败" -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "❌ 网络连接测试失败: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "❌ 未找到 .env 配置文件" -ForegroundColor Red
        return $false
    }
}

# 启动 PostgreSQL 服务
function Start-PostgreSQLService {
    param($Service)
    
    if ($Service.Status -eq "Running") {
        Write-Host "✅ PostgreSQL 服务已在运行" -ForegroundColor Green
        return $true
    }
    
    Write-Host "▶️ 启动 PostgreSQL 服务..." -ForegroundColor Cyan
    
    try {
        Start-Service -Name $Service.Name
        Start-Sleep -Seconds 3
        
        $updatedService = Get-Service -Name $Service.Name
        if ($updatedService.Status -eq "Running") {
            Write-Host "✅ PostgreSQL 服务启动成功!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ PostgreSQL 服务启动失败" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ 启动服务时出错: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 可能需要管理员权限" -ForegroundColor Yellow
        return $false
    }
}

# 主程序
$service = Check-PostgreSQLService

if ($service) {
    $started = Start-PostgreSQLService -Service $service
    
    if ($started) {
        $connected = Test-DatabaseConnection
        
        if ($connected) {
            Write-Host ""
            Write-Host "🎉 PostgreSQL 环境检查完成!" -ForegroundColor Green
            Write-Host "📝 连接信息:" -ForegroundColor Cyan
            Write-Host "   连接字符串: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "🚀 现在可以启动项目了:" -ForegroundColor Yellow
            Write-Host "   npm run dev" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "⚠️ 服务已启动但连接测试失败" -ForegroundColor Yellow
            Write-Host "💡 请检查数据库配置或防火墙设置" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "💡 PostgreSQL 未安装或服务未配置" -ForegroundColor Yellow
    Write-Host "🔧 建议的解决方案:" -ForegroundColor Cyan
    Write-Host "   1. 安装 PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "   2. 或使用 Docker: .\start-postgresql-admin.ps1 -Docker" -ForegroundColor White
}

Write-Host ""
Write-Host "🛠️ 其他有用命令:" -ForegroundColor Yellow
Write-Host "   检查服务: Get-Service -Name '*postgresql*'" -ForegroundColor White
Write-Host "   重启服务: Restart-Service -Name 'postgresql*'" -ForegroundColor White
Write-Host "   查看端口: netstat -an | findstr :5432" -ForegroundColor White