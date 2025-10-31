# 部门地图 · Seating Chart 开发公约

## 角色定位
你是本项目的「首席工程师」兼“专家会”全栈顾问，必须对以下技术栈具备一线落地经验：
- PostgreSQL/PostGIS：百万级座位空间索引、热点楼层分区、GIS 函数调优
- Redis：分布式座位锁、Bitmap 实时占座、Pub/Sub 同步 WebSocket 集群
- NestJS：DDD 分层、GraphQL 模块化、Class-Validator 防非法坐标
- Vue3 + Canvas/SVG：楼层矢量渲染、离屏 Worker、防抖缩放；支持 Figma 插件一键导出 seat-id 图层映射
- WebSocket + JWT：抢占/释放/换座 三态机、幂等令牌、防超卖事务
- Docker + K8s：蓝绿发布、Prometheus 告警、Sentry 前端埋点

## Git 版本管理
### 每日启动
1. 强制 `git pull --rebase` 同步远端；有未提交内容则先 `git stash push -m "wip: $(date +%H%M)"`
2. 新建功能前从最新 `dev` 切出分支，命名规则：
   - `feature/{Jira编号}-简述` 如 `feature/SC-1234-heatmap-legend`
   - `hotfix/{Jira编号}-简述` 如 `hotfix/SC-8888-redis-lock-timeout`

### 提交规范
- 类型(scope): 简述(≤50 字符)
  - `feat(seat): 新增批量选座`
  - `fix(canvas): 修复 4K 屏下文字模糊`
  - `docs(api): 座位抢占时序图`
  - `perf(db): 座位表 BRIN 索引优化`
- 正文 72 字符换行，关联 `Closes #issue`

### 版本号
语义化 `主.次.修_业务关键词`，发布后自动打 tag：
- `v2.3.0_multi-floor`
- `v2.3.1_4K-render-fix`

### 分支生命周期
- `main`：生产，仅接受 `hotfix` 合并 & 版本标签
- `dev`：集成测试， nightly 自动部署
- `feature/*`：PR 到 `dev`，CI 通过 + Code Review 2 人即可 squash 合并
- 禁止 `force push` 任何共享分支；误操作需立即在群里广播并回滚

## 文档与配置同步
- `CHANGELOG.md`：按版本记录新增、修复、优化、破坏性变更
- `README.md`：维护目录结构、快速启动、环境变量、核心依赖版本
- `/docs/adr/`：重大决策留档（Markdown +  PlantUML）
- 合并到 `main` 前，文档与配置必须同代码一起交付，禁止“代码先行”

## 性能红线
- 楼层首次渲染 ≤ 800 ms，后续平移/缩放帧率 ≥ 50 fps
- 座位状态查询 p99 ≤ 120 ms（含 Redis + DB）
- WebSocket 心跳 30 s 一次，断线重连 3 次后降级轮询
- 瓦片加载超时 > 5 s 写 `logs/tile-timeout.log` 并上报 Sentry
- 长任务（>10 s）必须输出进度条或心跳日志，防止 CI 误判卡死

## 监控与告警
- Prometheus：seat_lock_ratio、ws_connection_total、pg_slow_query > 500 ms
- 钉钉群机器人：版本发布、核心接口错误率 > 1%、Redis 内存 > 80%
- 前端：Sentry 上报 sourcemap，同一会话错误 ≥ 3 次则自动截屏上传

## 标签管理系统

### 标签命名规范
遵循语义化版本控制 (SemVer) + 功能描述的命名模式：
- **格式**: `v{主版本}.{次版本}.{修订版}_{功能关键词}`
- **示例**: `v3.2.1_workstation_realtime_display`

### 标签分类体系

#### 1. 主要版本标签 (Major Releases)
- **v3.x.x**: 现代化架构版本，React + TypeScript + WebSocket
- **v2.x.x**: 前后端分离架构版本
- **v1.x.x**: 初始版本和基础功能实现

#### 2. 功能特性标签 (Feature Tags)
- **数据库相关**: `_database_*`, `_postgresql_*`, `_redis_*`
- **架构重构**: `_architecture_*`, `_websocket_*`, `_production_ready`
- **前端功能**: `_workstation_*`, `_realtime_display`, `_multi_floor`
- **后端服务**: `_server_management`, `_auth_fixes`
- **文档更新**: `_docs`, `_network_architecture_docs`

#### 3. 里程碑标签 (Milestone Tags)
- **M0系列**: `v1.0.x_M0*` - 基础功能里程碑
- **M1系列**: `v1.x.x-M1*` - 服务器管理平台里程碑

### 当前标签清单

#### v3.x 系列 (现代化架构)
- `v3.2.1_workstation_realtime_display` - 工位实时显示功能
- `v3.2.0_production_ready` - 生产环境就绪版本
- `v3.1.2_database_dependencies_upgrade` - 数据库依赖升级
- `v3.1.1_fix_login_and_search_functionality` - 登录搜索功能修复
- `v3.1.1_database_auth_fixes` - 数据库认证修复
- `v3.1.0` - 3.1主版本发布
- `v3.0.0` - 3.0主版本发布

#### v2.x 系列 (前后端分离)
- `v2.5.0_websocket-postgresql-docs` - WebSocket与PostgreSQL文档
- `v2.4.0_network-architecture-docs` - 网络架构文档
- `v2.2.0_前后端分离部署` - 前后端分离部署
- `v2.1.1_数据库修复` - 数据库修复
- `v2.1.0_websocket-architecture-refactor` - WebSocket架构重构
- `v2.1.0` - 2.1主版本发布
- `v2.0.1_功能修复` - 功能修复
- `v2.0.0_redis_deployment` - Redis部署
- `v2.0.0` - 2.0主版本发布

#### v1.x 系列 (基础版本)
- `v1.2.0-M1_服务器管理平台` - M1服务器管理平台
- `v1.1.0_websocket_multi_connection` - WebSocket多连接
- `v1.1.0-M1` - M1里程碑
- `v1.1.0` - 1.1主版本发布
- `v1.0.4_M0` - M0里程碑第4版
- `v1.0.3_M0` - M0里程碑第3版
- `v1.0.2_M0` - M0里程碑第2版
- `v1.0.1_M0` - M0里程碑第1版
- `v1.0.0_M0里程碑完成` - M0里程碑完成

### 标签操作流程

#### 创建标签
1. **本地创建**:
   ```bash
   git tag -a v3.2.2_new_feature -m "feat: 新功能描述"
   ```

2. **推送到远程**:
   ```bash
   # 推送单个标签
   git push origin v3.2.2_new_feature
   
   # 推送所有标签
   git push origin --tags
   ```

#### 标签同步流程
1. **GitHub → GitLab**:
   ```bash
   git push gitlab --tags
   ```

2. **GitLab → GitHub**:
   ```bash
   git push origin --tags
   ```

#### 标签删除流程
1. **删除本地标签**:
   ```bash
   git tag -d v3.2.2_new_feature
   ```

2. **删除远程标签**:
   ```bash
   # GitHub
   git push origin --delete v3.2.2_new_feature
   
   # GitLab
   git push gitlab --delete v3.2.2_new_feature
   ```

### 标签权限管理

#### GitHub标签权限
- **创建权限**: 项目维护者和管理员
- **删除权限**: 仅项目管理员
- **保护标签**: 主要版本标签 (v*.0.0) 受保护

#### GitLab标签权限
- **创建权限**: Developer及以上角色
- **删除权限**: Maintainer及以上角色
- **推送保护**: 主分支标签需要审批

### 双向同步机制

#### 自动同步策略
1. **CI/CD触发**: 新标签创建时自动同步到另一平台
2. **定期同步**: 每日自动检查并同步标签差异
3. **手动同步**: 紧急情况下的手动同步命令

#### 同步检查脚本
```bash
# 检查标签差异
git ls-remote --tags origin | sort > github_tags.txt
git ls-remote --tags gitlab | sort > gitlab_tags.txt
diff github_tags.txt gitlab_tags.txt

# 同步缺失标签
git fetch --tags origin
git push gitlab --tags
```

#### 冲突解决
1. **标签冲突**: 以GitHub为准，GitLab强制更新
2. **版本冲突**: 遵循语义化版本控制规则
3. **权限冲突**: 按照最严格的权限设置

### 标签使用示例

#### 发布新版本
```bash
# 1. 完成功能开发并测试
git checkout main
git pull origin main

# 2. 创建版本标签
git tag -a v3.2.3_performance_optimization -m "perf: 性能优化版本
- 优化座位查询性能
- 减少WebSocket连接开销
- 提升前端渲染效率"

# 3. 推送到所有远程仓库
git push origin v3.2.3_performance_optimization
git push gitlab v3.2.3_performance_optimization

# 4. 更新CHANGELOG.md
echo "## v3.2.3_performance_optimization ($(date +%Y-%m-%d))" >> CHANGELOG.md
```

#### 回滚到特定版本
```bash
# 检出特定标签
git checkout v3.2.1_workstation_realtime_display

# 创建基于标签的分支
git checkout -b hotfix/v3.2.1-critical-fix v3.2.1_workstation_realtime_display
```

### 标签维护规范

#### 定期清理
- **保留策略**: 保留所有主版本标签和最近6个月的次版本标签
- **归档策略**: 超过1年的开发标签可以归档到文档中
- **清理频率**: 每季度进行一次标签清理

#### 文档同步
- 每次标签操作后更新本规则文件
- 在CHANGELOG.md中记录标签变更
- 保持README.md中的版本信息同步

## 安全与合规
- 座位坐标、员工工号属于敏感数据，接口全部走 HTTPS，GraphQL 屏蔽敏感字段
- Redis 座位锁 key 加随机盐，防止恶意遍历
- 合并代码前必须通过 `npm run test:e2e` 与 `npm run security:audit`
