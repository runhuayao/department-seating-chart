# 标签同步检查和同步脚本
# Tag Synchronization Check and Sync Script

param(
    [switch]$Check,      # 仅检查差异
    [switch]$Sync,       # 执行同步
    [switch]$Force       # 强制同步
)

Write-Host "=== 部门地图项目标签同步工具 ===" -ForegroundColor Green
Write-Host "Tag Synchronization Tool for Department Seating Chart" -ForegroundColor Green
Write-Host ""

# 检查Git仓库状态
if (-not (Test-Path ".git")) {
    Write-Error "错误：当前目录不是Git仓库"
    exit 1
}

# 获取远程仓库信息
Write-Host "检查远程仓库配置..." -ForegroundColor Yellow
$remotes = git remote -v
Write-Host $remotes

# 获取GitHub标签
Write-Host "`n获取GitHub标签..." -ForegroundColor Yellow
try {
    $githubTags = git ls-remote --tags origin 2>$null | ForEach-Object {
        if ($_ -match "refs/tags/(.+)$") {
            $matches[1] -replace '\^\{\}$', ''
        }
    } | Where-Object { $_ -and $_ -notmatch '\^\{\}$' } | Sort-Object -Unique
    Write-Host "GitHub标签数量: $($githubTags.Count)" -ForegroundColor Green
} catch {
    Write-Error "无法获取GitHub标签: $_"
    $githubTags = @()
}

# 获取GitLab标签
Write-Host "`n获取GitLab标签..." -ForegroundColor Yellow
try {
    $gitlabTags = git ls-remote --tags gitlab 2>$null | ForEach-Object {
        if ($_ -match "refs/tags/(.+)$") {
            $matches[1] -replace '\^\{\}$', ''
        }
    } | Where-Object { $_ -and $_ -notmatch '\^\{\}$' } | Sort-Object -Unique
    Write-Host "GitLab标签数量: $($gitlabTags.Count)" -ForegroundColor Green
} catch {
    Write-Error "无法获取GitLab标签: $_"
    $gitlabTags = @()
}

# 获取本地标签
Write-Host "`n获取本地标签..." -ForegroundColor Yellow
$localTags = git tag -l | Sort-Object
Write-Host "本地标签数量: $($localTags.Count)" -ForegroundColor Green

# 分析差异
Write-Host "`n=== 标签差异分析 ===" -ForegroundColor Cyan

# GitHub缺失的标签
$missingInGitHub = $localTags | Where-Object { $_ -notin $githubTags }
if ($missingInGitHub) {
    Write-Host "`nGitHub缺失的标签:" -ForegroundColor Red
    $missingInGitHub | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
} else {
    Write-Host "`n✅ GitHub标签完整" -ForegroundColor Green
}

# GitLab缺失的标签
$missingInGitLab = $localTags | Where-Object { $_ -notin $gitlabTags }
if ($missingInGitLab) {
    Write-Host "`nGitLab缺失的标签:" -ForegroundColor Red
    $missingInGitLab | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
} else {
    Write-Host "`n✅ GitLab标签完整" -ForegroundColor Green
}

# 本地缺失的标签
$missingLocally = ($githubTags + $gitlabTags) | Sort-Object -Unique | Where-Object { $_ -notin $localTags }
if ($missingLocally) {
    Write-Host "`n本地缺失的标签:" -ForegroundColor Yellow
    $missingLocally | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

# 仅检查模式
if ($Check) {
    Write-Host "`n=== 检查完成 ===" -ForegroundColor Green
    exit 0
}

# 同步模式
if ($Sync -or $Force) {
    Write-Host "`n=== 开始同步标签 ===" -ForegroundColor Cyan
    
    # 同步到GitHub
    if ($missingInGitHub -or $Force) {
        Write-Host "`n同步标签到GitHub..." -ForegroundColor Yellow
        try {
            if ($Force) {
                git push origin --tags --force
            } else {
                git push origin --tags
            }
            Write-Host "✅ GitHub同步完成" -ForegroundColor Green
        } catch {
            Write-Error "GitHub同步失败: $_"
        }
    }
    
    # 同步到GitLab
    if ($missingInGitLab -or $Force) {
        Write-Host "`n同步标签到GitLab..." -ForegroundColor Yellow
        try {
            if ($Force) {
                git push gitlab --tags --force
            } else {
                git push gitlab --tags
            }
            Write-Host "✅ GitLab同步完成" -ForegroundColor Green
        } catch {
            Write-Error "GitLab同步失败: $_"
        }
    }
    
    # 获取远程标签到本地
    if ($missingLocally) {
        Write-Host "`n获取远程标签到本地..." -ForegroundColor Yellow
        try {
            git fetch origin --tags
            git fetch gitlab --tags
            Write-Host "✅ 本地标签更新完成" -ForegroundColor Green
        } catch {
            Write-Error "本地标签更新失败: $_"
        }
    }
    
    Write-Host "`n=== 同步完成 ===" -ForegroundColor Green
} else {
    Write-Host "`n使用参数:" -ForegroundColor Cyan
    Write-Host "  -Check  : 仅检查标签差异"
    Write-Host "  -Sync   : 执行标签同步"
    Write-Host "  -Force  : 强制同步所有标签"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\sync-tags.ps1 -Check"
    Write-Host "  .\sync-tags.ps1 -Sync"
    Write-Host "  .\sync-tags.ps1 -Force"
}

Write-Host ""