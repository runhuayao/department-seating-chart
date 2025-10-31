# GitHub 上传指南

本文档将指导您如何将部门地图项目上传到GitHub平台。

## 📋 准备工作检查清单

✅ **已完成的准备工作**：
- [x] 更新了 `.gitignore` 文件，排除敏感信息和不必要的文件
- [x] 清理了硬编码的密码和敏感信息
- [x] 更新了 `README.md` 文档，包含完整的项目说明
- [x] 添加了 `LICENSE` 文件 (MIT许可证)
- [x] 提交了所有更改到本地Git仓库
- [x] 合并了功能分支到master分支

## 🚀 上传到GitHub的步骤

### 步骤1: 创建GitHub仓库

1. **登录GitHub**
   - 访问 https://github.com
   - 登录您的GitHub账户

2. **创建新仓库**
   - 点击右上角的 "+" 按钮
   - 选择 "New repository"
   - 填写仓库信息：
     - **Repository name**: `department-seating-chart`
     - **Description**: `企业级实时座位管理系统 - 基于WebSocket和PostgreSQL的部门地图解决方案`
     - **Visibility**: 选择 Public 或 Private
     - **不要**勾选 "Initialize this repository with a README"
     - **不要**添加 .gitignore 或 license（我们已经有了）

3. **获取仓库URL**
   - 创建后，复制仓库的HTTPS URL
   - 格式类似：`https://github.com/YOUR_USERNAME/department-seating-chart.git`

### 步骤2: 配置远程仓库

在项目目录中打开PowerShell，执行以下命令：

```powershell
# 更新远程仓库URL（替换YOUR_USERNAME为您的GitHub用户名）
git remote set-url origin https://github.com/YOUR_USERNAME/department-seating-chart.git

# 验证远程仓库配置
git remote -v
```

### 步骤3: 推送代码到GitHub

```powershell
# 推送master分支到GitHub
git push -u origin master

# 推送所有分支（可选）
git push --all origin

# 推送标签（如果有的话）
git push --tags origin
```

### 步骤4: 验证上传

1. **检查GitHub仓库**
   - 刷新GitHub仓库页面
   - 确认所有文件都已上传
   - 检查README.md是否正确显示

2. **验证文件结构**
   确认以下重要文件都已上传：
   - ✅ `README.md` - 项目说明文档
   - ✅ `LICENSE` - MIT许可证
   - ✅ `package.json` - 项目依赖
   - ✅ `.gitignore` - Git忽略规则
   - ✅ `src/` - 前端源代码
   - ✅ `api/` - 后端API代码
   - ✅ `CHANGELOG.md` - 版本更新历史

## 🔒 安全检查

### 确认以下敏感信息已被排除：

- ❌ 数据库密码（已使用环境变量替代）
- ❌ API密钥和令牌
- ❌ `pgpass.txt` 文件（已删除）
- ❌ `node_modules/` 目录
- ❌ `.env` 文件（只保留 `.env.example`）
- ❌ 构建产物和临时文件

### 环境变量配置

用户需要创建自己的 `.env` 文件：

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入实际的配置信息
```

## 📝 后续维护

### 定期更新

```powershell
# 添加新的更改
git add .

# 提交更改
git commit -m "feat: 添加新功能描述"

# 推送到GitHub
git push origin master
```

### 版本标签

```powershell
# 创建版本标签
git tag -a v3.2.2 -m "Release version 3.2.2"

# 推送标签到GitHub
git push origin v3.2.2
```

## 🎯 GitHub仓库优化建议

### 1. 设置仓库描述和标签

在GitHub仓库页面：
- 添加详细的仓库描述
- 设置相关标签：`react`, `typescript`, `websocket`, `postgresql`, `redis`, `seating-chart`
- 设置仓库主页URL（如果有演示站点）

### 2. 配置GitHub Pages（可选）

如果需要展示项目文档：
- 进入仓库设置
- 找到 "Pages" 选项
- 选择源分支和文件夹

### 3. 设置Issue模板

创建 `.github/ISSUE_TEMPLATE/` 目录，添加：
- Bug报告模板
- 功能请求模板
- 问题分类标签

### 4. 添加贡献指南

创建 `CONTRIBUTING.md` 文件，说明：
- 代码贡献流程
- 代码规范要求
- Pull Request模板

## ❗ 故障排除

### 推送失败的常见原因

1. **网络连接问题**
   ```powershell
   # 检查网络连接
   ping github.com
   
   # 使用SSH替代HTTPS（如果配置了SSH密钥）
   git remote set-url origin git@github.com:YOUR_USERNAME/department-seating-chart.git
   ```

2. **认证问题**
   - 确保GitHub用户名和密码正确
   - 如果启用了2FA，需要使用Personal Access Token
   - 考虑配置SSH密钥进行认证

3. **仓库权限问题**
   - 确认您有仓库的写入权限
   - 检查仓库是否存在且URL正确

### 获取帮助

如果遇到问题，可以：
1. 查看GitHub官方文档
2. 检查Git命令的详细错误信息
3. 在项目Issues中提问

---

**完成上传后，您的部门地图项目就可以在GitHub上公开分享了！** 🎉

## 📊 项目统计信息

- **代码行数**: 约50,000+行
- **文件数量**: 200+个文件
- **技术栈**: React + TypeScript + Node.js + PostgreSQL + Redis
- **功能模块**: 15+个核心模块
- **文档完整度**: 95%+

祝您上传顺利！如有问题，请参考故障排除部分或联系技术支持。