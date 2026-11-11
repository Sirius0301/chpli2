# CHPLI2 全栈开发教程（Developer Tutorial）

> 目标读者：全栈开发基础较少、希望从 0 开始理解并迭代本工程的开发者。
> 最终目标：**2 个月（约 8 周，2026-11 初 → 2026-12 底）学习并实战，完成网站基本内容并成功部署上线**。
> 阅读方式：第 1–4 章建立全局认知；第 5–6 章动手把工程跑起来；第 7 章是按周执行的学习+实战计划；第 8 章部署；第 9–10 章是资源与避坑指南。每周开始前重读相关章节。

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
10. [避坑指南（真实踩过的坑）](#10-避坑指南真实踩过的坑)

---

## 1. 工程全景：模块与目录

CHPLI2 是一个 **pnpm workspaces monorepo**（多包单仓库）。一个仓库里装着 4 个可独立启动的应用 + 1 个共享代码包。

```
chpli2/
├── apps/                    # 前端（3 个应用）
│   ├── host/                #   宿主应用：导航、语言切换、加载业务模块
│   ├── travel/              #   Travel Remote：行程与交通记录（业务模块 1）
│   └── calendar/            #   Calendar Remote：日历事件（业务模块 2）
├── services/
│   └── api/                 # 后端：NestJS 模块化单体（唯一的服务端进程）
├── packages/
│   └── shared/              # 前后端共享代码：类型、校验函数、错误码、事件契约
├── e2e/                     # 端到端测试（Playwright）
├── infra/
│   └── docker-compose.yml   # 开发数据库（PostgreSQL 容器）
├── package.json             # 仓库根：pnpm 脚本（dev / test / test:e2e ...）
└── pnpm-workspace.yaml      # 声明哪些目录是 workspace 包
```

### 模块清单

| 模块 | 位置 | 技术 | 职责 | 状态 |
| --- | --- | --- | --- | --- |
| Host | `apps/host` | React 18 + Rsbuild | 应用外壳：左侧导航、顶部语言切换器、按需加载 Travel/Calendar | ✅ 可用 |
| Travel | `apps/travel` | React 18 + Rsbuild | 行程（Trip）与交通段（Transport）的完整增删改查 | ✅ 可用 |
| Calendar | `apps/calendar` | React 18 + Rsbuild | 事件列表（按月分组）、来源跳转 | ✅ 可用（最小视图） |
| API | `services/api` | NestJS + Prisma | 全部业务逻辑与数据读写 | ✅ 可用（Travel+Calendar） |
| Shared | `packages/shared` | 纯 TypeScript | 前后端共用的 DTO 类型、领域校验函数、错误码、领域事件格式 | ✅ 可用 |
| E2E | `e2e` | Playwright | 模拟真实浏览器的端到端测试 | ✅ 4 个用例 |

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
- **共享依赖**：react / react-dom 被声明为 singleton（单例），三个应用共用浏览器里的同一份 React，否则会出现"两个 React 实例"导致的诡异崩溃（见避坑指南）。
- 配置位置：每个 app 的 `rsbuild.config.ts` 里 `pluginModuleFederation({...})`。
- 端口约定：Host 3000 / Travel 3001 / Calendar 3002 / API 4000。
- 前端之间的通信：Calendar 点击事件 → 触发 `window` 自定义事件 `chpli2-open-trip` → Host 监听后切换到 Travel 并传入 `initialTripId`（见 `apps/host/src/App.tsx`）。
- 语言切换：语言存 `localStorage`（key `chpli2-language`）+ 广播事件 `chpli2-language-changed`，三个应用各自监听并切换 i18next 实例。

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

## 10. 避坑指南（真实踩过的坑）

1. **pnpm 11 的 `ERR_PNPM_IGNORED_BUILDS`**：依赖的构建脚本需要在 `pnpm-workspace.yaml` 里用 `allowBuilds: {esbuild: true, ...}` 逐个声明（package.json 的 `pnpm.onlyBuiltDependencies` 已被 pnpm 11 废弃）。
2. **Module Federation RUNTIME-006**：Host 作为入口应用，shared 的 react/react-dom 必须 `eager: true`，否则入口同步调用 `loadShareSync` 时共享模块尚未加载，页面白屏。同时要给 `'react/'`、`'react-dom/'` 加子路径共享，否则 `react-dom/client` 等子路径导入会绕过共享产生第二个 React 副本。Remote 侧的对称问题：remote 的 shared 不能 eager，因此 remote 的 `src/index.tsx` 只留 `import('./bootstrap')` 异步边界，真正的渲染入口（createRoot 等同步共享模块调用）放在 `src/bootstrap.tsx`，否则 remote 独立运行（dev server 直开 3001/3002）同样抛 RUNTIME-006。
3. **Remote 暴露的组件必须自包含副作用导入**：`apps/*/src/bootstrap.tsx` 里的 `import './i18n'` 在独立运行时有效，但 Host 加载的是暴露的 `./App` 模块——`App.tsx` 自己不 import i18n 就会渲染出原始 key。
4. **Docker 拉取镜像超时**：国内网络拉 docker.io 官方镜像可能极慢，可改用本地已有镜像（本工程已用 `postgres:16-alpine`）或配置镜像加速器。
5. **端口残留**：服务异常退出后端口可能仍被占用，用 `lsof -ti:3000,3001,3002,4000 | xargs kill` 清理。
6. **测试选择器**：`getByRole({name})` 默认子串匹配，日历事件按钮的 accessible name 里可能包含 "Travel" 等词导致命中多个元素——导航按钮断言要加 `exact: true`。
7. **`.next` 红线**：本工程禁止 Next.js 及任何产生 `.next` 目录的工具（旧版工程的历史约束，见 `AGENTS.md`）。
8. **后端集成测试与 e2e 不得并行**：两者共用同一个 PostgreSQL（`chpli2`），集成测试的 `resetDatabase` 会清空 e2e 依赖的种子国家/事件，造成 e2e 随机失败（如「seed country China must exist」、视图取数为空）。跑 e2e 期间不要同时跑 `services/api` 的测试。
9. **Playwright 视图切换是 tab 不是 button**：日历的月/周/日是 `tablist` 里的 tab（`getByRole('tab', { name: 'Week' })`），写 `getByRole('button')` 会一直等到超时。

---

*本文档随工程迭代持续更新。修改模块结构、路由或架构决策时，必须同步更新本文档。*
