# Docker 安装检查和指导脚本
# 用于检查 Docker Desktop 的安装状态并提供安装指导

param(
    [switch]$Install,
    [switch]$Help
)

# 显示帮助信息
function Show-Help {
    Write-Host "Docker 安装检查和指导工具" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\check-docker-installation.ps1          # 检查 Docker 安装状态"
    Write-Host "  .\check-docker-installation.ps1 -Install # 打开 Docker Desktop 下载页面"
    Write-Host "  .\check-docker-installation.ps1 -Help    # 显示此帮助信息"
    Write-Host ""
}

# 检查 Docker 命令是否可用
function Test-DockerCommand {
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            return @{
                Available = $true
                Version = $dockerVersion
            }
        }
    } catch {
        # Docker 命令不存在
    }
    return @{
        Available = $false
        Version = $null
    }
}

# 检查 Docker Desktop 服务状态
function Test-DockerService {
    try {
        $dockerInfo = docker info 2>$null
        if ($dockerInfo) {
            return @{
                Running = $true
                Info = $dockerInfo
            }
        }
    } catch {
        # Docker 服务未运行
    }
    return @{
        Running = $false
        Info = $null
    }
}

# 检查 Docker Desktop 进程
function Test-DockerDesktopProcess {
    $dockerDesktop = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    return $dockerDesktop -ne $null
}

# 打开 Docker Desktop 下载页面
function Open-DockerDownloadPage {
    $downloadUrl = "https://www.docker.com/products/docker-desktop/"
    Write-Host "正在打开 Docker Desktop 下载页面..." -ForegroundColor Yellow
    Start-Process $downloadUrl
}

# 主检查函数
function Check-DockerInstallation {
    Write-Host "🔍 检查 Docker 安装状态..." -ForegroundColor Blue
    Write-Host "================================" -ForegroundColor Blue
    Write-Host ""

    # 1. 检查 Docker 命令
    $dockerCommand = Test-DockerCommand
    if ($dockerCommand.Available) {
        Write-Host "✅ Docker 命令可用" -ForegroundColor Green
        Write-Host "   版本: $($dockerCommand.Version)" -ForegroundColor White
    } else {
        Write-Host "❌ Docker 命令不可用" -ForegroundColor Red
        Write-Host "   错误: 系统无法识别 'docker' 命令" -ForegroundColor Red
    }
    Write-Host ""

    # 2. 检查 Docker Desktop 进程
    $desktopProcess = Test-DockerDesktopProcess
    if ($desktopProcess) {
        Write-Host "✅ Docker Desktop 进程正在运行" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker Desktop 进程未运行" -ForegroundColor Red
    }
    Write-Host ""

    # 3. 检查 Docker 服务
    if ($dockerCommand.Available) {
        $dockerService = Test-DockerService
        if ($dockerService.Running) {
            Write-Host "✅ Docker 服务正常运行" -ForegroundColor Green
        } else {
            Write-Host "❌ Docker 服务未运行" -ForegroundColor Red
            Write-Host "   提示: 请启动 Docker Desktop 应用程序" -ForegroundColor Yellow
        }
        Write-Host ""
    }

    # 4. 综合诊断和建议
    Write-Host "📋 诊断结果和建议:" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow

    if (-not $dockerCommand.Available) {
        Write-Host "🚨 Docker 未安装或未正确配置" -ForegroundColor Red
        Write-Host ""
        Write-Host "解决方案:" -ForegroundColor Yellow
        Write-Host "1. 下载并安装 Docker Desktop for Windows" -ForegroundColor White
        Write-Host "   运行: .\check-docker-installation.ps1 -Install" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. 手动下载地址:" -ForegroundColor White
        Write-Host "   https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. 安装后重启计算机" -ForegroundColor White
        Write-Host "4. 启动 Docker Desktop 应用程序" -ForegroundColor White
        Write-Host "5. 等待 Docker 完全启动（系统托盘图标变为绿色）" -ForegroundColor White
        Write-Host ""
    } elseif (-not $desktopProcess) {
        Write-Host "⚠️  Docker 已安装但 Docker Desktop 未运行" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "解决方案:" -ForegroundColor Yellow
        Write-Host "1. 启动 Docker Desktop 应用程序" -ForegroundColor White
        Write-Host "2. 等待 Docker 完全启动" -ForegroundColor White
        Write-Host "3. 检查系统托盘中的 Docker 图标状态" -ForegroundColor White
        Write-Host ""
    } elseif ($dockerCommand.Available -and $desktopProcess -and -not $dockerService.Running) {
        Write-Host "⚠️  Docker Desktop 正在启动中" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "解决方案:" -ForegroundColor Yellow
        Write-Host "1. 等待 Docker Desktop 完全启动" -ForegroundColor White
        Write-Host "2. 检查系统托盘中的 Docker 图标是否为绿色" -ForegroundColor White
        Write-Host "3. 如果长时间未启动，尝试重启 Docker Desktop" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "✅ Docker 安装和配置正常！" -ForegroundColor Green
        Write-Host ""
        Write-Host "下一步:" -ForegroundColor Yellow
        Write-Host "1. 运行 PostgreSQL 容器:" -ForegroundColor White
        Write-Host "   .\start-postgres-docker.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. 或者使用单行命令:" -ForegroundColor White
        Write-Host "   docker run -d --name department-map-postgres -e POSTGRES_DB=department_map -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=113464 -p 5432:5432 -v postgres_data:/var/lib/postgresql/data postgres:15-alpine" -ForegroundColor Cyan
        Write-Host ""
    }

    Write-Host "🔧 故障排除:" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host "如果遇到问题，请尝试:" -ForegroundColor White
    Write-Host "1. 以管理员身份运行 PowerShell" -ForegroundColor White
    Write-Host "2. 重启 Docker Desktop" -ForegroundColor White
    Write-Host "3. 重启计算机" -ForegroundColor White
    Write-Host "4. 检查 Windows 功能中的 Hyper-V 和容器功能是否启用" -ForegroundColor White
    Write-Host "5. 确保 Windows 版本支持 Docker Desktop" -ForegroundColor White
    Write-Host ""
}

# 主程序逻辑
if ($Help) {
    Show-Help
    exit 0
}

if ($Install) {
    Open-DockerDownloadPage
    exit 0
}

# 默认执行检查
Check-DockerInstallation