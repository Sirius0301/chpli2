# CHPLI 人生文件夹（Life Folder L1）切片任务书

> 范围：文件分类体系 + 文件记录（元数据 + MinIO 对象存储）+ 模板 + 推荐。
> 不在本切片：对话协助（L2，见 D6 网关设计）。
> 依据：PROJECT_INSTRUCTIONS「Life Folder：通过模板、推荐和对话协助用户建立人生文件夹体系。未经确认不得创建、移动或删除文件；敏感文件默认私有并严格控制访问」。
> 前置：Growth G2 已交付（2026-11-14）。复用：MinIO 对象存储（全局 ObjectStorageService）、magic bytes 嗅探、幂等/乐观锁/隔离、跨模块关联的属主校验模式。

---

## 一、需求澄清与切片规划（L1 最小闭环）

用户在 Life Folder 模块看到**内置人生文件夹分类体系**（七类），可按**模板**（内置 12 项文件模板，含"推荐补齐"标记）上传**文件记录**（标题/备注/敏感标记 + 文件进 MinIO、DB 只存元数据与存储键），按分类浏览/下载/移动/删除；**推荐**=未补齐的推荐模板列表（客户端由模板×已有文件推导，无独立端点）。「未经确认不得创建、移动、删除」落实为前端二次确认（创建=上传前表单确认、移动/删除=两步确认）。**敏感文件默认私有**：`sensitive` 默认 true，全部文件本即属主隔离（跨用户 404），敏感标记用于显式警示与后续分享功能的访问控制基线（L1 内无分享）。

## 二、核心决策

记录（2026-11-14）：

- **D1 分类体系**：`lf_categories(id, userId null=内置, name, parentId null=顶级, sortOrder)`；**树深 ≤2**（顶级→子类，服务层校验）；内置分类由迁移种子数据提供（固定 id、`ON CONFLICT DO NOTHING`、删除拦截）；用户可建自定义分类（顶级或挂在内置/自定义顶级下）；同级同范围名称唯一（冲突 422）。
- **D2 内置分类**（七类）：身份与证件 / 财务与税务 / 健康与医疗 / 教育与职业 / 房产与车辆 / 家庭与法务 / 其他。
- **D3 文件记录**：`lf_documents(id 客户端 uuid, userId, categoryId FK, title, notes?, sensitive 默认 true, templateId? 可空, storageKey unique, fileName, mimeType, sizeBytes, 软删除)`；存储键 `life-files/{userId}/{documentId}.{ext}`；文件体只进 MinIO（AGENTS.md），DB 仅存元数据+键。
- **D4 文件类型与大小**：magic bytes 嗅探白名单 = **PDF + JPEG/PNG/WebP/GIF**（纯文本无法可靠嗅探，排除并记录），单文件 ≤**10MB**（比图片大，人生文件夹多为 PDF 扫描件）；非白名单 422、超大 413/422（沿用分层）。
- **D5 敏感文件**：默认 `sensitive=true`（规格"默认私有"）；UI 敏感徽标；下载/打开照常（属主本人），但前端对敏感文件的删除/移动确认文案显式提及"敏感文件"；跨用户访问一律 404（M0 D5）。
- **D6 对话协助（L2 设计，L1 不实现）**：网关抽象=**OpenAI 兼容 chat completions**；配置全走环境变量 `LIFE_ASSIST_BASE_URL` / `LIFE_ASSIST_API_KEY` / `LIFE_ASSIST_MODEL`（密钥不入库不入仓，`.env.example` 仅占位说明）；未配置时 L2 端点返回 503 `ASSIST_UNAVAILABLE`（明确降级，**绝不伪造响应**）；L2 以上下文=文件清单+分类+模板做轻量检索增强。L1 交付物=本决策 + 网关接口草图（任务书记录），无假入口、无无效按钮。
- **D7 模板与推荐**：`lf_templates(id 内置, categoryId, name, description, recommended)` 迁移种子；推荐列表 = recommended 模板 去掉已有 `templateId` 关联的文件（前端推导）；「按模板添加」预填标题/分类/敏感=true。
- **D8 移动与删除语义**：移动=PATCH categoryId（前端确认后提交；目标分类须存在且属主可见）；删除分类被文件占用时 422 拦截（先移动/删除文件）；删除文件=软删除+删除对象（best-effort warn 不回滚，M3 D5 语义）；替换文件=PUT multipart 删旧对象。
- **D9 校验/隔离/分层**：沿用既有全部约定；新错误码 `CATEGORY_NOT_FOUND`、`DOCUMENT_NOT_FOUND`、`CATEGORY_NOT_EMPTY`、`DOCUMENT_TYPE_INVALID`。

## 三、接口契约

- `GET /api/life-folder/categories` → 树（内置+自定义）；`POST` `{name, parentId?}`（自定义，深度≤2）；`DELETE /:id`（仅自定义；非空 422）。
- `GET /api/life-folder/templates` → 内置模板（含 recommended）。
- `GET /api/life-folder/documents?category_id=` → `DocumentDto[]`；`POST /documents`（multipart：file + id/title/categoryId/notes/sensitive/templateId）；`GET|PATCH|DELETE /documents/:id`；`PUT /documents/:id/file`（替换）；`GET /documents/:id/file`（鉴权代理下载）。
- `@chpli2/shared` 新增 `lifefolder.ts`：DTO、LIFE_DOC_MIME（pdf+4 图）、LIFE_DOC_MAX_BYTES=10MB、`isValidLifeDocMime`（嗅探复用 memo 的 sniffer + pdf）。

## 四、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E109 | 分类层级 >2 / 同级重名 / 删除内置分类 / 删除非空分类 | 422 `VALIDATION_ERROR` / `CATEGORY_NOT_EMPTY`；内置 422 |
| E110 | 文件非白名单类型 / 超大 | 422 / 413（分层，M3 E59/E60 同语义） |
| E111 | 移动文件到不存在/他人的分类 | 404 |
| E112 | 未确认即删除（前端） | 前端两步确认；API 不替用户假设（删除即执行） |
| E113 | 跨用户访问分类/文件/下载 | 404（M0 D5） |
| E114 | 关联不存在的模板 | 422（templateId 校验） |

## 五、验收标准

- A107 内置七类可见；自定义分类可建（顶级/子级）、重名/超深被拦；非空分类删除被拦
- A108 上传 PDF → 元数据+对象落库 → 列表/下载正确 → 敏感徽标默认显示；非白名单类型被拒
- A109 移动文件到其他分类（确认后）即时生效；替换文件后旧对象不可达
- A110 推荐区仅显示未补齐的推荐模板；按模板添加并关联 templateId 后该推荐消失
- A111 跨用户隔离；E109–E114 有对应测试；A17/A19 回归通过

## 六、测试覆盖要求

- **集成测试**：分类（E109）、文档上传（E110/E111/E114）、敏感默认、移动/替换/删除、隔离（E113）、内置数据种子存在性。
- **契约测试**：新路由与 DTO 入 OpenAPI，快照更新。
- **组件测试**：分类树渲染、敏感徽标、推荐推导、两步确认。
- **端到端测试**：A107–A111 关键路径（真实 PDF 经 UI 上传）；既有全量回归。

## 七、假设（待确认）

- **H36** 内置分类/模板文案仅中文种子（i18n 在前层渲染内置名称时不翻译；多语言种子另议）。
- **H37** 敏感标记 L1 不引入额外加密（存储已私有；加密-at-rest 另议）。
- **H38** 对话协助 L2 才接网关；L1 无任何 assist UI 入口。

## 八、完成定义（DoD）

迁移可重复执行且种子幂等；E109–E114 有对应测试；A107–A111 通过；契约快照更新；Host 导航三语；`pnpm dev` 一键起 lifefolder remote（端口 3006）；`ROADMAP.md` 更新。
