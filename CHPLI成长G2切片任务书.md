# CHPLI 成长与职业（Growth G2）切片任务书

> 范围：技能节点 + 学习资源（书签关联）+ 实践证据（笔记关联）+ 定期回顾（含 Memo 关联与「下次回顾」安排）。
> 依据：PROJECT_INSTRUCTIONS「技能节点、学习资源、实践证据、进度和定期回顾」；G1 任务书后置裁定（技能/资源/证据/回顾按可复用模式扩展，日历关联并入回顾切片）。
> 前置：Growth G1 已交付（2026-11-13）。复用：G1 跨模块关联机制（属主 Service 校验/解析）、派生进度、幂等/乐观锁/隔离、pending-open 信箱跨模块跳转。

---

## 一、切片规划（一个完整垂直切片）

G2 在 growth 模块内新增三块端到端能力，共用一套**统一关联表**（G1 `goal_links` 升级为多属主 `growth_links`）：

1. **技能节点**：名称 + 熟练度（0–5 刻度）+ **可选从属于一个目标**（goalId 可空，删目标后置空不级联——技能是长期资产，不随目标消失）。
2. **学习资源**：技能关联书签（`growth_links` module=bookmarks）——书签本身是成熟实体，资源=「技能→书签」的关联，不建新资源表。
3. **实践证据**：技能关联笔记（module=notes）——证据=「技能→笔记」关联，同机制。
4. **定期回顾**：回顾记录（标题/内容/回顾日期纯日期/可选从属目标）+ **Memo 关联**（module=memos，引用既有备忘）+ **「安排下次回顾」**：一键生成一张未来日期的 Memo 作为回顾提醒（幂等：review 存 `nextMemoId`，重复点击只打开既有 Memo）。

## 二、核心决策

记录（2026-11-14）：

- **D1 技能从属关系**：`skills.goalId` 可空 FK（SetNull）。技能默认独立；用户可将其挂到某目标下表示「为该目标服务的技能」。删除目标 → 技能保留、goalId 置空（不级联删除）。每用户技能名唯一（`@@unique([userId, name])`，冲突 422 `SKILL_EXISTS`）——技能是命名空间化的长期资产。
- **D2 熟练度**：整数 0–5（0=未评估，1=了解…5=专家），服务端钳制越界值（<0→0，>5→5 过于宽容；改为越界 422，前后端同校验）。
- **D3 统一关联表**：`growth_links(id, ownerType: 'goal'|'skill'|'review', ownerId, module: 'notes'|'bookmarks'|'memos', refId, createdAt)`，`@@unique([ownerType, ownerId, module, refId])`。G1 的 `goal_links` 迁移为 `ownerType='goal'`（迁移内 INSERT…SELECT 复制后 DROP，既有数据保留）。多态无硬 FK，属主删除时由 Service 同事务清理其 links——边界更清晰，owner 互不知晓。校验/标题解析仍只经属主模块 Service（Notes/Bookmarks/Memo），**G2 起 MemoService 加入校验注册表**；悬挂链接读取省略（G1 D5 语义不变）。
- **D4 GoalsService 改造**：G1 的 goal_links 读写改为 growth_links（ownerType='goal'），API 契约与 DTO 不变（回归即验收）。
- **D5 回顾模型**：`reviews(id, userId, title, content?, reviewedAt 纯日期(默认今天), goalId? SetNull, nextMemoId? unique, 软删除)`。回顾可选从属目标；nextMemoId 指向安排的下次回顾 Memo（被删则置空由读取时省略处理——review DTO 返回 `nextMemoDate` 供展示）。
- **D6 安排下次回顾（写操作跨模块）**：`POST /api/reviews/{id}/schedule-next-memo { date }` → 经 **MemoService.create（属主模块公开 Service API）** 创建纯日期 Memo（标题=回顾标题+「（回顾）」，id 幂等）：review.nextMemoId 为空→先落库预留 id 再创建（两步间崩溃可确定性恢复）；非空且 Memo 健在→直接返回既有（重试/双击不重复，E108）；**悬挂**（Memo 被删）→ 换新 id 重新安排并落库。date 为纯日期须 ≥ 今天（允许今天）。
- **D7 Memo 关联与跳转**：回顾可关联既有 Memo（memos picker，窗口查询返回原始 memo 供选择）；「打开」走 G1 信箱机制，`module:'memos'` → Host 切到 Calendar → calendar remote 挂载时消费（按 memo 日期锚定日视图并打开该 Memo 的编辑面板——calendar 增加 memos 消费分支）。
- **D8 校验/隔离/分层**：沿用既有全部约定；新错误码 `SKILL_NOT_FOUND`、`REVIEW_NOT_FOUND`、`SKILL_EXISTS`。

## 三、接口契约（相对 G1 的增量）

- `GET /api/skills` → `SkillDto[]`（含 `links`（已解析）、`goalTitle`）；`POST`（幂等，name 冲突 422）/ `GET|PATCH|DELETE /api/skills/{id}`。
- `PUT /api/skills/{id}/links` `{module: 'notes'|'bookmarks', refId}` / `DELETE .../links/{linkId}`（复用统一机制）。
- `GET /api/reviews`（reviewedAt 倒序）/`POST` / `GET|PATCH|DELETE /api/reviews/{id}`。
- `PUT /api/reviews/{id}/links` `{module: 'memos', refId}` / `DELETE .../links/{linkId}`。
- `POST /api/reviews/{id}/schedule-next-memo` `{date}` → `ReviewDto`（幂等，D6）。
- Memo 候选：`GET /api/memos` 复用既有窗口查询（前端传 from/to）。
- `@chpli2/shared` 新增 `skills.ts`/`reviews.ts` 或并入 `growth.ts`：SKILL_LEVELS(0–5)、GOAL_LINK_MODULES 扩为含 `'memos'`、SkillDto/ReviewDto 系列。

## 四、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E102 | 技能名为空/超长、重名（同用户）、level 越界 | 422 `VALIDATION_ERROR` / `SKILL_EXISTS` |
| E103 | 技能挂在不存在/他人的目标下 | 404（经 GoalsService 校验） |
| E104 | 回顾日期非法 / schedule date 早于今天 | 422 |
| E105 | 关联 module 非法（回顾仅允许 memos 等属主白名单） | 400（DTO）/ 422 |
| E106 | 关联目标不可见、nextMemoId 指向已删 Memo | 添加 404；DTO 中省略/置空（悬挂语义） |
| E107 | 对他人技能/回顾/关联操作 | 404（M0 D5） |
| E108 | schedule-next-memo 重复调用 | 幂等返回既有安排（D6） |

## 五、验收标准

- A102 创建技能（名称/熟练度/挂到目标）→ 重名被拦（E102）→ 删除目标后技能保留且 goalId 置空
- A103 给技能挂书签（学习资源）与笔记（实践证据），标题解析正确、重复幂等、删除目标笔记后链接消失
- A104 创建回顾（今天默认日期/挂目标）→ 编辑内容 → 关联既有 Memo
- A105 「安排下次回顾」选未来日期 → 生成 Memo（标题含回顾名）→ 重复点击/重试只得到一个 Memo → 打开跳转 Calendar 并定位该 Memo
- A106 G1 目标关联回归全部通过（统一表迁移无损）
- A17/A19 回归；E102–E108 有对应测试

## 六、测试覆盖要求

- **单元测试**：level 钳制/校验辅助（若有）；统一关联唯一键语义由集成覆盖。
- **集成测试**：skills CRUD（E102/E103/E107）、reviews CRUD（E104/E107）、schedule 幂等与 Memo 生成（E108/D6）、skill/review 链接（E105/E106）、**G1 goals 链接回归**（迁移无损）。
- **契约测试**：新路由与 SkillDto/ReviewDto 入 OpenAPI，快照更新。
- **组件测试**：熟练度刻度渲染、技能链接选择器、回顾编辑器、schedule 按钮幂等态。
- **端到端测试**：A102–A105 关键路径 + 全量回归。

## 七、假设（待确认）

- **H33** 技能无父子层级（「节点」按名称+从属目标组织；层级树另议）。
- **H34** 回顾无强制周期模板（自由记录；周期提醒由「安排下次回顾」Memo 承担）。
- **H35** 学习资源=书签关联，不复制 URL（书签是唯一定义源）。

## 八、完成定义（DoD）

迁移可重复执行且 G1 关联数据无损迁移；E102–E108 有对应测试；A102–A106 通过；契约快照更新；growth remote 三语新文案；`ROADMAP.md` 更新 G2 状态。
