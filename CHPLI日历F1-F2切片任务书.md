# CHPLI Calendar 模块 F1+F2 切片任务书

> 范围：事件 CRUD + 月/周/日三视图（F1）、多日历管理（F2）、节假日订阅日历、到期提醒。
> 不在本切片：重复日程（F3）、时区高级处理（F4 仅做基础）、冲突限制（F5）、行为禁忌（F6）、Travel 联动（F7）、搜索（F8）。
> 依据：CHPLI 项目核心规则与工程约束，对标 Apple Calendar 网页版交互。

---

## 一、切片目标

交付一个真实可用的端到端流程：用户登录后进入日历页，可创建多个日历、订阅节假日日历、在三视图中创建/编辑/拖拽/删除事件、为事件设置到期提醒，并在左下角查看即将到期的提醒列表。

## 二、数据模型

统一数据库，Calendar 模块拥有以下四张表的所有权；其他模块只读访问（经 API），禁止直接写入。

### 2.1 calendars（日历表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 稳定 ID，永不复用 |
| name | varchar(64) | 日历名称，必填 |
| color | char(7) | 十六进制色值，如 #0A84FF |
| type | enum | `custom`（自建）/ `subscription`（订阅，如节假日） |
| readonly | bool | 订阅日历为 true，前端禁编辑 |
| region_code | varchar(16) | 订阅日历专用：CN / DE-BY（德国-巴伐利亚）/ CH-ZH（瑞士-苏黎世）等，自建日历为 null |
| is_default | bool | 用户默认日历，每用户恰好一个 |
| sort_order | int | 侧边栏排序 |
| created_at / updated_at / deleted_at | timestamp | 软删除 |

约束：
- 每用户至少保留一个 `custom` 日历；删除最后一个自建日历必须拦截
- 同一用户下 `name` 允许重复（Apple 行为一致），但删除/转移时按 ID 操作，不按名称

### 2.2 events（事件表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 稳定 ID |
| calendar_id | uuid FK → calendars.id | 必填；事件必须归属一个日历 |
| title | varchar(256) | 必填；空标题保存时前端兜底为「未命名事件」 |
| start_at | timestamp with tz | 必填 |
| end_at | timestamp with tz | 必填，必须 > start_at（全天事件见下） |
| all_day | bool | 全天事件 |
| timezone | varchar(64) | IANA 时区名，如 Asia/Shanghai；记录创建时时区 |
| location | varchar(256) | 可空 |
| description | text | 可空 |
| created_at / updated_at / deleted_at | timestamp | 软删除 |

约束：
- `all_day = true` 时 start_at/end_at 存日期（00:00 起，结束日次日 00:00 止，Apple 语义）
- 非全天事件 `end_at <= start_at` 直接 422 拒绝
- 跨模块来源字段（source_module / source_ref）本切片预留但为 null，供 F7 幂等同步使用

### 2.3 reminders（提醒表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | |
| event_id | uuid FK → events.id | 级联软删除 |
| offset_days | smallint | 提前天数，合法值域 1–30（30 = 一个月上限） |
| preset | enum | `month` / `week` / `day` / `custom`，便于前端回显 |
| status | enum | `pending` / `sent` / `dismissed` |
| trigger_at | timestamp with tz | 由 start_at − offset_days 预计算，事件改时间时重算 |
| sent_at | timestamp | 可空 |

约束：
- `offset_days > 30` 直接 422 拒绝（前后端双重校验）
- 一个事件允许多条提醒（预设 + 自定义可叠加）
- 提醒触发通知走 Host 通知通道，Calendar 只负责维护 trigger_at 与状态

### 2.4 holiday_entries（节假日数据表，内置只读）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | |
| region_code | varchar(16) | CN / DE-{州代码} / CH-{州代码} |
| date | date | |
| name | varchar(64) | 节日名，按当前语言回退：中→英→德 |
| is_workday | bool | 仅中国大陆使用：true 表示调休工作日 |

约束：
- 数据由系统内置/更新，不提供用户写接口
- 德国按联邦州（16 州）、瑞士按州（26 州）分别建数据，无调休概念

## 三、接口契约（模块内 API 摘要）

- `GET /calendars` 列表（含订阅状态）；`POST /calendars`；`PATCH /calendars/{id}`；`DELETE /calendars/{id}?move_to={calendar_id}`（不带 move_to 且含事件 → 409 要求用户选择）
- `GET /events?from=&to=&calendar_ids=`（按视图窗口取数）；`POST /events`；`PATCH /events/{id}`（含改 calendar_id 即移动日历）；`DELETE /events/{id}`
- `GET /events/{id}/reminders`；`PUT /events/{id}/reminders`（整体替换该事件提醒集）
- `GET /reminders/due?before=`（左下角到期提醒列表，按 trigger_at 升序）
- `GET /holidays?region_codes=&from=&to=`（只读）

所有写操作幂等：客户端生成事件 ID（uuid）随创建请求提交，重复提交返回原记录而非新建。

## 四、异常清单

| # | 场景 | 期望行为 |
|---|---|---|
| E1 | 删除含事件的日历，未选择去向 | 409 + 前端弹确认框：「一并删除 N 条事件」或「转移到指定日历」，用户确认前不动数据 |
| E2 | 删除最后一个自建日历 | 422 拦截，提示至少保留一个日历 |
| E3 | end_at ≤ start_at | 422，前端表单同步标红 |
| E4 | 自定义提醒 > 30 天 | 422 + 前端输入框即时提示「最多提前一个月」 |
| E5 | 事件跨午夜（如 22:00–次日 02:00） | 合法；周/月视图正确渲染为跨日块 |
| E6 | 全天事件在用户切换时区后 | 仍按日期锚定，不漂移（全天事件与时区解耦） |
| E7 | 修改事件时间后 | 该事件所有 pending 提醒的 trigger_at 重算；已 sent 的不变 |
| E8 | 删除事件 | 其 reminders 级联软删除，不再触发 |
| E9 | 节假日数据未覆盖当前查看年份 | 视图正常渲染，节假日层静默缺省，不报错 |
| E10 | 订阅节假日时未选择州（DE/CH） | 前端强制选择后才提交；后端缺 region_code 422 |
| E11 | 重复创建请求（网络重试/双击） | 幂等返回同一事件，不产生重复数据 |
| E12 | 移动事件到只读订阅日历 | 422 拦截 |
| E13 | 提醒触发时间已过期（如给过去事件补提醒） | 允许保存，状态直接置 dismissed，不补发通知 |
| E14 | 并发编辑同一事件 | 以 updated_at 乐观锁，后到请求 409，前端提示刷新 |

## 五、验收标准

### 多日历
- A1 新建日历后出现在侧边栏列表，可选色、可显隐勾选
- A2 新建事件默认保存到当前选中日历；表单中切换日历下拉后保存到所选日历
- A3 事件从一个日历移动到另一个日历后，颜色与归属即时更新，刷新后保持一致
- A4 隐藏某日历后，其全部事件（含节假日层）在三视图中不可见，到期提醒列表同步隐藏
- A5 删除日历走 E1/E2 确认流程，未确认不产生任何数据变更

### 节假日订阅
- A6 勾选「中国大陆节假日」后，月视图日期格显示节日名；调休工作日以「班」标记
- A7 订阅德国/瑞士节假日时弹出州选择；选定后仅显示该州假日
- A8 节假日条目不可点击编辑、不可删除、不可拖入事件

### 事件 CRUD 与三视图
- A9 月视图：跨天事件渲染为连续横条；单格超出显示「还有 N 项」可展开
- A10 周/日视图：全天事件固定在顶部区域；重叠事件横向并列
- A11 点击空白新建、拖拽移动、拖拽拉伸改时长、单击弹摘要气泡、气泡内进完整编辑
- A12 今日列高亮 + 当前时间红线（周/日视图）

### 到期提醒
- A13 可设置提前一个月/一周/一天/自定义（≤30 天），超出被拦截（E4）
- A14 左下角到期提醒列表按到期时间升序，显示标题、日历色点、到期日、剩余天数；点击条目跳转对应事件
- A15 到达 trigger_at 后收到 Host 通知，条目标记为已提醒
- A16 修改提醒规则立即生效，历史 sent 记录保留

### 通用
- A17 中/英/德三语界面文案与日期格式正确切换；语言、日期格式、时区三者独立
- A18 所有重要操作（删日历、删事件）有确认步骤；页面无空入口、无无效按钮
- A19 刷新/重登后数据完整，无任何仅存在于前端的临时状态

## 六、测试覆盖要求

- **单元测试**：时间窗口计算、跨午夜拆分、全天事件日期锚定、提醒 trigger_at 计算与重算、offset_days 校验
- **集成测试**：events/reminders 级联删除、日历删除转移、幂等创建（E11）、乐观锁（E14）
- **契约测试**：上述 API 的请求/响应 schema，供 Host 与未来 Travel 模块对接
- **端到端测试**：A1–A19 中标记用户路径的关键场景（至少覆盖 A2、A5、A9、A13、A14）

## 七、完成定义（DoD）

数据模型迁移可重复执行且不破坏已有数据；E1–E14 全部有对应测试；A1–A19 全部通过；契约文档随代码提交。
