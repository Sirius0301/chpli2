# CHPLI 笔记（Notes N1）切片任务书

> 范围：笔记 CRUD + Markdown 安全渲染 + 标签 + 优先级 + 自动保存 + 两级筛选（标签 AND / 优先级 OR）。
> 不在本切片（Notes 模块后续切片）：双链/反链（`[[id]]`）、版本历史、附件（复用 M3 图片模式）、全文搜索、笔记间关联展示。
> 依据：PROJECT_INSTRUCTIONS「Notes：Markdown、附件、自动保存、搜索、双链、反链和版本历史」；ROADMAP M2' 首个模块；Memo M1–M2 成熟模式（明确复用点见 D5）。
> 前置：M0–M5 已交付（2026-11-12）。

---

## 一、切片目标

用户登录后从 Host 导航进入笔记模块：左侧笔记列表（按更新时间倒序、标签/优先级两级筛选），右侧编辑器（标题 + Markdown 正文 + 实时预览切换 + 标签 + 优先级），自动保存（防抖 + 手动保存），三语文案。数据按用户完全隔离。

## 二、数据模型

### 2.1 notes（迁移 `notes_n1`，仅新建表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 客户端生成，幂等创建锚点（复用 E11/E47） |
| user_id | uuid FK → users | 用户隔离（M0） |
| title | varchar(256) | 必填非空 |
| body | text | Markdown 正文，≤100KB |
| priority | varchar(8) | none / low / medium / high（复用 Memo 枚举） |
| tags | text[] | ≤10 个，每个 ≤32 字符（复用 Memo 约束） |
| created_at / updated_at / deleted_at | timestamp | 软删除；列表按 updated_at 倒序 |

预留决策（D6）：双链从 body 文本解析 `[[note-id]]`，本切片不加列、不建链接表；版本历史后续独立迁移建表。

## 三、接口契约（模块内 API）

- `GET /api/notes?tags=&priorities=`：当前用户笔记（未删除），updatedAt 倒序；`tags` AND / `priorities` OR（复用 M2 语义，两维 AND）。
- `GET /api/notes/tags` → `{tag, count}[]`（聚合，count 降序，不受筛选影响；复用 M2 D5）。
- `POST /api/notes` → 201（body：`{id, title, body?, priority?, tags?}`；幂等：同 id 重复提交返回原记录）。
- `GET /api/notes/{id}` / `PATCH /api/notes/{id}`（`updatedAt` 乐观锁，409）/ `DELETE /api/notes/{id}`（204，软删除）。
- NoteDto：`{ id, title, body, priority, tags, createdAt, updatedAt }`。
- 校验分层（沿用仓库约定）：DTO 形态错误 400，领域校验 422（空标题、非法标签等）；跨用户一律 404。
- `@chpli2/shared` 新增 `notes.ts`：NotePriority/NoteDto/CreateNoteDto/UpdateNoteDto + `NOTE_BODY_MAX_BYTES = 100_000`、标签约束直接复用 Memo 常量。

## 四、核心决策

记录（2026-11-12）：

- **D1 切片范围**：如上「范围」节；搜索/双链/版本/附件明确后置。
- **D2 新 Remote**：新建 `apps/notes`（Module Federation remote，name `notes`，端口 3003，模板克隆 travel/calendar 既有结构）；Host 负责导航/认证/多语言（工程约束），remote 复用 `authFetchHeaders` 与 401 广播（M0 模式）。
- **D3 Markdown 渲染**：`react-markdown`（MIT）+ 默认配置——**默认不渲染原始 HTML**（micromark 转义），不引入 rehype-raw，从根上规避 XSS；代码块不高亮（后续切片可选）。
- **D4 自动保存**：正文/标题变更防抖 1.5s 自动 PATCH；`Ctrl/Cmd+S` 立即保存；保存状态指示（保存中/已保存/冲突 409 提示刷新）；乐观锁沿用 Memo E49 模式。
- **D5 Memo 复用点**（成熟模式直接沿用，不重新设计）：标签 `text[]` 存储与校验、`MEMO_PRIORITIES` 枚举、客户端 id 幂等创建、跨用户 404、400/422 分层、`tagCounts` 聚合端点、两级筛选语义、localStorage 偏好持久化、错误码文案模式。
- **D6 预留而非实现**：双链解析（`[[id]]`）与版本历史不加列不建表，由各自切片迁移引入；笔记正文中出现 `[[...]]` 本切片按普通文本渲染。
- **D7 列表排序与窗口**：全量返回当前用户笔记（个人系统量级，不分页）；updatedAt 倒序；无日历/时区语义（`updatedAt` 为服务端时间戳，前端按 locale 格式化展示）。
- **D8 异常与迁移**：迁移仅新建 notes 表，不动既有表；中英德三语文案同步新增；无时刻/时区输入。

## 五、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E77 | 空标题 / body 超 100KB / 非法标签（空、超长、超个数） | 400（DTO 层）/ 422（服务层），前端表单即时校验 |
| E78 | 并发编辑同一笔记 | 409 `CONCURRENT_MODIFICATION`，编辑器提示刷新 |
| E79 | 重复提交创建（双击/重试） | 幂等返回原记录（同 Memo E47） |
| E80 | 访问他人笔记 | 404（M0 D5），聚合端点不含他人标签 |
| E81 | 自动保存途中网络失败 | 状态指示「保存失败」+ 重试按钮，内容不丢（本地保留） |
| E82 | Markdown 中含 HTML/脚本 | 按文本转义渲染（D3），不执行 |

## 六、前端交互

- 布局：左列表栏（搜索留占位后续切片——本切片不放无效输入框；列表项=标题+更新时间+优先级色点+标签数）、右编辑区。
- 筛选栏（复用 Memo Sidebar 模式）：标签复选（AND，带 count）+ 优先级复选（OR）+ 清除。
- 编辑器：标题输入、正文 textarea（等宽字体）、「预览」开关（react-markdown 渲染）、标签 chip 编辑器（复用 Memo DetailPanel 交互）、优先级下拉、删除（二次确认）。
- 自动保存状态条 + `Cmd/Ctrl+S`；新建笔记按钮。
- 三语文案（zh-CN/en/de）；语言切换沿用 `chpli2-language-changed` 事件。

## 七、验收标准

- A70 新建→编辑正文→自动保存→刷新后内容完整（A19 回归）
- A71 Markdown 预览正确渲染标题/列表/链接；HTML 输入被转义不执行（E82）
- A72 标签/优先级两级筛选语义正确（AND/OR）；聚合候选不受筛选影响
- A73 并发编辑 409 提示；重复创建幂等（E78/E79）
- A74 跨用户隔离：B 无法看到/打开/修改 A 的笔记（E80）
- A75 自动保存失败可重试且不丢内容（E81）
- A17/A19 回归通过（三语、持久化）

## 八、测试覆盖要求

- **单元测试**：shared 无新逻辑（校验在后端/前端复用）；后端标签/标题校验辅助。
- **集成测试**：CRUD（E77/E79/E80）、乐观锁（E78）、筛选与聚合（A72）、排序。
- **契约测试**：OpenAPI 新增 /api/notes 路由与 NoteDto；快照更新。
- **组件测试**：列表/编辑器渲染、自动保存防抖（fake timers）、预览切换、筛选联动。
- **端到端测试**：关键路径（A70–A74 抽查）+ Host 导航进入 notes remote；既有 e2e 回归。

## 九、假设（待确认）

- **H21** 笔记无日历语义，不参与 Memo 到期/提醒体系（跨模块关联另议）。
- **H22** 全量列表不上分页/搜索（N2 搜索切片再引入）。
- **H23** 附件切片直接复用 M3 图片模式（note_images 同构 memo_images）。

## 十、完成定义（DoD）

迁移可重复执行；E77–E82 有对应测试；A70–A75 与 A17/A19 通过；契约快照更新；Host 导航三语；`pnpm dev` 一键起全部 remote；`ROADMAP.md` 更新 Notes N1 状态。
