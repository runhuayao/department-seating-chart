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

## 安全与合规
- 座位坐标、员工工号属于敏感数据，接口全部走 HTTPS，GraphQL 屏蔽敏感字段
- Redis 座位锁 key 加随机盐，防止恶意遍历
- 合并代码前必须通过 `npm run test:e2e` 与 `npm run security:audit`
