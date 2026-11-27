# CHPLI Workspace Instructions

开始修改前阅读 `PROJECT_INSTRUCTIONS.md` 和 `ROADMAP.md`，检查 Git 状态；不得覆盖或提交与本任务无关的用户变更。

## 当前冻结范围（2026-11-27 起）

- **只允许修改 Memo（Calendar）与 Notes**，以及它们直接依赖的 `packages/ui`、`packages/shared` 和对应测试。
- **Host、Travel、Bookmarks、Growth、LifeFolder 冻结**。未经用户明确指令“解冻某个 app”，不得修改这些目录、样式或导航。
- 跨 app 共享组件变更必须保持既有调用方行为兼容，并运行受影响 app 的测试；不能以“统一”为名批量改冻结 app。
- 解冻按单个 app 进行，完成一个再解冻下一个；解冻指令需写入本轮交付说明。

## 10 条强制规则

1. **垂直切片**：每次交付真实可用的端到端功能，不添加空模块、无效按钮或伪造持久化。
2. **领域不变量**：Plan/Memory 不互斥且不随时间自动转换；计划/实际时间分开保存；线路只允许同级；用户数据默认私有，重要操作必须确认。
3. **模块边界**：Host/Remote/后端模块边界清晰；跨模块只通过 API 或领域事件协作，不直接改对方数据表；文件进对象存储，数据库只存元数据；不得产生 `.next`。
4. **UI 复用**：优先使用 `@chpli2/ui` 已有能力（清单见 `packages/ui/README.md`）；缺能力先在库中补 `tsx + module.css + test`，再迁移调用方；业务复合卡片留在 app；组件不得内置 API/固定文案；app 样式用 CSS Modules 或根作用域前缀，不新增 `.loading`/`.field` 这类通用全局类。
5. **Clean Code**：命名表达意图；受控、纯展示、无副作用；超过 **250 行**、JSX 嵌套 **>3 层**或同一状态/事件逻辑出现 **2 次**时评估拆分；例外写入 Clean Code 台账。纯格式化/改名不计入台账。
6. **时间、i18n、迁移**：时刻、纯日期 day key、展示时区三者分开；至少中/英/德；数据库变更必须手写迁移、兼容既有数据，不 reset 开发库。
7. **验证**：三包以上受影响用 `pnpm verify:test`（独立 `chpli2_test`）；只动单包至少该包 typecheck + 测试；e2e 用 `pnpm test:e2e:test`；未运行不得声称通过。
8. **测试选择器**：e2e 优先 role/label/text/testid；禁止新增私有 CSS class 定位；旧选择器由 `e2e/legacy-class-selectors.json` 守护，只能单向减少（截止 2027-01-31）。
9. **文档与台账**：完成切片同步 `ROADMAP.md`；Clean Code 结构性优化按“一个切片/PR 一条”登记到 `how-to-write-clean-code.md`；长期说明（README/Tutorial）不写死测试数量，以命令输出为准；ROADMAP 历史条目可保留当次输出。
10. **安全**：密钥、会话、日志、本地环境文件不得提交；未经用户明确要求，不自动 commit/push/publish，不执行破坏性操作。

## 单一事实源

| 文件 | 只负责 |
|---|---|
| `AGENTS.md`（本文件） | 10 条强制规则与冻结范围 |
| `.kimi-code/agents/chpli-harness.md` | 工作流、已知陷阱、完成步骤 |
| `DELIVERY_CHECKLIST.md` | 按变更类型的最小验证矩阵 |
| `how-to-write-clean-code.md` | Clean Code 细则与优化台账 |
| `packages/ui/README.md` | 组件 API、边界、使用方式 |
| `e2e/SELECTOR_CONVENTIONS.md` | e2e 选择器规范与迁移规则 |

不要在上表多个文件中重复同一条规则；需要修改规则时只改负责文件，其他文件只链接。

## 文档规范

- 长期入口文档保留在仓库根：`AGENTS.md`、`PROJECT_INSTRUCTIONS.md`、`ROADMAP.md`、`Developer-Tutorial.md`、`DELIVERY_CHECKLIST.md`、`README.md`、`How-to-create-chpli.md`、`how-to-write-clean-code.md`。
- 任务书、决策记录、长篇经验总结放入 `.kimi-code/agents/docs/`；根目录不放新的散落文档。
- 文档内容与代码行为一致；发现过期描述随本次交付修正。
