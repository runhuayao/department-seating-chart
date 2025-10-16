# Docker部署测试脚本
# 用于测试API服务和Redis服务的独立部署和容器间通信

param(
    [switch]$Verbose
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $colorMap = @{
        "Red" = "Red"
        "Green" = "Green"
        "Blue" = "Blue"
        "Yellow" = "Yellow"
        "Cyan" = "Cyan"
        "Magenta" = "Magenta"
        "White" = "White"
    }
    
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

# 检查Docker运行状态
function Test-DockerStatus {
    Write-ColorOutput "🐳 检查Docker运行状态..." "Blue"
    
    try {
        $dockerVersion = docker --version
        Write-ColorOutput "  ✅ Docker已安装: $dockerVersion" "Green"
        
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  ✅ Docker服务正在运行" "Green"
            return $true
        } else {
            Write-ColorOutput "  ❌ Docker服务未运行" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "  ❌ Docker未安装或不可用" "Red"
        return $false
    }
}

# 清理测试环境
function Clear-TestEnvironment {
    Write-ColorOutput "🧹 清理测试环境..." "Blue"
    
    try {
        # 停止并删除测试容器
        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>&1 | Out-Null
        Write-ColorOutput "  ✅ 测试环境已清理" "Green"
        return $true
    }
    catch {
        Write-ColorOutput "  ⚠️ 清理过程中出现警告: $($_.Exception.Message)" "Yellow"
        return $true
    }
}

# 启动测试环境
function Start-TestEnvironment {
    Write-ColorOutput "🚀 启动测试环境..." "Blue"
    
    try {
        # 构建并启动测试容器
        docker-compose -f docker-compose.test.yml up -d --build
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  ✅ 测试环境启动成功" "Green"
            return $true
        } else {
            Write-ColorOutput "  ❌ 测试环境启动失败" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "  ❌ 启动异常: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 等待服务就绪
function Wait-ForServices {
    Write-ColorOutput "⏳ 等待服务就绪..." "Blue"
    
    $maxWaitTime = 120
    $waitInterval = 5
    $elapsedTime = 0
    
    while ($elapsedTime -lt $maxWaitTime) {
        try {
            # 检查API服务健康状态
            $apiHealth = Invoke-WebRequest -Uri "http://localhost:8081/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
            
            if ($apiHealth.StatusCode -eq 200) {
                Write-ColorOutput "  ✅ 服务已就绪 (耗时: $elapsedTime 秒)" "Green"
                return $true
            }
        }
        catch {
            # 继续等待
        }
        
        Write-ColorOutput "  ⏳ 等待中... ($elapsedTime/$maxWaitTime 秒)" "Cyan"
        Start-Sleep -Seconds $waitInterval
        $elapsedTime += $waitInterval
    }
    
    Write-ColorOutput "  ❌ 服务启动超时" "Red"
    return $false
}

# 测试容器间网络连通性
function Test-NetworkConnectivity {
    Write-ColorOutput "🌐 测试容器间网络连通性..." "Blue"
    
    $tests = @(
        @{
            Name = "API到Redis连接"
            Description = "测试API容器是否能连接到Redis容器"
            Command = "docker exec api-test redis-cli -h redis-test ping"
        },
        @{
            Name = "API到PostgreSQL连接"
            Description = "测试API容器是否能连接到PostgreSQL容器"
            Command = "docker exec api-test pg_isready -h postgres-test -p 5432"
        }
    )
    
    $allPassed = $true
    
    foreach ($test in $tests) {
        Write-ColorOutput "  测试: $($test.Description)" "Cyan"
        
        try {
            $result = Invoke-Expression $test.Command
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "  ✅ $($test.Name) 通过" "Green"
            } else {
                Write-ColorOutput "  ❌ $($test.Name) 失败" "Red"
                $allPassed = $false
            }
        }
        catch {
            Write-ColorOutput "  ❌ $($test.Name) 异常: $($_.Exception.Message)" "Red"
            $allPassed = $false
        }
    }
    
    return $allPassed
}

# 测试API服务功能
function Test-ApiService {
    Write-ColorOutput "🔧 测试API服务功能..." "Blue"
    
    $apiTests = @(
        @{ 
            Name = "健康检查"
            Url = "http://localhost:8081/health"
            Method = "GET"
            ExpectedStatus = 200
        },
        @{ 
            Name = "Redis连接状态"
            Url = "http://localhost:8081/api/redis/status"
            Method = "GET"
            ExpectedStatus = 200
        }
    )
    
    $allPassed = $true
    
    foreach ($test in $apiTests) {
        Write-ColorOutput "  测试: $($test.Name)" "Cyan"
        
        try {
            $response = Invoke-WebRequest -Uri $test.Url -Method $test.Method -TimeoutSec 10
            
            if ($response.StatusCode -eq $test.ExpectedStatus) {
                Write-ColorOutput "  ✅ $($test.Name) 通过 (状态码: $($response.StatusCode))" "Green"
                
                if ($Verbose) {
                    Write-ColorOutput "    响应内容: $($response.Content)" "White"
                }
            } else {
                Write-ColorOutput "  ❌ $($test.Name) 失败 (状态码: $($response.StatusCode))" "Red"
                $allPassed = $false
            }
        }
        catch {
            Write-ColorOutput "  ❌ $($test.Name) 异常: $($_.Exception.Message)" "Red"
            $allPassed = $false
        }
    }
    
    return $allPassed
}

# 检查容器资源使用情况
function Get-ContainerResources {
    Write-ColorOutput "📊 检查容器资源使用情况..." "Blue"
    
    try {
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
        
        Write-ColorOutput "容器资源使用情况:" "White"
        Write-ColorOutput $stats "White"
        
        return $true
    }
    catch {
        Write-ColorOutput "❌ 获取容器资源信息失败: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 生成测试报告
function Generate-TestReport {
    param(
        [bool]$DockerStatus,
        [bool]$EnvironmentStarted,
        [bool]$ServicesReady,
        [bool]$NetworkConnectivity,
        [bool]$ApiService,
        [bool]$ResourcesChecked
    )
    
    Write-ColorOutput "`n📋 测试报告" "Blue"
    Write-ColorOutput "=" * 50 "Blue"
    
    $tests = @(
        @{ Name = "Docker状态检查"; Status = $DockerStatus },
        @{ Name = "测试环境启动"; Status = $EnvironmentStarted },
        @{ Name = "服务就绪检查"; Status = $ServicesReady },
        @{ Name = "网络连通性测试"; Status = $NetworkConnectivity },
        @{ Name = "API服务功能测试"; Status = $ApiService },
        @{ Name = "资源使用情况检查"; Status = $ResourcesChecked }
    )
    
    $passedCount = 0
    $totalCount = $tests.Count
    
    foreach ($test in $tests) {
        $status = if ($test.Status) { "✅ 通过" } else { "❌ 失败" }
        $color = if ($test.Status) { "Green" } else { "Red" }
        
        Write-ColorOutput "$($test.Name): $status" $color
        
        if ($test.Status) {
            $passedCount++
        }
    }
    
    Write-ColorOutput "`n总结: $passedCount/$totalCount 项测试通过" "Blue"
    
    if ($passedCount -eq $totalCount) {
        Write-ColorOutput "🎉 所有测试通过！Docker环境部署成功！" "Green"
        return $true
    } else {
        Write-ColorOutput "⚠️ 部分测试失败，请检查配置" "Yellow"
        return $false
    }
}

# 主函数
function Main {
    Write-ColorOutput "🚀 开始Docker部署测试" "Blue"
    Write-ColorOutput "=" * 50 "Blue"
    
    # 执行测试步骤
    $dockerStatus = Test-DockerStatus
    if (-not $dockerStatus) {
        Write-ColorOutput "❌ Docker未运行，测试终止" "Red"
        return
    }
    
    $environmentCleared = Clear-TestEnvironment
    $environmentStarted = Start-TestEnvironment
    
    if (-not $environmentStarted) {
        Write-ColorOutput "❌ 测试环境启动失败，测试终止" "Red"
        return
    }
    
    $servicesReady = Wait-ForServices
    $networkConnectivity = Test-NetworkConnectivity
    $apiService = Test-ApiService
    $resourcesChecked = Get-ContainerResources
    
    # 生成测试报告
    $overallSuccess = Generate-TestReport -DockerStatus $dockerStatus -EnvironmentStarted $environmentStarted -ServicesReady $servicesReady -NetworkConnectivity $networkConnectivity -ApiService $apiService -ResourcesChecked $resourcesChecked
    
    # 清理环境（可选）
    Write-ColorOutput "`n🧹 清理测试环境..." "Blue"
    Clear-TestEnvironment
    
    if ($overallSuccess) {
        exit 0
    } else {
        exit 1
    }
}

# 执行主函数
Main