# CHPLI

**A Personal System for Life and Growth**

> Be confident. Be honest. Be polite. Keep learning. Keep iterating.

CHPLI is an extensible personal management system for organizing everyday life, preserving meaningful experiences, and supporting long-term growth. It brings calendars, travel plans and memories, bookmarks, connected notes, career roadmaps, and personal document management into one modular workspace.

CHPLI 不仅存储信息，也帮助用户理解经历、做出有意识的选择，并持续迭代自己。

## 产品价值观

- **Confidence**：保持自信。
- **Honesty**：坦诚面对自己和他人。
- **Politeness**：尊重他人与边界。
- **Learning**：持续学习。
- **Iteration**：持续回顾、调整和更新。

## 模块范围

| 模块 | 核心方向 |
| --- | --- |
| Calendar（日历备忘录） | Memo 备忘（纯日期、优先级、重复规则、按实例完成）、月/周/日视图；旧 Event 日程能力随 Memo 化逐步退役 |
| Travel | 旅行计划与回忆、交通住宿、二维地图与线路 |
| Bookmarks | 分类书签、点击统计、卡片与列表、不活跃降级 |
| Notes | Markdown、附件、双链、反链、搜索与版本历史 |
| Growth & Career | 成长路径、职业规划、里程碑、实践证据与回顾 |
| Life Folder | 人生文件夹模板、分类推荐、文件元数据与到期提醒 |
| Daily Records | 身体指标、锻炼、饮食、影音阅读和日常支出记录 |

## 工程基线

- 前端：React、TypeScript、Module Federation。
- 后端：先采用模块化单体，不过早拆分微服务。
- 数据：统一数据库，按模块明确数据所有权；文件进入对象存储。
- 协作：跨模块使用稳定 API 和领域事件，同步必须幂等且可追溯。
- 国际化：至少支持中文、英文、德文；语言、日期格式与时区独立处理。

## 当前状态

Iteration 1 已完成：Travel 与 Calendar 最小闭环端到端可用。

- **后端** `services/api`（NestJS 模块化单体 + Prisma/PostgreSQL）：Travel 模块（行程、交通段、国家/城市/地点）与 Calendar 模块（事件）通过 outbox 领域事件协作，按 `sync_key` 幂等同步；42 个单元/集成/契约测试通过。
- **前端** `apps/host` + `apps/travel` + `apps/calendar`（React + TypeScript + Rsbuild Module Federation），中/英/德三语；13 个组件测试通过。
- **E2E** `e2e/`（Playwright）：创建 PLAN 行程→交通段→日历同步（幂等）→修改→刷新持久化→确认删除，及 MEMORY 不同步、非法线路拦截、语言切换，共 4 个用例。

本地运行（数据库使用 Docker，首次自动初始化）：

```bash
pnpm install
pnpm dev:db             # 启动 PostgreSQL 容器（chpli2-postgres，端口 5432）
pnpm -C services/api db:migrate && pnpm -C services/api db:seed   # 仅需首次
pnpm dev                # 一键启动 API :4000 + Host :3000 + Travel :3001 + Calendar :3002
```

浏览器打开 http://localhost:3000 即可体验完整闭环。其他命令：

```bash
pnpm test               # 单元/集成/契约（需数据库运行）
pnpm test:e2e           # 端到端（自动拉起 4 个服务）
pnpm build && pnpm typecheck
```

## 迭代约定

1. 每轮先明确用户价值、范围、异常情况和验收标准。
2. 每次完成真实可用的端到端流程，不交付空入口或无效按钮。
3. 重要数据操作必须具备持久化、失败反馈和防重复提交能力。
4. 数据库变更不得破坏已有数据。
5. 每轮同步考虑单元、集成、契约和端到端测试。

详细约束见 `PROJECT_INSTRUCTIONS.md`，实施顺序见 `ROADMAP.md`。
新手入门与 8 周学习计划见 [`Developer-Tutorial.md`](Developer-Tutorial.md)（模块/架构/路由详解 + 从零到部署的路线图）。

## Kimi Code Harness Agent

仓库提供项目级 `chpli-harness` Agent，并通过根目录 `AGENTS.md` 注入持续生效的工程约束。Agent 定义位于 `.kimi-code/agents/chpli-harness.md`，保留 Kimi Code 默认提示词和工具能力。

在仓库根目录启动新会话：

```bash
kimi --agent chpli-harness
```

该配置遵循 [Kimi Code 自定义 Agent 规范](https://github.com/MoonshotAI/kimi-code/blob/main/docs/zh/customization/agents.md)。本地 Kimi 配置、凭证和会话数据不应提交到仓库。
