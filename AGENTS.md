# CHPLI Workspace Instructions

开始修改前阅读 `PROJECT_INSTRUCTIONS.md` 和 `ROADMAP.md`，并检查当前 Git 状态。不得覆盖或提交与本任务无关的用户变更。

## 核心规则

- 按垂直切片交付真实可用的端到端功能，不添加空模块、无效按钮或伪造的持久化。
- Plan 与 Memory 可同时存在；时间流逝不自动改变数据身份。
- 分别保存计划和实际时间，允许补录过去的计划。
- 旅行地图只允许同级连接，城内线路两端必须属于同一城市。
- 跨模块通过明确 API 和领域事件协作，同步须幂等、可追溯、可恢复。
- 用户数据默认私有，重要或破坏性操作必须经用户确认。

## 工程规则

- 保持 Host、Remote 与后端模块边界，不跨模块直接修改数据表。
- 工程目录中不得出现 `.next`；若某工具会产生该目录（如 Next.js），改用其他工具。
- 文件进入对象存储，数据库只保存元数据和存储键。
- 新功能同步考虑中英德、时区、异常状态和数据迁移。
- 优先小范围修改并复用现有模式，不进行与任务无关的重构或格式化。
- **组件与布局优先使用 `@chpli2/ui`**：Button/Input/Select/Modal/Tabs/Field/TagInput/FilterRow/Workspace/SidePanel/ResizeHandle/Alert/Loading/Tooltip/OverflowTooltip 等已有能力不得在各 app 重复实现；库能力不足时先补库（含测试），再迁移调用方。
- 业务复合组件（MemoChip、GoalCard、TripCard 等）留在 app；当第二个 app 需要同一模式时，再抽象进 `@chpli2/ui`。
- 新增/修改 UI 组件必须提供 `tsx + module.css + test`，使用 tokens、CSS Modules、内置无障碍语义，不硬编码颜色/文案；迁移按垂直切片逐步进行，不做一次性大重写。
- 每次基于 Clean Code 原则的优化必须追加到 `how-to-write-clean-code.md` 的优化台账，写明问题、改动、验证和对应原则。
- 密钥、会话记录、日志和本地环境文件不得提交。

## 文档规范

- 后续新增的 md 文档（任务书、设计/决策记录、经验总结等）一律放入 `.kimi-code/agents/docs/`，不要散落在仓库根目录。
- 仓库根只保留长期入口文档：`AGENTS.md`、`PROJECT_INSTRUCTIONS.md`、`ROADMAP.md`、`Developer-Tutorial.md`、`DELIVERY_CHECKLIST.md`、`README.md`、`How-to-create-chpli.md`、`how-to-write-clean-code.md`。
- 文档内容与代码行为保持一致；发现过期描述随交付一并修正。

## 验证与交付

- 根据变更运行适当的单元、集成、契约和端到端测试。
- UI 变更需验证真实交互；数据库变更需验证迁移与兼容性。
- 交付前检查 diff 和工作区状态，只报告实际执行过的验证。
- 未经用户明确要求，不自动提交、推送或发布。
