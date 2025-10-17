# Simple PostgreSQL Status Check Script
# For existing local PostgreSQL environment

Write-Host "PostgreSQL Status Check" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green

# Check PostgreSQL Service
Write-Host "Checking PostgreSQL service..." -ForegroundColor Cyan

$services = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue

if (-not $services) {
    Write-Host "No PostgreSQL service found" -ForegroundColor Red
    Write-Host "Please check if PostgreSQL is installed" -ForegroundColor Yellow
    exit 1
}

if ($services -is [array]) {
    Write-Host "Found multiple PostgreSQL services:" -ForegroundColor Green
    foreach ($service in $services) {
        $status = if ($service.Status -eq "Running") { "RUNNING" } else { "STOPPED" }
        Write-Host "  - $($service.Name): $status" -ForegroundColor White
    }
    $mainService = $services[0]
} else {
    $status = if ($services.Status -eq "Running") { "RUNNING" } else { "STOPPED" }
    Write-Host "Found PostgreSQL service: $($services.Name) - $status" -ForegroundColor Green
    $mainService = $services
}

# Start service if stopped
if ($mainService.Status -ne "Running") {
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Cyan
    try {
        Start-Service -Name $mainService.Name
        Start-Sleep -Seconds 3
        $updatedService = Get-Service -Name $mainService.Name
        if ($updatedService.Status -eq "Running") {
            Write-Host "PostgreSQL service started successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to start PostgreSQL service" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error starting service: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "You may need administrator privileges" -ForegroundColor Yellow
    }
} else {
    Write-Host "PostgreSQL service is already running" -ForegroundColor Green
}

# Test database connection
Write-Host "Testing database connection..." -ForegroundColor Cyan

$envFile = ".\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    $dbHost = ($envContent | Where-Object { $_ -match "^DB_HOST=" }) -replace "DB_HOST=", ""
    $dbPort = ($envContent | Where-Object { $_ -match "^DB_PORT=" }) -replace "DB_PORT=", ""
    $dbName = ($envContent | Where-Object { $_ -match "^DB_NAME=" }) -replace "DB_NAME=", ""
    $dbUser = ($envContent | Where-Object { $_ -match "^DB_USER=" }) -replace "DB_USER=", ""
    
    Write-Host "Database Configuration:" -ForegroundColor Yellow
    Write-Host "  Host: $dbHost" -ForegroundColor White
    Write-Host "  Port: $dbPort" -ForegroundColor White
    Write-Host "  Database: $dbName" -ForegroundColor White
    Write-Host "  User: $dbUser" -ForegroundColor White
    
    # Test port connectivity
    try {
        $connection = Test-NetConnection -ComputerName $dbHost -Port $dbPort -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "Port $dbPort is accessible" -ForegroundColor Green
        } else {
            Write-Host "Port $dbPort is not accessible" -ForegroundColor Red
        }
    } catch {
        Write-Host "Network test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host ".env file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Connection Information:" -ForegroundColor Cyan
Write-Host "Connection String: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor Cyan

Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  Check services: Get-Service -Name '*postgresql*'" -ForegroundColor White
Write-Host "  Restart service: Restart-Service -Name 'postgresql*'" -ForegroundColor White
Write-Host "  Check port: netstat -an | findstr :5432" -ForegroundColor White