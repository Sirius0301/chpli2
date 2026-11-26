# CHPLI 日历备忘录（M1）切片任务书

> 范围：Memo CRUD、月/周/日三视图改造（周日起、周视图默认、视图偏好持久化）、9 种重复规则（前端展开 `expandMemoToRange`）、完成机制（非重复直接勾选，重复用 MemoCompletion 按日期实例）、DetailPanel。
> 不在本切片：标签与两级筛选（M2）、图片上传与 DetailPanel 响应式（M3）、即将到期卡片/角标/浏览器通知（M4）、Portal 集成（M5）、农历节气月视图（M2）。
> 依据：2026-11-11 产品方向调整——Calendar 合并进「Portal 内的日历备忘录（Memo）」；既有 Event 时刻/时区（F4）、多日历、节假日订阅能力随 Memo 化逐步退役；F3（RRULE）任务书作废。
> 前置：M0 用户与认证已交付（2026-11-11）。

---

## 一、切片目标

用户登录后进入日历备忘录页，默认看到周视图（周日起）：点击某天可创建备忘录（纯日期、无时刻/时区），可在月/周/日三视图间切换（选择持久化），可为备忘录设置 9 种重复规则之一（前端按日期展开渲染），可直接勾选完成（非重复备忘录整体完成；重复备忘录按日期实例完成），点击条目在 DetailPanel 中查看与编辑。

## 二、数据模型

Calendar/Memo 模块拥有以下两张新表；`date` 一律为纯日期（`date` 类型，无时区语义），与 Memo 纯日期定位一致。

### 2.1 memos

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 客户端生成，幂等创建锚点（沿用 E11） |
| user_id | uuid FK → users | 用户隔离（M0） |
| title | varchar(256) | 必填，非空 |
| date | date | 备忘录日期（纯日期，允许过去） |
| priority | varchar(8) | none / low / medium / high，默认 none |
| note | text? | 备注，可空 |
| repeat | varchar(16) | none + 9 种（见 2.3），默认 none |
| repeat_end | date? | 重复截止日（含），可空 = 无限重复 |
| completed_at | timestamp? | 非重复备忘录的完成时间；null = 未完成 |
| created_at / updated_at / deleted_at | timestamp | 软删除 |

约束：`repeat_end < date` 直接 422；`repeat != none` 时 `completed_at` 恒为 null（完成状态走 MemoCompletion）。

### 2.2 memo_completions（重复实例完成表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | |
| memo_id | uuid FK → memos | 级联删除 |
| date | date | 完成的实例日期 |
| completed_at | timestamp | |

约束：`@@unique([memo_id, date])`——同一实例重复勾选幂等，天然防重。

### 2.3 重复规则（9 种）

| 规则 | 语义 |
|---|---|
| daily | 每天 |
| weekdays | 工作日（周一至周五） |
| weekly | 每周（同星期几） |
| biweekly | 每两周（自起始日起每隔 14 天） |
| monthly | 每月同日；短月收拢到月末（1/31 → 2/28） |
| monthlyByWeekday | 每月第 N 个星期几（如每月第 2 个周二）；当月无该序数时收拢到当月最后一个该星期几 |
| quarterly | 每 3 个月同日（收拢） |
| semiannual | 每 6 个月同日（收拢） |
| yearly | 每年同月同日（2/29 → 2/28） |

展开逻辑在 `@chpli2/shared` 的 `expandMemoToRange(memo, fromKey, toKey)`（纯函数、按 `YYYY-MM-DD` 键运算，与浏览器时区无关），后端不展开。

## 三、接口契约

- `GET /api/memos?from=&to=`：`from`/`to` 为 `YYYY-MM-DD`（含头不含尾，缺省今天−31 天 / 今天+366 天）。返回**原始 Memo**（不展开）：`date <= to` 且（非重复：`date >= from`；重复：`repeat_end` 为空或 `>= from`）。重复规则由前端展开。
- `POST /api/memos` → 201；客户端生成 `id`，重复提交返回原记录（E11 同语义）。校验失败 422 `VALIDATION_ERROR`。
- `GET /api/memos/{id}` → 200；不存在或他人所有 404 `MEMO_NOT_FOUND`（M0 D5）。
- `PATCH /api/memos/{id}` → 200；`updatedAt` 乐观锁，冲突 409 `CONCURRENT_MODIFICATION`（沿用 E14）。
- `DELETE /api/memos/{id}` → 204；软删除，memo_completions 级联。
- `PUT /api/memos/{id}/completion`：`{ date: 'YYYY-MM-DD', completed: boolean }`。非重复：`date` 必须等于 `memo.date`，`completed=true` 置 `completed_at`，`false` 清除；重复：按实例日期 upsert/删除 MemoCompletion，`date` 必须是该规则的一个实际出现日，否则 422 `MEMO_DATE_NOT_INSTANCE`。响应为更新后的 MemoDto。
- MemoDto：`{ id, title, date, priority, note, repeat, repeatEnd, completedAt, completions: string[]（已完成实例日期，仅重复备忘录）, createdAt, updatedAt }`。
- `@chpli2/shared` 新增：MemoPriority / MemoRepeatRule 常量与类型、MemoDto / CreateMemoDto / UpdateMemoDto / SetMemoCompletionDto、`expandMemoToRange` 及日期键工具。错误码新增 `MEMO_NOT_FOUND`、`MEMO_DATE_NOT_INSTANCE`。

## 四、核心决策

记录（2026-11-11）：

- **D1 纯日期语义**：Memo 只有日期没有时刻与时区；存储与展开全部使用 `YYYY-MM-DD` 日期键（UTC 日期算术），渲染与浏览器时区无关。F4 的时刻/时区语义不适用于 Memo。
- **D2 前端展开**：重复实例由前端 `expandMemoToRange` 展开（任务书既定规格）；后端只做窗口查询并返回原始 Memo + 已完成实例日期列表。
- **D3 双轨完成**：非重复 → `memos.completed_at`；重复 → `memo_completions` 按实例日期一行。重复备忘录的 `completed_at` 恒为 null，避免双源真相。
- **D4 旧 Event UI 随本切片退役**：calendar remote 前端整体替换为 Memo 应用（旧 EventModal/EventPopover/Sidebar/多日历/节假日/到期提醒 UI 移除）；后端 events/calendars/reminders/holidays API 与 Travel 日历投影保留（Travel 模块依赖，后续切片再退役）。对应 UI 级 e2e（calendar-f1f2、calendar-f4-timezone）退役，trip-calendar 的日历 UI 断言改为 API 级断言。
- **D5 视图偏好**：视图模式（月/周/日）持久化到 localStorage（`chpli2-memo-view`），周视图默认；周起始固定周日（产品规格），不做用户可配。
- **D6 重复规则选型**：9 种见 2.3；短月/无该序数日一律「收拢」而非跳过，行为与 Apple 备忘录/日历一致。

## 五、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E43 | title 为空 / 超过 256 字 | 400（DTO 层超长）/ 422（服务层空串），均 `VALIDATION_ERROR` |
| E44 | date / repeatEnd 非合法日期（如 2026-02-30） | 400（格式）/ 422（非真实日期），均 `VALIDATION_ERROR` |
| E45 | repeatEnd 早于 date | 422 `VALIDATION_ERROR` |
| E46 | priority / repeat 非法枚举值 | 400 `VALIDATION_ERROR`（DTO 层） |
| E47 | 重复创建请求（网络重试/双击） | 幂等返回同一 Memo（E11） |
| E48 | 访问他人 Memo 或完成记录 | 404 `MEMO_NOT_FOUND`（M0 D5） |
| E49 | 并发编辑同一 Memo | 409 `CONCURRENT_MODIFICATION` |
| E50 | 对重复 Memo 完成一个非出现日（如 weekdays 规则勾选周六） | 422 `MEMO_DATE_NOT_INSTANCE` |
| E51 | 对非重复 Memo 完成时 date 与 memo.date 不一致 | 422 `VALIDATION_ERROR` |

## 六、前端交互

- 三视图：月（周日起始 6×7 网格）、周（7 列，默认视图）、日（单列）；工具栏prev/今天/next + 视图切换；视图选择持久化（D5）。
- 点击空白日期格：DetailPanel 进入创建模式（日期预选该天）；点击条目：DetailPanel 进入编辑模式；DetailPanel 为右侧固定面板（M3 再做抽屉/底部弹层响应式）。
- 条目渲染：按优先级着色（none 灰 / low 蓝 / medium 橙 / high 红），完成实例划线置灰；月视图超格显示「还有 N 项」。
- 完成勾选：条目行内复选框直接切换完成状态（重复条目按实例日期）；编辑面板内同步显示。
- DetailPanel 字段：标题、日期、优先级、重复规则（9 种 + 不重复）、重复截止日（选重复时出现，可留空）、备注；删除需二次确认；保存失败回显错误（E43–E46 前端即时校验）。
- 三语文案（zh-CN/en/de）；语言、日期格式、时区独立（A17 回归）。

## 七、验收标准

- A41 创建→刷新→编辑→删除 Memo 闭环，数据持久化（A19 回归）
- A42 三视图周日起渲染正确；周视图为默认；视图切换后刷新仍保持（D5）
- A43 9 种重复规则在月/周/日视图按实例正确展开（含短月收拢、weekdays 跳过周末、repeatEnd 截断）
- A44 非重复 Memo 勾选完成/取消完成即时生效并持久化
- A45 重复 Memo 按日期实例完成：勾选单个实例不影响其他实例；跨月视图完成状态一致
- A46 E43–E51 全部被拦截且有对应测试
- A47 跨用户隔离：用户 B 无法看到/操作用户 A 的 Memo（E48）
- A17/A19 回归通过（三语、持久化）

## 八、测试覆盖要求

- **单元测试**：`expandMemoToRange` 全 9 种规则 + 收拢/截断/边界；日期键工具；后端 Memo 校验辅助。
- **集成测试**：Memo CRUD（E43–E47）、完成机制（E50/E51 + 幂等重复勾选）、乐观锁（E49）、跨用户隔离（E48）、窗口查询语义。
- **契约测试**：OpenAPI 新增 /api/memos 路由与 MemoDto schema；快照更新；live 响应校验。
- **端到端测试**：注册登录→建 Memo→重复规则展开→勾选完成→删除关键路径（A41–A45 抽查）；既有 auth-users、trip-calendar（改为 API 级日历断言）回归。

## 九、假设（待确认）

- **H1** 标签（M2）与图片（M3）本切片不建列，由各自切片迁移加入。
- **H2** 重复截止日 `repeat_end` 含当天；无限重复（null）在视窗内展开，不做实例总数上限（视窗天然有界）。
- **H3** 完成操作不校验「日期不早于今天」——允许补勾/取消历史实例（诚实记录，与 Plan/Memory 规则一致）。
- **H4** 视图偏好存 localStorage（前端偏好，非业务数据）；若 M5 Portal 要求跨端同步偏好，再迁移后端。
- **H5** monthlyByWeekday 当月无第 N 个该星期几时收拢到当月最后一个（如「每月第 5 个周五」在无 5 个周五的月份落在第 4 个）。

## 十、完成定义（DoD）

迁移可重复执行且旧数据不受影响；E43–E51 全部有对应测试；A41–A47 与 A17/A19 通过；契约快照更新；旧 Event UI 与其 e2e 按 D4 退役且无死代码残留；`ROADMAP.md` 更新 M1 状态。
