# CHPLI 书签（Bookmarks B1）切片任务书

> 范围：书签 CRUD + 分类 + 描述图片（对象存储）+ 卡片/列表视图 + 点击统计与排序 + 30 天不活跃灰色精简降级。
> 依据：PROJECT_INSTRUCTIONS「Bookmarks：支持分类、描述图片、卡片与列表视图、点击统计和排序。30 天未点击的书签进入灰色精简列表，仅显示名称、分类和域名」。
> 前置：Notes N2 已交付（2026-11-12）。复用成熟模式：附件=M3/N2（对象存储+元数据+鉴权回源）、分类=Memo/Notes 标签模式、幂等创建/乐观锁/隔离=Memo 模式。

---

## 一、需求澄清与默认决策

规格未明确处的合理默认（记录备查）：

- **D1 分类**：`categories String[]`（自由文本，≤10 个/每个 ≤32 字符，trim+去重——完全复用 Memo 标签约束与交互）。B1 **不做分类筛选**（规格未要求），仅编辑与展示；如需筛选后续切片再加。
- **D2 描述图片**：每书签**一张封面图**（1:1）。文件进对象存储（`bookmark-covers/{userId}/{bookmarkId}.{ext}`）；DB 在行上仅存元数据+存储键（`coverStorageKey` 唯一、`coverFileName`、`coverMimeType`，均可空）。上传=multipart PUT 整体替换（删除旧对象）；下载走鉴权代理回源（复用 M3 D3）；书签删除时清理对象。
- **D3 URL 校验**：仅 http/https；服务端用 `new URL()` 解析并归一化存储；`domain`（hostname）在保存时计算落列（灰色列表与展示用）。非法/非 http(s) URL → 422。
- **D4 点击统计**：`POST /api/bookmarks/{id}/click` → `clickCount+1`、`lastClickedAt=now()`，返回更新后的 DTO。前端点击卡片/行时打开新标签页并调用一次；API 语义=每次调用计一次（真实统计，不做去重——幂等约束针对的是同步/重试不产生重复数据，点击计数天然是事件）。
- **D5 不活跃降级判定**：`inactive = COALESCE(lastClickedAt, createdAt) < now() - 30 天`，**服务端计算**并随 DTO 返回 `inactive: boolean`（30 为常量，可后续配置化）；前端据此分「活跃区/不活跃区」两段渲染，不活跃区默认折叠、灰色精简（仅名称、分类、域名）。点击不活跃条目照常计数 → 刷新后回到活跃区（闭环）。
- **D6 排序**：`sort` 查询参数白名单：`recent`（默认：lastClickedAt 降序、未点击排后按 createdAt 降序）/ `clicks`（clickCount 降序）/ `title`（标题升序）/ `added`（创建时间降序）。服务端排序。
- **D7 视图**：卡片/列表切换 + 排序选择存 localStorage（`chpli2-bookmarks-prefs`，复用偏好持久化模式）；两视图共用数据源。
- **D8 数据模型**：`bookmarks` 表（迁移仅建表）：id（客户端 uuid 幂等）、userId、title(≤256 必填)、url(≤2048)、domain、description(≤2000 可空)、categories、cover 三列、clickCount、lastClickedAt、软删除、时间戳。

## 二、接口契约

- `GET /api/bookmarks?sort=` → `BookmarkDto[]`（含 inactive/domain/clickCount/lastClickedAt）。
- `POST /api/bookmarks`（幂等，客户端 id）/ `GET|PATCH|DELETE /api/bookmarks/{id}`（PATCH 乐观锁 409）。
- `POST /api/bookmarks/{id}/click` → 计数后的 `BookmarkDto`。
- `PUT /api/bookmarks/{id}/cover`（multipart file；magic bytes 嗅探、4 类白名单、≤5MB；替换时删旧对象）。
- `GET /api/bookmarks/{id}/cover/file`（鉴权代理回源）。
- `@chpli2/shared` 新增 `bookmarks.ts`：BookmarkDto/CreateBookmarkDto/UpdateBookmarkDto、BOOKMARK_SORTS、isValidHttpUrl、约束常量。

## 三、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E89 | URL 非 http/https、无法解析、超长 | 422 `VALIDATION_ERROR`（前后端双重校验） |
| E90 | 空标题 / 非法分类 | 400（DTO 层）/ 422（服务层） |
| E91 | 封面非图片/超大 | 422 / 413（M3 E59/E60 同语义） |
| E92 | 并发编辑同一书签 | 409 `CONCURRENT_MODIFICATION` |
| E93 | 重复创建（双击/重试） | 幂等返回原记录 |
| E94 | 访问他人书签/封面/计数 | 404（M0 D5） |
| E95 | 替换封面时旧对象删除失败 | 不回滚（warn 日志，M3 D5 同语义） |

## 四、验收标准

- A82 新建书签（标题/URL/分类/描述）→ 卡片与列表视图正确渲染 → 刷新持久化
- A83 上传封面 → 缩略图展示 → 替换后旧图不可达 → 删除书签后对象清理
- A94 点击卡片 → 新标签打开 URL → 点击数 +1、lastClickedAt 更新 → 排序随点击变化
- A95 四种排序切换生效且持久化
- A96 31 天前点击过的书签进入灰色精简列表（仅名称/分类/域名、默认折叠）；点击后回到活跃区
- A89–A95 被拦截有对应测试；A17/A19 回归通过

## 五、测试覆盖要求

- **集成测试**：CRUD/校验（E89/E90）、幂等（E93）、乐观锁（E92）、点击计数、排序四态、inactive 边界（29/30/31 天、从未点击按 createdAt）。
- **契约测试**：新路由与 BookmarkDto 入 OpenAPI，快照更新。
- **组件测试**：视图切换与排序参数下发、inactive 分区渲染（灰色精简）、封面上传/替换、点击回调。
- **端到端测试**：关键路径（A82–A96 抽查；inactive 用 `docker exec psql` 将 last_clicked_at 置旧驱动真实 UI 断言——e2e 环境本已依赖 docker）。

## 六、假设（待确认）

- **H27** 描述=纯文本（无 Markdown）；如需富文本另议。
- **H28** 点击统计不含去重/防刷；公网部署前另议。
- **H29** 不活跃阈值 30 天为常量（规格值）。

## 七、完成定义（DoD）

迁移可重复执行；E89–E95 有对应测试；A82–A96 通过；契约快照更新；Host 导航三语；`pnpm dev` 一键起 bookmarks remote（端口 3004）；`ROADMAP.md` 更新。
