# Thread ID 设计说明

## 为什么有两个 Thread ID？

threads 表中有两个不同的 ID 字段：

### 1. `id` (UUID) - 数据库主键
- **类型**: `uuid`
- **用途**: Supabase 数据库的主键
- **创建者**: 后端 (`supabase_db.py:413`)
- **创建时机**: 当用户发送第一条消息时，后端创建数据库记录
- **作用范围**: 仅在数据库内部使用

```python
# backend/src/storage/supabase_db.py:413
thread_id = str(uuid.uuid4())  # 后端生成的数据库 ID

thread_data = {
    "id": thread_id,  # ← 数据库主键
    "user_id": user_id,
    "title": title,
    "langgraph_thread_id": langgraph_thread_id,  # ← LangGraph ID
}
```

### 2. `langgraph_thread_id` (TEXT) - LangGraph 会话 ID
- **类型**: `text` (虽然实际上是 UUID 字符串)
- **用途**: LangGraph SDK 的 thread_id，用于管理对话状态
- **创建者**: 前端 LangGraph SDK
- **创建时机**: 用户开始新对话时，LangGraph SDK 自动生成
- **作用范围**:
  - LangGraph 管理对话状态
  - 前端 URL 参数 `?threadId=xxx`
  - API 路由参数
  - 文件上传关联

```typescript
// frontend/src/app/hooks/useChat.ts:39
const [threadId, setThreadId] = useQueryState("threadId");
// threadId 由 LangGraph SDK 自动生成，是 UUID 格式

// frontend/src/app/hooks/useChat.ts:65
body: JSON.stringify({
  langgraph_thread_id: threadId,  // ← 传给后端
  title: "New Task",
})
```

## 工作流程

```
前端 (LangGraph SDK)
   ↓
   生成 langgraph_thread_id (UUID)
   ↓
   用户发送第一条消息
   ↓
后端 (/api/threads POST)
   ↓
   生成新的数据库 id (UUID)
   ↓
   创建 threads 记录:
   {
     id: "db-uuid-1234...",           ← 数据库主键
     langgraph_thread_id: "lg-uuid-5678...",  ← LangGraph ID
     user_id: "user-uuid-...",
     title: "New Task"
   }
```

## 为什么要两个 ID？

### 原因 1: 职责分离

**LangGraph Thread ID (`langgraph_thread_id`)**:
- LangGraph 框架的核心概念
- 管理对话状态、历史消息、checkpoints
- 在 LangGraph Cloud/Server 中是唯一标识符
- 前端和 LangGraph API 都使用这个 ID

**数据库 ID (`id`)**:
- Supabase/PostgreSQL 的表主键
- 用于数据库关系（外键引用）
- 符合数据库设计最佳实践

### 原因 2: 系统解耦

如果只使用一个 ID：
- ❌ 数据库设计会依赖于 LangGraph 的 ID 生成策略
- ❌ 无法独立修改 LangGraph 配置
- ❌ 如果将来更换 AI 框架，需要重构整个数据库

使用两个 ID：
- ✅ LangGraph 可以独立管理对话状态
- ✅ 数据库可以独立管理数据关系
- ✅ 两个系统松耦合，便于维护

### 原因 3: 外键引用的需求

在数据库设计中，其他表需要引用 threads：

```sql
-- thread_files 表引用的是数据库 id，不是 langgraph_thread_id
CREATE TABLE thread_files (
    id UUID PRIMARY KEY,
    thread_id UUID REFERENCES threads(id),  -- ← 引用数据库 ID
    file_id UUID REFERENCES files(id),
    ...
);

-- 外键约束需要引用主键
-- 而 langgraph_thread_id 不是主键
```

如果使用 `langgraph_thread_id` 作为主键：
- 需要将 `langgraph_thread_id` 改为 UUID 类型（但这会失去灵活性）
- 所有外键引用都要使用 LangGraph 生成的 ID
- 数据库设计会过度依赖外部系统

## 前端显示哪个 ID？

**前端显示和使用的是 `langgraph_thread_id`**:

```typescript
// frontend/src/app/hooks/useThreads.ts:122
return {
  id: thread.thread_id,  // ← 这是 langgraph_thread_id
  updatedAt: new Date(thread.updated_at),
  status: thread.status,
  title,
  description,
  assistantId,
};
```

因为：
1. ✅ 前端与 LangGraph SDK 交互，需要使用 LangGraph 的 thread_id
2. ✅ URL 参数 `?threadId=xxx` 是 langgraph_thread_id
3. ✅ 文件上传、消息查询都使用 langgraph_thread_id

## API 路由设计

所有面向前端的 API 都使用 `langgraph_thread_id`:

```python
# backend/src/api/webapp.py

# ✅ 使用 langgraph_thread_id
@app.get("/api/threads/{langgraph_thread_id}/files")
async def get_thread_files(langgraph_thread_id: str, ...):
    # 内部会查询数据库 id
    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    db_thread_id = thread_record["id"]  # ← 获取数据库 ID
    # 然后使用数据库 ID 查询关联数据
    ...

# ❌ 不直接暴露数据库 id
@app.get("/api/threads/{database_id}/files")  # 这样不好
```

## 数据库查询示例

```python
# 1. 前端传来 langgraph_thread_id
langgraph_thread_id = "550e8400-e29b-41d4-a716-446655440000"

# 2. 后端先查询 threads 表获取数据库 id
thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
# thread_record = {
#   "id": "123e4567-e89b-12d3-a456-426614174000",  ← 数据库 ID
#   "langgraph_thread_id": "550e8400-e29b-41d4-a716-446655440000",
#   "user_id": "...",
#   "title": "My Task"
# }

# 3. 使用数据库 id 查询关联表
db_thread_id = thread_record["id"]
files = await supabase.table("thread_files")\
    .select("*")\
    .eq("thread_id", db_thread_id)\  # ← 使用数据库 ID
    .execute()
```

## 总结

| 特性 | `id` (数据库主键) | `langgraph_thread_id` |
|------|------------------|----------------------|
| 类型 | UUID | TEXT (UUID 字符串) |
| 创建者 | 后端 | LangGraph SDK (前端) |
| 主要用途 | 数据库关系、外键 | LangGraph 对话状态 |
| 前端可见 | ❌ 否 | ✅ 是 |
| URL 参数 | ❌ 否 | ✅ 是 |
| API 路由 | ❌ 否 | ✅ 是 |
| 外键引用 | ✅ 是 | ❌ 否 |

**设计理念**:
- 前端和 LangGraph 使用 `langgraph_thread_id`
- 数据库内部使用 `id` 管理关系
- 两个系统松耦合，各司其职

这是一个经典的 **关注点分离 (Separation of Concerns)** 设计模式。
