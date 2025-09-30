# 部门地图系统 - 一键启动脚本
# 自动检查和启动所有必需的服务，然后启动开发环境

param(
    [switch]$SkipServiceCheck,
    [switch]$ProductionMode,
    [switch]$ServerManagement,
    [switch]$Quiet
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    if (-not $Quiet) {
        Write-Host $Message -ForegroundColor $Color
    }
}

# 显示项目信息
function Show-ProjectInfo {
    Write-ColorOutput ""
    Write-ColorOutput "🏢 部门地图管理系统" "Cyan"
    Write-ColorOutput "================================" "Cyan"
    Write-ColorOutput "版本: v3.1.0" "Gray"
    Write-ColorOutput "当前版本: ffbe17d - 室内地图编辑功能和性能优化" "Gray"
    Write-ColorOutput "启动时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Gray"
    Write-ColorOutput ""
}

# 检查和启动服务
function Start-ProjectServices {
    if ($SkipServiceCheck) {
        Write-ColorOutput "⏭️  跳过服务检查" "Yellow"
        return $true
    }
    
    Write-ColorOutput "🔍 检查项目依赖服务..." "Blue"
    
    try {
        $checkScript = Join-Path $PSScriptRoot "scripts\check-services.ps1"
        if (Test-Path $checkScript) {
            $params = @("-AutoStart")
            if ($Quiet) { $params += "-Quiet" }
            
            & $checkScript @params
            $serviceCheckResult = $LASTEXITCODE -eq 0
            
            if ($serviceCheckResult) {
                Write-ColorOutput "✅ 所有服务检查通过" "Green"
            } else {
                Write-ColorOutput "⚠️  部分服务存在问题，但继续启动" "Yellow"
            }
            
            return $true
        } else {
            Write-ColorOutput "❌ 服务检查脚本不存在，跳过检查" "Red"
            return $true
        }
    }
    catch {
        Write-ColorOutput "❌ 服务检查失败: $($_.Exception.Message)" "Red"
        Write-ColorOutput "⚠️  继续启动项目..." "Yellow"
        return $true
    }
}

# 启动开发环境
function Start-DevelopmentEnvironment {
    Write-ColorOutput ""
    Write-ColorOutput "🚀 启动开发环境..." "Blue"
    
    try {
        if ($ServerManagement) {
            Write-ColorOutput "🖥️  启动服务器管理模式..." "Yellow"
            & npm run dev:all
        } elseif ($ProductionMode) {
            Write-ColorOutput "🏭 启动生产模式..." "Yellow"
            & npm run build
            if ($LASTEXITCODE -eq 0) {
                & npm run preview
            }
        } else {
            Write-ColorOutput "🛠️  启动开发模式..." "Yellow"
            & npm run dev
        }
    }
    catch {
        Write-ColorOutput "❌ 启动开发环境失败: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 显示启动后信息
function Show-StartupInfo {
    Write-ColorOutput ""
    Write-ColorOutput "🌐 服务访问地址:" "Cyan"
    Write-ColorOutput "================================" "Cyan"
    
    if ($ServerManagement) {
        Write-ColorOutput "📱 前端应用:     http://localhost:5173" "Green"
        Write-ColorOutput "🖥️  服务器管理:   http://localhost:5174" "Green"
        Write-ColorOutput "🔧 后端API:      http://localhost:8080" "Green"
        Write-ColorOutput "🗄️  M1管理界面:   http://localhost:3002" "Green"
    } elseif ($ProductionMode) {
        Write-ColorOutput "🌐 生产预览:     http://localhost:4173" "Green"
    } else {
        Write-ColorOutput "📱 前端应用:     http://localhost:5173" "Green"
        Write-ColorOutput "🔧 后端API:      http://localhost:8080" "Green"
    }
    
    Write-ColorOutput "💾 Redis缓存:    localhost:6379" "Green"
    Write-ColorOutput "🗃️  PostgreSQL:   localhost:5432" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "💡 提示:" "Yellow"
    Write-ColorOutput "   - 按 Ctrl+C 停止所有服务" "Gray"
    Write-ColorOutput "   - 运行 npm run services:check 检查服务状态" "Gray"
    Write-ColorOutput "   - 运行 npm run redis:start 单独启动Redis" "Gray"
}

# 主函数
function Main {
    Show-ProjectInfo
    
    # 1. 检查和启动服务
    $servicesOk = Start-ProjectServices
    
    if (-not $servicesOk) {
        Write-ColorOutput "❌ 服务启动失败，退出" "Red"
        exit 1
    }
    
    # 2. 启动开发环境
    Start-DevelopmentEnvironment
    
    # 3. 显示启动信息
    Show-StartupInfo
}

# 脚本入口点
if ($MyInvocation.InvocationName -ne '.') {
    Main
}