# Redis自动启动脚本
# 用于在项目启动时自动检查和启动Redis服务

param(
    [switch]$Force,
    [switch]$Quiet,
    [int]$Port = 6379,
    [string]$ConfigFile = "Redis\redis.windows.conf"
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

# 检查Redis进程是否运行
function Test-RedisRunning {
    param([int]$Port = 6379)
    
    try {
        $process = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
        if ($process) {
            Write-ColorOutput "✅ Redis进程已运行 (PID: $($process.Id))" "Green"
            return $true
        }
        
        # 检查端口是否被占用
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-ColorOutput "✅ Redis服务在端口 $Port 上运行" "Green"
            return $true
        }
        
        return $false
    }
    catch {
        return $false
    }
}

# 启动Redis服务器
function Start-RedisServer {
    param(
        [string]$ConfigPath,
        [int]$Port = 6379
    )
    
    $redisExecutable = Join-Path $PSScriptRoot "..\Redis\redis-server.exe"
    $configFullPath = Join-Path $PSScriptRoot "..\$ConfigPath"
    
    # 检查Redis可执行文件是否存在
    if (-not (Test-Path $redisExecutable)) {
        Write-ColorOutput "❌ Redis可执行文件不存在: $redisExecutable" "Red"
        return $false
    }
    
    # 检查配置文件是否存在
    if (-not (Test-Path $configFullPath)) {
        Write-ColorOutput "❌ Redis配置文件不存在: $configFullPath" "Red"
        return $false
    }
    
    try {
        Write-ColorOutput "🚀 启动Redis服务器..." "Yellow"
        Write-ColorOutput "   可执行文件: $redisExecutable" "Gray"
        Write-ColorOutput "   配置文件: $configFullPath" "Gray"
        Write-ColorOutput "   端口: $Port" "Gray"
        
        # 使用Start-Process在后台启动Redis
        $processInfo = Start-Process -FilePath $redisExecutable -ArgumentList $configFullPath -WindowStyle Hidden -PassThru
        
        # 等待服务启动
        Start-Sleep -Seconds 3
        
        # 验证启动是否成功
        if (Test-RedisRunning -Port $Port) {
            Write-ColorOutput "✅ Redis服务器启动成功 (PID: $($processInfo.Id))" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Redis服务器启动失败" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ 启动Redis时发生错误: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 测试Redis连接
function Test-RedisConnection {
    param([int]$Port = 6379)
    
    try {
        # 尝试连接Redis
        $testScript = @"
const Redis = require('ioredis');
const redis = new Redis({
    host: 'localhost',
    port: $Port,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
});

redis.ping()
    .then(() => {
        console.log('REDIS_CONNECTION_SUCCESS');
        process.exit(0);
    })
    .catch((err) => {
        console.log('REDIS_CONNECTION_FAILED:', err.message);
        process.exit(1);
    });
"@
        
        $tempFile = [System.IO.Path]::GetTempFileName() + ".js"
        $testScript | Out-File -FilePath $tempFile -Encoding UTF8
        
        $result = & node $tempFile 2>&1
        Remove-Item $tempFile -Force
        
        if ($result -contains "REDIS_CONNECTION_SUCCESS") {
            Write-ColorOutput "✅ Redis连接测试成功" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Redis连接测试失败: $result" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ Redis连接测试异常: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 主执行逻辑
function Main {
    Write-ColorOutput "🔍 Redis自动启动检查器" "Cyan"
    Write-ColorOutput "================================" "Cyan"
    
    # 检查Redis是否已经运行
    if (Test-RedisRunning -Port $Port) {
        if (-not $Force) {
            Write-ColorOutput "ℹ️  Redis已在运行，无需启动" "Yellow"
            
            # 测试连接
            if (Test-RedisConnection -Port $Port) {
                Write-ColorOutput "✅ Redis服务检查完成" "Green"
                return $true
            } else {
                Write-ColorOutput "⚠️  Redis进程运行但连接失败，尝试重启..." "Yellow"
                # 停止现有进程并重启
                Get-Process -Name "redis-server" -ErrorAction SilentlyContinue | Stop-Process -Force
                Start-Sleep -Seconds 2
            }
        } else {
            Write-ColorOutput "🔄 强制模式：停止现有Redis进程..." "Yellow"
            Get-Process -Name "redis-server" -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 2
        }
    }
    
    # 启动Redis服务器
    $startResult = Start-RedisServer -ConfigPath $ConfigFile -Port $Port
    
    if ($startResult) {
        # 测试连接
        Start-Sleep -Seconds 2
        if (Test-RedisConnection -Port $Port) {
            Write-ColorOutput "🎉 Redis服务启动并连接成功！" "Green"
            Write-ColorOutput "   访问地址: localhost:$Port" "Gray"
            return $true
        } else {
            Write-ColorOutput "❌ Redis启动成功但连接失败" "Red"
            return $false
        }
    } else {
        Write-ColorOutput "❌ Redis启动失败" "Red"
        return $false
    }
}

# 脚本入口点
if ($MyInvocation.InvocationName -ne '.') {
    $success = Main
    if ($success) {
        exit 0
    } else {
        exit 1
    }
}