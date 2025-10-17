# Docker 安装检查和指导脚本
# 用于检查 Docker Desktop 是否正确安装和配置

param(
    [switch]$Install,
    [switch]$Help
)

# 显示帮助信息
function Show-Help {
    Write-Host "🐳 Docker 安装检查和指导工具" -ForegroundColor Blue
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\check-docker.ps1           # 检查 Docker 状态"
    Write-Host "  .\check-docker.ps1 -Install  # 显示安装指导"
    Write-Host "  .\check-docker.ps1 -Help     # 显示此帮助"
    Write-Host ""
}

# 检查 Docker 是否安装
function Test-DockerInstalled {
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Host "✅ Docker 已安装: $dockerVersion" -ForegroundColor Green
            return $true
        }
    } catch {
        # Docker 命令不存在
    }
    
    Write-Host "❌ Docker 未安装或未添加到 PATH" -ForegroundColor Red
    return $false
}

# 检查 Docker 服务状态
function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>$null
        if ($dockerInfo) {
            Write-Host "✅ Docker 服务正在运行" -ForegroundColor Green
            return $true
        }
    } catch {
        # Docker 服务未运行
    }
    
    Write-Host "❌ Docker 服务未运行" -ForegroundColor Red
    return $false
}

# 检查 Docker Desktop 进程
function Test-DockerDesktop {
    $dockerDesktop = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if ($dockerDesktop) {
        Write-Host "✅ Docker Desktop 正在运行" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Docker Desktop 未运行" -ForegroundColor Yellow
        return $false
    }
}

# 显示安装指导
function Show-InstallGuide {
    Write-Host "🚀 Docker Desktop 安装指导" -ForegroundColor Blue
    Write-Host ""
    Write-Host "1. 下载 Docker Desktop:" -ForegroundColor Yellow
    Write-Host "   访问: https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    Write-Host "   选择 'Docker Desktop for Windows'"
    Write-Host ""
    Write-Host "2. 系统要求:" -ForegroundColor Yellow
    Write-Host "   - Windows 10/11 (64位)"
    Write-Host "   - 启用 WSL 2 或 Hyper-V"
    Write-Host "   - 至少 4GB RAM"
    Write-Host ""
    Write-Host "3. 安装步骤:" -ForegroundColor Yellow
    Write-Host "   a) 下载并运行 Docker Desktop Installer.exe"
    Write-Host "   b) 按照安装向导完成安装"
    Write-Host "   c) 重启计算机"
    Write-Host "   d) 启动 Docker Desktop"
    Write-Host ""
    Write-Host "4. 验证安装:" -ForegroundColor Yellow
    Write-Host "   运行此脚本检查状态: .\check-docker.ps1"
    Write-Host ""
    Write-Host "5. 常见问题:" -ForegroundColor Yellow
    Write-Host "   - 如果提示启用 WSL 2，请运行:"
    Write-Host "     wsl --install" -ForegroundColor Cyan
    Write-Host "   - 如果提示启用虚拟化，请在 BIOS 中启用 Hyper-V"
    Write-Host ""
}

# 显示故障排除建议
function Show-Troubleshooting {
    Write-Host "🔧 故障排除建议:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 重启 Docker Desktop:" -ForegroundColor White
    Write-Host "   - 右键点击系统托盘中的 Docker 图标"
    Write-Host "   - 选择 'Restart Docker Desktop'"
    Write-Host ""
    Write-Host "2. 检查 Windows 功能:" -ForegroundColor White
    Write-Host "   - 打开 '启用或关闭 Windows 功能'"
    Write-Host "   - 确保启用 'WSL 2' 或 'Hyper-V'"
    Write-Host ""
    Write-Host "3. 更新 WSL 2:" -ForegroundColor White
    Write-Host "   wsl --update" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. 重置 Docker Desktop:" -ForegroundColor White
    Write-Host "   - Docker Desktop 设置 > Troubleshoot > Reset to factory defaults"
    Write-Host ""
}

# 主函数
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    if ($Install) {
        Show-InstallGuide
        return
    }
    
    Write-Host "🐳 Docker 状态检查" -ForegroundColor Blue
    Write-Host "==================" -ForegroundColor Blue
    Write-Host ""
    
    $dockerInstalled = Test-DockerInstalled
    $dockerRunning = $false
    $dockerDesktopRunning = $false
    
    if ($dockerInstalled) {
        $dockerRunning = Test-DockerRunning
        $dockerDesktopRunning = Test-DockerDesktop
        
        if ($dockerRunning) {
            Write-Host ""
            Write-Host "🎉 Docker 配置完成，可以使用!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📋 下一步操作:" -ForegroundColor Yellow
            Write-Host "   运行 PostgreSQL: .\start-postgres-docker.ps1" -ForegroundColor Cyan
            Write-Host ""
            return
        }
    }
    
    Write-Host ""
    Write-Host "⚠️  Docker 配置不完整" -ForegroundColor Yellow
    Write-Host ""
    
    if (-not $dockerInstalled) {
        Write-Host "📥 需要安装 Docker Desktop" -ForegroundColor Red
        Write-Host "   运行: .\check-docker.ps1 -Install" -ForegroundColor Cyan
    } elseif (-not $dockerDesktopRunning) {
        Write-Host "🚀 需要启动 Docker Desktop" -ForegroundColor Yellow
        Write-Host "   1. 从开始菜单启动 'Docker Desktop'"
        Write-Host "   2. 等待 Docker 完全启动"
        Write-Host "   3. 重新运行此脚本验证"
    } elseif (-not $dockerRunning) {
        Show-Troubleshooting
    }
    
    Write-Host ""
    Write-Host "🔄 备用方案:" -ForegroundColor Yellow
    Write-Host "   使用本地 PostgreSQL: .\postgresql-helper.ps1" -ForegroundColor Cyan
    Write-Host ""
}

# 执行主函数
Main