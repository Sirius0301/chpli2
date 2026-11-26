# CHPLI 成长与职业（Growth & Career G1）切片任务书

> 范围：职业目标 CRUD + 里程碑 + 派生进度 + 跨模块关联（笔记/书签）。
> 不在本切片（按可复用模式后续扩展）：技能节点、学习资源、实践证据、定期回顾、日历（Memo）关联。
> 依据：PROJECT_INSTRUCTIONS「Growth & Career：记录职业目标、技能节点、里程碑、学习资源、实践证据、进度和定期回顾，可关联笔记、日历与书签」；跨模块关联是设计重点（AGENTS.md：经 API 协作、不直改数据表）。
> 前置：Bookmarks B1 已交付（2026-11-13）。复用：纯日期语义（Memo D1）、幂等/乐观锁/隔离/400-422 分层（Memo 模式）、sessionStorage 偏好、附件/链接的属主校验模式（N2 双链）。

---

## 一、切片规划（G1 最小端到端闭环）

**核心闭环**：创建职业目标 → 添加里程碑 → 勾选完成里程碑 → 进度条自动前进 → 关联一篇笔记/一个书签（校验归属、显示标题、点击跳转目标模块）→ 回顾目标列表（状态+进度+到期日一眼可见）。目标可暂停/达成/归档，全程无自动状态流转。

## 二、核心决策

记录（2026-11-13）：

- **D1 G1 范围**：目标+里程碑+进度+关联（notes/bookmarks 两种链接类型）。技能节点/学习资源/实践证据/回顾按同一套「实体+关联」模式后续切片扩展；日历（Memo）关联并入回顾切片（目标复盘与日历联动更有意义）。
- **D2 进度=派生值**：`progress = round(已完成里程碑数 / 里程碑总数 × 100)`，无里程碑=0。**不设手动进度**，避免双源真相；里程碑是唯一进度来源。
- **D3 目标状态机**：`active / paused / achieved / archived`，用户手动切换；全部里程碑完成**不自动**改状态（沿用「计划不随时间/条件自动转换」底线）。
- **D4 目标日期**：`targetDate` 纯日期（date 列，YYYY-MM-DD 契约，UTC 日期算术），无时刻/时区——与 Memo 纯日期模式一致。
- **D5 跨模块关联机制（设计重点）**：
  - 表 `goal_links(id, goalId FK 级联, module, refId, createdAt)`，`@@unique([goalId, module, refId])`——重复添加天然幂等；
  - **归属校验与标题解析只经属主模块的 Service**（注入 `NotesService`/`BookmarksService` 调用其 `get(userId, refId)`）：不直读属主表、不经 HTTP 自调用，符合模块边界；目标不可见（他人/已删）→ 校验 404 拒绝添加；
  - **悬挂链接**（添加后目标被删）：读取目标列表时解析失败即省略该链接（DTO 不返回），行保留不级联——属主模块对 growth 零感知、零侵入；
  - 反向（笔记/书签页显示被哪些目标引用）为后续切片（需在属主模块加只读查询，另议）。
- **D6 打开关联**：目标内点击「打开」→ `sessionStorage['chpli2-pending-open'] = {module, id}` + 派发 `chpli2-navigate` 事件（Host 监听切视图）；notes/bookmarks remote **挂载时**读取并消费信箱（选中笔记/打开编辑面板）——规避远程懒加载时序问题，不新增 host 传参协议。
- **D7 里程碑**：`title` 必填 ≤256；`date` 可选纯日期（计划日期，可过去/未来）；`status: open/done`（done 记录 completedAt，取消 done 清空）；列表排序：有日期按日期升序（无日期排后），再按创建序。删除里程碑走二次确认（前端）。
- **D8 工程约定**：实体 id 客户端生成幂等创建；PATCH 乐观锁 409；跨用户 404；DTO 400/服务 422 分层；日期越界（如 2026-02-30）422；里程碑/链接操作随目标权限校验（先验 goal 归属）。

## 三、数据模型（迁移 `growth_g1`）

```prisma
model Goal {
  id String @id            // 客户端 uuid（幂等）
  userId String
  title String @db.VarChar(256)
  description String?
  status String @default("active")  // active | paused | achieved | archived
  targetDate DateTime? @db.Date     // 纯日期（D4）
  deletedAt DateTime?
  createdAt/updatedAt
  milestones Milestone[]; links GoalLink[]
  @@index([userId])
}
model Milestone {
  id String @id; goalId FK 级联
  title String @db.VarChar(256)
  date DateTime? @db.Date
  status String @default("open")    // open | done
  completedAt DateTime?
  createdAt/updatedAt
}
model GoalLink {
  id String @id @default(uuid())
  goalId FK 级联; module String @db.VarChar(16)  // notes | bookmarks
  refId String
  createdAt DateTime
  @@unique([goalId, module, refId])
}
```

## 四、接口契约

- `GET /api/goals` → `GoalDto[]`（含 `progress`（派生）/`milestones`/`links`（已解析标题，悬挂省略）），按 updatedAt 倒序。
- `POST /api/goals`（幂等）/ `GET|PATCH|DELETE /api/goals/{id}`（PATCH 乐观锁；status/targetDate 校验）。
- `POST /api/goals/{id}/milestones`（body `{id, title, date?}`，幂等）；
  `PATCH /api/goals/{goalId}/milestones/{mid}`（title/date/status；status done↔open 维护 completedAt）；
  `DELETE .../milestones/{mid}`（204）。删除后进度自动重算（派生）。
- `PUT /api/goals/{id}/links` `{module, refId}` → `GoalDto`（幂等；module 白名单 notes/bookmarks；目标经属主 Service 校验 404）；
  `DELETE /api/goals/{id}/links/{linkId}`（204）。
- `@chpli2/shared` 新增 `growth.ts`：GOAL_STATUSES、GoalLinkModule、GoalDto/MilestoneDto/GoalLinkDto/CreateUpdate DTO、`computeGoalProgress`（纯函数，前后端同算）。

## 五、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E96 | 目标状态/链接 module 非法枚举 | 400 `VALIDATION_ERROR` |
| E97 | targetDate/milestone.date 非真实日期 | 400/422（分层） |
| E98 | 里程碑空标题 | 422；PATCH 乐观锁 409（E78 同模式） |
| E99 | 关联目标不存在/他人所有/已删 | 404（添加被拒）；已存在的悬挂链接读取时省略（D5） |
| E100 | 重复添加同一关联 | 幂等：返回原状态 200，不产生重复行 |
| E101 | 对他人目标加里程碑/链接 | 404（M0 D5） |

## 六、验收标准

- A97 创建目标→加里程碑→勾选完成→进度条按派生值更新→刷新持久化
- A98 目标状态四态手动切换；全部里程碑完成不自动改状态（D3）
- A99 关联笔记/书签：校验归属、显示解析标题、重复添加幂等、目标删除后关联消失
- A100 点击关联「打开」→ Host 切到目标模块 → 笔记被选中/书签编辑面板打开（D6）
- A101 跨用户隔离（E101）；E96–E100 有对应测试；A17/A19 回归通过

## 七、测试覆盖要求

- **单元测试**：`computeGoalProgress` 纯函数（0 里程碑/全部完成/四舍五入）。
- **集成测试**：CRUD（E96–E98）、进度派生重算、里程碑状态流转（completedAt 维护）、链接幂等/悬挂省略/属主校验（E99/E100）、隔离（E101）。
- **契约测试**：/api/goals 全路由与 DTO 入 OpenAPI，快照更新。
- **组件测试**：进度条派生渲染、里程碑勾选、链接添加选择器、悬挂链接不渲染。
- **端到端测试**：G1 闭环 + 打开关联跨模块跳转；既有全量回归。

## 八、假设（待确认）

- **H30** 进度仅里程碑派生；若后续需要非里程碑进度（如技能熟练度），另设字段并注明来源。
- **H31** 里程碑无独立负责人/权重；等权计入进度。
- **H32** 回顾（定期复盘提醒）依赖日历联动，另起切片。

## 九、完成定义（DoD）

迁移可重复执行；E96–E101 有对应测试；A97–A101 通过；契约快照更新；Host 导航三语；`pnpm dev` 一键起 growth remote（端口 3005）；`ROADMAP.md` 更新。
