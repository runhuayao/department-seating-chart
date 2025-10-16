# 简化的Docker部署测试脚本
param([switch]$Verbose)

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Docker {
    Write-Status "检查Docker状态..." "Blue"
    try {
        docker --version | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ Docker运行正常" "Green"
            return $true
        }
    }
    catch {
        Write-Status "❌ Docker未运行" "Red"
        return $false
    }
    return $false
}

function Start-TestEnv {
    Write-Status "启动测试环境..." "Blue"
    try {
        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>&1 | Out-Null
        docker-compose -f docker-compose.test.yml up -d --build
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ 测试环境启动成功" "Green"
            return $true
        }
    }
    catch {
        Write-Status "❌ 启动失败" "Red"
        return $false
    }
    return $false
}

function Wait-Services {
    Write-Status "等待服务就绪..." "Blue"
    $maxWait = 120
    $waited = 0
    
    while ($waited -lt $maxWait) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8081/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Status "✅ 服务就绪 (耗时: $waited 秒)" "Green"
                return $true
            }
        }
        catch { }
        
        Start-Sleep -Seconds 5
        $waited += 5
        Write-Status "等待中... ($waited/$maxWait 秒)" "Cyan"
    }
    
    Write-Status "❌ 服务启动超时" "Red"
    return $false
}

function Test-Network {
    Write-Status "测试网络连通性..." "Blue"
    $success = $true
    
    try {
        docker exec api-test redis-cli -h redis-test ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ API到Redis连接正常" "Green"
        } else {
            Write-Status "❌ API到Redis连接失败" "Red"
            $success = $false
        }
    }
    catch {
        Write-Status "❌ 网络测试异常" "Red"
        $success = $false
    }
    
    return $success
}

function Test-API {
    Write-Status "测试API服务..." "Blue"
    $success = $true
    
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:8081/health" -TimeoutSec 10
        if ($health.StatusCode -eq 200) {
            Write-Status "✅ 健康检查通过" "Green"
            if ($Verbose) {
                Write-Status "响应: $($health.Content)" "White"
            }
        } else {
            Write-Status "❌ 健康检查失败" "Red"
            $success = $false
        }
    }
    catch {
        Write-Status "❌ API测试异常: $($_.Exception.Message)" "Red"
        $success = $false
    }
    
    return $success
}

function Get-Resources {
    Write-Status "检查容器资源..." "Blue"
    try {
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        Write-Status "容器资源使用情况:" "White"
        Write-Status $stats "White"
        return $true
    }
    catch {
        Write-Status "❌ 资源检查失败" "Red"
        return $false
    }
}

function Cleanup {
    Write-Status "清理测试环境..." "Blue"
    try {
        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>&1 | Out-Null
        Write-Status "✅ 清理完成" "Green"
    }
    catch {
        Write-Status "⚠️ 清理警告" "Yellow"
    }
}

# 主执行流程
Write-Status "🚀 开始Docker部署测试" "Blue"
Write-Status "=" * 40 "Blue"

$dockerOk = Test-Docker
if (-not $dockerOk) {
    Write-Status "❌ Docker检查失败，退出" "Red"
    exit 1
}

$envOk = Start-TestEnv
if (-not $envOk) {
    Write-Status "❌ 环境启动失败，退出" "Red"
    exit 1
}

$servicesOk = Wait-Services
$networkOk = Test-Network
$apiOk = Test-API
$resourcesOk = Get-Resources

Write-Status "`n📋 测试结果" "Blue"
Write-Status "=" * 40 "Blue"
Write-Status "Docker状态: $(if($dockerOk) {'✅'} else {'❌'})" $(if($dockerOk) {"Green"} else {"Red"})
Write-Status "环境启动: $(if($envOk) {'✅'} else {'❌'})" $(if($envOk) {"Green"} else {"Red"})
Write-Status "服务就绪: $(if($servicesOk) {'✅'} else {'❌'})" $(if($servicesOk) {"Green"} else {"Red"})
Write-Status "网络连通: $(if($networkOk) {'✅'} else {'❌'})" $(if($networkOk) {"Green"} else {"Red"})
Write-Status "API功能: $(if($apiOk) {'✅'} else {'❌'})" $(if($apiOk) {"Green"} else {"Red"})
Write-Status "资源检查: $(if($resourcesOk) {'✅'} else {'❌'})" $(if($resourcesOk) {"Green"} else {"Red"})

$allOk = $dockerOk -and $envOk -and $servicesOk -and $networkOk -and $apiOk -and $resourcesOk

if ($allOk) {
    Write-Status "`n🎉 所有测试通过！Docker环境部署成功！" "Green"
} else {
    Write-Status "`n⚠️ 部分测试失败，请检查配置" "Yellow"
}

Cleanup

if ($allOk) { exit 0 } else { exit 1 }