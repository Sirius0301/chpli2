# CHPLI 系统描述（System Description）

> 本文档用 9 组 Mermaid 图描述 CHPLI 当前（2026-11）已交付功能的架构全景。
> 涵盖：系统上下文、容器架构、部署视图、Module Federation 拓扑、页面路由、后端模块协作、全局 ER、关键状态机、核心时序。
> 阅读顺序建议：上下文 → 容器 → 拓扑 → 路由（前端）→ 模块协作 / ER（后端）→ 状态机 / 时序（关键机制）。

---

## 1. 系统上下文图（C4 Level 1）

CHPLI 是一个个人生活与成长管理系统。最终用户通过浏览器访问（未来可能嵌入 Portal 平台的 WebView）；系统唯一的后端是 NestJS 模块化单体；数据落在 PostgreSQL，文件落在 MinIO；LLM 网关为已设计未接入的可选能力。

```mermaid
flowchart LR
    user(["个人用户<br/>浏览器（桌面/移动）"])

    subgraph ext["外部系统"]
        portal["Portal 平台<br/>（外部宿主，postMessage 集成，待联调）"]
        llm["LLM 网关<br/>（OpenAI 兼容，未接入→503 降级）"]
        smtp["邮件/短信网关<br/>（dev 环境: devCode 日志通道）"]
    end

    subgraph chpli["CHPLI 系统"]
        fe["CHPLI Web<br/>Host + 6 个微前端模块"]
        api["CHPLI API<br/>NestJS 模块化单体"]
    end

    db[("PostgreSQL 16<br/>业务数据")]
    obj[("MinIO<br/>对象存储（文件体）")]

    user -->|"https 访问"| fe
    portal -.->|"iframe 嵌入 + postMessage"| fe
    fe -->|"REST /api（JWT）"| api
    api --> db
    api --> obj
    api -.-> smtp
    api -.->|"chat completions（未配置则降级）"| llm
```

## 2. 容器架构图（C4 Level 2）

7 个可独立启动的前端容器 + 1 个后端容器 + 2 个共享包 + 1 个基础设施层。Host 通过 Module Federation 在**运行时**加载 6 个 Remote；`@chpli2/shared` / `@chpli2/ui` 以 TS 源码方式被所有前端消费（不构建不发布）。

```mermaid
flowchart TB
    subgraph devmachine["开发者机器（pnpm dev，8 个进程）"]
        host["Host :3000<br/>导航/认证/Portal 桥<br/>品牌外壳+每日一句+折叠侧栏"]
        travel["Travel Remote :3001<br/>行程/交通"]
        calendar["Calendar Remote :3002<br/>备忘录化日历"]
        notes["Notes Remote :3003<br/>Markdown 笔记"]
        bookmarks["Bookmarks Remote :3004<br/>书签"]
        growth["Growth Remote :3005<br/>目标/技能/回顾"]
        lifefolder["LifeFolder Remote :3006<br/>人生文件夹"]

        subgraph sharedpkgs["共享包（源码消费）"]
            shared["@chpli2/shared<br/>DTO/校验/错误码/领域纯函数"]
            ui["@chpli2/ui<br/>design tokens + 6 原子组件"]
        end

        api["API :4000<br/>NestJS 模块化单体<br/>Auth/Memo/Notes/Bookmarks/Growth/<br/>LifeFolder/Travel/Calendar(legacy)/Outbox"]
    end

    subgraph infra["基础设施（docker compose）"]
        pg[("PostgreSQL :5432")]
        minio[("MinIO :9000/:9001<br/>memo-images/ note-images/<br/>bookmark-covers/ life-files/{userId}/…")]
    end

    e2e["E2E（Playwright）<br/>独立进程，复用 dev 库+端口"]

    host -.->|"remoteEntry.js 运行时加载"| travel & calendar & notes & bookmarks & growth & lifefolder
    travel & calendar & notes & bookmarks & growth & lifefolder --> api
    host --> api
    api --> pg & minio
    e2e -.-> host
    e2e -.-> api
```

## 3. 部署视图

当前只有本地开发部署（实测形态）；生产为规划目标（单 VPS 全栈部署，对应 Developer-Tutorial 第 8 章）。

```mermaid
flowchart LR
    subgraph prod["规划：生产（单 VPS，待实施）"]
        nginx["Nginx :443<br/>TLS 终结 + 静态资源<br/>/ → host 构建产物"]
        apip["API 进程 :4000<br/>（systemd/pm2，NestJS）"]
        pgp[("PostgreSQL<br/>（本机或托管）")]
        miniop[("MinIO<br/>（本机或对象存储服务）")]
        nginx -->|"/* 静态"| hostdist["host dist<br/>（构建时打包 6 个 remote 的<br/>remoteEntry 静态产物或由 CDN 提供）"]
        nginx -->|"/api 反向代理"| apip
        apip --> pgp & miniop
    end

    subgraph dev["当前：本地开发（实测）"]
        direction TB
        concurrently["pnpm dev<br/>predev 清端口 → concurrently ×8"]
        d1["api(nest watch) :4000"] --- d2["host :3000"] --- d3["travel :3001"] --- d4["calendar :3002"]
        d5["notes :3003"] --- d6["bookmarks :3004"] --- d7["growth :3005"] --- d8["lifefolder :3006"]
        dc["docker compose<br/>chpli2-postgres :5432<br/>chpli2-minio :9000/9001"]
        concurrently --- d1
        d1 --- dc
    end
```

## 4. Module Federation 拓扑图

Host 是唯一的 MF **入口**（react/react-dom 以 singleton+eager 共享）；Remote 的 `index.tsx` 只有异步边界（防 RUNTIME-006）。MF DTS 类型共享为已知噪音（TYPE-001，不影响运行）。

```mermaid
flowchart LR
    subgraph host["host（name: host）"]
        H["./App（eager 入口）<br/>remotes.d.ts 声明 6 个 Remote 类型"]
    end

    subgraph remotes["6 个 Remote（各自暴露 ./App）"]
        R1["travel@:3001<br/>TravelApp(initialTripId?)"]
        R2["calendar@:3002<br/>CalendarApp"]
        R3["notes@:3003<br/>NotesApp（消费 chpli2-pending-open 信箱）"]
        R4["bookmarks@:3004<br/>BookmarksApp（消费信箱）"]
        R5["growth@:3005<br/>GrowthApp（发出跨模块打开/导航）"]
        R6["lifefolder@:3006<br/>LifeFolderApp"]
    end

    H -->|"import('travel/App') 等 6 个 lazy()"| R1 & R2 & R3 & R4 & R5 & R6

    subgraph sharedcfg["shared: singleton 共享"]
        S1["react / react-dom<br/>host: eager:true<br/>remotes: 非 eager"]
    end
    host --- sharedcfg
    remotes --- sharedcfg

    subgraph bridge["跨容器通信（非 MF）"]
        B1["chpli2-navigate / chpli2-open-trip<br/>CustomEvent（window）"]
        B2["chpli2-pending-open<br/>sessionStorage 信箱"]
        B3["chpli2-language-changed<br/>语言广播"]
        B4["Portal postMessage 桥<br/>ready/init/logout/login-request/navigate"]
    end
    R5 --> B2 --> R3 & R4 & R2
    R5 --> B1 --> H
    H <--> B4
```

## 5. 页面路由图

Host **不使用 URL 路由**：视图是 React state（`view` + `tripId`），因此刷新总是回到首页——这是当前的有意取舍（刷新恢复见状态机时序外的 localStorage 偏好）。各 Remote 内部有自己的视图状态。

```mermaid
flowchart TD
    subgraph hostview["Host 视图状态（非 URL）"]
        V0{"auth.user?"} -->|null| A["登录/注册卡<br/>（密码 / 验证码 devCode）"]
        V0 -->|有用户| V1{"view"}
        V1 -->|home| HOME["首页<br/>logo + 每日一句(头部) + 欢迎"]
        V1 -->|travel| TR["Travel remote<br/>TripList ⇄ TripDetail(tripId)"]
        V1 -->|calendar| CA["Calendar remote"]
        V1 -->|notes| NO["Notes remote"]
        V1 -->|bookmarks| BM["Bookmarks remote"]
        V1 -->|growth| GR["Growth remote"]
        V1 -->|lifefolder| LF["LifeFolder remote"]
    end

    subgraph calview["Calendar 内部"]
        C1{"视图（周默认）"} --> C2["月视图<br/>农历(zh)/节气/今日格/更多"]
        C1 --> C3["周视图<br/>7 列×24h 区带"]
        C1 --> C4["日视图"]
        C2 & C3 & C4 --> C5["DetailPanel<br/>create / edit + 图片 + 标签"]
        C0["筛选侧栏<br/>标签AND + 优先级OR"] --> C1
    end

    subgraph otherviews["其他 Remote 内部"]
        N1["Notes<br/>列表+筛选+搜索 ⇄ 编辑器<br/>(预览/反链/历史/图片)"]
        B1V["Bookmarks<br/>卡片/列表 × 4 种排序<br/>编辑器抽屉 + 不活跃区"]
        G1["Growth<br/>目标列表+tabs(目标/技能/回顾)<br/>⇄ 目标详情/技能卡/回顾卡"]
        L1["LifeFolder<br/>分类树 ⇄ 文件列表<br/>推荐区/上传弹窗/移动"]
    end

    HOME -.->|chpli2-navigate| TR & CA & NO & BM & GR & LF
    GR -.->|"chpli2-pending-open"| NO & BM & CA
```

## 6. 后端模块协作图

模块化单体：一个进程、一个数据库，按模块隔离。协作纪律：**跨模块只经对方模块公开的 Service 或领域事件（Outbox），绝不直改对方数据表**。

```mermaid
flowchart TB
    subgraph api["NestJS 模块化单体（:4000）"]
        direction TB
        auth["AuthModule<br/>注册/密码/验证码/令牌"]
        memo["MemoModule<br/>memos / completions / images"]
        notes["NotesModule<br/>notes / versions / images"]
        bm["BookmarksModule<br/>bookmarks / click / cover"]
        growth["GrowthModule<br/>goals+milestones / skills / reviews / growth_links"]
        lf["LifeFolderModule<br/>categories / templates / documents"]
        travel["TravelModule<br/>trips / transports / geo(参考数据)"]
        legacy["CalendarModule(legacy)<br/>events/calendars/holidays<br/>（UI 已退役，待 F4 决策）"]
        outbox["OutboxModule<br/>领域事件投递"]
        shared["SharedModule（Global）<br/>PrismaService / ObjectStorageService<br/>ValidatedBody / 错误码"]

        growth -->|"显式 import Service 做归属校验+标题解析<br/>（NotesService / BookmarksService / MemoService）"| notes & bm & memo
        growth -->|"scheduleNextMemo → MemoService.create"| memo
        travel -->|"syncToCalendar → Outbox 事件"| outbox
        outbox -->|"投影写 CalendarEvent（syncKey 幂等）"| legacy
        auth & memo & notes & bm & growth & lf & travel & legacy & outbox --> shared
    end

    pg[("PostgreSQL<br/>每模块只拥有本模块的表")]
    minio[("MinIO")]
    shared --> pg
    memo & notes & bm & lf --> minio
```

## 7. 全局 ER 图

28 张表。文件类实体（memo_images / note_images / bookmarks.cover / lf_documents）**只存元数据+存储键**，文件体在 MinIO（图中以虚线示意）。`growth_links` 为多态关联（ownerType × module），无外键；`reviews.nextMemoId → memos` 为软关联（悬挂自愈）。

```mermaid
erDiagram
    users ||--o{ trips : owns
    users ||--o{ calendars : owns
    users ||--o{ memos : owns
    users ||--o{ notes : owns
    users ||--o{ bookmarks : owns
    users ||--o{ goals : owns
    users ||--o{ skills : owns
    users ||--o{ reviews : owns
    users ||--o{ lf_categories : owns
    users ||--o{ lf_documents : owns
    users ||--o{ login_codes : "verify"

    calendars ||--o{ events : has
    events ||--o{ reminders : has
    trips ||--o{ transports : has

    Country ||--o{ City : has
    City ||--o{ Location : has

    memos ||--o{ memo_completions : "@@unique(memoId,date)"
    memos ||--o{ memo_images : has
    notes ||--o{ note_versions : "每保存一版"
    notes ||--o{ note_images : has
    goals ||--o{ milestones : has
    goals ||--o{ skills : "optional goalId"
    goals ||--o{ reviews : "optional goalId"
    lf_categories ||--o{ lf_documents : has

    users {
        text id PK
        text username "unique"
        text email "unique, nullable"
        text phone "unique, nullable"
        text password_hash "nullable(验证码登录)"
    }
    memos {
        text id PK "客户端生成"
        text user_id FK
        date date "纯日期,无时区"
        text priority "none|low|medium|high"
        text repeat "none + 9 种规则"
        date repeat_end "nullable, 含当天"
        text[] tags "<=10 个"
    }
    memo_completions {
        text memo_id FK
        date date
    }
    notes {
        text id PK "客户端生成"
        text body "<=100KB"
    }
    note_versions {
        text note_id FK
        int seq "每篇保留最近50版"
    }
    bookmarks {
        text id PK
        text domain "从 url 归一化"
        int click_count
        timestamp last_clicked_at "inactive>=30天"
    }
    goals {
        text id PK
        text status "active|paused|achieved|archived"
        int progress "派生: done/total"
    }
    skills {
        text name "每用户 unique"
        int level "0..5"
    }
    reviews {
        text id PK
        date reviewed_at
        text next_memo_id "软关联 memos, 悬挂自愈"
    }
    growth_links {
        text owner_type "goal|skill|review"
        text module "notes|bookmarks|memos"
        text ref_id "多态, 无 FK"
    }
    lf_documents {
        text id PK "客户端生成"
        text storage_key "→ MinIO"
        bool sensitive "默认 true"
    }
    lf_categories_extra["lf_categories.parentId → 自身(树深≤2, 无 FK 查询约束)"]
    transports {
        text trip_id FK
        text mode "FLIGHT|TRAIN|BUS|…"
        text origin_level "COUNTRY|CITY|LOCATION"
        bool sync_to_calendar
    }
    OutboxEvent {
        text type "领域事件"
        text payload "JSON"
        timestamp processed_at "nullable"
    }

    minio_object {
        text key PK "bucket/userId/id.ext"
    }
    memos }o--o{ growth_links : "逻辑关联(module=memos, 无FK)"
    notes }o--o{ growth_links : "逻辑关联(module=notes, 无FK)"
    bookmarks }o--o{ growth_links : "逻辑关联(module=bookmarks, 无FK)"
    lf_documents }o--|| minio_object : "storage_key"
    memo_images }o--|| minio_object : "storage_key"
    note_images }o--|| minio_object : "storage_key"
```

## 8. 关键状态机图

### 8.1 目标状态（手动流转，里程碑全完成**不**自动改状态）

```mermaid
stateDiagram-v2
    [*] --> active : 创建即 active
    active --> paused : 手动暂停
    paused --> active : 恢复
    active --> achieved : 手动标记达成
    paused --> achieved : 手动标记达成
    achieved --> active : 重新打开
    active --> archived : 归档
    paused --> archived : 归档
    archived --> active : 取消归档
    note right of achieved
        里程碑全完成仅推进进度条
        状态转换一律人工（决策底线）
    end note
```

### 8.2 交通段日历同步（syncKey 幂等投影）

```mermaid
stateDiagram-v2
    [*] --> UNSYNCED : 创建交通段\nsyncToCalendar=false 停留于此
    UNSYNCED --> SYNCED : syncToCalendar=true\n→ Outbox 事件 → CalendarEvent(syncKey)
    SYNCED --> SYNCED : 编辑交通段\n同 syncKey 覆盖更新（幂等）
    SYNCED --> PENDING_DELETE : 删除交通段\n事件标记待删
    PENDING_DELETE --> [*] : 投影删除 CalendarEvent
    note right of SYNCED
        写入 legacy events API
        日历 Memo UI 不可见（F4 待决策）
    end note
```

### 8.3 回顾的下次安排（幂等 + 悬挂自愈）

```mermaid
stateDiagram-v2
    [*] --> UNPLANNED : 创建回顾
    UNPLANNED --> PLANNED : scheduleNextMemo(date)\n→ 先落 nextMemoId 再 MemoService.create
    PLANNED --> PLANNED : 重复调用直接返回既有\n(不产生第二个 Memo)
    PLANNED --> REPLANNED : 关联 Memo 被删(悬挂)
    REPLANNED : 重新安排 → 换新 memoId
    REPLANNED --> PLANNED
```

### 8.4 书签活跃性（派生态，非存储状态）

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : 创建/点击复活\nCOALESCE(lastClickedAt, createdAt) < 30天
    ACTIVE --> INACTIVE : ≥30 天未点击\n(服务端计算, 前端灰色折叠区)
    INACTIVE --> ACTIVE : 点击 → click+1
    note right of INACTIVE
        lastClickedAt=now 复活
        整 30 天也算 inactive(含边界)
    end note
```

## 9. 核心时序图

### 9.1 创建备忘录（客户端幂等 + 乐观锁）

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant C as Calendar Remote
    participant A as API · MemoModule
    participant D as PostgreSQL

    U->>C: 点击空白日期格 → 创建面板
    C->>C: crypto.randomUUID() 作为 memo id
    C->>A: POST /api/memos {id, title, date, priority, repeat, tags…}
    A->>A: ValidatedBody 校验(400) + 服务层领域校验(422)
    A->>D: INSERT … ON CONFLICT(id) 幂等
    D-->>A: MemoDto
    A-->>C: 201（重试同 id → 返回既有记录）
    C->>C: 视图即时刷新 + 到期卡片/角标联动
```

### 9.2 Travel → 日历同步（Outbox 投影，syncKey 幂等）

```mermaid
sequenceDiagram
    autonumber
    participant T as Travel Remote
    participant A as API · TravelModule
    participant O as Outbox
    participant P as 投影(CalendarModule)
    participant D as PostgreSQL

    T->>A: POST /trips/:id/transports {syncToCalendar:true, …}
    A->>A: 校验同级连接(E43 拒绝跨级/同端点)
    A->>D: 写入 Transport(同事务)
    A->>O: 投递 TransportCreated 领域事件
    A-->>T: 201 TransportDto
    O->>P: 消费事件(异步/恢复均可重放)
    P->>P: 按 syncKey 计算 CalendarEvent upsert
    P->>D: 写 CalendarEvent(legacy, syncKey UNIQUE)
    Note over T,P: 此后编辑→同 syncKey 覆盖；删除→PENDING_DELETE→删事件
```

### 9.3 Portal 模式登录握手（trust but verify）

```mermaid
sequenceDiagram
    autonumber
    participant P as Portal(父帧)
    participant H as Host App
    participant A as API · AuthModule

    P->>H: chpli2:portal:init {token} (origin 白名单校验)
    H->>H: 先写 localStorage, 不盲信
    H->>A: GET /api/auth/me (Bearer token)
    alt 令牌有效
        A-->>H: UserDto
        H->>H: 进入应用(永不渲染本地登录卡)
    else 令牌无效
        A-->>H: 401
        H->>P: chpli2:portal:login-request
        H->>H: 「等待 Portal 登录」占位
    end
    H->>P: chpli2:portal:ready (握手, 500ms 超时回退独立模式)
    Note over P,H: 登出双向: 用户在 CHPLI 登出→notifyLogout;\nPortal 终止会话→logout 信号→清本地态
```

### 9.4 成长模块跨模块打开链接（信箱 + 导航事件）

```mermaid
sequenceDiagram
    autonumber
    participant G as Growth Remote
    participant W as window/sessionStorage
    participant H as Host
    participant N as Notes Remote(懒加载)

    G->>W: sessionStorage[chpli2-pending-open] = {module:'notes', id}
    G->>W: dispatch chpli2-navigate {view:'notes'}
    W->>H: chpli2-navigate 事件
    H->>H: setView('notes') → lazy import('notes/App')
    H->>N: 挂载 NotesApp
    N->>W: 读取并清除信箱
    N->>N: 选中该笔记并打开编辑器
    Note over G,N: 规避 MF 懒加载时序——信箱由目标 remote 挂载时消费（同机制用于 bookmarks/calendar）
```

---

*本文档随交付迭代更新；新增模块/表/协议时同步补充对应图示。*
