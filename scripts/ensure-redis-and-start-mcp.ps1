# Ensure local Redis is running before starting MCP Redis server

param(
    [string]$RedisUrl = "redis://localhost:6379"
)

Write-Host "🔧 Redis MCP 启动包装器" -ForegroundColor Cyan
Write-Host "Redis URL: $RedisUrl" -ForegroundColor Gray

function Get-PortFromUrl {
    param([string]$Url)
    try {
        if ($Url -match ":(\d+)") { return [int]$Matches[1] } else { return 6379 }
    } catch { return 6379 }
}

function Test-RedisUp {
    param([int]$Port)
    try {
        $proc = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
        if ($proc) { return $true }
        $net = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return [bool]$net
    } catch { return $false }
}

function Wait-ForRedis {
    param([int]$Port,[int]$TimeoutSec = 20)
    $start = Get-Date
    while ((Get-Date) - $start -lt (New-TimeSpan -Seconds $TimeoutSec)) {
        if (Test-RedisUp -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

$port = Get-PortFromUrl -Url $RedisUrl

if (-not (Test-RedisUp -Port $port)) {
    Write-Host "🔍 未检测到本地 Redis，尝试启动..." -ForegroundColor Yellow
    $psScript = Join-Path $PSScriptRoot "start-redis.ps1"
    $cmdScript = Join-Path $PSScriptRoot "start-redis.cmd"

    if (Test-Path $psScript) {
        Write-Host "▶ 使用 PowerShell 脚本启动 Redis: $psScript" -ForegroundColor Gray
        & $psScript -Quiet -Port $port | Out-Host
    } elseif (Test-Path $cmdScript) {
        Write-Host "▶ 使用 CMD 脚本启动 Redis: $cmdScript" -ForegroundColor Gray
        & $cmdScript | Out-Host
    } else {
        Write-Host "⚠ 未找到启动脚本，直接尝试启动 redis-server" -ForegroundColor Yellow
        $redisExe = "redis-server"
        $confPath = (Test-Path "Redis\redis.windows.conf") ? "Redis\redis.windows.conf" : (Test-Path "redis.conf") ? "redis.conf" : $null
        if ($confPath) {
            Start-Process -FilePath $redisExe -ArgumentList $confPath -WindowStyle Hidden | Out-Null
        } else {
            Start-Process -FilePath $redisExe -WindowStyle Hidden | Out-Null
        }
    }

    if (-not (Wait-ForRedis -Port $port -TimeoutSec 20)) {
        Write-Host "❌ 本地 Redis 启动失败或端口未就绪 (:$port)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ 本地 Redis 就绪，启动 MCP Redis 服务器..." -ForegroundColor Green

# 启动 MCP Redis 服务器（保持前台进程）
npx -y @modelcontextprotocol/server-redis $RedisUrl