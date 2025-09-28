# PostgreSQL服务重启脚本
# 需要以管理员权限运行

Write-Host "🔄 正在重启PostgreSQL服务..." -ForegroundColor Yellow

try {
    # 停止PostgreSQL服务
    Write-Host "⏹️  停止PostgreSQL服务..." -ForegroundColor Cyan
    Stop-Service -Name "postgresql-x64-16" -Force
    Start-Sleep -Seconds 3
    
    # 启动PostgreSQL服务
    Write-Host "▶️  启动PostgreSQL服务..." -ForegroundColor Cyan
    Start-Service -Name "postgresql-x64-16"
    Start-Sleep -Seconds 5
    
    # 检查服务状态
    $service = Get-Service -Name "postgresql-x64-16"
    if ($service.Status -eq "Running") {
        Write-Host "✅ PostgreSQL服务重启成功!" -ForegroundColor Green
        Write-Host "📊 服务状态: $($service.Status)" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL服务启动失败!" -ForegroundColor Red
        Write-Host "📊 服务状态: $($service.Status)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ 重启失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 请确保以管理员权限运行此脚本" -ForegroundColor Yellow
    Write-Host "💡 或者手动在服务管理器中重启PostgreSQL服务" -ForegroundColor Yellow
}

Write-Host "\n📝 完成后可以测试数据库连接" -ForegroundColor Cyan
Write-Host "🔗 连接字符串: postgresql://postgres:113464@localhost:5432/department_map" -ForegroundColor Cyan