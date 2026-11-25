# CHPLI2 全栈开发教程（Developer Tutorial）

> 目标读者：全栈开发基础较少、希望从 0 开始理解并迭代本工程的开发者。
> 最终目标：**2 个月（约 8 周，2026-11 初 → 2026-12 底）学习并实战，完成网站基本内容并成功部署上线**。
> 阅读方式：第 1–4 章建立全局认知；第 5–6 章动手把工程跑起来；第 7 章是按周执行的学习+实战计划；第 8 章部署；第 9 章是资源；第 10 章讲组件库（所有页面共用的 UI 体系）；第 11 章是避坑指南。每周开始前重读相关章节。

---

## 目录

1. [工程全景：模块与目录](#1-工程全景模块与目录)
2. [架构详解：各层如何协作](#2-架构详解各层如何协作)
3. [路由关系：页面、API、数据表](#3-路由关系页面api数据表)
4. [核心数据流：一次"创建交通段"的完整旅程](#4-核心数据流一次创建交通段的完整旅程)
5. [环境准备：从 0 搭建开发环境](#5-环境准备从-0-搭建开发环境)
6. [第一个实践：跑起来，再改一个小功能](#6-第一个实践跑起来再改一个小功能)
7. [8 周学习与实战计划](#7-8-周学习与实战计划)
8. [部署计划：上线一个真实网站](#8-部署计划上线一个真实网站)
9. [学习资源推荐](#9-学习资源推荐)
10. [组件库与 UI 体系（@chpli2/ui）](#10-组件库与-ui-体系chpli2ui)
11. [避坑指南（真实踩过的坑）](#11-避坑指南真实踩过的坑)

---

## 1. 工程全景：模块与目录

CHPLI2 是一个 **pnpm workspaces monorepo**（多包单仓库）。一个仓库里装着 7 个可独立启动的前端应用 + 1 个后端 + 2 个共享包。

```
chpli2/
├── apps/                    # 前端（1 个宿主 + 6 个业务 Remote）
│   ├── host/                #   宿主应用：导航、语言切换、认证、加载业务模块（端口 3000）
│   ├── travel/              #   Travel Remote：行程与交通记录（3001）
│   ├── calendar/            #   Calendar Remote：备忘录化日历（3002）
│   ├── notes/               #   Notes Remote：Markdown 笔记（3003）
│   ├── bookmarks/           #   Bookmarks Remote：书签（3004）
│   ├── growth/              #   Growth Remote：成长与职业（3005）
│   └── lifefolder/          #   LifeFolder Remote：人生文件（3006）
├── services/
│   └── api/                 # 后端：NestJS 模块化单体（唯一的服务端进程，端口 4000）
├── packages/
│   ├── shared/              # 前后端共享代码：类型、校验函数、错误码、事件契约
│   └── ui/                  # 共享组件库：design tokens + 原子组件（见第 10 章）
├── e2e/                     # 端到端测试（Playwright）
├── infra/
│   └── docker-compose.yml   # 开发基础设施（PostgreSQL + MinIO 容器）
├── scripts/
│   └── kill-port-listeners.mjs  # predev 清场脚本（见第 10.7 节）
├── package.json             # 仓库根：pnpm 脚本（dev / test / test:e2e ...）
└── pnpm-workspace.yaml      # 声明哪些目录是 workspace 包
```

### 模块清单

| 模块 | 位置 | 技术 | 职责 | 状态 |
| --- | --- | --- | --- | --- |
| Host | `apps/host` | React 18 + Rsbuild | 应用外壳：导航、语言切换、认证、Portal 集成、按需加载 6 个 Remote | ✅ 可用 |
| Travel | `apps/travel` | React 18 + Rsbuild | 行程（Trip）与交通段（Transport）的完整增删改查 | ✅ 可用 |
| Calendar | `apps/calendar` | React 18 + Rsbuild | 备忘录化日历：月/周/日三视图、重复规则（含自定义按星期、按实例完成/删除）、标签筛选、农历、到期提醒 | ✅ 可用（当前形态已达标） |
| Notes | `apps/notes` | React 18 + Rsbuild | Markdown 笔记（博客园风格编辑器）：自动保存+本地兜底、双链/反链、版本历史、附件、全文搜索、发布表单与阅读视图 | ✅ 可用（当前形态已达标） |
| Bookmarks | `apps/bookmarks` | React 18 + Rsbuild | 书签：分类、封面、卡片/列表视图、点击统计、不活跃降级 | ✅ 可用 |
| Growth | `apps/growth` | React 18 + Rsbuild | 成长与职业：目标/里程碑/技能/学习资源/实践证据/定期回顾 | ✅ 可用 |
| LifeFolder | `apps/lifefolder` | React 18 + Rsbuild | 人生文件：分类体系、模板推荐、对象存储、敏感文件默认私有 | ✅ 可用 |
| API | `services/api` | NestJS + Prisma | 全部业务逻辑与数据读写 | ✅ 可用 |
| Shared | `packages/shared` | 纯 TypeScript | 前后端共用的 DTO 类型、领域校验函数、错误码、领域事件格式 | ✅ 可用 |
| UI | `packages/ui` | React + CSS Modules | 共享组件库：tokens + Button/Input/Select/Chip/Modal/Empty | ✅ 可用（见第 10 章） |
| E2E | `e2e` | Playwright | 模拟真实浏览器的端到端测试（含用户视角六模块旅程） | ✅ 60 个用例 |

### 为什么这样划分？（模块化思想）

- **Host 与 Remote 分离**：每个业务模块（Travel、Calendar）是独立的应用，可以独立开发、独立部署。Host 通过 Module Federation 在运行时加载它们。新增模块（如未来的 Bookmarks、Notes）时，Host 导航加一项、配置里加一个 Remote 即可，不动其他模块。
- **后端模块化单体**：只有一个进程、一个数据库，但代码按模块（`src/travel/`、`src/calendar/`）隔离，每个模块只拥有自己的数据表。**跨模块不允许直接改对方的数据表**，必须通过 API 或领域事件（见第 2 章 Outbox）。这样既避免微服务的运维复杂度，又保留清晰的边界。
- **共享包**：前后端用同一份类型定义和校验函数（`validateRoute` 等），避免"前端校验一套、后端校验另一套"导致的不一致。

---

## 2. 架构详解：各层如何协作

### 2.1 前端：Module Federation（模块联邦）

```
浏览器打开 :3000 (Host)
   │
   ├─ React.lazy(() => import('travel/App'))  ──按需──▶ :3001/remoteEntry.js (Travel Remote)
   └─ React.lazy(() => import('calendar/App')) ──按需──▶ :3002/remoteEntry.js (Calendar Remote)
```

- Host 不打包 Travel/Calendar 的代码，而是在浏览器里**运行时**从各自端口拉取（`remoteEntry.js` 是 Remote 的入口清单）。
- **共享依赖**：react / react-dom 被声明为 singleton（单例），Host 与所有 Remote 共用浏览器里的同一份 React，否则会出现"两个 React 实例"导致的诡异崩溃（见避坑指南）。
- 配置位置：每个 app 的 `rsbuild.config.ts` 里 `pluginModuleFederation({...})`。
- 端口约定：Host 3000 / Travel 3001 / Calendar 3002 / API 4000。
- 前端之间的通信：Calendar 点击事件 → 触发 `window` 自定义事件 `chpli2-open-trip` → Host 监听后切换到 Travel 并传入 `initialTripId`（见 `apps/host/src/App.tsx`）。
- 语言切换：语言存 `localStorage`（key `chpli2-language`）+ 广播事件 `chpli2-language-changed`，各应用监听并切换自己的 i18next 实例。

### 2.2 后端：NestJS 模块化单体

```
HTTP 请求 → main.ts（全局前缀 /api、CORS、Swagger、异常过滤器）
   → TravelModule / CalendarModule（各自 Controller → Service → Prisma）
   → PostgreSQL
```

| 目录 | 职责 |
| --- | --- |
| `src/travel/` | 行程/交通段/国家城市地点的 Controller（路由）、Service（业务规则）、DTO（入参校验） |
| `src/calendar/` | 日历事件的查询与同步逻辑 |
| `src/shared/` | `PrismaService`（数据库连接）、`OutboxDispatcher`（事件分发）、统一异常过滤器 |
| `prisma/` | `schema.prisma`（数据模型）+ `migrations/`（迁移文件，数据库结构的版本历史） |

NestJS 的核心概念对应关系：**Module ≈ 业务模块**，**Controller ≈ 路由表**，**Service ≈ 业务逻辑**，**DTO + ValidationPipe ≈ 入参校验**，**依赖注入 ≈ 构造器里声明依赖，框架自动传入**。

### 2.3 数据库：Prisma + PostgreSQL + 迁移

- Prisma 是 ORM：用 `schema.prisma` 描述表结构，用 `prisma migrate` 生成并执行 SQL 迁移。**迁移是只向前兼容的增量变更，绝不手工改库结构**。
- 开发环境数据库用 Docker 跑（`infra/docker-compose.yml`，容器 `chpli2-postgres`，数据在卷 `chpli2-pgdata` 中持久保存）。
- 关键约定：表按模块归属 —— `travel_` 前缀表只属于 Travel，`calendar_` 前缀表只属于 Calendar。

### 2.4 跨模块通信：Outbox（发件箱）模式

这是本工程最重要的架构决策。需求：Travel 里创建交通段后，Calendar 要自动生成一个事件；且**重复提交/重试/修改都不能产生重复事件**。

做法：

1. Travel 在**同一个数据库事务**里：插入交通段 + 往 `outbox_event` 表插入一条事件（`TransportPlanned`）。
2. 事务提交后，`OutboxDispatcher`（每 200ms 轮询）把事件交给 Calendar 的处理器。
3. Calendar 处理器按 `sync_key`（格式 `travel:transport:<id>`，全局唯一约束）**upsert** 日历事件：存在则更新，不存在则插入。
4. 删除交通段 → 发 `TransportDeleted` → Calendar 软删除（`deleted_at`）对应事件。

好处：即使消息重复投递、服务重启，结果也一致（幂等）；事件有持久化记录（可追溯）；失败可重放。

---

## 3. 路由关系：页面、API、数据表

### 3.1 页面导航关系（无 URL 路由，状态切换）

本工程**刻意不用 React Router**：Host 用 `useState<View>` 切换主区域内容。

```
Host (:3000)
├── 首页（欢迎语）
├── 点击"行程" → 懒加载 travel/App
│     ├── 行程列表（TripList）──Open──▶ 行程详情（TripDetail）
│     │                                     └── 交通段表单（TransportForm：新增/编辑）
│     └──（由 Calendar 跳转时带 initialTripId 直达详情）
└── 点击"日历" → 懒加载 calendar/App
      └── 事件列表 ──点击事件 ──chpli2-open-trip 事件──▶ Host 切到 Travel 详情
```

### 3.2 REST API 路由表（全部挂在 `/api` 前缀下）

| 方法 | 路径 | 所属模块 | 说明 |
| --- | --- | --- | --- |
| GET | `/travel/countries` | Travel | 国家列表（参考数据） |
| GET | `/travel/countries/:id/cities` | Travel | 某国城市列表 |
| GET | `/travel/cities/:id/locations` | Travel | 某城地点列表 |
| POST | `/travel/trips` | Travel | 创建行程 `{title, type: PLAN\|MEMORY}` → 201 |
| GET | `/travel/trips/:id` | Travel | 行程详情（含交通段数组） |
| POST | `/travel/trips/:id/transports` | Travel | 创建交通段 → 201 |
| PATCH | `/travel/transports/:id` | Travel | 修改交通段（触发事件更新日历） |
| DELETE | `/travel/transports/:id` | Travel | 删除交通段（触发事件删日历事件）→ 204 |
| GET | `/calendar/events?from=&to=` | Calendar | 事件列表（不含软删；from/to 可选） |
| GET | `/api/docs-json` | - | OpenAPI（Swagger）JSON，接口文档的单一事实来源 |

错误响应统一格式：`{ statusCode, message, errorCode }`。领域错误码：`ROUTE_SAME_ENDPOINT` / `ROUTE_LEVEL_MISMATCH` / `ROUTE_CITY_MISMATCH` / `TIME_ORDER_INVALID` / `TRIP_NOT_FOUND` / `TRANSPORT_NOT_FOUND` / `VALIDATION_ERROR`。

### 3.3 数据表关系（文字版 ER 图）

```
travel_Country 1───N travel_City 1───N travel_Location
travel_Trip 1───N travel_Transport          （Trip.type = PLAN | MEMORY）
travel_Transport ──(outbox 事件)──▶ calendar_CalendarEvent（sync_key 唯一）

OutboxEvent：id, type(TransportPlanned/Updated/Deleted), payload(JSON), occurredAt, processedAt
CalendarEvent：id, title, startsAt, endsAt, timezone, sourceModule, sourceType, sourceId,
               syncKey(唯一), deletedAt(软删)
Transport：mode, originLevel/originId, destinationLevel/destinationId,
           plannedDepartureAt/plannedArrivalAt（计划时间，可过去），
           actualDepartureAt/actualArrivalAt（实际时间），syncToCalendar
```

领域规则（必须始终遵守）：

1. Plan 与 Memory 不互斥，不随时间自动转换；计划时间可过去，到期不自动变更状态。
2. 线路只允许同级：国家↔国家、城市↔城市、同城内地点↔地点；禁止跨层级、跨城地点连线。
3. 只有 PLAN 行程且 syncToCalendar=true 才同步日历；MEMORY 永不同步。
4. 时间一律存 UTC（`timestamptz`），前端按用户本地时区渲染；语言、日期格式、时区三者独立。
5. 重要数据操作（删除等）必须经过用户二次确认。

---

## 4. 核心数据流：一次"创建交通段"的完整旅程

以用户在表单点"添加"为例，每一跳都可以在代码里找到对应位置：

```
1. 用户填写表单（apps/travel/src/components/TransportForm.tsx）
   └─ 前端先用 packages/shared 的 validateRoute / isPlannedTimeOrderValid 即时校验
2. 点击 Add → api.createTransport()（apps/travel/src/api.ts）→ POST /api/travel/trips/:id/transports
   └─ 提交中按钮禁用并显示 "Submitting…"（防重复提交）
3. NestJS TravelController → TravelService（services/api/src/travel/）
   └─ ValidationPipe 校验入参 → validateRoute 再次校验（后端是最终权威）
   └─ prisma interactive transaction：
        INSERT travel_Transport  +  INSERT OutboxEvent(TransportPlanned)
4. OutboxDispatcher（src/shared/outbox-dispatcher.ts，200ms 轮询）取出事件
5. CalendarSyncService（src/calendar/calendar-sync.service.ts）
   └─ MEMORY 行程 → 跳过；PLAN → 按 syncKey upsert calendar_CalendarEvent
6. 用户切到 Calendar 页 → GET /api/calendar/events → 渲染事件
   └─ Travel 详情里 transport.calendarSync 徽标来自 Calendar 模块
      导出的只读查询服务（模块间 API 调用）
```

**练习理解**：在 `services/api/src/travel/travel.service.ts` 里找到事务代码，在 `calendar-sync.service.ts` 里找到 upsert 代码，把这两段读懂，你就掌握了本工程 80% 的架构思想。

---

## 5. 环境准备：从 0 搭建开发环境

按顺序执行（macOS 示例，Linux 类似）：

```bash
# 1. Node.js 20+（推荐用 nvm 管理版本）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 24 && node -v

# 2. pnpm 11（Node 自带的 corepack 启用即可）
corepack enable && corepack prepare pnpm@11.25.0 --activate && pnpm -v

# 3. Docker Desktop（数据库容器用）
#    官网下载安装并启动：https://www.docker.com/products/docker-desktop/

# 4. Git（macOS 自带或 xcode-select --install）

# 5. 编辑器：VS Code，推荐插件：
#    ESLint / Prettier / Prisma / ES7+ React Snippets / Docker
```

克隆并启动工程：

```bash
git clone <仓库地址> chpli2 && cd chpli2
pnpm install
pnpm dev:db                                        # 启动 PostgreSQL 容器
pnpm -C services/api db:migrate                    # 建表（首次）
pnpm -C services/api db:seed                       # 写入参考数据（国家/城市/地点，幂等）
pnpm dev                                           # 一键启动 4 个服务
```

浏览器打开 http://localhost:3000 即见 demo。接口文档在 http://localhost:4000/api/docs （Swagger UI）。

---

## 6. 第一个实践：跑起来，再改一个小功能

**任务：给行程类型徽标加颜色**（约 30 分钟，走通"改代码 → 看效果 → 跑测试"闭环）。

1. 找到 `apps/travel/src/components/TripList.tsx`，找到渲染 `trip.type` 徽标的位置。
2. 在 `apps/travel/src/styles.css` 里新增两个 class（如 `.badge--plan` 蓝色、`.badge--memory` 紫色）。
3. 保存 → 浏览器自动热更新（HMR），观察效果。
4. 跑测试确认没破坏行为：`pnpm test`。
5. **拓展练习**：给 Memory 行程的详情页加一段"回忆型行程不同步日历"的提示文案（需要改 `TripDetail.tsx` + `i18n.ts` 三个语言文件 + 组件测试）。完成后你就完成了第一次真正的全栈功能迭代。

> 每个功能都要经历：**明确价值 → 改 shared 契约（如需）→ 改后端 + 测试 → 改前端 + 测试 → E2E 验证 → 更新文档**。这就是本工程的标准工作流。

---

## 7. 8 周学习与实战计划

节奏：每周**学习主题（约 40% 时间）+ 实战任务（约 60% 时间）**，每周五晚跑全部测试并写一页周报（完成了什么/卡在哪/下周计划）。对应 `ROADMAP.md` 的 Iteration 2–8，前 7 周做功能，第 8 周部署。

| 周 | 时间 | 学习主题 | 实战任务（对应 ROADMAP） | 验收标准 |
| --- | --- | --- | --- | --- |
| **W1** | 11/02–11/08 | TypeScript 基础；读懂现有代码：跟着第 4 章数据流把 API 前后代码读一遍；NestJS 官方概览 | **Iteration 2 起步**：计划 vs 实际时间对比 UI；计划到期后"等待用户确认"流程（不自动转换状态） | 行程详情能并排展示计划/实际时间；到期计划行程出现"确认"按钮，点击后才归档；测试全绿 |
| **W2** | 11/09–11/15 | SVG 与 Canvas 基础；数据可视化概念；React 状态提升 | **Iteration 2 核心**：国家/城市/城内三种独立二维地图模式，只允许同级连线（复用 `validateRoute`） | 三种模式可切换；非法连线被阻止；地图组件有单元测试 |
| **W3** | 11/16–11/22 | 对象存储概念（S3/MinIO）；文件上传与元数据设计 | **Iteration 2 收尾**：交通段关联住宿/照片/笔记/实际经历（照片进对象存储，DB 只存元数据） | 可上传照片并在行程详情展示；回忆型行程仍默认不提醒 |
| **W4** | 11/23–11/29 | 日历领域建模：重复规则（RRULE）、时区处理深入 | **Iteration 3**：Calendar 月/周/日视图 + 分类管理 + 全天事件 | 三种视图可切换；全天事件正确显示；中英德日期格式正确 |
| **W5** | 11/30–12/06 | 重复日程算法；冲突检测；防抖与节流 | **Iteration 3 收尾 + Iteration 4 起步**：重复日程、冲突限制、行为禁忌提醒；Bookmarks 数据模型与 CRUD | 重复日程正确展开；冲突被提示；书签可增删改查 |
| **W6** | 12/07–12/13 | 搜索基础（PostgreSQL 全文检索）；编辑器技术选型 | **Iteration 4 收尾 + Iteration 5**：Bookmarks 卡片/列表、点击统计、30 天不活跃降级；Notes 的 Markdown + 自动保存 + 搜索 | 30 天未点击书签自动降级为精简列表；笔记可编辑保存搜索 |
| **W7** | 12/14–12/20 | 图数据模型（双链/反链）；进度与回顾的数据设计 | **Iteration 5 收尾 + Iteration 6**：Notes 双链/反链/版本历史（稳定 ID）；Growth & Career 成长路径/里程碑/回顾（关联笔记/日历/书签） | 笔记双链可跳转、反链可见、历史可回溯；成长模块可记录进度与回顾 |
| **W8** | 12/21–12/27 | Docker Compose 生产部署；CI/CD（GitHub Actions）；Nginx 反向代理；HTTPS/域名 | **Iteration 7/8 简化版 + 部署**：Life Folder 与 Daily Records 的最小可用版（记录身体指标/支出，支出用最小货币单位整数）；整站 Docker 化、备份、CI、购买云服务器与域名并上线 | **网站可从公网访问**，核心流程可用；数据库每日自动备份；push 后 CI 自动测试 |

> W8 时间紧，Life Folder / Daily Records 只做最小闭环（先记录、后完善）。如果 W1–W7 有延期，优先保部署：**功能可以迭代，上线日期不动摇**。

> 进度注记（2026-11-26）：实际进度快于计划——M0–M5、N1–N3、B1、G1/G2、L1 均已交付（见 `ROADMAP.md`）。**Calendar（备忘录化日历）与 Notes（博客园风格编辑器）已达当前预期形态**，后续为持续优化迭代；剩余主线为 L2（人生文件对话协助）、Travel 迭代增强与 W8 部署。

### 每周固定动作（形成习惯）

1. 周一：读本周对应 ROADMAP 条目，列出验收标准。
2. 开发前：更新数据模型草案 → 与 mentor/AI 评审 → 写迁移 → 再写代码。
3. 每天结束：`pnpm test` 必须全绿才收工。
4. 周五：跑 `pnpm test:e2e`，写周报，更新 `ROADMAP.md` 勾选完成项。

---

## 8. 部署计划：上线一个真实网站

第 8 周的具体动作清单：

1. **服务器**：购买一台最便宜的云 VPS（2C2G 起，境内需备案则选境外节点或用国内对象存储+CDN 方案）。安装 Docker。
2. **域名 + HTTPS**：购买域名，用 Caddy 或 certbot + Let's Encrypt 自动签发证书。
3. **生产 Docker Compose**（新建 `infra/docker-compose.prod.yml`）：
   - postgres（挂数据卷 + 每日 `pg_dump` 备份到对象存储）
   - api（构建 `services/api` 镜像，跑 `prisma migrate deploy` 后启动）
   - 前端三应用：先 `pnpm build` 出静态产物，用 Nginx/Caddy 托管；Module Federation 的 remoteEntry 也静态托管，Host 的 remotes 地址改为生产域名。
   - 一个反向代理按路径分发：`/` → Host 静态资源，`/api` → API 容器。
4. **CI/CD**：GitHub Actions —— push 后自动 `pnpm install && pnpm test && pnpm test:e2e`，通过后构建镜像并部署（简单起见可用服务器上的 webhook 拉取最新代码重建）。
5. **上线检查单**：数据库有备份任务、密钥全部走环境变量（不进 git）、Swagger 文档在生产关闭或加访问控制、404/错误页可用、三语言完整。

---

## 9. 学习资源推荐

| 主题 | 资源 |
| --- | --- |
| TypeScript | 官方 Handbook（tslang.cn 中文版） |
| React | react.dev 官方教程（Tic-Tac-Toe → Thinking in React） |
| NestJS | 官方文档 Overview 章节（Controllers/Providers/Modules） |
| Prisma | 官方 "Getting Started" + Migrate 章节 |
| PostgreSQL | 《SQL 必知必会》+ 官方教程的索引与事务章节 |
| Module Federation | module-federation.io 官方文档（英文） |
| Docker | Docker 官方 "Get Started" 10 篇 |
| Playwright | playwright.dev 官方文档的 Writing Tests 章节 |
| 工程思想 | 《重构》《领域驱动设计》精简版概念；本项目 `PROJECT_INSTRUCTIONS.md` + `AGENTS.md` 就是活的领域规范 |

---

## 10. 组件库与 UI 体系（@chpli2/ui）

> 2026-11 UI 重构的成果：把散落在 7 个前端应用里各自手写的按钮、输入框、标签、弹窗收敛成一个共享组件库 `packages/ui`，视觉语言参考 ant-design v5（取其 token 值与设计思想，不依赖 antd 代码）。7 个应用（Host + 6 个 Remote）已全部迁移完毕，e2e 42 项全绿。

### 10.1 为什么要有组件库

重构前每个应用都有自己的 `styles.css`（合计 3300+ 行），并且**同一套东西写了 7 遍**：按钮样式 7 份、输入框样式 7 份、日期下拉样式 7 份。更糟的是 token 分裂——Host 用 `--color-*`、各 Remote 用 `--chpli-accent`，同一个"主题蓝"有好几个名字和好几个色值。后果是：改一个按钮的 hover 颜色要改 7 个文件，还改不齐。

组件库解决的就是这件事：**"长什么样"只定义一次，所有应用共享。**

### 10.2 四层架构（组件库的全部秘密）

```
① Design Tokens   tokens.css        颜色/圆角/阴影/动效的唯一事实来源（CSS 变量）
② 原子组件        components/        Button/Input/Textarea/Select/Chip/Modal/Empty
③ 包工程          package.json       workspace 包，消费方直接引 TS 源码，不构建不发布
④ 样式投递        CSS Modules        类名构建时哈希；token 经 :root 全局生效
```

- **① Token 层**：组件里只写 `var(--chpli-primary)`，禁止硬编码颜色。想换主题色？改 `tokens.css` 里 `--chpli-primary` 一组值，7 个应用同时生效。
- **② 组件层**：无业务含义、不碰 API、不内置文案（文案由调用方经 i18n 传入）。为什么强调"无业务"：组件库里一旦混进业务，每次业务改动都会牵连所有应用。
- **③ 包工程层**：这是**内部组件库与 npm 开源组件库的关键区别**。开源库（antd 等）需要 rollup/rslib 构建出 esm/cjs + d.ts 再发布；内部库直接 `"main": "src/index.ts"` 让消费方引源码，每个应用打包时自己编译——零构建配置，类型即时同步。详见 `packages/shared`（同一个套路）。
- **④ 样式投递层**：为什么用 CSS Modules？Module Federation 下 7 个应用的 CSS 会加载进**同一个页面**，普通类名（`.button`）可能互相覆盖；CSS Modules 构建时把类名哈希化，天然隔离。token 则相反——必须全局生效，所以用普通 CSS 定义在 `:root` 上，Host 和每个 Remote 的入口各 import 一次（重复定义幂等，无害）。

### 10.3 用法（在任意应用里）

```tsx
import { Button, Chip, Input, Modal, Select, Textarea, Empty } from '@chpli2/ui';
import '@chpli2/ui/tokens.css'; // 每个应用入口 import 一次（bootstrap.tsx 里已有）
```

三个前提：package.json 加 `"@chpli2/ui": "workspace:*"` 并 `pnpm install`；应用要有 `src/css-modules.d.ts`（声明 `*.module.css` 模块，抄任意现有应用）；每个应用自己决定**怎么摆**这些组件（布局、网格、响应式留在应用里）。

### 10.4 边界原则：库管什么，app 管什么

| 归组件库 | 归应用 |
| --- | --- |
| 控件视觉（hover/focus/disabled/尺寸） | 页面布局、网格、间距结构 |
| 弹层行为（Esc/遮罩关闭/动画） | 业务卡片（MemoChip、GoalCard） |
| token 变量 | 响应式断点结构（drawer/bottom-sheet 的壳） |

复合业务组件**留在 app 不进库**。什么时候抽象进库？当第二个 app 需要同一个模式时（Modal 的 `href` 锚点模式就是这么来的——lifefolder 需要"长得是按钮、行为是链接"的下载按钮）。这个"二次出现才抽象"的纪律避免库被一次性设计压垮。

### 10.5 如何新增一个组件

1. `src/components/NewThing.tsx` + `NewThing.module.css` + `NewThing.test.tsx`（三件一套）
2. 样式只引用 token（`var(--chpli-*)`）；**不要写 `var(--chpli-x, #兜底值)`**——断链应该立刻暴露，兜底只会掩盖
3. 从 `src/index.ts` 导出
4. 测试用 `@testing-library/react` + `fireEvent`（与仓库现有测试一致）

token 改名要先加旧名别名、全仓迁移完再删（本次 `--chpli-accent → --chpli-primary` 就是这个流程）。维护纪律全文见 `packages/ui/README.md`。

### 10.6 迁移的验证套路（可复用的重构方法论）

这次 7 个应用逐一迁移，每一步都用同一张安全网，所以敢大步改：

1. **组件测试**管渲染逻辑（换个组件 className 变了，测试必须不依赖具体类名）
2. **Playwright 截图**管视觉（起 dev server + mock API，人眼看一眼）
3. **42 项 e2e**管真实交互链路

外加两条经验：**e2e 断言用 role/文本定位器，不要用实现私有类名**（`.tag-editor__chip` 这类类名随重构消失会让测试挂掉，而 `getByRole('dialog', { name })` 天然抗重构——还顺带做无障碍检查）；**每层迁移跑完立刻全量回归**，不把失败攒到后面。

### 10.7 dev 启动加固（predev + strictPort）

`pnpm dev` 现在自带清场：根 package.json 的 `predev` 钩子会跑 `scripts/kill-port-listeners.mjs`，杀掉占用 3000–3006/4000 的残留 node 进程（只杀 node，其他进程只报告不动）。同时 7 个 rsbuild 配置都设了 `strictPort: true`——端口被占时**立即报错退出**，不再静默 +1 递增。为什么必须报错：remoteEntry 的 URL 写死是 `3001`–`3006`，静默递增即使启动"成功"，页面也是坏的，排查起来远比启动失败费劲。

---

## 11. 避坑指南（真实踩过的坑）

1. **pnpm 11 的 `ERR_PNPM_IGNORED_BUILDS`**：依赖的构建脚本需要在 `pnpm-workspace.yaml` 里用 `allowBuilds: {esbuild: true, ...}` 逐个声明（package.json 的 `pnpm.onlyBuiltDependencies` 已被 pnpm 11 废弃）。
2. **Module Federation RUNTIME-006**：Host 作为入口应用，shared 的 react/react-dom 必须 `eager: true`，否则入口同步调用 `loadShareSync` 时共享模块尚未加载，页面白屏。同时要给 `'react/'`、`'react-dom/'` 加子路径共享，否则 `react-dom/client` 等子路径导入会绕过共享产生第二个 React 副本。Remote 侧的对称问题：remote 的 shared 不能 eager，因此 remote 的 `src/index.tsx` 只留 `import('./bootstrap')` 异步边界，真正的渲染入口（createRoot 等同步共享模块调用）放在 `src/bootstrap.tsx`，否则 remote 独立运行（dev server 直开 3001/3002）同样抛 RUNTIME-006。
3. **Remote 暴露的组件必须自包含副作用导入**：`apps/*/src/bootstrap.tsx` 里的 `import './i18n'` 在独立运行时有效，但 Host 加载的是暴露的 `./App` 模块——`App.tsx` 自己不 import i18n 就会渲染出原始 key。
4. **Docker 拉取镜像超时**：国内网络拉 docker.io 官方镜像可能极慢，可改用本地已有镜像（本工程已用 `postgres:16-alpine`）或配置镜像加速器。
5. **端口残留**：服务异常退出后端口可能仍被占用。`pnpm dev` 现在自带 `predev` 清场（见第 10.7 节）；手动清理用 `lsof -ti:3000,3001,3002,4000 | xargs kill`。注意 e2e 期间 Playwright 会独占同一批端口，此时启动 dev 必然撞车，等 e2e 跑完再开发。
6. **测试选择器**：`getByRole({name})` 默认子串匹配，日历事件按钮的 accessible name 里可能包含 "Travel" 等词导致命中多个元素——导航按钮断言要加 `exact: true`。
7. **`.next` 红线**：本工程禁止 Next.js 及任何产生 `.next` 目录的工具（旧版工程的历史约束，见 `AGENTS.md`）。
8. **后端集成测试与 e2e 不得并行**：两者共用同一个 PostgreSQL（`chpli2`），集成测试的 `resetDatabase` 会清空 e2e 依赖的种子国家/事件，造成 e2e 随机失败（如「seed country China must exist」、视图取数为空）。跑 e2e 期间不要同时跑 `services/api` 的测试。
9. **Playwright 视图切换是 tab 不是 button**：日历的月/周/日是 `tablist` 里的 tab（`getByRole('tab', { name: 'Week' })`），写 `getByRole('button')` 会一直等到超时。
10. **`emitDecoratorMetadata: false` 下 Nest DI 必须显式 `@Inject`**：本工程 tsconfig 关闭 decorator metadata（esbuild 工具链不产出），构造函数参数、DTO 类型都无从推断——所有 provider 构造函数参数加 `@Inject(XxxService)`，请求体用 `@ValidatedBody(Dto)`（见 `src/shared/validate-dto.ts`），否则运行时 `undefined` 或校验静默失效。**Module 类的构造器注入同理**（2026-11 N3 定时发布踩过：NotesModule 裸写 `constructor(private notes: NotesService)`，tsx 运行时注入 undefined，首个清扫 tick 直接崩溃进程；集成测试却全绿——vitest 工具链发射 metadata，环境差异让缺陷只在 dev/生产暴露）。
11. **`prisma migrate dev` 会挂起**：它是交互式的，在本工程环境（无 TTY）里创建迁移时会一直等待输入。新迁移的正确姿势：手写 `prisma/migrations/<timestamp>_<name>/migration.sql`，再 `pnpm exec prisma migrate deploy` 应用 + `prisma generate` 重生成 client（F4/M0 已多次验证）。
12. **手机登录标识必须归一化后完全一致**：`+86 138...` 和 `138...` 归一化结果不同，是两种不同的登录标识（入库即 `normalizePhone` 的结果）。测试和 e2e 里注册与登录要么用同一种写法，要么自己算归一化结果，否则会莫名 401。
13. **验证码联调/e2e 靠 devCode**：`AUTH_CODE_TRANSPORT=log`（默认）时 `/api/auth/code` 响应会带 `devCode`、同时写服务器日志；这是 e2e 唯一能拿到验证码的通道。注意 60s 重发冷却——同一个 identifier 在 e2e 里点两次「发送验证码」第二次会 429，用 `page.waitForResponse` 抓第一次响应即可。
14. **「今天」一律用本地日历日，禁止 `toISOString().slice(0,10)`**：本工程 day key（YYYY-MM-DD）全链路无时区语义。`new Date().toISOString()` 是 UTC——在本地时区领先 UTC 的环境（如东八区）每天 00:00–08:00 窗口内，"今天"会差一天：日历到期标签把「今天」显示成「还有 1 天」、成长回顾默认记成「昨天」。正确姿势是 `dayKey(new Date())`（本地年月日拼装，见 `apps/calendar/src/dates.ts`）。此坑在 2026-11-26 零点前后的回归中两次现形（Sidebar dueLabel、reviews.service todayKey 已修）；纯 key 的日期加减（`due.ts shiftKey`）不涉及"今天"概念，保持 UTC 实现即可。
15. **OpenAPI 契约快照要随接口变更重生成**：`services/api/test/contracts/openapi.snapshot.json` 与实时生成的文档逐字节比对。新增/修改 DTO 字段后删掉快照文件跑一次 `test/contract/openapi.contract.spec.ts` 即自动重写，务必 `git diff` 确认 diff 只含本次契约变更。

---

*本文档随工程迭代持续更新。修改模块结构、路由或架构决策时，必须同步更新本文档。*
