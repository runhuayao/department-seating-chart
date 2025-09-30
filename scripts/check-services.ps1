# 项目服务检查和自动启动脚本
# 用于在项目启动时检查所有必需的服务

param(
    [switch]$AutoStart,
    [switch]$Quiet,
    [switch]$Force
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

# 检查Redis服务状态
function Test-RedisService {
    try {
        $process = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
        if ($process) {
            Write-ColorOutput "✅ Redis服务正在运行 (PID: $($process.Id))" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Redis服务未运行" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ 检查Redis服务时出错: $($_.Exception.Message)" "Red"
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

# 检查PostgreSQL连接
function Test-DatabaseConnection {
    try {
        Write-ColorOutput "🔍 检查数据库连接..." "Blue"
        
        # 创建临时测试脚本
        $testScript = @"
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'department_map',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

pool.query('SELECT NOW() as current_time')
    .then(result => {
        console.log('DATABASE_CONNECTION_SUCCESS');
        console.log('Current time:', result.rows[0].current_time);
        process.exit(0);
    })
    .catch(err => {
        console.log('DATABASE_CONNECTION_FAILED:', err.message);
        process.exit(1);
    })
    .finally(() => {
        pool.end();
    });
"@
        
        $tempFile = [System.IO.Path]::GetTempFileName() + ".js"
        $testScript | Out-File -FilePath $tempFile -Encoding UTF8
        
        $result = & node $tempFile 2>&1
        Remove-Item $tempFile -Force
        
        if ($result -contains "DATABASE_CONNECTION_SUCCESS") {
            Write-ColorOutput "✅ 数据库连接正常" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ 数据库连接失败: $result" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ 数据库连接测试异常: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 检查Node.js依赖
function Test-NodeDependencies {
    try {
        Write-ColorOutput "📦 检查Node.js依赖..." "Blue"
        
        if (-not (Test-Path "node_modules")) {
            Write-ColorOutput "❌ node_modules目录不存在，需要运行 npm install" "Red"
            return $false
        }
        
        # 检查关键依赖
        $keyDependencies = @("express", "react", "vite", "ioredis", "pg")
        $missingDeps = @()
        
        foreach ($dep in $keyDependencies) {
            if (-not (Test-Path "node_modules\$dep")) {
                $missingDeps += $dep
            }
        }
        
        if ($missingDeps.Count -gt 0) {
            Write-ColorOutput "❌ 缺少关键依赖: $($missingDeps -join ', ')" "Red"
            return $false
        }
        
        Write-ColorOutput "✅ Node.js依赖检查通过" "Green"
        return $true
    }
    catch {
        Write-ColorOutput "❌ 依赖检查异常: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 启动Redis服务
function Start-RedisService {
    try {
        Write-ColorOutput "🚀 启动Redis服务..." "Yellow"
        
        $scriptPath = Join-Path $PSScriptRoot "start-redis.ps1"
        if (Test-Path $scriptPath) {
            $params = @()
            if ($Force) { $params += "-Force" }
            if ($Quiet) { $params += "-Quiet" }
            
            & $scriptPath @params
            return $?
        } else {
            Write-ColorOutput "❌ Redis启动脚本不存在: $scriptPath" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ 启动Redis服务时出错: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 主检查函数
function Invoke-ServiceCheck {
    Write-ColorOutput "🔍 部门地图系统 - 服务检查器" "Cyan"
    Write-ColorOutput "======================================" "Cyan"
    Write-ColorOutput "检查时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Gray"
    Write-ColorOutput ""
    
    $allServicesOk = $true
    
    # 1. 检查Node.js依赖
    Write-ColorOutput "1️⃣ 检查Node.js依赖..." "Blue"
    if (-not (Test-NodeDependencies)) {
        $allServicesOk = $false
        if ($AutoStart) {
            Write-ColorOutput "🔄 自动安装依赖..." "Yellow"
            & npm install
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ 依赖安装完成" "Green"
            } else {
                Write-ColorOutput "❌ 依赖安装失败" "Red"
                $allServicesOk = $false
            }
        }
    }
    
    # 2. 检查Redis服务
    Write-ColorOutput ""
    Write-ColorOutput "2️⃣ 检查Redis服务..." "Blue"
    if (-not (Test-RedisService)) {
        if ($AutoStart) {
            Write-ColorOutput "🔄 自动启动Redis服务..." "Yellow"
            if (Start-RedisService) {
                Write-ColorOutput "✅ Redis服务启动成功" "Green"
            } else {
                Write-ColorOutput "❌ Redis服务启动失败" "Red"
                $allServicesOk = $false
            }
        } else {
            $allServicesOk = $false
        }
    }
    
    # 3. 检查数据库连接
    Write-ColorOutput ""
    Write-ColorOutput "3️⃣ 检查数据库连接..." "Blue"
    if (-not (Test-DatabaseConnection)) {
        Write-ColorOutput "⚠️  数据库连接失败，但系统可以使用内存数据库运行" "Yellow"
        # 数据库连接失败不阻止系统启动，因为有内存备用模式
    }
    
    # 4. 显示服务状态摘要
    Write-ColorOutput ""
    Write-ColorOutput "📊 服务状态摘要:" "Cyan"
    Write-ColorOutput "================================" "Cyan"
    
    # Redis状态
    if (Test-RedisService) {
        Write-ColorOutput "🟢 Redis服务: 运行中" "Green"
    } else {
        Write-ColorOutput "🔴 Redis服务: 未运行" "Red"
    }
    
    # 数据库状态
    if (Test-DatabaseConnection) {
        Write-ColorOutput "🟢 数据库: 连接正常" "Green"
    } else {
        Write-ColorOutput "🟡 数据库: 使用内存模式" "Yellow"
    }
    
    # Node.js依赖状态
    if (Test-NodeDependencies) {
        Write-ColorOutput "🟢 依赖包: 完整" "Green"
    } else {
        Write-ColorOutput "🔴 依赖包: 不完整" "Red"
    }
    
    Write-ColorOutput ""
    
    if ($allServicesOk) {
        Write-ColorOutput "🎉 所有服务检查通过，系统可以正常启动！" "Green"
        return $true
    } else {
        Write-ColorOutput "⚠️  部分服务存在问题，但系统仍可启动" "Yellow"
        Write-ColorOutput "   建议运行: .\scripts\check-services.ps1 -AutoStart" "Gray"
        return $false
    }
}

# 脚本入口点
if ($MyInvocation.InvocationName -ne '.') {
    $result = Invoke-ServiceCheck
    if ($result) {
        exit 0
    } else {
        exit 1
    }
}