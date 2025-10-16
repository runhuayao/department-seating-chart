# Docker Deployment Test Script
param([switch]$Verbose)

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Docker {
    Write-Status "Checking Docker status..." "Blue"
    try {
        docker --version | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "[OK] Docker is running" "Green"
            return $true
        }
    }
    catch {
        Write-Status "[ERROR] Docker is not running" "Red"
        return $false
    }
    return $false
}

function Start-TestEnv {
    Write-Status "Starting test environment..." "Blue"
    try {
        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>&1 | Out-Null
        docker-compose -f docker-compose.test.yml up -d --build
        if ($LASTEXITCODE -eq 0) {
            Write-Status "[OK] Test environment started" "Green"
            return $true
        }
    }
    catch {
        Write-Status "[ERROR] Failed to start environment" "Red"
        return $false
    }
    return $false
}

function Wait-Services {
    Write-Status "Waiting for services to be ready..." "Blue"
    $maxWait = 120
    $waited = 0
    
    while ($waited -lt $maxWait) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8081/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Status "[OK] Services ready (took $waited seconds)" "Green"
                return $true
            }
        }
        catch { }
        
        Start-Sleep -Seconds 5
        $waited += 5
        Write-Status "Waiting... ($waited/$maxWait seconds)" "Cyan"
    }
    
    Write-Status "[ERROR] Service startup timeout" "Red"
    return $false
}

function Test-Network {
    Write-Status "Testing network connectivity..." "Blue"
    $success = $true
    
    try {
        docker exec api-test redis-cli -h redis-test ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "[OK] API to Redis connection works" "Green"
        } else {
            Write-Status "[ERROR] API to Redis connection failed" "Red"
            $success = $false
        }
    }
    catch {
        Write-Status "[ERROR] Network test exception" "Red"
        $success = $false
    }
    
    return $success
}

function Test-API {
    Write-Status "Testing API service..." "Blue"
    $success = $true
    
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:8081/health" -TimeoutSec 10
        if ($health.StatusCode -eq 200) {
            Write-Status "[OK] Health check passed" "Green"
            if ($Verbose) {
                Write-Status "Response: $($health.Content)" "White"
            }
        } else {
            Write-Status "[ERROR] Health check failed" "Red"
            $success = $false
        }
    }
    catch {
        Write-Status "[ERROR] API test exception: $($_.Exception.Message)" "Red"
        $success = $false
    }
    
    return $success
}

function Get-Resources {
    Write-Status "Checking container resources..." "Blue"
    try {
        $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        Write-Status "Container resource usage:" "White"
        Write-Status $stats "White"
        return $true
    }
    catch {
        Write-Status "[ERROR] Resource check failed" "Red"
        return $false
    }
}

function Cleanup {
    Write-Status "Cleaning up test environment..." "Blue"
    try {
        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>&1 | Out-Null
        Write-Status "[OK] Cleanup completed" "Green"
    }
    catch {
        Write-Status "[WARNING] Cleanup warning" "Yellow"
    }
}

# Main execution flow
Write-Status "Starting Docker deployment test" "Blue"
Write-Status "========================================" "Blue"

$dockerOk = Test-Docker
if (-not $dockerOk) {
    Write-Status "[ERROR] Docker check failed, exiting" "Red"
    exit 1
}

$envOk = Start-TestEnv
if (-not $envOk) {
    Write-Status "[ERROR] Environment startup failed, exiting" "Red"
    exit 1
}

$servicesOk = Wait-Services
$networkOk = Test-Network
$apiOk = Test-API
$resourcesOk = Get-Resources

Write-Status "" "White"
Write-Status "Test Results" "Blue"
Write-Status "========================================" "Blue"

$results = @(
    @{ Name = "Docker Status"; Status = $dockerOk },
    @{ Name = "Environment Startup"; Status = $envOk },
    @{ Name = "Services Ready"; Status = $servicesOk },
    @{ Name = "Network Connectivity"; Status = $networkOk },
    @{ Name = "API Functionality"; Status = $apiOk },
    @{ Name = "Resource Check"; Status = $resourcesOk }
)

$passedCount = 0
foreach ($result in $results) {
    $status = if ($result.Status) { "[PASS]" } else { "[FAIL]" }
    $color = if ($result.Status) { "Green" } else { "Red" }
    Write-Status "$($result.Name): $status" $color
    if ($result.Status) { $passedCount++ }
}

$allOk = $passedCount -eq $results.Count

Write-Status "" "White"
Write-Status "Summary: $passedCount/$($results.Count) tests passed" "Blue"

if ($allOk) {
    Write-Status "All tests passed! Docker environment deployment successful!" "Green"
} else {
    Write-Status "Some tests failed, please check configuration" "Yellow"
}

Cleanup

if ($allOk) { exit 0 } else { exit 1 }