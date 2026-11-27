# 从 0 到 1 独立构建 CHPLI：每天 2 小时 · 费曼学习法实战计划

> 基线：2026-11-26 的本仓库——约 4.2 万行代码、28 个 Prisma 模型、19 个迁移、7 个前端应用、1 个 NestJS API、66 条 Playwright 用例。
> 目标读者：能写基础 TypeScript/React，但还没有独立从空目录搭出这套系统的人。
> 计划长度：10 周 × 7 天 × 2 小时 = **140 小时**；第 8 周末是「最小可交付门」，第 9–10 周做部署与空白重建。
> 使用方法：先花 40 分钟读完第 1–3 章，再从 Day 1 开始；每天结束写 5 行日志；每周日做周考与复盘。

---

## 目录

1. [先定义「独立 build」](#1-先定义独立-build)
2. [工程全景与阅读顺序](#2-工程全景与阅读顺序)
3. [费曼学习法：把「看懂」变成「讲得出、建得出」](#3-费曼学习法把看懂变成讲得出建得出)
4. [10 周总览](#4-10-周总览)
5. [每日 2 小时计划（Day 1–70）](#5-每日-2-小时计划day-170)
6. [从零构建 Playbook](#6-从零构建-playbook)
7. [费曼概念卡（14 张）](#7-费曼概念卡14-张)
8. [真实陷阱地图](#8-真实陷阱地图)
9. [自测、答辩与空白重建评分](#9-自测答辩与空白重建评分)
10. [进度管理、命令与资源](#10-进度管理命令与资源)

---

## 1. 先定义「独立 build」

### 1.1 三种「0→1」，先选一种

| 层次 | 含义 | 产物 | 参考工时 | 建议 |
|---|---|---|---|---|
| A. 跑通现有 | 克隆、装依赖、起服务、改小功能 | 能运行、能解释主流程 | 1–2 天（约 4h） | 第 0 步，必须做 |
| B. 核心复刻 | 新建仓库，从空目录重建「认证 + Travel + Outbox 同步 + Memo 日历 + Host/MF + 测试 + 部署」 | 可独立运行、可演示、可上线的核心系统 | **120–150h** | **本计划的目标** |
| C. 全量复刻 | 1:1 重建 7 个模块、所有边界情况、历史兼容 | 与现仓库功能等价 | 300h+ | 不建议作为第一目标 |

**关键认知：0→1 ≠ 1:1 抄一遍。** 现仓库有大量历史沉积（已退役的 Event/Calendar/Reminder/Holiday、Portal 协议、笔记富文本细节、三个模块的完整业务）。第一遍只重建「最小但真实」的垂直切片；全量复刻是之后的第二次迭代。

### 1.2 本计划的验收物（Definition of Done）

到 Day 70，你应该在**一个全新的空目录**里拥有：

- [ ] 独立 git 仓库，没有复制现有源码（允许查文档、看参考实现、看报错；不允许整文件粘贴）。
- [ ] `pnpm` monorepo：`apps/host` + `apps/travel` + `apps/calendar` + `services/api` + `packages/shared` + `packages/ui` + `e2e`。
- [ ] 用户注册/登录/JWT/全局守卫/按用户隔离（跨用户访问返回 404）。
- [ ] Travel：PLAN/MEMORY 行程创建与详情、交通段增删改查、同级线路校验（国家↔国家、城市↔城市、同城地点↔地点）。
- [ ] Outbox → Calendar 投影：创建/更新/删除同步，重复投递不产生第二条事件，MEMORY 永不同步。
- [ ] Memo 日历：月/周/日三视图、纯日期语义、重复规则展开、按实例完成。
- [ ] Host 通过 Module Federation 加载 2 个 Remote，中/英/德三语，窄屏可用。
- [ ] 测试：shared 单测、API 集成测试、React 组件测试、3 条真实浏览器 e2e（创建→立即可见→刷新仍在→删除）。
- [ ] 部署：生产构建 + Docker + 反向代理 + HTTPS + 每日数据库备份。

### 1.3 工程量现实检查

| 部分 | 现仓库规模 | 核心复刻建议 | 说明 |
|---|---:|---:|---|
| `services/api` | 约 16,100 行 | 5,000–6,500 行 | 只做认证、Travel、Calendar 投影、Memo |
| `apps/*` 前端 | 约 19,900 行 | 5,000–6,000 行 | Host + Travel + Calendar 三个应用 |
| `packages/shared` | 约 2,400 行 | 1,200 行 | 核心 DTO、校验、事件、错误码 |
| `packages/ui` | 约 860 行 | 300–500 行 | Button/Input/Select/Modal/Empty 够用 |
| `e2e` | 约 2,900 行 | 600–900 行 | 3–5 条旅程，不求覆盖所有模块 |
| 自动化测试 | 约 500 条 | 80–120 条 | 核心路径 + 主要异常 + 用户隔离 |

每天 2 小时、连续 70 天是 140 小时。**不要用「行数」衡量进度，用「可运行的垂直切片」衡量。** 一个能创建、能刷新、能删除、有测试的行程功能，比十个空页面有价值。

### 1.4 范围裁剪：Must / Should / Could / Won't

| 优先级 | 范围 | 处理方式 |
|---|---|---|
| **Must** | 认证与用户隔离、Travel、Outbox/Calendar 投影、Memo 核心、Host/MF、三语、核心测试、部署 | 必须完成；落后也不砍 |
| **Should** | Bookmarks 最小模块、Memo 标签/筛选、图片上传（MinIO）、重复规则自定义星期、到期提醒 | 时间够就做；W8 可跳过 |
| **Could** | Notes 编辑器、Growth、LifeFolder、Portal postMessage、验证码登录、农历、通知 | 第一遍不做；第二次迭代再加 |
| **Won't** | 已退役的 Event/Calendar/Reminder/Holiday 表、评论系统、管理后台、全量文案与图片 | 明确不做，避免时间黑洞 |

> **重要省时点**：`schema.prisma` 里有 28 个模型，但 `Calendar`、`Event`、`Reminder`、`HolidayEntry` 是 Memo 化之前的遗留（见 `ROADMAP.md` 的 F1/F2/F4 退役记录）。核心复刻只需要约 14 个模型：`User`、`Country`、`City`、`Location`、`Trip`、`Transport`、`OutboxEvent`、`CalendarEvent`、`Memo`、`MemoCompletion`、`LoginCode`（可选）、`Bookmark`（可选）、`MemoImage`（可选）、`Note`（可选）。

### 1.5 三条铁律

1. **垂直切片，不做「先写完所有表再写页面」。** 每个切片都走完：契约 → 数据库 → API → 测试 → UI → e2e → 文档。
2. **契约先行。** 先在 `packages/shared` 写类型、常量、校验函数和错误码，再写后端和前端；前后端引用同一份，避免「两套校验」。
3. **先自己写，卡 30 分钟再看参考。** 看完参考只允许抄「模式」，合上文件重写一遍；重写不出来，说明还没掌握。

---

## 2. 工程全景与阅读顺序

### 2.1 一句话架构

**React Host 在浏览器运行时通过 Module Federation 加载 6 个业务 Remote；所有 Remote 通过 `/api` 访问同一个 NestJS 模块化单体；后端用 Prisma 访问 PostgreSQL；Travel 与 Calendar 之间用事务性 Outbox 事件解耦；文件进对象存储，数据库只存元数据。**

```
浏览器
  └─ Host (:3000) ──MF──▶ Travel (:3001) / Calendar (:3002) / Notes (:3003) ...
                                   │
                                   └─ /api 代理 ──▶ NestJS (:4000) ──Prisma──▶ PostgreSQL (:5432)
                                                          │
                                                          └─▶ MinIO (:9000, 可选)
```

### 2.2 目录地图

```
chpli2/
├── apps/
│   ├── host/                 # 宿主：导航、语言、认证、加载 Remote（3000）
│   ├── travel/               # 行程与交通段（3001）
│   ├── calendar/             # 备忘录化日历（3002）
│   ├── notes/                # Markdown 笔记（3003，第一遍不做）
│   ├── bookmarks/            # 书签（3004，Should）
│   ├── growth/               # 成长与职业（3005，第一遍不做）
│   └── lifefolder/           # 人生文件夹（3006，第一遍不做）
├── services/api/             # NestJS 模块化单体（4000）
│   ├── src/auth/             # 注册、登录、JWT、全局 Guard
│   ├── src/travel/           # 行程、交通段、地理参考数据
│   ├── src/calendar/         # CalendarEvent 投影与查询
│   ├── src/memo/             # Memo、完成实例、图片
│   ├── src/shared/           # PrismaService、Outbox、异常过滤器、对象存储
│   └── prisma/               # schema + migrations + seed
├── packages/
│   ├── shared/               # 类型、DTO、校验、错误码、领域事件（直接引 TS 源码）
│   └── ui/                   # tokens + 原子组件（直接引 TS 源码）
├── e2e/                      # Playwright
├── infra/docker-compose.yml  # PostgreSQL + MinIO
└── scripts/                  # 开发辅助脚本
```

### 2.3 运行时拓扑

| 进程 | 端口 | 职责 | 启动方式 |
|---|---:|---|---|
| Host | 3000 | 应用外壳、导航、语言、认证、懒加载 Remote | `pnpm -C apps/host dev` |
| Travel Remote | 3001 | 行程/交通段 UI | `pnpm -C apps/travel dev` |
| Calendar Remote | 3002 | 日历/Memo UI | `pnpm -C apps/calendar dev` |
| Notes/Bookmarks/Growth/LifeFolder | 3003–3006 | 其余业务模块 | 各自 `dev` |
| API | 4000 | 全部业务逻辑与数据读写 | `pnpm -C services/api start:dev` |
| PostgreSQL | 5432 | 唯一数据库 | `pnpm dev:db` |
| MinIO | 9000/9001 | 对象存储（可选） | `pnpm dev:db` |

根 `pnpm dev` 会先跑迁移，再用 `concurrently` 启动 API + 7 个前端；`predev` 会清掉占用 3000–3006/4000 的残留 node 进程。

### 2.4 必须记住的领域规则

1. **Plan 与 Memory 不互斥**，也不由当前时间自动转换；计划时间可以在过去，到期后等待用户确认。
2. **计划时间与实际时间分别保存**；前端展示时区分两者。
3. **旅行线路只允许同级连接**：国家↔国家、城市↔城市、同城内地点↔地点；禁止国家→城市、城市→地点、跨城市地点连线。
4. **只有 PLAN 行程且 `syncToCalendar=true` 才同步日历**；MEMORY 永不同步；关闭同步时要清除已有投影。
5. **跨模块不直接改对方的数据表**：通过 API 或领域事件协作；同步必须幂等、可追溯、可恢复。
6. **图片和文件进对象存储**，数据库只存元数据和存储键。
7. **时间语义分三种**：时刻用 UTC 语义（本仓库 Prisma 映射为 `TIMESTAMP(3)`，读写统一按 UTC ISO 字符串；新项目建议 `timestamptz`）；纯日期用 `YYYY-MM-DD` 的 day key（无时区）；展示按用户本地时区/语言格式化。三者不要混。
8. **用户数据默认私有**；删除/移动/发布等重要操作必须二次确认。

### 2.5 代码阅读顺序（按依赖，不按目录）

| 顺序 | 读什么 | 要回答的问题 |
|---:|---|---|
| 1 | `README.md`、`PROJECT_INSTRUCTIONS.md`、`ROADMAP.md`、`Developer-Tutorial.md` | 产品是什么？当前做到哪？哪些已退役？ |
| 2 | `package.json`、`pnpm-workspace.yaml`、各包 `package.json` | 有哪些包？脚本怎么调度？依赖怎么共享？ |
| 3 | `services/api/prisma/schema.prisma` + `migrations/` | 数据所有权、关系、唯一约束、历史迁移 |
| 4 | `src/main.ts`、`src/app.module.ts` | 全局前缀、校验管道、异常过滤器、模块图 |
| 5 | `src/auth/auth.guard.ts`、`auth.service.ts` | 请求如何认证？用户身份如何进入业务层？ |
| 6 | `src/travel/travel.controller.ts`、`travel.service.ts` | 一个垂直切片的 Controller→Service→Prisma 全貌 |
| 7 | `src/shared/outbox-dispatcher.ts`、`src/calendar/calendar-sync.service.ts` | 跨模块事件如何发、如何消费、如何幂等 |
| 8 | `packages/shared/src/validation.ts`、`events.ts`、`memo.ts` | 前后端共享契约与领域规则 |
| 9 | `apps/host/src/App.tsx`、`apps/host/rsbuild.config.ts`、`apps/travel/src/index.tsx` | Host 如何加载 Remote、共享 React、异步边界 |
| 10 | `apps/travel/src/api.ts`、`TransportForm.tsx`、`apps/calendar/src/dates.ts` | 前端请求、表单校验、日期语义 |
| 11 | `services/api/test/`、`e2e/trip-calendar.spec.ts` | 测试分层与真实用户旅程 |

> 注意：`Developer-Tutorial.md` 写于更早版本，个别路由与状态已过期（例如日历事件页已被 Memo 取代、Travel 日历投影现在用 `/api/calendar/travel-events` 做 API 级断言）。**以源码、测试和 `ROADMAP.md` 为准**；本计划已按当前代码校正。

### 2.6 质量门与测试版图

| 层 | 工具 | 测什么 | 命令 | 大致数量 |
|---|---|---|---|---:|
| 共享逻辑单测 | Vitest | `validateRoute`、重复展开、时区/日期、错误码 | `pnpm -C packages/shared test` | 约 65 |
| 组件测试 | Vitest + Testing Library | 表单交互、按钮禁用、列表/空态、错误提示 | `pnpm -C apps/travel test` | 约 105（7 个前端） |
| UI 组件测试 | Vitest + Testing Library | Button/Input/Select/Modal/Empty | `pnpm -C packages/ui test` | 约 18 |
| 后端单元测试 | Vitest | 纯服务逻辑（mapper、sync status、日期） | `pnpm -C services/api test:unit` | 约 30 |
| 后端集成测试 | Vitest + Supertest + 真 PostgreSQL | API 正常/异常/越权/幂等 | `pnpm -C services/api test:integration` | 约 200 |
| 契约测试 | Vitest + OpenAPI 快照 | DTO/路由变更是否同步到文档 | `pnpm -C services/api test:contract` | 1 个套件 |
| 端到端 | Playwright + 真浏览器 | 创建→可见→刷新→修改→删除 | `pnpm test:e2e` | 66 |
| 一键回归 | 组合 | typecheck + 全部非 e2e 测试，包级串行 | `pnpm verify` | 约 430 |

> 命令解释：`pnpm verify` = `pnpm typecheck && pnpm -r --workspace-concurrency=1 --filter '!./e2e' test`。**不要裸跑 `pnpm -r test` 下结论**——多包并行会让时序敏感的集成测试偶发失败。e2e 与 dev server 端口互斥，不能同时跑。
>
> ⚠️ **数据安全**：`services/api/test/setup.ts` 的 `resetDatabase()` 会清空目标库的业务表；测试读取 `DATABASE_URL`，默认就是开发库。第一次跑 API 测试前，先备份开发库，或创建独立的 `chpli2_test` 库并把 `DATABASE_URL` 指过去（先 `migrate deploy`）。e2e 目前复用开发库，跑之前确认没有要保留的数据。**不要在有真实数据的库上直接跑 `pnpm verify`。**

---

## 3. 费曼学习法：把「看懂」变成「讲得出、建得出」

### 3.1 代码版费曼五步

1. **选一个「问题」，不是「标题」。**
   坏：今天学 Prisma。好：为什么改了 `schema.prisma` 还要写迁移？不写会发生什么？
2. **合上代码，用 5 分钟讲给一个 12 岁的孩子听。**
   可以录音、写在纸上、或讲给 AI 听。禁止使用「就是那个」「反正框架会处理」这类借词。
3. **标记卡壳点，回源码/文档求证。**
   卡壳的地方就是你的知识缺口。写下「纠错卡」：我原来以为……，实际上是……，证据在 `文件:行号`。
4. **用类比 + 反例 + 最小实验把解释压到 50 字以内。**
   反例比定义更能暴露理解：如果去掉这个约束，系统会坏在哪？
5. **让测试或命令替你作证。**
   每个概念至少配一个可证伪实验：跑一条测试、查一次数据库、看一次网络请求。**讲得顺 ≠ 真的懂；能预测结果才算懂。**

### 3.2 每天 2 小时的时间盒

| 时段 | 时长 | 做什么 | 产出 |
|---|---:|---|---|
| 00:00–00:10 | 10m | 间隔复习：合上资料，讲昨天/三天前的卡片 | 口头复述，标记忘记的点 |
| 00:10–00:40 | 30m | 带着 3 个问题读源码/官方文档一节 | 3 条笔记，不超过 1 页 |
| 00:40–01:40 | 60m | 动手实现一个最小增量 + 写/跑测试 | 可运行代码或可复现实验 |
| 01:40–01:55 | 15m | 费曼输出：录音/写卡片/画图，记录卡壳 | 1 张卡片 + 1 个待验证问题 |
| 01:55–02:00 | 5m | 记日志、git commit、写下明天第一件事 | 5 行日志 + 干净工作区 |

**碎片日（只有 45 分钟）**：10 分钟复习 + 20 分钟改一个小点（改文案/补一个断言/读一个函数）+ 10 分钟讲清 + 5 分钟日志。**不要因为只有 45 分钟就跳过费曼输出。**

**单日超时规则**：超过 2 小时 15 分钟就停。把未完成项写进「明日第一件事」，不要熬夜补——连续性比单日时长重要。

### 3.3 费曼卡片模板

把下面模板复制到你的学习日志（建议 `.kimi-code/agents/docs/CHPLI-Learning-Log.md`，按仓库文档规范放置）：

```markdown
### 卡片 N｜问题（用问句，不用标题）

- 12 岁版（≤50 字）：
- 面试官版（含术语、边界、trade-off）：
- 生活类比：
- 反例 / 如果去掉它会怎样：
- 源码锚点：path/to/file.ts:行号
- 可证伪实验：命令 / 测试名 / 预期结果
- 本次卡壳点：
- 纠错卡：我原来以为……，实际……
- 复习：D+1 / D+3 / D+7
```

### 3.4 三种讲法，缺一不可

| 讲法 | 要求 | 用来检验 |
|---|---|---|
| **12 岁版** | 不用术语，用生活类比，50 字内 | 是否真正理解，而不是背名词 |
| **面试官版** | 说出输入/输出、边界、失败模式、替代方案 | 是否有工程判断 |
| **编译器版** | 能写出类型签名、SQL、配置或伪代码 | 是否能落地 |

例：Outbox——
- 12 岁版：先把「要寄的信」和「要办的事」写在同一张纸上，再让邮差按纸送信；信送重了，收信人按编号只认一次。
- 面试官版：业务行与事件行同事务写入，至少一次投递，消费者用唯一 `syncKey` 做幂等 upsert；替代方案是双写或 CDC，但双写不一致、CDC 太重。
- 编译器版：`prisma.$transaction` 内 `transport.create` + `outboxEvent.create`；dispatcher 轮询 `processedAt=null`；handler 按 `syncKey` upsert。

### 3.5 间隔复习 1–3–7

- **D+1**：第二天早上用 2 分钟复述昨天的卡片，不看笔记。
- **D+3**：三天后做一次「空白纸重画」：只画时序图/ER 图/数据流，再对照。
- **D+7**：周日的周考里，用 5 分钟把本周核心概念讲给 AI 或朋友听。
- 忘记的卡片不要重读全文，只回到「源码锚点 + 可证伪实验」，重新走一遍五步。

### 3.6 用 AI 的正确姿势（反抄袭规则）

AI 可以极大加速，但也会制造「我看懂了」的幻觉。约定：

| 允许 | 禁止 |
|---|---|
| 让 AI 当学生，你讲给它听，它提问/挑错 | 让 AI 生成整个模块，你直接粘贴 |
| 让 AI 出 5 道追问题，检验你的解释 | 只看 AI 的解释，不跑代码 |
| 你先写接口/测试，再看 AI 的对照实现，diff 差异 | 让 AI 替你决定数据模型和边界 |
| 让 AI 解释报错、生成测试数据、审查 diff | 把 AI 生成的代码当成「已经理解」 |
| 让 AI 扮演面试官，追问 trade-off | 用「能跑」代替「能讲清」 |

示例 prompt（把 AI 当学生/考官，而不是代写）：

```text
我刚学完 Outbox。下面是我的 5 分钟讲解：
<粘贴你的解释>
请只做三件事：1) 标出事实错误；2) 追问 3 个我可能没想清的点；
3) 按 0–4 分评价我的解释（0=背名词，4=能重建），不要替我重写。
```

**硬规则：AI 生成的任何一段代码，你必须能逐行解释；解释不了就删掉重写。** 这不是道德要求，是防止 70 天后你仍然不能独立 build。

### 3.7 掌握度 rubric 与「假懂信号」

| 等级 | 表现 |
|---|---|
| L0 跑通 | 能按命令启动，但不知道为什么 |
| L1 复述 | 能说出术语和流程，离开笔记就卡 |
| L2 解释 | 能画图、能举例、能说出边界，看代码能定位 |
| L3 重建 | 空白仓库能重搭核心切片，能修 bug，能补测试 |
| L4 设计 | 能独立设计新切片：数据模型、API、异常、测试、部署 |

**目标：Day 70 达到 L3；L4 需要再做 2–3 个真实需求。**

假懂信号（出现任意一条，回到费曼第 2 步）：
- 能说「用 Outbox 保证最终一致」，但说不出「事件在哪个事务里写、重复了怎么办」。
- 能说「用 Module Federation」，但画不出 Host 加载 Remote 的时序，也不知道 `eager`/`singleton` 的作用。
- 能说「日期用 UTC」，但解释不了为什么 `toISOString().slice(0,10)` 会在东八区早上差一天。
- 能跑测试，但测试红了只会重跑，不会定位是数据、时序还是断言问题。

---

## 4. 10 周总览

| 周 | 主题 | 关键输入 | 交付物 | 周末门 |
|---:|---|---|---|---|
| W1 | 跑通 + 架构认知 | README、Tutorial、schema、Host/MF、Outbox | 架构一页纸 + 黄金链路时序图 | 能 5 分钟讲清全链路 |
| W2 | 新仓库骨架 + 数据层 | workspace、Prisma、Nest 基座 | 可启动的空系统 + 第一张表 | 能从空目录重搭骨架 |
| W3 | 认证与用户隔离 | JWT、bcrypt、Guard、DTO/错误分层 | 注册/登录/me + 越权 404 + 测试 | 能独立实现 auth 最小闭环 |
| W4 | Travel 后端垂直切片 | 领域校验、事务、outbox 写入 | Travel API + 集成测试 | API 层黄金链路闭环 |
| W5 | Host + MF + Travel UI | Rsbuild、MF、i18n、组件测试 | 浏览器可用的 Travel 模块 | 创建→刷新仍在 |
| W6 | Outbox + Calendar 投影 | dispatcher、upsert、幂等、软删 | 创建/更新/删除同步 + 幂等测试 | 重复 10 次仍 1 条事件 |
| W7 | Memo 日历 | 纯日期、重复展开、实例完成 | 月/周/日 + 重复 + 按实例完成 | 能重写 `expandMemoToRange` |
| W8 | 质量门 + 第二模块（可选） | Playwright、交付检查单 | 3 条 e2e + 全量回归 | **最小可交付门** |
| W9 | 部署 | Docker、反代、HTTPS、CI、备份 | 公网可访问 + 备份/恢复 | 公网黄金链路可用 |
| W10 | 空白重建挑战 | 自己的笔记，不看源码 | 5 天从空目录重建核心切片 | 评分 ≥80/100 |

> 如果只有 8 周：把 W9 压缩成 3 天部署、W10 的挑战改成「半天白板重建」，并跳过 W8 第二模块。**Must 不砍，Should/Could 全砍。**

> 周次是相对编号：从你开始的那天算第 1 天，第 7/14/…/70 天为复盘日；若从周一开始，复盘日正好是周日。

---

## 5. 每日 2 小时计划（Day 1–70）

> 读表方式：每天固定「输入 30m + 动手 75m + 费曼 15m」；「验收」是当天结束前必须看到的结果。没有验收结果，不算完成。

### 第 1 周：跑通现有系统，建立架构地图

**本周目标**：不改代码，先能运行、能画图、能讲清「一次创建交通段如何变成日历投影」。
**本周交付**：一页架构图 + 一张黄金链路时序图 + 一份「我还不懂的 10 个问题」清单。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D1** 环境与首次运行 | README「本地运行」+ Developer-Tutorial §5；核对 Node 20+、pnpm 11、Docker | 起 DB → migrate → seed → `pnpm dev`；手动走通「建行程→加交通段→等待约 1 秒并刷新详情，看到 SYNCED 徽标；用 API 查 travel-events 看到投影」；记录进程/端口 ✅ 3000 与 4000/api/docs 可访问 | 5 句话讲「打开 :3000 背后发生了什么」，画进程图 |
| **D2** 仓库地图与依赖 | 根 `package.json`、`pnpm-workspace.yaml`、各包 `package.json`；跑 `pnpm list -r --depth -1` | 画目录树 + 依赖图；标出 `shared/ui` 被谁引用；抄下所有根脚本 ✅ 能说出 7 前端/1 后端/2 共享包的分工 | 为什么用 monorepo？`workspace:*` 解析到什么？拆成 10 个仓库会多什么成本？ |
| **D3** 数据层 | `schema.prisma` 全部模型；19 个迁移目录名；`prisma/seed.ts` | psql `\dt`、`\d+ "Transport"`；查 seed 数据；画 Must 模型 ER 图；标出 4 张遗留表 ✅ 说出每张 Must 表的归属模块 | schema / migration / seed / generate 四者区别；为什么不能手改表？ |
| **D4** 后端请求链路 | `main.ts`、`app.module.ts`、`auth.guard.ts`、`travel.controller.ts`、`travel.service.ts` | Swagger 调 register/login/countries/create trip；用 curl 带 token；在代码里定位每个 handler ✅ 能指出 Guard、ValidationPipe、ExceptionFilter 的位置 | 带 token 的 POST 经过哪些层？401/400/409/422 分别在哪产生？ |
| **D5** 前端与 Module Federation | `apps/host/src/App.tsx`、`host/rsbuild.config.ts`、`travel/src/index.tsx` + `bootstrap.tsx` | DevTools Network 看 `remoteEntry.js`；直接开 :3001 独立运行；停掉 travel 看错误边界 ✅ 能说出 Host/Remote 的加载顺序 | Host 如何加载 Remote？React 为什么必须 singleton？remote 入口为什么要 `import('./bootstrap')`？ |
| **D6** 黄金链路 | `travel.service.ts` 事务段（约 106–122 行）、`outbox-dispatcher.ts`、`calendar-sync.service.ts`、`shared/events.ts` | 创建交通段后查 `"OutboxEvent"` 与 `"CalendarEvent"`；修改/删除再查；建 MEMORY 行程验证不同步 ✅ 能用 SQL 证明 `syncKey` 只有一行 | 从点击 Add 到 CalendarEvent 出现，画 8 步时序图；哪一步保证幂等？ |
| **D7** 测试与质量门 | `test/setup.ts`、一个 integration spec、一个组件测试、`e2e/playwright.config.ts` + `trip-calendar.spec.ts` | **先备份开发库或切到 `chpli2_test`**，再跑 `pnpm verify`；若环境允许跑 `pnpm test:e2e`；读一次失败日志 ✅ 能说出每层测试的命令与职责 | 测试金字塔每层测什么？为什么集成测试用真 DB？为什么 e2e 不能和 dev 并行？ |

**本周门（周日 30 分钟）**
- [ ] 能不看文档画出「浏览器 → Host → Remote → API → Prisma → PostgreSQL → Outbox → Calendar」。
- [ ] 能解释 8 个进程/端口各自的作用。
- [ ] 「不懂清单」至少 10 条，并标出下周要解决的 3 条。

**周考 3 题**
1. 为什么 Travel 和 Calendar 不直接互相调用 Service，而要走 Outbox？
2. `syncKey` 唯一约束解决的是什么问题？没有它会怎样？
3. 如果 Host 和 Remote 各自打包了一份 React，页面可能出现什么现象？

---

### 第 2 周：新仓库骨架 + 数据层

**本周目标**：在全新目录里搭出 monorepo、shared 包、PostgreSQL、Prisma、Nest 基座，并跑通第一个集成测试。
**本周交付**：`chpli-rebuild` 仓库 + 第一张表 + `/api/docs-json` + 1 个集成测试。
**对照规则**：先自己写；卡 30 分钟再看参考；看完合上重写。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D8** 新仓库骨架 | pnpm workspace 官方文档；参考根 `package.json`、`tsconfig.base.json` | 新建 `chpli-rebuild` + git init；写 `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`.gitignore`、`.prettierrc.json`；建空目录 ✅ `pnpm -r exec pwd` 列出所有包；首次 commit | workspace 协议如何解析？根脚本如何调度子包？ |
| **D9** shared 包 | `packages/shared/package.json`、`src/index.ts`、`validation.ts`、`errors.ts` | 建 `@chpli2/shared`（`main: src/index.ts`，不构建）；写 `ApiErrorBody`、`ERROR_CODES`、`validateRoute` + Vitest ✅ 3 个单测通过 | 为什么 shared 不构建？前后端共享类型如何避免漂移？ |
| **D10** 数据库容器 + Prisma | `infra/docker-compose.yml`、`schema.prisma` 头部、`.env.example` | 写只含 postgres 的 compose；启动容器；`prisma init`；配 `DATABASE_URL`；写 `.env.example` ✅ `pg_isready` 通过，Prisma 能连接 | `DATABASE_URL` 从哪来？容器卷为什么重要？ |
| **D11** 第一张表与迁移 | 一个现有 `migration.sql`；`schema.prisma` 的 Country/City/Location | 写 schema（先 Country/City/Location；User 留到 D15）；手写 `0001_init/migration.sql`；`migrate deploy` + `generate`；psql 验证 ✅ 表存在、`_prisma_migrations` 有记录、重复 deploy 不报错 | `migrate deploy` 与 `migrate dev` 的区别；迁移为什么只向前？ |
| **D12** Nest 基座 | `main.ts`、`app.module.ts`、`shared/prisma.service.ts`、`api-exception.filter.ts` | 建 Nest 入口：全局前缀 `/api`、`ValidationPipe`、异常过滤器、Swagger、`PrismaService` ✅ `/api/docs-json` 返回 OpenAPI；启动无 DI 错误 | Nest 的 Module/Controller/Service/Provider 各是什么？依赖注入怎么工作？ |
| **D13** 第一个端点 + 集成测试 | `services/api/test/setup.ts`、`helpers.ts` | 实现 `GET /api/health`（此时还没有全局 Guard，先不做认证；D17 再加）；写 Supertest 集成测试；`resetDatabase` + `seed`（**先切到独立测试库**）✅ 测试绿，curl 返回 ok | 为什么测试要 reset？测试顺序依赖为什么危险？ |
| **D14** 周复盘 + 空白重建 | 自己的笔记 | 45 分钟从空目录重搭 root + shared + Prisma 连接（不看参考）；对照差异；补笔记 ✅ 能独立重搭骨架 | 5 分钟讲清「monorepo → DB → Nest」的启动顺序 |

**本周门**
- [ ] 新仓库 `pnpm install` 成功，`pnpm typecheck` 通过。
- [ ] 数据库有 4 张表，`migrate deploy` 可重复执行。
- [ ] 1 个真实集成测试通过（不是 mock）。
- [ ] 能解释「为什么新迁移要手写 + deploy，而不是 reset 开发库」。

**周考 3 题**
1. `prisma generate` 生成的是什么？为什么每次改 schema 都要跑？
2. 为什么 `shared` 包的 `main` 指向 `src/index.ts` 而不是 `dist`？
3. 集成测试和单元测试的边界在哪？为什么这个项目集成测试用真 PostgreSQL？

---

### 第 3 周：认证与用户隔离

**本周目标**：实现注册/登录/JWT/全局守卫/按用户隔离，并建立错误分层与契约测试。
**本周交付**：auth 最小闭环 + 跨用户 404 + 6 条集成测试 + OpenAPI 快照。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D15** User + 注册 | `auth/auth.dto.ts`、`auth.service.ts`、schema `User` | User 模型 + 迁移；注册 DTO；`bcryptjs` 哈希；用户名唯一冲突 409 ✅ 注册成功、重复 409 | 密码为什么不能明文？bcrypt 的盐存在哪？ |
| **D16** 登录 + JWT + me | `auth.service.ts` 登录逻辑、`@nestjs/jwt` 配置 | 实现 login/me；JWT payload `sub/username`；过期时间；测试 ✅ 登录拿 token，me 返回用户，无 token 401 | JWT 是无状态的吗？登出为什么不能只靠后端？ |
| **D17** 全局 Guard + 隔离 | `auth.guard.ts`、`current-user.decorator.ts`、`public.decorator.ts` | 注册全局 Guard；`@Public()`（让 health 保持公开）；从 `request.user` 取 `userId`；所有查询加 `userId`；跨用户 404 ✅ 两个用户数据互不可见 | 认证与授权的区别？为什么跨用户返回 404 而不是 403？ |
| **D18** 错误与校验分层 | `api-exception.filter.ts`、`http-error.ts`、`shared/errors.ts`、`validation.ts` | 统一 `{statusCode,message,errorCode}`；DTO 形态错误 400；领域错误按模块约定（Travel 用 400 + `ROUTE_*`/`TIME_ORDER_INVALID`，Memo 用 422）；测试 ✅ 错误格式一致、错误码稳定 | 400/401/403/404/409/422 各自语义；为什么本项目 Travel 用 400、Memo 用 422？这种不一致有什么风险？ |
| **D19** auth 集成测试补全 | `test/integration/auth-users.spec.ts` | 覆盖注册/登录/me/重复/错误密码/跨用户 6 条路径 ✅ 测试全绿且可重复 | 测试如何做到可重复？为什么不能依赖执行顺序？ |
| **D20** OpenAPI 契约 | `test/contract/openapi.contract.spec.ts`、快照文件 | 给 auth 路由加 Swagger 注解；生成快照；写契约测试；`git diff` 只含本次变更 ✅ 快照包含 auth，改动会触发失败 | 契约测试与集成测试的区别？快照为什么要逐字节比对？ |
| **D21** 周复盘 + 重建 auth | 自己的笔记 | 30 分钟白板画 auth 时序；45 分钟从空实现 register/login/guard（不看参考）；补测试 ✅ 能独立实现 auth 最小闭环 | 如果要把密码登录换成验证码登录，改哪些层？ |

**本周门**
- [ ] 注册/登录/me 三条路径可用，密码哈希入库存。
- [ ] 全局 Guard 生效，public 路由可访问，跨用户 404。
- [ ] 400/409/422 的边界按模块约定清晰，错误响应格式统一，错误码稳定。
- [ ] 能从空目录重写 auth 的核心三文件。

**周考 3 题**
1. JWT 里应该放什么、不该放什么？为什么？
2. 为什么 `@Public()` 要配合全局 Guard，而不是在每个 Controller 上写？
3. 如果两个用户同时注册同一个用户名，数据库靠什么保证只有一个成功？

---

### 第 4 周：Travel 后端垂直切片

**本周目标**：完成 Travel 的数据模型、地理参考数据、行程/交通段 CRUD、领域校验、事务与 outbox 写入。
**本周交付**：可用的 Travel API + 集成测试 + outbox 行 + 一份接口表。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D22** Travel 模型 | schema `Trip/Transport/Country/City/Location`、`OutboxEvent` | 写模型 + 关系 + 索引；加 `OutboxEvent`（为 D27 准备）；迁移；检查 FK/唯一约束 ✅ 迁移成功，ER 图更新 | 为什么 Country→City→Location 三层？Trip 与 Transport 的基数？ |
| **D23** Geo API + seed | `geo.controller.ts`、`geo.service.ts`、`seed-reference-data.ts` | 实现 countries/cities/locations；幂等 seed；测试 ✅ 参考数据可查，重复 seed 不重复 | seed 为什么必须幂等？参考数据与用户数据的边界？ |
| **D24** Trip API | `travel.controller.ts`、`travel.service.ts` 创建/查询；`TripList.tsx` 的 localStorage id 模式 | 实现 create/get；PLAN/MEMORY 枚举；用户隔离；测试；理解现仓库为什么没有 `GET /travel/trips`（前端存 id 逐个取）✅ 两种 trip 可创建，详情只返回自己的；能解释 localStorage id 模式的取舍 | 为什么 Plan 与 Memory 不由时间自动决定？为什么列表用 localStorage 存 id，而不是服务端 list？ |
| **D25** Transport 创建 + 领域校验 | `shared/validation.ts` 的 `validateRoute`、`travel.dto.ts` | 实现 create transport；前后端共用 `validateRoute`；同端点/跨级/跨城拒绝；测试 ✅ 3 类非法线路 400 + 稳定 errorCode，合法 201 | 为什么校验放 shared？后端为什么还要再校验一次？ |
| **D26** 时间与更新/删除 | `isPlannedTimeOrderValid`、update/delete service | PATCH/DELETE；计划/实际时间校验；级联/软删；测试 ✅ 更新时间成功，非法时间 400 + `TIME_ORDER_INVALID`，删除 204 | 计划时间可以过去吗？到达早于出发怎么处理？ |
| **D27** 事务 + outbox 写入 | `travel.service.ts` 约 106–122 行、280–315 行 | 把 create/update/delete 包进事务；同事务写 outbox；MEMORY 不写；`syncToCalendar=false` 发 Deleted 清除旧投影 ✅ 创建后 outbox 恰好 1 行；回滚时两者都不存在 | 为什么事件要和业务数据同事务？分开写会怎样？ |
| **D28** 周复盘 + API 黄金链路 | 本周测试 | 用 curl/Supertest 走完整链路；补异常用例；更新接口表/ER 图 ✅ API 层闭环 | 不看代码，讲清 Travel 的 API 与数据所有权 |

**本周门**
- [ ] 8 个 Travel 路由可用，错误码稳定。
- [ ] 非法线路三类都能被后端拒绝（不只是前端）。
- [ ] 创建交通段后，同一事务里有 outbox 行。
- [ ] 能解释为什么 `syncToCalendar=false` 不是「什么都不做」，而是「发 Deleted」。

**周考 3 题**
1. 为什么「同级线路」校验要放在 shared，而不是只写在前端表单？
2. 创建交通段的事务里，如果 outbox 插入失败，交通段会存在吗？为什么？
3. 计划时间与实际时间为什么分四列存，而不是一个 `time` 字段？

---

### 第 5 周：Host + Module Federation + Travel UI

**本周目标**：从空目录建立 Host 和一个 Travel Remote，跑通登录、创建/列表/详情/表单。
**本周交付**：:3000 可加载 :3001，最小登录/注册，三语切换，表单校验，组件测试。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D29** Rsbuild + React | `apps/travel/rsbuild.config.ts`、`package.json` | 新建 `apps/travel`；Rsbuild + React；端口 3001；`strictPort: true`；hello page ✅ :3001 可访问，build 成功 | Rsbuild 与 Vite/Webpack 的关系？为什么选它？ |
| **D30** MF hello remote | Host/Remote 的 MF 配置、`index.tsx`/`bootstrap.tsx` | Remote 暴露 `./App`；Host 懒加载；shared React singleton + 子路径共享；异步边界 ✅ Host 显示 Remote，独立运行也正常，无白屏 | `remoteEntry.js` 里有什么？为什么 shared 要 singleton？为什么 remote 入口要异步？ |
| **D31** Host 壳 + 登录 | `apps/host/src/App.tsx`、`AuthCard.tsx`、`i18n.ts` | 导航/布局/`Suspense`/`ErrorBoundary`；**最小登录/注册卡**（用户名/密码，token 存 localStorage，`/me` 校验，401 回登录）；先用最小 CSS，D34 再抽到 `@chpli2/ui` ✅ 能注册/登录；切换模块不刷新；Remote 挂了有错误提示 | Host 应该管认证还是 Remote 管？为什么 token 存 localStorage 有风险？ |
| **D32** Travel 列表/详情 | `apps/travel/src/api.ts`、`App.tsx`、`TripList/TripDetail` | API client（auth header/401）；列表/详情；loading/error/empty ✅ 真实数据渲染；刷新后仍在 | 前端 API 层为什么要统一封装？401 如何回登录？ |
| **D33** 表单 + 校验 | `TransportForm.tsx`、shared validation | 受控表单；国家/城市/地点联动；即时校验；提交禁用；错误展示 ✅ 非法线路前端阻止；成功创建后列表刷新 | 受控组件与非受控的区别？为什么提交中要禁用？ |
| **D34** i18n + UI | `host/src/i18n.ts`、`travel/src/i18n.ts`、`packages/ui` | 建 `packages/ui`（tokens + Button/Input/Chip）；三语 resources；localStorage + 语言事件；替换 Host/Travel 手写控件 ✅ 三语切换；无硬编码文案；UI 一致 | i18n、日期格式、时区为什么是三件事？ |
| **D35** 组件测试 + 浏览器验收 | Testing Library 文档 + 现有 `__tests__` 作参考 | 新建组件测试：测表单/列表；用 role 定位；跑测试；浏览器手动走黄金链路 ✅ 测试绿；三语+窄屏各看一眼 | 组件测试与 e2e 的边界；为什么不用 class 选择器？ |

**本周门**
- [ ] Host :3000 能加载 Travel :3001，直接打开 :3001 也能独立运行。
- [ ] 创建行程/交通段后刷新仍在；非法线路被阻止。
- [ ] 中/英/德切换生效；窄屏不横向溢出。
- [ ] 至少 3 个组件测试，使用 role/文本定位。

**周考 3 题**
1. 为什么 Host 的 shared React 要 `eager: true`，Remote 不能 eager？
2. Remote 独立运行正常，但被 Host 加载后 i18n 显示原始 key，最可能是什么原因？
3. 为什么 MF 场景下要用 CSS Modules，而不是全局 class？

---

### 第 6 周：Outbox 与 Calendar 投影

**本周目标**：把 Travel 的领域事件真正消费掉，形成「创建/更新/删除都同步、重复投递不重复、MEMORY 永不同步」的闭环。
**本周交付**：dispatcher + `CalendarEvent` upsert + 幂等测试 + Travel 详情同步徽标 + 只读投影 API。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D36** Dispatcher | `shared/outbox-dispatcher.ts` | 实现 200ms 轮询、batch、`register`、成功后标记；`onApplicationShutdown` 清理 ✅ 未处理事件被消费；handler 失败不标记 | 轮询 vs 消息队列；为什么第一版先用轮询？ |
| **D37** CalendarEvent + upsert | `calendar-sync.service.ts` | 建 `CalendarEvent` 模型 + 唯一 `syncKey`；upsert；软删；测试 ✅ 重复处理仍 1 行 | upsert 的并发安全靠什么？`syncKey` 为什么是幂等锚点？ |
| **D38** 注册事件 + MEMORY | `calendar-sync.service.ts` 约 21–73 行 | 注册 Planned/Updated/Deleted；MEMORY 跳过；`syncToCalendar=false` 用 Deleted 清旧投影 ✅ MEMORY 无事件；删除后软删 | 为什么 MEMORY 永不同步？用户关掉同步后旧事件怎么办？ |
| **D39** 幂等与恢复 | outbox 集成测试 | 手工重复投递；重启后重放；并发 tick；测试；日志 ✅ 重复 10 次仍 1 行；重启不丢事件 | 至少一次投递下，消费者必须满足什么？ |
| **D40** 投影 API + 同步徽标 | `calendar.controller.ts` 的 `travel-events`、`calendar-sync-status.service.ts`、`TransportList.tsx` | 实现 `GET /api/calendar/travel-events`；Travel 详情显示 SYNCED 徽标（模块间只读服务）；**不重建日历事件页**（M1 已用 Memo 取代）✅ API 有 1 条投影；刷新详情后徽标出现；刷新后仍在 | Travel 如何知道日历同步成功？为什么用只读服务而不是直查表？ |
| **D41** 失败处理 | dispatcher 日志、异常过滤器 | 模拟 handler 抛错；确认事件不标记、下轮重试；加告警日志；测试 ✅ 失败可恢复；进程不崩 | 失败重试会不会无限循环？如何设计死信/上限？ |
| **D42** 周复盘 + 讲 Outbox | 自己的笔记 | 白板画 Outbox 全链路；30 分钟从零写 dispatcher 骨架；对照 ✅ 能讲清三层 | 用邮局比喻讲 Outbox；面试官版讲 trade-off |

**本周门**
- [ ] 创建 PLAN + 同步 → `GET /api/calendar/travel-events` 恰好 1 条；更新 → 仍 1 条且内容更新；删除 → 软删。
- [ ] MEMORY → 0 条；`syncToCalendar=false` → 既有投影被清除。
- [ ] 同一条事件重复投递 10 次，`"CalendarEvent"` 仍只有 1 行。
- [ ] 能画「业务事务 → outbox → dispatcher → handler → upsert」的完整时序。

**周考 3 题**
1. Outbox 为什么能解决「业务写成功、事件写失败」的不一致？它又不能解决什么？
2. 如果 handler 成功但标记 `processedAt` 失败，下一轮会怎样？消费者需要什么性质？
3. `syncKey` 为什么用 `travel:transport:<id>`，而不是用标题+时间？

---

### 第 7 周：Memo 日历

**本周目标**：实现纯日期 Memo、月/周/日视图、重复规则展开、按实例完成。
**本周交付**：可创建/查看/完成/删除的日历 + 重复规则单测 + 三语文案。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D43** Memo 模型 + CRUD | schema `Memo/MemoCompletion`、`memo.service.ts` | 建模型；纯日期 `date`；CRUD API；用户隔离；测试 ✅ 创建/查询/更新/删除；跨用户 404 | 为什么 Memo 没有时区/时刻？`date` 与 `timestamp` 的区别？ |
| **D44** Calendar remote + 月视图 | `apps/travel/rsbuild.config.ts`（复制配置）、`apps/calendar` 组件、`dates.ts` | 新建 `apps/calendar` Remote（端口 3002，暴露 `./App`）；Host 加导航/懒加载；月网格（周日起）；点击日期创建；详情面板；测试 ✅ :3002 独立运行；Host 可进入；月视图可建/看；刷新持久 | 日历网格的日期边界怎么算？为什么周日起？ |
| **D45** 周/日视图 | `apps/calendar/src/App.tsx` | 周/日视图；视图切换；localStorage 偏好；响应式 ✅ 三视图一致；偏好刷新保留 | 同一个 memo 如何在三种视图复用？状态提升在哪？ |
| **D46** 重复规则 | `shared/memo.ts` 的 `expandMemoToRange` | 实现 UI 七选一：不重复/每天/每周/每月/每季度/每年/自定义（每季度=每季度第 N 天，不是每 3 个月同日）；短月/2-29 收拢；单测；前端展开 ✅ 规则用例全绿；创建后立即可见 | 为什么重复只在读取时展开，不预生成行？ |
| **D47** 按实例完成 | `memo.service.ts` 约 291–345 行、`MemoCompletion` | 非重复用 `completedAt`；重复用 completion upsert；唯一约束；`excludedDates`；测试 ✅ 完成某天不影响其他天；重复切换幂等 | 为什么重复备忘不能用 `completedAt`？实例身份是什么？ |
| **D48** 标签/筛选/三语 | Memo tags、聚合端点 | `tags text[]`；AND/OR 筛选；聚合端点；三语文案；窄屏 ✅ 筛选正确；候选实时刷新；三语 | 标签为什么不用独立表？AND/OR 语义怎么组合？ |
| **D49** 周复盘 + 重写展开 | 自己的笔记 | 关代码重写 `expandMemoToRange` 的 3 个规则；对比；补测试 ✅ 能独立写重复展开 | 讲清日期键、重复、实例完成三者的关系 |

**本周门**
- [ ] 月/周/日三视图都能创建和显示 Memo。
- [ ] 重复规则至少覆盖：每天、每周、每月、每季度、每年、自定义星期；短月/2-29 有测试。
- [ ] 完成某个实例后，其他实例状态不变；重复切换不产生重复行。
- [ ] 三语文案齐全，窄屏可用。

**周考 3 题**
1. 为什么「今天」要用本地日历日，而不能用 `new Date().toISOString().slice(0,10)`？
2. 重复备忘的「实例」由什么唯一确定？为什么不能用 `(memoId, 序号)`？
3. 如果重复规则在读取时展开，如何保证月视图性能？你会怎么优化？

---

### 第 8 周：质量门 + 第二模块（可选）

**本周目标**：补上真实浏览器 e2e、全量回归，并在时间允许时加一个最小模块证明「模式可复制」。
**本周交付**：3 条 e2e + 全量回归 + 一份 gap 清单；可选 Bookmarks 最小 CRUD。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D50** e2e 基座 | `playwright.config.ts`、`global-setup.ts`、`auth.ts` | 装 Playwright/Chromium；配置 `webServer`；写第一条「注册→登录→建行程」✅ 1 条 e2e 绿；失败有 trace/screenshot | e2e 为什么单 worker？`webServer` 如何复用已有服务？ |
| **D51** e2e 领域规则 | `trip-calendar.spec.ts` | 创建→API 投影出现→刷新→修改→删除；非法线路；MEMORY 不同步；role 定位 ✅ 3 条 e2e 绿；不依赖私有 class | 为什么 e2e 断言要相对化？硬编码计数为什么会 flake？ |
| **D52** 第二模块（可选） | `bookmarks` schema/service/controller | 模型 + CRUD + 用户隔离 + 测试；分类 `text[]`；URL 校验 ✅ API 闭环（落后则跳过） | 新模块如何复用既有模式而不复制？模块边界在哪？ |
| **D53** 第二模块 UI（可选） | `apps/bookmarks` | Remote + 列表/表单；错误/空态；组件测试 ✅ Host 可进入；CRUD 可用 | 为什么新模块是 Remote，而不是 Host 里的一个页面？ |
| **D54** 对象存储（可选） | `object-storage.service.ts`、memo images | MinIO compose；上传/下载；DB 只存元数据；magic bytes；测试 ✅ 上传可见；删除清理 | 为什么文件不进数据库？存储键如何设计？ |
| **D55** 全量回归 | `DELIVERY_CHECKLIST.md` | `pnpm verify` + `pnpm test:e2e`；三语/窄屏/刷新；契约快照；`git diff` ✅ 全绿；无调试输出/密钥 | 交付前检查清单为什么按变更类型分？ |
| **D56** 最小交付门 | 全部笔记 | 30 分钟白板架构；5 分钟 demo；列 gap；决定 W9–10 重点 ✅ 通过下方清单 | 如果明天要从零再来一次，你会按什么顺序做？ |

**最小交付门（必须全部打勾才进入 W9）**
- [ ] 新仓库能 `pnpm install && pnpm dev` 一键启动。
- [ ] 注册→登录→建行程→加交通段→API 投影出现→刷新仍在→删除→投影消失；Travel 详情徽标正确。
- [ ] 非法线路被后端拒绝；MEMORY 不同步。
- [ ] `pnpm verify` 全绿；至少 3 条 e2e 绿。
- [ ] 能不看代码讲清 Host/MF、Nest/DI、Prisma/迁移、Outbox/幂等四件事。

**周考 3 题**
1. e2e 和集成测试各抓什么类型的 bug？为什么不能互相替代？
2. 为什么新模块要做成 Remote，而不是在 Host 里加路由？
3. 如果只能保留 3 条 e2e，你保留哪 3 条？为什么？

---

### 第 9 周：部署

**本周目标**：把核心系统部署到一台真实服务器，公网可访问，有 HTTPS、备份和 CI。
**本周交付**：生产 compose + 反向代理 + 域名/证书 + CI + 恢复演练。

| Day / 主题 | 输入（30m） | 动手（75m）与验收 | 费曼输出（15m） |
|---|---|---|---|
| **D57** 生产构建 | 根 `build` 脚本、各 app 配置 | `pnpm build`；检查 dist；修构建错误；本地 preview ✅ 所有包 build 成功；静态产物可访问 | dev 与 prod 构建差异；为什么 MF 生产要改 remote URL？ |
| **D58** API 容器 | `services/api/package.json`、Docker 文档 | 多阶段 Dockerfile；prod compose（PG+API）；启动时 `migrate deploy`；健康检查 ✅ 容器 API 可访问；迁移成功 | 多阶段构建解决什么？启动时跑迁移有什么风险？ |
| **D59** 反向代理 | Host/Remote 构建产物 | Caddy/Nginx：`/`→Host，`/api`→API，Remote 静态路径；改 `REMOTE_URLS` ✅ 本地域名访问；所有 Remote 加载 | 同域部署为什么能简化 CORS 和 MF？ |
| **D60** HTTPS + 安全 | `.env.example`、`main.ts` CORS | 域名/证书；CORS；安全头；Swagger 保护/关闭；`JWT_SECRET`；如启用了验证码登录，通道改真实 SMTP/SMS（未启用则删掉相关配置）✅ HTTPS 绿锁；无密钥进 git | 密钥管理的最低要求；为什么 `AUTH_CODE_TRANSPORT=log` 不能上生产？ |
| **D61** CI | 根脚本 | GitHub Actions：install/typecheck/test/build；PG service；缓存；e2e 单独 job ✅ push 后 CI 绿 | CI 应该跑哪些门？为什么 e2e 单独 job？ |
| **D62** 备份/恢复 | 无 | `pg_dump` 定时；对象存储备份；恢复演练；日志 ✅ 恢复到新库成功 | 备份不演练等于没有备份；RPO/RTO 是什么？ |
| **D63** 部署复盘 | 检查单 | 公网走黄金链路；故障演练（API 挂/DB 挂）；写 runbook ✅ 公网可用；runbook 1 页 | 上线后最可能坏的三件事？ |

**本周门**
- [ ] 公网 URL 可打开，HTTPS 正常。
- [ ] 注册/登录/建行程/加交通段/API 投影出现/刷新仍在/删除可用；Travel 详情徽标正确。
- [ ] 数据库每日备份，且至少成功恢复一次。
- [ ] CI 在 push 后自动跑 typecheck/test/build。
- [ ] 仓库里没有 `.env`、密钥、日志、`dist`、`node_modules`。

**周考 3 题**
1. 生产环境为什么不能依赖 `localhost` 的 remote URL？
2. `prisma migrate deploy` 在启动时失败，应用应该启动还是退出？为什么？
3. 备份策略里，数据库和对象存储为什么都要备？

---

### 第 10 周：空白重建挑战

**本周目标**：不看现有源码，用 5 天从空目录重建核心切片，证明你是 L3 而不是「跟着教程跑通」。
**规则**：只允许看自己的笔记、官方文档、报错；不允许打开本仓库源码；每天结束 commit。

| Day / 主题 | 任务 | 验收 |
|---|---|---|
| **D64** 挑战 1：骨架 + DB + auth 骨架 | 建 workspace、shared、Prisma、Nest、User 模型、注册/登录骨架 | `pnpm dev` 可启动；表存在；注册/登录可用 |
| **D65** 挑战 2：Travel 后端 | Trip/Transport、validateRoute、CRUD、集成测试 | 非法线路 400 + 稳定 errorCode；合法 201；测试绿 |
| **D66** 挑战 3：Outbox + Calendar | 事务写事件、dispatcher、upsert、幂等测试 | 创建→1 条事件；重复投递→仍 1 条；MEMORY→0 条 |
| **D67** 挑战 4：Host + MF + Travel UI | Host、Remote、懒加载、表单、三语 | :3000 加载 :3001；创建→刷新仍在 |
| **D68** 挑战 5：测试 + 部署配置 | 3 条 e2e、Dockerfile、反代配置 | e2e 绿；本地容器可访问 |
| **D69** Gap 分析 + 修复 | 对照第 9 章评分表，找最低的 3 项，重做 | 最低 3 项各提升至少 1 档 |
| **D70** 终极答辩 + 下一步 | 20 问答辩；写 90 天计划 | 评分 ≥80/100；能讲清取舍 |

**挑战期间的时间盒**：每天前 10 分钟看自己的笔记列 3 个任务，中间 90 分钟实现，最后 20 分钟写「卡在哪、明天怎么绕」。**卡住 30 分钟才能查官方文档；仍然卡住就降级实现，不要抄源码。**

---

## 6. 从零构建 Playbook

> 这一章是「施工顺序 + 命令 + 验收」。不要按目录顺序写，按依赖顺序写。每个阶段结束都 commit。

### 6.0 新建目录与对照规则

```bash
mkdir chpli-rebuild && cd chpli-rebuild
git init
pnpm init
# 编辑 package.json：private: true、packageManager、scripts
pnpm add -D typescript prettier concurrently
mkdir -p apps services packages infra scripts e2e
```

根 `pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
  - "e2e"
```

如果 pnpm 11 报 `ERR_PNPM_IGNORED_BUILDS`，在 `pnpm-workspace.yaml` 加：

```yaml
allowBuilds:
  '@nestjs/core': true
  '@prisma/client': true
  '@prisma/engines': true
  esbuild: true
  prisma: true
```

**对照规则**：
1. 先写接口签名 + 失败测试，再写实现。
2. 卡 30 分钟才看参考；看的时候只找「模式」，不整文件复制。
3. 看完合上参考，自己重写；重写不出来就再读一遍，直到能写。
4. 用 `git diff` 对比自己的实现和参考，记录「为什么它这样设计」。

### 6.1 P0：基线（Day 1–7）

```bash
# 在现有仓库里
pnpm install
pnpm dev:db
pnpm -C services/api db:migrate
pnpm -C services/api db:seed
pnpm dev
# 打开 http://localhost:3000 和 http://localhost:4000/api/docs
# 先确认 DATABASE_URL 指向独立测试库或已备份，再跑 verify（见 2.6 数据安全）
pnpm verify
```

验收：黄金链路手动走通；`pnpm verify` 全绿；能画出架构图。若 e2e 也要跑：`npx playwright install chromium && pnpm test:e2e`（先停 dev，避免端口冲突）。

### 6.2 P1：Monorepo 骨架（Day 8–9）

- 根 `package.json` 脚本至少包含：`dev`、`build`、`test`、`typecheck`、`verify`。
- `tsconfig.base.json`：`strict: true`、`noUncheckedIndexedAccess: true`、`moduleResolution: "bundler"`。
- `packages/shared`：`"type": "module"`、`"main": "./src/index.ts"`、`"types": "./src/index.ts"`、`exports` 指向源码；不构建。
- `packages/ui` 同理；tokens 是普通 CSS，组件用 CSS Modules。
- 验收：`pnpm -r exec pwd` 列出所有包；`pnpm typecheck` 通过。

### 6.3 P2：数据层（Day 10–11）

```bash
# infra/docker-compose.yml 先只写 postgres
docker compose -f infra/docker-compose.yml up -d postgres
cd services/api
pnpm add @prisma/client
pnpm add -D prisma tsx
pnpm exec prisma init --datasource-provider postgresql
# 编辑 prisma/schema.prisma：先 Country、City、Location（User 在 P3 认证阶段加）
mkdir -p prisma/migrations/0001_init
# 手写 migration.sql：CREATE TABLE IF NOT EXISTS ...
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec tsx prisma/seed.ts
```

验收：

```bash
docker exec -it chpli2-postgres psql -U chpli2 -d chpli2 -c '\dt'
docker exec -it chpli2-postgres psql -U chpli2 -d chpli2 -c 'select * from "_prisma_migrations";'
```

**不要**用 `prisma migrate dev` 反复 reset 开发库；本环境已知它会挂起/要求 reset。手写 SQL + `migrate deploy` 是可靠路径。

### 6.4 P3：API 基座 + 认证（Day 12–21）

依赖：

```bash
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/jwt @nestjs/swagger \
  reflect-metadata rxjs class-validator class-transformer bcryptjs dotenv
pnpm add -D @nestjs/testing supertest @types/supertest vitest tsx typescript
```

顺序：
1. `main.ts`：`setGlobalPrefix('api')`、`ValidationPipe({whitelist, forbidNonWhitelisted, transform})`、全局异常过滤器、Swagger。
2. `PrismaService`：`onModuleInit` 连接；`enableShutdownHooks`。
3. `AuthModule`：register → `bcryptjs` 哈希 → login → JWT → me。
4. 全局 `AuthGuard` + `@Public()` + `@CurrentUser()`。
5. 测试基座：`Test.createTestingModule({imports:[AppModule]})` + Supertest + 真 DB + `resetDatabase()`。

验收：注册/登录/me；无 token 401；跨用户 404；错误响应 `{statusCode,message,errorCode}`。

### 6.5 P4：Travel 垂直切片（Day 22–28）

数据模型：`Country 1─N City 1─N Location`；`Trip 1─N Transport`；`OutboxEvent`（`CalendarEvent` 在 P6 加）。

路由（与现仓库一致）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/travel/countries` | 国家列表 |
| GET | `/api/travel/countries/:id/cities` | 城市列表 |
| GET | `/api/travel/cities/:id/locations` | 地点列表 |
| POST | `/api/travel/trips` | 创建行程 `{title,type}` |
| GET | `/api/travel/trips/:id` | 详情（含交通段） |
| POST | `/api/travel/trips/:id/transports` | 创建交通段 |
| PATCH | `/api/travel/transports/:id` | 修改 |
| DELETE | `/api/travel/transports/:id` | 删除 → 204 |

校验分层：DTO 形态错误 400；Travel 领域错误（同端点/跨级/跨城/时间倒序）也是 400，但带稳定 `errorCode`；Memo/Growth 等模块的领域错误用 422。`validateRoute` 放 shared，前后端共用；后端仍要再校验一次。复刻时保持「同模块内一致 + 错误码稳定」，不要为了统一数字改动既有契约。

### 6.6 P5：Host + MF + Travel UI（Day 29–35）

Host 配置要点：

```ts
pluginModuleFederation({
  name: 'host',
  remotes: { travel: 'travel@http://localhost:3001/remoteEntry.js' },
  shared: {
    react: { singleton: true, requiredVersion: '18.3.1', eager: true },
    'react/': { singleton: true, requiredVersion: '18.3.1', eager: true },
    'react-dom': { singleton: true, requiredVersion: '18.3.1', eager: true },
    'react-dom/': { singleton: true, requiredVersion: '18.3.1', eager: true },
  },
})
```

Remote 配置要点：

```ts
pluginModuleFederation({
  name: 'travel',
  filename: 'remoteEntry.js',
  exposes: { './App': './src/App.tsx' },
  shared: {
    react: { singleton: true, requiredVersion: '18.3.1' },
    'react/': { singleton: true, requiredVersion: '18.3.1' },
    'react-dom': { singleton: true, requiredVersion: '18.3.1' },
    'react-dom/': { singleton: true, requiredVersion: '18.3.1' },
  },
})
```

Host 要有最小登录/注册卡：token 存 localStorage，`/api/auth/me` 校验，401 时清 token 回登录。

Remote 的 `src/index.tsx` 只留：

```ts
import('./bootstrap');
```

`bootstrap.tsx` 里再做 `createRoot` 和 `import './i18n'`。这样独立运行和 Host 加载都不会在共享模块就绪前同步调用 `loadShareSync`。

### 6.7 P6：Outbox + Calendar 投影（Day 36–42）

核心代码形态（伪代码）：

```ts
// producer：业务行 + 事件行同一事务
const transport = await prisma.$transaction(async (tx) => {
  const created = await tx.transport.create({ data: { ... } });
  await tx.outboxEvent.create({
    data: {
      type: 'TransportPlanned',
      payload: JSON.stringify({ ...payload, syncKey: `travel:transport:${created.id}` }),
    },
  });
  return created;
});
```

```ts
// consumer：至少一次投递，按 syncKey 幂等
await prisma.calendarEvent.upsert({
  where: { syncKey: payload.syncKey },
  create: { ...payload, deletedAt: null },
  update: { ...payload, deletedAt: null },
});
```

规则：
- 只有 PLAN 且 `syncToCalendar=true` 才发 Planned/Updated；MEMORY 不发；关闭同步或删除时发 Deleted。
- dispatcher 轮询 `processedAt=null`，handler 成功后才标记；失败保留，下轮重试。
- 测试必须覆盖：创建、更新两次仍 1 条、删除软删、MEMORY 0 条、关闭同步清旧投影、重复投递 10 次仍 1 条。

### 6.8 P7：Memo 日历（Day 43–49）

- 新建 `apps/calendar` Remote（端口 3002，复制 Travel 的 Rsbuild/MF 配置），Host 加导航与懒加载。
- `date` 用 PostgreSQL `date` 或 UTC 午夜的 `DateTime`，全链路用 `YYYY-MM-DD` day key；**禁止 `toISOString().slice(0,10)` 表达「今天」**。
- 重复规则只在读取时展开：`expandMemoToRange(memo, fromKey, toKey)`，不预生成行。
- 非重复完成用 `completedAt`；重复完成用 `MemoCompletion(memoId,date)` 唯一约束；删除单个实例用 `excludedDates date[]`。
- 月视图周日起；视图偏好存 localStorage；三语文案齐全。

### 6.9 P8：测试与 e2e（Day 50–56）

每层最低配：
- shared：`validateRoute`、`expandMemoToRange`、日期/时区工具。
- API：每条路由至少 1 正常 + 1 异常 + 1 越权；outbox 至少 1 条幂等测试。
- 前端：表单提交禁用、非法校验提示、空态、错误态。
- e2e：注册→登录→建行程→加交通段→API 投影出现→刷新仍在→删除→投影消失；非法线路；MEMORY 不同步。

### 6.10 P9：部署（Day 57–63）

- `pnpm build` 产出 Host/Remote 静态资源；Host 的 `REMOTE_URLS` 必须从「写死 localhost」改成生产域名或同域相对路径。
- API 用多阶段 Dockerfile；启动前 `prisma migrate deploy`；失败则容器退出（不要带病启动）。
- 反向代理：`/` → Host，`/api` → API，Remote 静态资源按路径托管；同域最省事。
- 环境变量：`DATABASE_URL`、`JWT_SECRET`、`AUTH_CODE_TRANSPORT`、`S3_*`；密钥只放服务器/CI secret。
- 备份：`pg_dump` 每日 + 对象存储同步；每月至少恢复演练一次。
- 上线检查：Swagger 关闭或加保护、CORS 收敛、HTTPS、三语、404/错误页、日志。

---

## 7. 费曼概念卡（14 张）

> 用法：先自己填，再对照「源码锚点」验证。填不出来的地方就是下周要补的课。

### 卡 1｜为什么用 pnpm workspace？
- 12 岁版：一个仓库里放很多小盒子，盒子之间可以互相拿东西，不用复制。
- 专业版：workspace 协议把包软链到根 `node_modules`，`workspace:*` 保证本地版本；`pnpm -r` 统一跑脚本。
- 反例：拆成 10 个仓库 → 版本发布、联调、类型同步成本剧增。
- 源码锚点：`pnpm-workspace.yaml`、根 `package.json`。
- 自测：`pnpm -r --filter '!./e2e' test` 为什么要排除 e2e？

### 卡 2｜Module Federation 解决什么？
- 12 岁版：主机不把每个房间都建在自己家，而是运行时去邻居家把房间搬过来。
- 专业版：Host 在运行时加载 Remote 的 `remoteEntry.js`，共享 React 单例；Remote 可独立开发/部署。
- 反例：不做 singleton → 两个 React 实例 → hooks/context 崩溃。
- 源码锚点：`apps/host/rsbuild.config.ts`、`apps/travel/src/index.tsx`。
- 自测：为什么 Host 的 shared 要 eager，Remote 不能 eager？

### 卡 3｜NestJS 的 Module/Controller/Service/DI
- 12 岁版：Module 是部门，Controller 是前台，Service 是干活的，DI 是「你说需要谁，公司自动给你配」。
- 专业版：`@Module` 声明 providers/imports；构造器注入；`@Inject` 显式声明 token。
- 反例：esbuild 不发射 decorator metadata → 不写 `@Inject` 运行时 undefined。
- 源码锚点：`services/api/src/app.module.ts`、`services/api/src/auth/auth.guard.ts`。
- 自测：为什么本工程所有 provider 构造器都写 `@Inject(XxxService)`？

### 卡 4｜Prisma schema / migration / generate
- 12 岁版：schema 是图纸，migration 是施工记录，generate 是照图纸生成工具箱。
- 专业版：schema 描述模型；migration 是只向前的 SQL 版本；generate 生成类型安全 client。
- 反例：手改数据库 → 迁移历史与真实结构漂移 → 新环境建不起来。
- 源码锚点：`services/api/prisma/schema.prisma`、`migrations/`。
- 自测：`migrate deploy` 与 `migrate dev` 的区别？为什么本环境手写 SQL？

### 卡 5｜事务性 Outbox
- 12 岁版：把「要办的事」和「要寄的通知」写在同一张纸上，避免办完事忘了寄信。
- 专业版：业务行 + `OutboxEvent` 同事务；dispatcher 至少一次投递；消费者幂等。
- 反例：先写业务再发消息 → 消息失败 → 日历永远缺一条；先发消息再写业务 → 消息指向不存在的行。
- 源码锚点：`services/api/src/travel/travel.service.ts:106`、`services/api/src/shared/outbox-dispatcher.ts`。
- 自测：handler 成功但标记失败，下一轮会怎样？

### 卡 6｜幂等与 syncKey
- 12 岁版：同一封信上写同一个编号，收信人看到编号已登记就不再办第二次。
- 专业版：`syncKey` 全局唯一 + `upsert`；重复投递收敛为一行。
- 反例：用标题+时间做 key → 改标题就多一条；用自增 id 做 key → 每次新建。
- 源码锚点：`packages/shared/src/validation.ts` 的 `transportSyncKey`、`services/api/src/calendar/calendar-sync.service.ts`。
- 自测：为什么 key 用 transport id，而不是 trip id + 序号？

### 卡 7｜领域校验与 400/422
- 12 岁版：格式不对是「没填对」，业务不允许是「填对了但不能这么做」。
- 专业版：DTO 形态错误 400；领域规则用 400 或 422（本仓库 Travel 用 400，Memo 用 422）+ 稳定 errorCode，前端按错误码映射文案。
- 反例：只给状态码不给 errorCode → 前端无法区分「改输入」还是「改选择」；跨模块强行统一数字 → 破坏既有契约。
- 源码锚点：`packages/shared/src/validation.ts`、`packages/shared/src/errors.ts`、`services/api/src/shared/api-exception.filter.ts`。
- 自测：同端点、跨级、跨城分别对应哪个错误码？为什么 Travel 是 400 而 Memo 是 422？

### 卡 8｜JWT + 全局 Guard + 用户隔离
- 12 岁版：门票上写着你是谁；每个门都查票；你的柜子只有你能开。
- 专业版：JWT `sub` 作为 userId；全局 Guard 校验；业务查询强制带 userId；跨用户 404。
- 反例：只在登录接口校验 → 其他接口裸奔；只用前端过滤 → 越权。
- 源码锚点：`services/api/src/auth/auth.guard.ts`、`services/api/src/auth/current-user.decorator.ts`。
- 自测：为什么跨用户返回 404 而不是 403？

### 卡 9｜时刻 vs 纯日期
- 12 岁版：约会要写「几点几分」，生日只写「几月几号」。
- 专业版：时刻存 UTC instant；纯日期存 day key（无时区）；展示按本地时区格式化。
- 反例：`toISOString().slice(0,10)` 在东八区 00:00–08:00 会差一天。
- 源码锚点：`apps/calendar/src/dates.ts`、`packages/shared/src/memo.ts`。
- 自测：为什么「今天」不能用 UTC 截取？纯日期加减可以用 UTC 吗？

### 卡 10｜重复规则与实例身份
- 12 岁版：每周一开会，是「同一个会议」的很多次；完成的是「这一次」。
- 专业版：规则读取时展开；实例用 `(memoId, date)` 唯一；非重复用 `completedAt`。
- 反例：用 `completedAt` 表示重复完成 → 一次完成把所有未来实例都标完成；把「每季度」实现成每 3 个月同日 → 与领域语义不符。
- 源码锚点：`packages/shared/src/memo.ts:273`、`services/api/src/memo/memo.service.ts:291`。
- 自测：为什么 `excludedDates` 要参与展开？

### 卡 11｜对象存储与元数据
- 12 岁版：相册里放照片，抽屉里只放「照片在哪」的纸条。
- 专业版：文件体进 S3/MinIO；DB 存 owner、mime、size、storageKey；下载走鉴权。
- 反例：把 10MB 图片存 `bytea` → 备份/查询/迁移都变慢。
- 源码锚点：`services/api/src/shared/object-storage.service.ts`、`services/api/src/memo/images.service.ts`。
- 自测：删除记录时，对象什么时候删？失败了怎么办？

### 卡 12｜测试金字塔与 e2e 定位
- 12 岁版：小零件单独测，整机再试跑，最后真人开一圈。
- 专业版：单测快而多；集成测真实 DB/API；e2e 少而慢，测用户旅程。
- 反例：只写 e2e → 慢且脆；只写单测 → 集成问题漏网。
- 源码锚点：`services/api/test/`、`e2e/trip-calendar.spec.ts`。
- 自测：为什么 e2e 用 role/文本定位，不用 CSS class？

### 卡 13｜并发写与串行队列
- 12 岁版：两个人同时改同一张纸，后写的会把先写的擦掉。
- 专业版：乐观锁版本号；409 冲突；同一资源的写操作串行化。
- 反例：防抖自动保存与发布按钮并发 → 同版本 409 → 静默失败。
- 源码锚点：`apps/notes` 的保存队列（对应本仓库 N3 修复）。
- 自测：队列内部为什么不能再入队同一个队列？

### 卡 14｜生产部署与密钥
- 12 岁版：把家里的水电总闸装好，钥匙只给家里人。
- 专业版：同域反代、HTTPS、环境变量、最小权限、备份恢复、CI 门禁。
- 反例：`JWT_SECRET` 写进代码、`AUTH_CODE_TRANSPORT=log` 上生产、Swagger 公开。
- 源码锚点：`services/api/src/env.ts`、`.env.example`。
- 自测：启动时迁移失败，应用应该退出还是继续？为什么？

---

## 8. 真实陷阱地图

> 每条都来自本仓库的真实事故（详见 `Developer-Tutorial.md` 第 11 章、`.kimi-code/agents/chpli-harness.md`）。按「你会在哪一天遇到」排序。

| # | 陷阱 | 现象 | 正确做法 | 遇到日 |
|---:|---|---|---|---|
| 1 | pnpm 11 忽略构建脚本 | `ERR_PNPM_IGNORED_BUILDS`，Prisma/esbuild 没编译 | `pnpm-workspace.yaml` 配 `allowBuilds` | D8/D10 |
| 2 | MF RUNTIME-006 | Host 白屏，`loadShareSync` 报错 | Host shared `eager`；Remote 入口异步；共享 `react/`、`react-dom/` 子路径 | D30 |
| 3 | Remote 未 import i18n | Host 里显示 `trip.listTitle` 原始 key | 暴露的 `App.tsx` 自己 `import './i18n'` | D30/D34 |
| 4 | esbuild 不发射 decorator metadata | DI 拿到 undefined；测试却全绿 | 构造器显式 `@Inject`；请求体用 `@ValidatedBody(Dto)` | D12/D17 |
| 5 | `prisma migrate dev` 挂起 | 无 TTY 一直等输入 | 手写 `migration.sql` + `migrate deploy` + `generate` | D11 |
| 6 | reset 开发库 | 用户数据丢失 | 永不 reset；测试用独立库/可重复清理 | D13 |
| 7 | 端口被占 | 启动失败或 Remote URL 错 | `predev` 清端口 + `strictPort: true` | D29 |
| 8 | e2e 与集成测试并行 | 同一 PG 被清空，e2e 随机失败 | 跑 e2e 时不跑 API 测试；CI 分 job | D50 |
| 9 | e2e 把 tab 当 button | `getByRole('button', {name:'Week'})` 超时 | 视图切换用 `getByRole('tab')` | D51 |
| 10 | `getByRole` 子串匹配 | 命中多个元素 | 导航断言加 `exact: true` | D51 |
| 11 | UTC 截取当「今天」 | 东八区早上差一天 | `dayKey(new Date())` 本地年月日拼装 | D43–D48 |
| 12 | 400/422 混用 | 前端无法区分错误类型 | DTO 400；领域错误按模块约定（Travel 400、Memo 422）；稳定 errorCode | D18/D25 |
| 13 | OpenAPI 快照漂移 | 契约测试逐字节失败 | 删快照重跑生成；diff 只含本次变更 | D20 |
| 14 | 自动保存与发布并发 | 409、保存静默失败 | 同一资源写操作串行队列；队列内不再入队 | 扩展 Notes 时 |
| 15 | 只测「编辑旧数据」 | 新建的重复备忘在所有视图不可见 | 验收必须含「创建后立即可见」 | D46 |
| 16 | 硬编码日期/计数 | e2e 随时区/星期 flake | 相对断言：先取基线，再断言变化量 | D51 |
| 17 | 密钥/日志入库 | 凭证泄露 | `.env` 只本地；`.gitignore`；CI secret | D60 |
| 18 | `.next` 红线 | 违反工程约束 | 不用 Next.js；本项目用 Rsbuild | 始终 |
| 19 | MinIO 镜像拉取超时 | `docker pull` 卡住 | 用 `bitnamilegacy/minio` 或镜像加速；显式建 bucket | D54 |

---

## 9. 自测、答辩与空白重建评分

### 9.1 最终答辩 20 问

**架构（5）**
1. 为什么 Host/Remote 用 Module Federation，而不是一个单体 React 应用？
2. 为什么后端先做模块化单体，而不是微服务？
3. Travel 与 Calendar 的边界在哪？哪些事只能通过事件做？
4. 如果明天要加 Notes 模块，需要改哪些地方？哪些地方不该改？
5. 共享 `packages/shared` 的代价是什么？什么时候不该放进去？

**数据（5）**
6. 为什么 Plan 与 Memory 不由时间自动转换？
7. 为什么线路只允许同级？跨城地点连线会破坏什么？
8. 为什么 Transport 要分计划/实际四列时间？
9. 为什么 Memo 是纯日期，而 CalendarEvent 是时刻？
10. 迁移为什么只向前？如何安全地加一列/改列宽？

**后端与可靠性（5）**
11. Outbox 如何保证「业务成功、事件不丢」？它不能保证什么？
12. 至少一次投递下，消费者必须满足什么？举一个本项目的例子。
13. 如果 dispatcher 挂了 10 分钟，恢复后会发生什么？
14. 用户隔离做在哪几层？为什么不能只靠前端？
15. 本仓库 Travel 用 400、Memo 用 422，为什么不统一？稳定 errorCode 比状态码更重要吗？

**前端与测试（3）**
16. 为什么 Host 的 React 要 singleton + eager？Remote 为什么相反？
17. 组件测试和 e2e 各测什么？为什么 e2e 不能用私有 class 定位？
18. 自动保存遇到 409 怎么处理？为什么要串行队列？

**部署（2）**
19. 生产环境为什么不能写死 `localhost` 的 remote URL？同域部署怎么解决？
20. 备份、恢复、迁移失败、密钥管理，各有一条最低要求，你会怎么写？

### 9.2 空白重建评分表（100 分）

| 项目 | 分值 | 评分标准 |
|---|---:|---|
| 环境与骨架 | 10 | 空目录能 `pnpm install`、`dev`、`typecheck` |
| 数据库与迁移 | 15 | 模型/关系/唯一约束正确；迁移可重复；seed 幂等 |
| 认证与隔离 | 15 | 注册/登录/me；Guard；跨用户 404；密码哈希 |
| Travel 与校验 | 15 | 行程创建/详情 + 交通段 CRUD；三类非法线路；时间校验；错误码 |
| Outbox 与幂等 | 20 | 同事务写入；dispatcher；upsert；重复 10 次 1 行；MEMORY 0 条 |
| Host/MF/UI | 10 | 两个应用；懒加载；三语；刷新持久；错误边界 |
| 测试 | 10 | 单测/集成/组件/e2e 各至少 1 条真实断言 |
| 部署 | 5 | 构建、容器、反代、HTTPS、备份至少跑通 |
| **合计** | **100** | **≥80 为 L3 通过；≥90 为优秀** |

### 9.3 周考怎么用

每周日 15 分钟：合上资料，口头回答本周 3 题；答不出的写进下周一的 10 分钟复习。不要用「看过」代替「讲过」。

---

## 10. 进度管理、命令与资源

### 10.1 每日日志（5 行）

```markdown
## Day N｜日期｜主题
- 今天跑通/交付：
- 今天讲清的 1 个概念：
- 卡壳点（具体到文件/命令/报错）：
- 明天第一件事：
- 测试/命令结果：
```

### 10.2 每周复盘（周日晚 20 分钟）

```markdown
## Week N 复盘
- 本周交付（可演示）：
- 本周门：通过 / 未通过（差哪一项）：
- 能讲清的 3 个概念：
- 仍卡壳的 2 个概念：
- 测试结果：pnpm verify / e2e
- 下周调整：砍掉什么、补什么
```

### 10.3 落后/超前怎么调

| 情况 | 调整 |
|---|---|
| 落后 1–2 天 | 砍当天「可选扩展」，保验收；周末不补课，顺延 |
| 落后 1 周 | 跳过 W8 第二模块和对象存储；W7 的周/日视图降为 Should（保月视图 + 重复 + 实例完成）；W9 部署压缩到 3 天 |
| 落后 2 周 | 三语/图片/提醒降为 Could；保认证、Travel、Outbox、Memo 核心、e2e、部署 |
| 超前 1 周 | 提前做 W10 挑战，或加 Notes/Bookmarks 最小模块 |
| 连续 3 天卡同一处 | 停下来写「最小复现」；查官方文档/问 AI；仍不行就降级实现并记录 |

**永远不要砍**：用户隔离、Outbox 幂等、黄金链路 e2e、部署与备份。

### 10.4 命令速查

```bash
# 安装与启动
pnpm install
pnpm dev:db                 # PostgreSQL + MinIO
pnpm -C services/api db:migrate
pnpm -C services/api db:seed
pnpm dev                    # API + 7 个前端

# 质量门
pnpm typecheck
pnpm verify                 # typecheck + 全部非 e2e 测试（串行）
pnpm test:e2e               # Playwright；与 dev 端口互斥

# 单包
pnpm -C packages/shared test
pnpm -C services/api test:integration
pnpm -C apps/travel test

# 数据库
docker exec -it chpli2-postgres psql -U chpli2 -d chpli2
docker exec -it chpli2-postgres psql -U chpli2 -d chpli2 -c '\dt'
pnpm -C services/api exec prisma studio   # 可选，图形化看数据

# 端口清理（macOS/Linux）
lsof -ti:3000,3001,3002,3003,3004,3005,3006,4000 | xargs kill
```

### 10.5 环境变量（本地）

| 变量 | 用途 | 本地默认 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接 | `postgresql://chpli2:chpli2@localhost:5432/chpli2?schema=public` |
| `API_PORT` | API 端口 | `4000` |
| `JWT_SECRET` | JWT 签名 | 开发有 fallback；生产必须设置 |
| `AUTH_CODE_TRANSPORT` | 验证码投递 | `log`（仅开发/e2e） |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | 对象存储 | 对应 MinIO compose |
| `LIFE_ASSIST_*` | LifeFolder 对话协助（可选） | 不设置则 503 降级 |

### 10.6 学习资源

| 主题 | 资源 |
|---|---|
| TypeScript | 官方 Handbook；重点：strict、泛型、类型收窄 |
| React | react.dev 官方教程；重点：状态提升、受控组件、Effect |
| NestJS | 官方 Overview：Modules / Controllers / Providers / Guards / Pipes |
| Prisma | Getting Started + Migrate + Transactions |
| PostgreSQL | 官方教程：索引、事务、唯一约束、`date` vs `timestamptz` |
| Module Federation | module-federation.io 官方文档；重点：shared/eager/singleton |
| Rsbuild | 官方配置文档；重点：`server.proxy`、`source.define`、`strictPort` |
| Playwright | Writing Tests；重点：role 定位、webServer、trace |
| Docker | Get Started；重点：多阶段构建、compose、卷 |
| 工程思想 | 《重构》《领域驱动设计》精简版；本仓库 `PROJECT_INSTRUCTIONS.md` + `AGENTS.md` |

### 10.7 结束之后

- 用 2 周给系统加一个**真实的新需求**（从数据模型到上线），这是 L4 的证明。
- 把 CHPLI 真正用 30 天，记录 10 个真实痛点，再决定下一轮迭代。
- 回本仓库修一个 bug 或补一组测试；读 `DELIVERY_CHECKLIST.md`，按真实交付标准走一遍。
- 如果你能独立完成 Day 64–68 的挑战，并且答辩 ≥80 分，你已经具备「从 0 到 1 独立 build」的能力，剩下的是经验与判断力。

---

*本计划基于 2026-11-26 的仓库状态编写。模块结构、命令或架构决策变化时，同步更新本文档。*
