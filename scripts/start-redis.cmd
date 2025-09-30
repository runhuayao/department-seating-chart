@echo off
REM Redis自动启动批处理脚本
REM 用于在项目启动时自动检查和启动Redis服务

setlocal enabledelayedexpansion

echo.
echo 🔍 Redis自动启动检查器
echo ================================

REM 检查Redis进程是否运行
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Redis进程已运行
    goto :test_connection
)

echo 🚀 启动Redis服务器...

REM 检查Redis可执行文件是否存在
if not exist "Redis\redis-server.exe" (
    echo ❌ Redis可执行文件不存在: Redis\redis-server.exe
    exit /b 1
)

REM 检查配置文件是否存在
if not exist "Redis\redis.windows.conf" (
    echo ❌ Redis配置文件不存在: Redis\redis.windows.conf
    exit /b 1
)

REM 启动Redis服务器
start /B "" "Redis\redis-server.exe" "Redis\redis.windows.conf"

REM 等待服务启动
timeout /t 3 /nobreak >nul

REM 再次检查进程
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Redis服务器启动成功
) else (
    echo ❌ Redis服务器启动失败
    exit /b 1
)

:test_connection
echo 🔍 测试Redis连接...

REM 创建临时Node.js测试脚本
set TEMP_FILE=%TEMP%\redis-test-%RANDOM%.js
(
echo const Redis = require('ioredis'^);
echo const redis = new Redis({
echo     host: 'localhost',
echo     port: 6379,
echo     retryDelayOnFailover: 100,
echo     maxRetriesPerRequest: 3,
echo     lazyConnect: true
echo }^);
echo.
echo redis.ping(^)
echo     .then(^(^) =^> {
echo         console.log('REDIS_CONNECTION_SUCCESS'^);
echo         process.exit(0^);
echo     }^)
echo     .catch(^(err^) =^> {
echo         console.log('REDIS_CONNECTION_FAILED:', err.message^);
echo         process.exit(1^);
echo     }^);
) > "%TEMP_FILE%"

REM 执行测试
node "%TEMP_FILE%" 2>nul | find "REDIS_CONNECTION_SUCCESS" >nul
if "%ERRORLEVEL%"=="0" (
    echo ✅ Redis连接测试成功
    del "%TEMP_FILE%" 2>nul
    echo.
    echo 🎉 Redis服务启动并连接成功！
    echo    访问地址: localhost:6379
    exit /b 0
) else (
    echo ❌ Redis连接测试失败
    del "%TEMP_FILE%" 2>nul
    exit /b 1
)

endlocal