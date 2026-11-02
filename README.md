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
| Calendar | 日程、分类、重复规则、提醒与禁止事项 |
| Travel | 旅行计划与回忆、交通住宿、二维地图与线路 |
| Bookmarks | 分类书签、点击统计、卡片与列表、不活跃降级 |
| Notes | Markdown、附件、双链、反链、搜索与版本历史 |
| Growth & Career | 成长路径、职业规划、里程碑、实践证据与回顾 |
| Life Folder | 人生文件模板、分类推荐、文件元数据与到期提醒 |
| Daily Records | 身体指标、锻炼、饮食、影音阅读和日常支出记录 |

## 工程基线

- 前端：React、TypeScript、Module Federation。
- 后端：先采用模块化单体，不过早拆分微服务。
- 数据：统一数据库，按模块明确数据所有权；文件进入对象存储。
- 协作：跨模块使用稳定 API 和领域事件，同步必须幂等且可追溯。
- 国际化：至少支持中文、英文、德文；语言、日期格式与时区独立处理。

## 当前状态

仓库已初始化，尚未生成业务模块占位实现。下一轮从可验证的垂直切片开始，优先确定 Travel 与 Calendar 的契约、数据模型和最小端到端流程。

## 迭代约定

1. 每轮先明确用户价值、范围、异常情况和验收标准。
2. 每次完成真实可用的端到端流程，不交付空入口或无效按钮。
3. 重要数据操作必须具备持久化、失败反馈和防重复提交能力。
4. 数据库变更不得破坏已有数据。
5. 每轮同步考虑单元、集成、契约和端到端测试。

详细约束见 `PROJECT_INSTRUCTIONS.md`，实施顺序见 `ROADMAP.md`。

## Kimi Code Harness Agent

仓库提供项目级 `chpli-harness` Agent，并通过根目录 `AGENTS.md` 注入持续生效的工程约束。Agent 定义位于 `.kimi-code/agents/chpli-harness.md`，保留 Kimi Code 默认提示词和工具能力。

在仓库根目录启动新会话：

```bash
kimi --agent chpli-harness
```

该配置遵循 [Kimi Code 自定义 Agent 规范](https://github.com/MoonshotAI/kimi-code/blob/main/docs/zh/customization/agents.md)。本地 Kimi 配置、凭证和会话数据不应提交到仓库。
