@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo Redis Auto Starter
echo ==================

REM Check if Redis is already running
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I "redis-server.exe" >NUL
if not errorlevel 1 (
    echo Redis is already running
    goto :end
)

echo Starting Redis server...

REM Check if Redis executable exists
if not exist "Redis\redis-server.exe" (
    echo Error: Redis executable not found
    exit /b 1
)

REM Check if config file exists  
if not exist "Redis\redis.windows.conf" (
    echo Error: Redis config file not found
    exit /b 1
)

REM Start Redis server in background
start /B "" "Redis\redis-server.exe" "Redis\redis.windows.conf"

REM Wait for startup
timeout /t 3 /nobreak >nul

REM Check if process started
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I "redis-server.exe" >NUL
if not errorlevel 1 (
    echo Redis server started successfully
) else (
    echo Failed to start Redis server
    exit /b 1
)

:end
echo Redis startup check completed
exit /b 0