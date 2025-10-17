# PostgreSQL 状态检查和启动脚本
# 适配用户现有的本地 PostgreSQL 环境

param(
    [switch]$Start,
    [switch]$Test
)

Write-Host "🔍 PostgreSQL 状态检查工具" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 检查 PostgreSQL 服务状态
function Check-PostgreSQLService {
    Write-Host "🔍 检查 PostgreSQL 服务..." -ForegroundColor Cyan
    
    $services = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue
    
    if (-not $services) {
        Write-Host "❌ 未找到 PostgreSQL 服务" -ForegroundColor Red
        return $null
    }
    
    if ($services -is [array]) {
        Write-Host "🔍 找到多个 PostgreSQL 服务:" -ForegroundColor Green
        foreach ($service in $services) {
            Write-Host "   - $($service.Name): $($service.Status)" -ForegroundColor White
        }
        return $services[0]
    } else {
        Write-Host "🔍 找到 PostgreSQL 服务: $($services.Name) ($($services.Status))" -ForegroundColor Green
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
        
        # 检查端口是否开放
        try {
            $connection = New-Object System.Net.Sockets.TcpClient
            $connection.Connect($dbHost, $dbPort)
            $connection.Close()
            Write-Host "✅ 端口 $dbPort 可访问" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "❌ 端口 $dbPort 不可访问" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "❌ 未找到 .env 文件" -ForegroundColor Red
        return $false
    }
}

# 启动 PostgreSQL 服务
function Start-PostgreSQLService {
    param($service)
    
    if (-not $service) {
        Write-Host "❌ 无法启动：未找到 PostgreSQL 服务" -ForegroundColor Red
        return $false
    }
    
    try {
        if ($service.Status -eq "Running") {
            Write-Host "✅ PostgreSQL 服务已在运行" -ForegroundColor Green
            return $true
        }
        
        Write-Host "▶️  启动 PostgreSQL 服务..." -ForegroundColor Cyan
        Start-Service -Name $service.Name
        Start-Sleep -Seconds 3
        
        $updatedService = Get-Service -Name $service.Name
        if ($updatedService.Status -eq "Running") {
            Write-Host "✅ PostgreSQL 服务启动成功!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ PostgreSQL 服务启动失败" -ForegroundColor Red
            Write-Host "📊 当前状态: $($updatedService.Status)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ 启动服务时出错: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 主逻辑
$service = Check-PostgreSQLService

if ($Start -and $service) {
    $started = Start-PostgreSQLService -service $service
    if ($started) {
        Start-Sleep -Seconds 2
        Test-DatabaseConnection | Out-Null
    }
} elseif ($Test) {
    Test-DatabaseConnection | Out-Null
} else {
    # 默认只检查状态
    if ($service) {
        Write-Host ""
        Write-Host "📝 连接信息:" -ForegroundColor Cyan
        Write-Host "🔗 连接字符串: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "💡 使用方法:" -ForegroundColor Yellow
        Write-Host "   启动服务: .\check-postgresql.ps1 -Start" -ForegroundColor White
        Write-Host "   测试连接: .\check-postgresql.ps1 -Test" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "💡 可能的解决方案:" -ForegroundColor Yellow
        Write-Host "   1. 检查 PostgreSQL 是否已安装" -ForegroundColor White
        Write-Host "   2. 确认服务名称是否正确" -ForegroundColor White
        Write-Host "   3. 以管理员权限运行此脚本" -ForegroundColor White
    }
}