# Thread ID 架构图

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Frontend)                      │
│                                                              │
│  LangGraph SDK 自动生成:                                     │
│  langgraph_thread_id = "550e8400-e29b-41d4-a716-446655440000"│
│                                                              │
│  URL: /chat?threadId=550e8400-e29b-41d4-a716-446655440000   │
│                                    │                         │
└────────────────────────────────────┼─────────────────────────┘
                                     │
                                     │ POST /api/threads
                                     │ { langgraph_thread_id: "550e8400..." }
                                     │
                                     ↓
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Backend)                          │
│                                                              │
│  1. 接收 langgraph_thread_id                                │
│  2. 生成新的数据库 id = uuid.uuid4()                        │
│     db_id = "123e4567-e89b-12d3-a456-426614174000"          │
│  3. 插入数据库:                                             │
│     {                                                       │
│       id: "123e4567...",              ← 数据库主键          │
│       langgraph_thread_id: "550e8400...",  ← LangGraph ID  │
│       user_id: "...",                                       │
│       title: "New Task"                                     │
│     }                                                       │
│                                    │                         │
└────────────────────────────────────┼─────────────────────────┘
                                     │
                                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据库 (Supabase DB)                       │
│                                                              │
│  ┌──────────────────── threads ────────────────────┐       │
│  │ id (PK)              │ langgraph_thread_id       │       │
│  ├──────────────────────┼───────────────────────────┤       │
│  │ 123e4567-...-174000  │ 550e8400-...-440000       │       │
│  │ aaaabbbb-...-111222  │ ccccdddd-...-333444       │       │
│  └──────────────────────┴───────────────────────────┘       │
│           │                                                 │
│           │ (外键引用使用 id)                               │
│           ↓                                                 │
│  ┌──────────────────── thread_files ──────────────┐        │
│  │ id (PK) │ thread_id (FK) │ file_id (FK)        │        │
│  ├─────────┼────────────────┼─────────────────────┤        │
│  │ xxx-... │ 123e4567-...   │ fff-...             │        │
│  │ yyy-... │ 123e4567-...   │ ggg-...             │        │
│  └─────────┴────────────────┴─────────────────────┘        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 文件上传流程

```
┌─────────────────────────────────────────────────────────────┐
│                        用户上传文件                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  前端: POST /files/upload                                    │
│  FormData:                                                   │
│    - file: <binary>                                          │
│    - langgraph_thread_id: "550e8400..."  ← URL 参数         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  后端处理:                                                   │
│                                                              │
│  1. 查询 threads 表:                                         │
│     WHERE langgraph_thread_id = "550e8400..."               │
│     获取 → thread_record.id = "123e4567..."                 │
│                                                              │
│  2. 保存文件到 Storage                                       │
│                                                              │
│  3. 创建 files 记录:                                         │
│     file_id = "fff-..."                                     │
│                                                              │
│  4. 创建 thread_files 关联:                                 │
│     {                                                       │
│       thread_id: "123e4567...",  ← 使用数据库 ID!          │
│       file_id: "fff-..."                                    │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

## API 查询流程

```
前端请求:
GET /api/threads/{langgraph_thread_id}/files
GET /api/threads/550e8400-e29b-41d4-a716-446655440000/files
                           │
                           ↓
后端处理:
┌─────────────────────────────────────────────────────────────┐
│  Step 1: 通过 langgraph_thread_id 查找数据库 id             │
│                                                              │
│  SELECT * FROM threads                                       │
│  WHERE langgraph_thread_id = '550e8400...'                  │
│  → thread_record = { id: "123e4567...", ... }               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: 使用数据库 id 查询关联文件                          │
│                                                              │
│  SELECT tf.*, f.*                                            │
│  FROM thread_files tf                                        │
│  JOIN files f ON tf.file_id = f.id                          │
│  WHERE tf.thread_id = '123e4567...'  ← 使用数据库 ID        │
│  → [{ file_id: "fff-...", filename: "data.csv", ... }]      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
                    返回文件列表给前端
```

## 两个 ID 的对比

```
┌────────────────────┬──────────────────┬─────────────────────┐
│      特性          │  id (数据库主键)  │ langgraph_thread_id │
├────────────────────┼──────────────────┼─────────────────────┤
│  生成位置          │  后端            │  前端 (LangGraph)   │
│  生成时机          │  创建记录时      │  开始对话时         │
│  类型              │  UUID            │  TEXT (UUID 字符串) │
│  是否为主键        │  ✅ 是           │  ❌ 否              │
│  前端可见          │  ❌ 否           │  ✅ 是              │
│  URL 参数          │  ❌ 否           │  ✅ 是              │
│  API 路由参数      │  ❌ 否           │  ✅ 是              │
│  外键引用          │  ✅ 是           │  ❌ 否              │
│  LangGraph 使用    │  ❌ 否           │  ✅ 是              │
│  数据库关系        │  ✅ 是           │  ❌ 否              │
└────────────────────┴──────────────────┴─────────────────────┘
```

## 为什么不能只用一个 ID？

### 选项 1: 只用 langgraph_thread_id 作为主键 ❌

```sql
-- 问题设计
CREATE TABLE threads (
    langgraph_thread_id TEXT PRIMARY KEY,  -- 用 LangGraph ID 作主键
    user_id UUID,
    title TEXT
);

CREATE TABLE thread_files (
    thread_id TEXT REFERENCES threads(langgraph_thread_id),
    file_id UUID
);
```

**问题**:
- ❌ 数据库设计依赖外部系统 (LangGraph)
- ❌ 如果 LangGraph 改变 ID 格式，数据库需要重构
- ❌ TEXT 类型作为主键和外键，性能不如 UUID
- ❌ 无法独立于 LangGraph 测试数据库

### 选项 2: 只用数据库 id，不存储 langgraph_thread_id ❌

```sql
-- 问题设计
CREATE TABLE threads (
    id UUID PRIMARY KEY,
    user_id UUID,
    title TEXT
    -- 没有 langgraph_thread_id 列
);
```

**问题**:
- ❌ 前端需要管理两个 ID 的映射
- ❌ 每次请求都需要额外查询来获取 LangGraph ID
- ❌ 无法通过 URL 参数直接访问线程
- ❌ LangGraph 和数据库记录难以关联

### 选项 3: 当前设计 (两个 ID) ✅

```sql
-- 正确设计
CREATE TABLE threads (
    id UUID PRIMARY KEY,                    -- 数据库关系
    langgraph_thread_id TEXT,               -- LangGraph 集成
    user_id UUID,
    title TEXT
);

CREATE INDEX idx_threads_langgraph_id ON threads(langgraph_thread_id);
```

**优势**:
- ✅ 职责分离：LangGraph 管理对话，数据库管理关系
- ✅ 系统解耦：两个系统可以独立演进
- ✅ 性能优化：UUID 主键快速，TEXT 索引查询也快
- ✅ 前端友好：URL 使用 LangGraph ID，简单直观
- ✅ 数据完整性：数据库 ID 作外键，保证引用完整性

## 关键点总结

1. **前端眼中只有一个 ID**: `langgraph_thread_id`
   - URL: `?threadId=550e8400...`
   - API: `/api/threads/550e8400.../files`
   - 用户完全不感知数据库 ID

2. **后端负责转换**:
   - 接收 `langgraph_thread_id`
   - 查询获取数据库 `id`
   - 使用数据库 `id` 进行关联查询

3. **数据库只知道关系**:
   - 主键: `id`
   - 外键: 引用 `id`
   - `langgraph_thread_id` 只是一个普通字段

这种设计是 **接口隔离原则** 和 **单一职责原则** 的体现。
