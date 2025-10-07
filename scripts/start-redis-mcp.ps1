# Redis MCP 自动启动脚本
# 功能: 检测Redis服务状态，自动启动Redis服务，然后启动Redis MCP

param(
    [string]$RedisUrl = "redis://localhost:6379",
    [string]$RedisPath = ".\Redis\redis-server.exe",
    [string]$RedisConfig = ".\redis.conf",
    [int]$MaxRetries = 5,
    [int]$RetryDelay = 2
)

Write-Host "🔍 Redis MCP 自动启动脚本开始执行..." -ForegroundColor Cyan

# 检查Redis服务器是否运行
function Test-RedisServer {
    param([string]$Host = "localhost", [int]$Port = 6379)
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync($Host, $Port).Wait(3000)
        $isConnected = $tcpClient.Connected
        $tcpClient.Close()
        return $isConnected
    }
    catch {
        return $false
    }
}

# 启动Redis服务器
function Start-RedisServer {
    Write-Host "🚀 正在启动Redis服务器..." -ForegroundColor Yellow
    
    # 检查Redis可执行文件是否存在
    if (-not (Test-Path $RedisPath)) {
        Write-Host "❌ Redis可执行文件未找到: $RedisPath" -ForegroundColor Red
        
        # 尝试查找系统中的Redis
        $systemRedis = Get-Command "redis-server" -ErrorAction SilentlyContinue
        if ($systemRedis) {
            $RedisPath = $systemRedis.Source
            Write-Host "✅ 找到系统Redis: $RedisPath" -ForegroundColor Green
        } else {
            Write-Host "❌ 系统中未找到Redis服务器" -ForegroundColor Red
            Write-Host "💡 请安装Redis或检查路径配置" -ForegroundColor Yellow
            return $false
        }
    }
    
    try {
        # 检查Redis配置文件
        $configArgs = @()
        if (Test-Path $RedisConfig) {
            $configArgs = @($RedisConfig)
            Write-Host "✅ 使用配置文件: $RedisConfig" -ForegroundColor Green
        } else {
            Write-Host "⚠️ 配置文件未找到，使用默认配置" -ForegroundColor Yellow
        }
        
        # 启动Redis服务器进程
        $redisProcess = Start-Process -FilePath $RedisPath -ArgumentList $configArgs -WindowStyle Hidden -PassThru
        
        if ($redisProcess) {
            Write-Host "✅ Redis服务器进程已启动 (PID: $($redisProcess.Id))" -ForegroundColor Green
            
            # 等待Redis服务器完全启动
            $retryCount = 0
            while ($retryCount -lt $MaxRetries) {
                Start-Sleep -Seconds $RetryDelay
                if (Test-RedisServer) {
                    Write-Host "✅ Redis服务器启动成功，端口6379可访问" -ForegroundColor Green
                    return $true
                }
                $retryCount++
                Write-Host "⏳ 等待Redis服务器启动... ($retryCount/$MaxRetries)" -ForegroundColor Yellow
            }
            
            Write-Host "❌ Redis服务器启动超时" -ForegroundColor Red
            return $false
        } else {
            Write-Host "❌ Redis服务器进程启动失败" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ 启动Redis服务器时发生错误: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 测试Redis连接
function Test-RedisConnection {
    param([string]$Url)
    
    Write-Host "🔍 测试Redis连接: $Url" -ForegroundColor Cyan
    
    try {
        # 使用Node.js测试Redis连接
        $testScript = @"
const Redis = require('ioredis');
const redis = new Redis('$Url');

redis.ping().then((result) => {
    console.log('✅ Redis PING成功:', result);
    process.exit(0);
}).catch((error) => {
    console.error('❌ Redis连接失败:', error.message);
    process.exit(1);
}).finally(() => {
    redis.disconnect();
});
"@
        
        $testResult = node -e $testScript
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Redis连接测试成功" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Redis连接测试失败" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Redis连接测试异常: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 启动Redis MCP服务器
function Start-RedisMCP {
    param([string]$Url)
    
    Write-Host "🚀 正在启动Redis MCP服务器..." -ForegroundColor Cyan
    
    try {
        # 启动Redis MCP服务器
        $mcpArgs = @(
            "-y",
            "@modelcontextprotocol/server-redis",
            $Url
        )
        
        Write-Host "📋 MCP启动参数: npx $($mcpArgs -join ' ')" -ForegroundColor Gray
        
        # 使用Start-Process启动MCP服务器
        $mcpProcess = Start-Process -FilePath "npx" -ArgumentList $mcpArgs -NoNewWindow -PassThru
        
        if ($mcpProcess) {
            Write-Host "✅ Redis MCP服务器已启动 (PID: $($mcpProcess.Id))" -ForegroundColor Green
            Write-Host "🎉 Redis MCP启动完成！" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Redis MCP服务器启动失败" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ 启动Redis MCP时发生错误: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 主执行流程
function Main {
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "🔧 Redis MCP 自动启动和配置脚本" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    
    # 步骤1: 检查Redis服务器状态
    Write-Host "`n📊 步骤1: 检查Redis服务器状态" -ForegroundColor Blue
    
    if (Test-RedisServer) {
        Write-Host "✅ Redis服务器已运行，跳过启动步骤" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Redis服务器未运行，准备启动..." -ForegroundColor Yellow
        
        # 步骤2: 启动Redis服务器
        Write-Host "`n🚀 步骤2: 启动Redis服务器" -ForegroundColor Blue
        
        if (-not (Start-RedisServer)) {
            Write-Host "❌ Redis服务器启动失败，无法继续" -ForegroundColor Red
            exit 1
        }
    }
    
    # 步骤3: 测试Redis连接
    Write-Host "`n🔍 步骤3: 测试Redis连接" -ForegroundColor Blue
    
    if (-not (Test-RedisConnection -Url $RedisUrl)) {
        Write-Host "❌ Redis连接测试失败，无法启动MCP" -ForegroundColor Red
        exit 1
    }
    
    # 步骤4: 启动Redis MCP服务器
    Write-Host "`n🚀 步骤4: 启动Redis MCP服务器" -ForegroundColor Blue
    
    if (Start-RedisMCP -Url $RedisUrl) {
        Write-Host "`n🎉 Redis MCP自动启动完成！" -ForegroundColor Green
        Write-Host "📍 Redis URL: $RedisUrl" -ForegroundColor Gray
        Write-Host "🔗 MCP服务器已就绪" -ForegroundColor Gray
    } else {
        Write-Host "❌ Redis MCP启动失败" -ForegroundColor Red
        exit 1
    }
}

# 执行主流程
try {
    Main
}
catch {
    Write-Host "❌ 脚本执行失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ 脚本执行完成" -ForegroundColor Green