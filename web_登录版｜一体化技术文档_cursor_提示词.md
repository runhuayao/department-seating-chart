# Web 登录版｜一体化技术文档 + Cursor 提示词（可直接交给 AI 助手）
> 作用：给 AI 编程助手一个**可阅读的技术文档**，同时内嵌**可复制的提示词**。PM 层目标清晰但技术可留白；工程层细节明确且可执行。你可以逐条把提示词丢给助手，或整页交给它。

---

## 0. 项目概述（PM 层）
- **目标**：基于 **2D 室内地图**（部门/楼层平面图），实现**工位可视化 + 人员搜索定位 + 在岗状态显示**（绿=在岗，灰=离岗）。
- **受众**：公司内部员工；**范围**：仅内网访问与账号登录；不做 3D 导航。
- **成功标准**：
  - 搜索定位 < 300ms（200 人规模）；地图切换与聚焦 < 300ms；
  - 状态刷新：轮询 60–120s；（可选）WebSocket 推送 ≤ 2s；
  - 移动端可用；SVG 文本在 0.75×~2× 清晰。

---

## 1. 技术主干（工程层）
- **前端**：React + Vite + TypeScript；**SVG** 渲染；缩放/平移用 **d3-zoom**；样式 **TailwindCSS**；状态管理 **Zustand**。
- **后端**：Node.js (Express + TypeScript)；输入校验 **Zod**；ORM **Prisma**。
- **数据库**：PostgreSQL（结构化数据 / 全文或 trigram 索引）。
- **缓存/在线判定**：Redis（`presence:{user_id} → {last_seen, status}`）。
- **认证**：开发期 JWT 或 Cookie-Session；生产期接内网 SSO。
- **部署**：Docker Compose（web/api/pg/redis/nginx）。

目录占位：
```
repo/
 ├─ README.md
 ├─ web/                  # React + Vite + TS（前端）
 │   └─ src/{components,hooks,services,store,routes}
 ├─ api/                  # Express + TS（后端）
 │   ├─ src/{routes,schemas,services}
 │   └─ prisma/schema.prisma
 ├─ scripts/              # CAD→SVG/JSON/DB 导入脚本
 └─ docker-compose.yml
```

---

## 2. 数据模型（Prisma 草案）
> 可直接让 AI 生成 Prisma 模型与迁移脚本。
```prisma
model Department { id Int @id @default(autoincrement()) name String @unique floor String? mapId String? desks Desk[] employees Employee[] }
model Map        { id String @id  type String  url String  deptId Int?  department Department? }
model Desk       { id String @id  label String deptId Int  x Int  y Int  w Int  h Int  department Department @relation(fields:[deptId],references:[id]) assignments Assignment[] }
model Employee   { id Int @id @default(autoincrement()) name String  deptId Int  title String? email String? phone String?  department Department @relation(fields:[deptId],references:[id]) assignments Assignment[]  @@index([name]) }
model Assignment { id Int @id @default(autoincrement()) employeeId Int deskId String active Boolean @default(true) assignedAt DateTime @default(now())  employee Employee @relation(fields:[employeeId],references:[id]) desk Desk @relation(fields:[deskId],references:[id])  @@unique([employeeId, deskId, active]) }
// presence 放 Redis；如需落库可建 Presence 表做历史审计
```

**种子数据（示例）**
```json
[
  {"desk_id":"Eng-D1","dept":"Engineering","x":40,"y":40,"w":130,"h":90,"label":"D1","employee_id":101,"employee":"Alice","status":"online"},
  {"desk_id":"Eng-D2","dept":"Engineering","x":190,"y":40,"w":130,"h":90,"label":"D2","employee_id":102,"employee":"Bob","status":"offline"}
]
```

---

## 3. API 规范（OpenAPI 风格）
**判定规则**：`now - last_seen < 6min` → online(绿)，否则 offline(灰)。

- `GET /api/map?dept=Engineering`
  - **200** `{ map_id:string, type:'svg'|'png'|'json', url:string }`
- `GET /api/desks?dept=Engineering`
  - **200** `[{desk_id,x,y,w,h,label,employee,employee_id,status}]`
- `GET /api/findUser?name=张三`
  - **200** 单条或数组（重名），含 `{dept,map_id,desk_id,x,y,status}`
- `GET /api/status?dept=Engineering`
  - **200** `[ {desk_id, employee_id, status } ]`
- `POST /api/heartbeat`
  - **Req** `{ user_id:number, ts:number }`（ms） → **200** 更新 `last_seen`
- `POST /api/auth/login|/logout`（开发期可用假登录）

**错误约定**：统一返回 `{ code:string, message:string, details?:any }`

---

## 4. 前端交互要点
- **DeptMap**（SVG）：
  - 支持平移/缩放（0.75×–2×）；双击某工位 → 居中 + 1–2s 脉冲高亮；
  - LOD：缩放 < 1× 仅状态点+工位号；≥1× 显示姓名+状态点；
  - 搜索命中：若跨部门，切换地图 → 待地图 ready → 聚焦目标工位；
  - 轮询状态：60–120s；断网指数退避（最大 5min）。

---

## 5. 在岗状态（Redis）
- Key：`presence:{user_id}` → `{ last_seen:number, status:'online'|'offline' }`
- 心跳：前端登录后每 2 分钟 `POST /api/heartbeat`；后台定时任务 60s 将超时用户置 offline；
- `GET /api/status?dept=…` 聚合部门内所有人的当前状态。

---

## 6. 部署（docker-compose 草案）
```yaml
version: '3.9'
services:
  web: { build: ./web, ports: ['5173:5173'], depends_on: [api] }
  api: { build: ./api, ports: ['3000:3000'], environment: { DATABASE_URL: 'postgresql://postgres:postgres@db:5432/app', REDIS_URL: 'redis://redis:6379' }, depends_on: [db, redis] }
  db: { image: postgres:16, environment: { POSTGRES_PASSWORD: postgres }, ports: ['5432:5432'] }
  redis: { image: redis:7, ports: ['6379:6379'] }
  nginx: { image: nginx:alpine, volumes: ['./ops/nginx.conf:/etc/nginx/nginx.conf:ro'], ports: ['80:80'], depends_on: [web, api] }
```

---

## 7. E2E 验收（Playwright 场景）
1) 登录 → 进入部门 → 搜索“张三” → 切换地图 → 聚焦高亮（断言元素在视区并显示脉冲）。
2) 模拟 `/status` 在线→离线→在线，断言状态点颜色变化。
3) 断网 30s 后退避；恢复后自动续跑。

---

# 8. Cursor 提示词（按顺序逐条投喂）

### A1｜前端地图容器 + 假数据渲染（SVG）
**PM 层**：我需要一个部门平面图容器，能平移/缩放/渲染工位、显示姓名与绿/灰指示灯，为后续对接后端打底；先用静态资源与假数据。
**工程层**：用 React+Vite+TS、Tailwind、d3-zoom、Zustand。实现 `<DeptMap mapSvgUrl desks[] />`：`desks:{desk_id,x,y,w,h,label,employee,status}[]`。支持 0.75×–2× 缩放；双击工位→居中并 1–2s 脉冲高亮；LOD：<1× 仅状态点+工位号；≥1× 显示姓名+状态点。提供 `desks.sample.json` 与路由 `/:dept` 加载渲染。

### A2｜搜索与跨部门定位（假实现）
**PM 层**：输入姓名即可自动切换到其部门并高亮工位；重名弹候选。
**工程层**：实现 `useSearch()`：`queryByName(name)` 返回 `{dept, desk_id, x,y,status}` 或候选数组。流程：若跨部门→`loadMap(dept)`→待地图 ready→`focusOnDesk(desk_id)`。UI：重名弹窗、未命中提示。加 Playwright 用例：两次跨部门搜索都能正确聚焦。

### A3｜状态轮询占位与图例
**PM 层**：实现前端定时轮询占位逻辑与图例（为后端心跳做准备）。
**工程层**：`services/status.ts`：`fetchDeptStatus(dept)`→`[{desk_id,status}]`。页面每 60–120s 拉取并合并状态；断网 30s 内进入指数退避（最大 5min），恢复后自动续跑；右上角显示最近刷新时间；附“随机状态”按钮便于目测。

### B1｜最小后端 API（Mock 可跑）
**PM 层**：提供 `/map` `/desks` `/findUser` 三个只读接口驱动前端。
**工程层**：Express+TS+Zod；CORS 允许 `http://localhost:5173`。路由：
- `GET /api/map?dept=Engineering` → `{ map_id,type,url }`
- `GET /api/desks?dept=Engineering` → `[{desk_id,x,y,w,h,label,employee,status}]`
- `GET /api/findUser?name=xxx` → 模糊匹配，重名返回数组
输出 Swagger 或 REST Client 示例；docker-compose 可一键启动。

### B2｜数据库与迁移（占位）
**PM 层**：定下数据库结构，为落库与导入脚本做准备。
**工程层**：Prisma 模型：departments/desks/employees/assignments/presence(可选)。对 `employees.name` 建 LIKE/Trigram 索引；`desks.dept_id`、`assignments(employee_id,desk_id,active)` 索引。生成迁移与种子（2 部门 × 各 10 工位）。`/findUser` 支持切换 SQL 驱动。

### C1｜在岗心跳与判定（后端）
**PM 层**：接入心跳，后端维护 `last_seen` 并计算在线/离线。
**工程层**：Redis Key：`presence:{user_id}`；`POST /api/heartbeat {user_id,ts}` 更新；定时任务每 60s 将超时用户置 offline；`GET /api/status?dept=…` 聚合部门状态；AOF 或冷启动时从 DB 回补。

---

## 9. 提交与文档更新节奏
- **Before 提示**：写 2–4 句 PM 目标 + 范围 + 成功标准；附工程细节与验收。
- **After 生成**：只跑验收；不通过就在原提示末尾补充“只修改 X，不改 Y”。合入前更新 README 的一个小节，并在 `/docs/adr` 记一次决策（若发生栈/接口变更）。

---

> 你可以把整份文档或其中任意段落复制给 AI 助手开始实现；若需要，我能再生成“极简 150–250 字版”的六条提示词，适配更小上下文窗口。

