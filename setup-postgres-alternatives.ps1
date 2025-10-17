# PostgreSQL 多种启动方案脚本
# 提供 Docker 和本地服务两种 PostgreSQL 启动方式

param(
    [Parameter(Position=0)]
    [ValidateSet("docker", "local", "check", "help")]
    [string]$Method = "check",
    
    [switch]$Install,
    [switch]$Help
)

# 显示帮助信息
function Show-Help {
    Write-Host "PostgreSQL 多种启动方案工具" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\setup-postgres-alternatives.ps1 check   # 检查可用的启动方案"
    Write-Host "  .\setup-postgres-alternatives.ps1 docker  # 使用 Docker 启动 PostgreSQL"
    Write-Host "  .\setup-postgres-alternatives.ps1 local   # 使用本地服务启动 PostgreSQL"
    Write-Host "  .\setup-postgres-alternatives.ps1 -Install # 打开 PostgreSQL 下载页面"
    Write-Host "  .\setup-postgres-alternatives.ps1 -Help   # 显示此帮助信息"
    Write-Host ""
    Write-Host "说明:" -ForegroundColor Yellow
    Write-Host "  - Docker 方案: 使用容器运行，无需本地安装 PostgreSQL"
    Write-Host "  - 本地方案: 使用本地安装的 PostgreSQL 服务"
    Write-Host ""
}

# 检查 Docker 是否可用
function Test-DockerAvailable {
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            $dockerInfo = docker info 2>$null
            return @{
                Available = $true
                Version = $dockerVersion
                ServiceRunning = $dockerInfo -ne $null
            }
        }
    } catch {
        # Docker 不可用
    }
    return @{
        Available = $false
        Version = $null
        ServiceRunning = $false
    }
}

# 检查本地 PostgreSQL 是否可用
function Test-LocalPostgreSQLAvailable {
    # 检查 psql 命令
    try {
        $psqlVersion = psql --version 2>$null
        if ($psqlVersion) {
            # 检查 PostgreSQL 服务状态
            $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
            return @{
                Available = $true
                Version = $psqlVersion
                ServiceRunning = $service -and $service.Status -eq "Running"
                ServiceName = $service.Name
            }
        }
    } catch {
        # psql 命令不可用
    }
    
    # 检查常见的 PostgreSQL 安装路径
    $commonPaths = @(
        "${env:ProgramFiles}\PostgreSQL\*\bin\psql.exe",
        "${env:ProgramFiles(x86)}\PostgreSQL\*\bin\psql.exe"
    )
    
    foreach ($path in $commonPaths) {
        $psqlPath = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($psqlPath) {
            try {
                $version = & $psqlPath.FullName --version 2>$null
                $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
                return @{
                    Available = $true
                    Version = $version
                    ServiceRunning = $service -and $service.Status -eq "Running"
                    ServiceName = $service.Name
                    PsqlPath = $psqlPath.FullName
                }
            } catch {
                continue
            }
        }
    }
    
    return @{
        Available = $false
        Version = $null
        ServiceRunning = $false
        ServiceName = $null
    }
}

# 启动 Docker PostgreSQL
function Start-DockerPostgreSQL {
    Write-Host "🐳 使用 Docker 启动 PostgreSQL..." -ForegroundColor Blue
    Write-Host "================================" -ForegroundColor Blue
    Write-Host ""
    
    # 检查 Docker 是否可用
    $docker = Test-DockerAvailable
    if (-not $docker.Available) {
        Write-Host "❌ Docker 不可用" -ForegroundColor Red
        Write-Host "请先安装 Docker Desktop:" -ForegroundColor Yellow
        Write-Host "  .\check-docker-installation.ps1 -Install" -ForegroundColor Cyan
        return $false
    }
    
    if (-not $docker.ServiceRunning) {
        Write-Host "❌ Docker 服务未运行" -ForegroundColor Red
        Write-Host "请启动 Docker Desktop 并等待服务完全启动" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "✅ Docker 可用，启动 PostgreSQL 容器..." -ForegroundColor Green
    
    # 调用专用的 Docker 启动脚本
    if (Test-Path ".\start-postgres-docker.ps1") {
        Write-Host "使用专用脚本启动..." -ForegroundColor Yellow
        & ".\start-postgres-docker.ps1"
    } else {
        Write-Host "使用直接命令启动..." -ForegroundColor Yellow
        $dockerCmd = "docker run -d --name department-map-postgres -e POSTGRES_DB=department_map -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=113464 -p 5432:5432 -v postgres_data:/var/lib/postgresql/data postgres:15-alpine"
        Write-Host "执行命令: $dockerCmd" -ForegroundColor Cyan
        Invoke-Expression $dockerCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PostgreSQL 容器启动成功!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📋 连接信息:" -ForegroundColor Yellow
            Write-Host "   主机: localhost" -ForegroundColor White
            Write-Host "   端口: 5432" -ForegroundColor White
            Write-Host "   数据库: department_map" -ForegroundColor White
            Write-Host "   用户名: postgres" -ForegroundColor White
            Write-Host "   密码: 113464" -ForegroundColor White
        } else {
            Write-Host "❌ 容器启动失败" -ForegroundColor Red
            return $false
        }
    }
    
    return $true
}

# 启动本地 PostgreSQL
function Start-LocalPostgreSQL {
    Write-Host "🏠 使用本地服务启动 PostgreSQL..." -ForegroundColor Blue
    Write-Host "================================" -ForegroundColor Blue
    Write-Host ""
    
    $postgres = Test-LocalPostgreSQLAvailable
    if (-not $postgres.Available) {
        Write-Host "❌ 本地 PostgreSQL 不可用" -ForegroundColor Red
        Write-Host "请先安装 PostgreSQL:" -ForegroundColor Yellow
        Write-Host "  .\setup-postgres-alternatives.ps1 -Install" -ForegroundColor Cyan
        return $false
    }
    
    Write-Host "✅ 本地 PostgreSQL 可用" -ForegroundColor Green
    Write-Host "   版本: $($postgres.Version)" -ForegroundColor White
    
    if ($postgres.ServiceRunning) {
        Write-Host "✅ PostgreSQL 服务已运行" -ForegroundColor Green
        Write-Host "   服务名: $($postgres.ServiceName)" -ForegroundColor White
    } else {
        Write-Host "⚠️  PostgreSQL 服务未运行，尝试启动..." -ForegroundColor Yellow
        
        if ($postgres.ServiceName) {
            try {
                Start-Service -Name $postgres.ServiceName
                Write-Host "✅ PostgreSQL 服务启动成功" -ForegroundColor Green
            } catch {
                Write-Host "❌ 无法启动 PostgreSQL 服务: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "请以管理员身份运行此脚本，或手动启动服务" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "❌ 未找到 PostgreSQL 服务" -ForegroundColor Red
            return $false
        }
    }
    
    Write-Host ""
    Write-Host "📋 连接信息:" -ForegroundColor Yellow
    Write-Host "   主机: localhost" -ForegroundColor White
    Write-Host "   端口: 5432" -ForegroundColor White
    Write-Host "   数据库: postgres (默认)" -ForegroundColor White
    Write-Host "   用户名: postgres" -ForegroundColor White
    Write-Host "   密码: (安装时设置的密码)" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 创建项目数据库:" -ForegroundColor Yellow
    if ($postgres.PsqlPath) {
        Write-Host "   `"$($postgres.PsqlPath)`" -U postgres -c `"CREATE DATABASE department_map;`"" -ForegroundColor Cyan
    } else {
        Write-Host "   psql -U postgres -c `"CREATE DATABASE department_map;`"" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "🔧 测试连接:" -ForegroundColor Yellow
    if ($postgres.PsqlPath) {
        Write-Host "   `"$($postgres.PsqlPath)`" -U postgres -d department_map -c `"SELECT version();`"" -ForegroundColor Cyan
    } else {
        Write-Host "   psql -U postgres -d department_map -c `"SELECT version();`"" -ForegroundColor Cyan
    }
    
    return $true
}

# 检查可用方案
function Check-AvailableMethods {
    Write-Host "🔍 检查可用的 PostgreSQL 启动方案..." -ForegroundColor Blue
    Write-Host "================================" -ForegroundColor Blue
    Write-Host ""
    
    # 检查 Docker 方案
    Write-Host "1. Docker 方案:" -ForegroundColor Yellow
    $docker = Test-DockerAvailable
    if ($docker.Available) {
        Write-Host "   ✅ Docker 已安装" -ForegroundColor Green
        Write-Host "   版本: $($docker.Version)" -ForegroundColor White
        if ($docker.ServiceRunning) {
            Write-Host "   ✅ Docker 服务正在运行" -ForegroundColor Green
            Write-Host "   推荐使用: .\setup-postgres-alternatives.ps1 docker" -ForegroundColor Cyan
        } else {
            Write-Host "   ⚠️  Docker 服务未运行" -ForegroundColor Yellow
            Write-Host "   请启动 Docker Desktop" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ Docker 未安装" -ForegroundColor Red
        Write-Host "   安装方法: .\check-docker-installation.ps1 -Install" -ForegroundColor Cyan
    }
    Write-Host ""
    
    # 检查本地方案
    Write-Host "2. 本地服务方案:" -ForegroundColor Yellow
    $postgres = Test-LocalPostgreSQLAvailable
    if ($postgres.Available) {
        Write-Host "   ✅ PostgreSQL 已安装" -ForegroundColor Green
        Write-Host "   版本: $($postgres.Version)" -ForegroundColor White
        if ($postgres.ServiceRunning) {
            Write-Host "   ✅ PostgreSQL 服务正在运行" -ForegroundColor Green
            Write-Host "   推荐使用: .\setup-postgres-alternatives.ps1 local" -ForegroundColor Cyan
        } else {
            Write-Host "   ⚠️  PostgreSQL 服务未运行" -ForegroundColor Yellow
            Write-Host "   启动方法: .\setup-postgres-alternatives.ps1 local" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ❌ PostgreSQL 未安装" -ForegroundColor Red
        Write-Host "   安装方法: .\setup-postgres-alternatives.ps1 -Install" -ForegroundColor Cyan
    }
    Write-Host ""
    
    # 推荐方案
    Write-Host "💡 推荐方案:" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    if ($docker.Available -and $docker.ServiceRunning) {
        Write-Host "推荐使用 Docker 方案（无需本地安装，环境隔离）" -ForegroundColor Green
        Write-Host "运行: .\setup-postgres-alternatives.ps1 docker" -ForegroundColor Cyan
    } elseif ($postgres.Available) {
        Write-Host "推荐使用本地服务方案" -ForegroundColor Green
        Write-Host "运行: .\setup-postgres-alternatives.ps1 local" -ForegroundColor Cyan
    } else {
        Write-Host "建议先安装 Docker Desktop（更简单）" -ForegroundColor Yellow
        Write-Host "运行: .\check-docker-installation.ps1 -Install" -ForegroundColor Cyan
    }
    Write-Host ""
}

# 打开 PostgreSQL 下载页面
function Open-PostgreSQLDownloadPage {
    $downloadUrl = "https://www.postgresql.org/download/windows/"
    Write-Host "正在打开 PostgreSQL 下载页面..." -ForegroundColor Yellow
    Start-Process $downloadUrl
}

# 主程序逻辑
if ($Help) {
    Show-Help
    exit 0
}

if ($Install) {
    Open-PostgreSQLDownloadPage
    exit 0
}

switch ($Method) {
    "check" {
        Check-AvailableMethods
    }
    "docker" {
        $success = Start-DockerPostgreSQL
        if (-not $success) {
            Write-Host ""
            Write-Host "💡 建议: 如果 Docker 方案不可用，可以尝试本地方案" -ForegroundColor Yellow
            Write-Host "运行: .\setup-postgres-alternatives.ps1 local" -ForegroundColor Cyan
        }
    }
    "local" {
        $success = Start-LocalPostgreSQL
        if (-not $success) {
            Write-Host ""
            Write-Host "💡 建议: 如果本地方案不可用，可以尝试 Docker 方案" -ForegroundColor Yellow
            Write-Host "运行: .\setup-postgres-alternatives.ps1 docker" -ForegroundColor Cyan
        }
    }
    default {
        Write-Host "❌ 无效的方法: $Method" -ForegroundColor Red
        Show-Help
        exit 1
    }
}