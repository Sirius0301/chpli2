# CHPLI 日历备忘录（M3）切片任务书

> 范围：Memo 图片上传（MinIO 对象存储）+ DetailPanel 响应式（桌面侧栏 / 移动抽屉 / 小屏底部弹层）。
> 不在本切片：图片在月视图格内/列表内的直接展示、图片排序、相册多选上传优化、Portal 集成（M5）。
> 依据：ROADMAP M3；AGENTS.md「文件进入对象存储，数据库只保存元数据和存储键」。
> 前置：M1、M2 已交付（2026-11-12）。

---

## 一、切片目标

用户在 Memo 详情中上传图片（jpeg/png/webp/gif，单张 ≤5MB），图片文件存入 MinIO 对象存储，数据库只保存元数据与存储键；三视图与筛选不受影响。DetailPanel 在窄屏下不再是固定右侧栏，而是抽屉（≤900px）与底部弹层（≤600px），带遮罩可关闭。

## 二、数据模型

### 2.1 memo_images（迁移 `memo_m3_images`）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 客户端生成（multipart 表单字段），幂等创建锚点 |
| memo_id | uuid FK → memos | 级联删除 |
| storage_key | varchar(512) unique | 对象存储键：`memo-images/{userId}/{memoId}/{id}.{ext}` |
| file_name | varchar(256) | 原始文件名（展示用） |
| mime_type | varchar(64) | image/jpeg 等 |
| size_bytes | int | 文件大小 |
| created_at | timestamp | |

约束：DB 不存图片内容；`storage_key` 全局唯一。Memo 软删除时图片行级联（FK 物理级联，对象由删除流程清理）。

### 2.2 对象存储

- MinIO 本地 docker-compose 形态（D1），bucket `chpli2-memo-images`，服务启动时自动创建（幂等）。
- 环境变量：`S3_ENDPOINT`（默认 http://localhost:9000）、`S3_ACCESS_KEY`（默认 chpli2）、`S3_SECRET_KEY`（默认 chpli2-secret-key）、`S3_BUCKET`（默认 chpli2-memo-images）；`.env.example` 同步占位。缺失默认值仅用于本地开发。

## 三、接口契约（相对 M2 的增量）

- `GET /api/memos/{id}/images` → `MemoImageDto[]`（`{ id, memoId, fileName, mimeType, sizeBytes, createdAt }`，按 createdAt 升序）。跨用户 404。
- `POST /api/memos/{id}/images`：multipart/form-data，字段 `file`（单文件）+ `id`（客户端 uuid）。校验：mime ∈ {image/jpeg, image/png, image/webp, image/gif}、≤5MB（DTO/存储层双重校验），否则 422；memo 不属于当前用户 404。幂等：同 `id` 重复提交返回已有记录，不重复上传（E58）。
- `DELETE /api/memos/{id}/images/{imageId}` → 204：删除元数据并移除对象；对象移除失败不回滚（元数据已删即视为成功，残留对象由运维清理，记 warn 日志）。
- `GET /api/memos/images/{imageId}/file`：经鉴权的文件下载（后端从 MinIO 流式回源，带 Content-Type/Content-Length）；跨用户 404。前端 `<img>` 经 fetch+blob 加载（复用令牌请求封装）。
- MemoDto 不内嵌图片列表（图片按需拉取，避免列表膨胀）。

## 四、核心决策

记录（2026-11-12）：

- **D1 MinIO 部署形态**：本地 docker-compose（与 postgres 同文件 `infra/docker-compose.yml`），命名卷持久化。**实施修正（2026-11-12）**：本机 docker 镜像源白名单拒绝 `minio/minio`（多个公共镜像源均 denied），改用 `bitnamilegacy/minio`（Bitnami legacy 打包的同一 MinIO 服务端，API 语义一致，`MINIO_DEFAULT_BUCKETS` 自动建桶）；bucket `chpli2-memo-images`。远端 S3 兼容服务后续以环境变量切换（minio 客户端天然 S3 兼容），本切片不做。
- **D2 存储键结构**：`memo-images/{userId}/{memoId}/{imageId}.{ext}`——用户隔离目录前缀，便于按用户/备忘录批量清理与生命周期策略。
- **D3 下载走鉴权代理**：不做预签名 URL（避免 URL 绕过 AuthGuard 的语义模糊）；后端 `GET .../file` 流式回源，前端 blob 化后展示。个人系统规模下回源开销可接受。
- **D4 幂等创建**：客户端生成图片 id 随表单提交（沿用 E11/E47 模式）；重复提交返回原记录。
- **D5 对象清理语义**：删除=先删元数据（事务）再删对象；对象删除失败不回滚、不报错给客户端（warn 日志），避免对象存储抖动导致用户无法完成删除。
- **D6 DetailPanel 响应式断点**：≥901px 固定右栏（现状）；601–900px 右侧抽屉（overlay，带遮罩）；≤600px 底部弹层（占屏高 70%，圆角上沿）。遮罩点击/×/Esc 关闭。CSS media query 实现，无 JS 断点逻辑。
- **D7 上传限制**：mime 白名单 4 类、单张 ≤5MB、一次表单一张（多选由前端循环逐个提交）；缩略图由浏览器自然缩放（服务端不生成缩略图）。

## 五、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E58 | 网络重试/双击导致同 id 重复上传 | 幂等返回原图片记录，对象不重复 |
| E59 | 非图片 mime 或伪装扩展名 | 422 `VALIDATION_ERROR`（按 magic bytes 嗅探，不信任文件名） |
| E60 | 单张 >5MB | multer 限制层 413（PayloadTooLarge）；服务层大小校验 422 `VALIDATION_ERROR`（双重拦截） |
| E61 | 对他人 Memo 上传/列图/删图/下载文件 | 404（M0 D5） |
| E62 | MinIO 不可用 | 上传/下载 503 `STORAGE_UNAVAILABLE`（启动连接失败不阻断 API 启动） |
| E63 | 删除图片时对象移除失败 | 元数据删除成功，接口仍 204，服务器 warn 日志（D5） |
| E64 | 窄屏打开 DetailPanel | 抽屉/底部弹层呈现，遮罩可关闭，表单可用 |

## 六、前端交互

- DetailPanel（编辑模式）新增「图片」区：缩略图网格（blob URL）、每张悬停删除（×，二次确认）、底部「添加图片」按钮（file input，accept=白名单，多选循环上传）；上传中禁用并显示进度状态（简单 spinner）；失败行内错误。
- 创建模式下图片区提示保存后可用（与 M1 的提醒一致；保存后自动进入编辑态）。
- 响应式（D6）：抽屉/底部弹层带遮罩；面板内表单布局在小屏单列。
- 三语文案同步。

## 七、验收标准

- A54 编辑态上传 2 张图片 → 缩略图即时显示 → 刷新后仍在 → 删除一张后刷新不再出现
- A55 E58 幂等（重复提交同一 id 不产生重复记录）；E59/E60 被拦截
- A56 用户 B 无法列出/下载/删除用户 A 的图片（E61，404）
- A57 MinIO 停止时上传返回 503 `STORAGE_UNAVAILABLE`（E62），其余 API 正常
- A58 窄屏（≤900px / ≤600px）DetailPanel 为抽屉/底部弹层，遮罩点击关闭（E64）
- A41–A53 回归通过

## 八、测试覆盖要求

- **单元测试**：存储键派生、mime 嗅探（magic bytes 表）、扩展名白名单映射。
- **集成测试**：上传（happy/幂等/坏 mime/超大/他人 404）、列表、删除（含对象移除）、文件下载（内容一致）、E62（连不上的 endpoint → 503）。
- **契约测试**：OpenAPI 新增三条图片路由与 MemoImageDto；快照更新。
- **端到端测试**：UI 上传真实小 png → 缩略图出现 → 刷新保留 → 删除；窄屏视口断言抽屉/底部弹层类名。Docker 不可用时如实说明未运行。

## 九、假设（待确认）

- **H11** 图片仅在 DetailPanel 展示；月/周视图格内不显示图片标记（M4 通知角标时再统一考虑格内标记）。
- **H12** 单 Memo 图片数量不设上限（个人场景）；对象存储容量由部署侧治理。
- **H13** 不生成服务端缩略图/不压缩；原图存储（D7）。
- **H14** e2e 环境默认 MinIO 可用（docker-compose 已含）；CI 中若无 docker 则图片用例跳过并注明。

## 十、完成定义（DoD）

迁移可重复执行；E58–E64 有对应测试；A54–A58 与 A41–A53 通过；契约快照更新；`.env.example` 更新；`ROADMAP.md` 更新 M3 状态；docker-compose 变更可直接 `docker compose up -d` 使用。
