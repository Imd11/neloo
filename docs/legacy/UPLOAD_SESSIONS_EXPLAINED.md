# upload_sessions 表详解

## 核心用途：两阶段上传（Two-Phase Upload）

`upload_sessions` 表是一个 **暂存区（Staging Area）**，用于实现文件上传与对话（thread）的解耦。

## 为什么需要这个表？

### 问题场景

在传统的文件上传中，可能会遇到以下问题：

1. **用户还没发送消息，先上传了文件**
   - 此时还没有 thread_id（对话 ID）
   - 文件上传到哪里？如何跟踪？

2. **用户上传文件后改变主意，没有发送消息**
   - 文件已经上传到 Storage
   - 如何清理这些"孤立"的文件？

3. **用户上传多个文件，但只想用其中几个**
   - 如何管理已上传但未使用的文件？

### 解决方案：两阶段上传

```
阶段 1 (Upload)    → upload_sessions 表 (暂存)
   ↓
用户发送消息，创建 thread
   ↓
阶段 2 (Commit)    → files 表 + thread_files 表 (永久存储)
```

## 完整工作流程

### 阶段 1: 上传（Upload）- 文件进入暂存区

```
1. 用户在前端选择文件（还没发送消息）
   ↓
2. 前端立即上传文件
   POST /files/upload
   - 文件上传到 Supabase Storage
   - 创建 upload_sessions 记录
   ↓
3. upload_sessions 记录创建：
   {
     id: "file-uuid-123",
     user_id: "user-uuid-456",
     filename: "data.csv",
     expected_size: 1024000,
     actual_size: 1024000,
     storage_path: "user-uuid-456/20251229_xxx.csv",
     status: "uploaded",      ← 文件已上传
     committed: false,        ← 但未关联到 thread
     thread_id: null,         ← 还没有 thread
     expires_at: "2025-12-29T15:00:00Z"  ← 1小时后过期
   }
   ↓
4. 前端显示文件为 "已上传，等待发送"
```

### 阶段 2: 提交（Commit）- 关联到对话

```
1. 用户输入消息并点击"发送"
   ↓
2. 前端创建/获取 thread_id
   const newThreadId = "thread-uuid-789"
   ↓
3. 前端调用 commitFiles(threadId)
   POST /uploads/commit
   {
     file_ids: ["file-uuid-123"],
     thread_id: "thread-uuid-789"
   }
   ↓
4. 后端处理：
   a) 更新 upload_sessions:
      {
        committed: true,
        thread_id: "thread-uuid-789",
        status: "committed"
      }

   b) 创建 files 记录:
      {
        id: "file-db-uuid-999",
        user_id: "user-uuid-456",
        filename: "data.csv",
        storage_path: "user-uuid-456/20251229_xxx.csv",
        ...
      }

   c) 创建 thread_files 关联:
      {
        thread_id: "db-thread-uuid-888",  # threads 表的 id
        file_id: "file-db-uuid-999"
      }
   ↓
5. 文件永久关联到对话
```

## 数据表对比

### upload_sessions（暂存区）

```sql
-- 临时存储，等待提交
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    filename TEXT,
    storage_path TEXT,
    status TEXT DEFAULT 'pending',  -- pending/uploaded/committed/error
    committed BOOLEAN DEFAULT FALSE, -- 是否已提交
    thread_id UUID,                  -- 关联的 thread（提交后才有）
    expires_at TIMESTAMPTZ,          -- 过期时间（1小时）
    ...
);
```

**特点**:
- ⏰ **有过期时间**：未提交的文件会在 1 小时后被清理
- 🔄 **状态管理**：pending → uploaded → committed
- 🗑️ **可取消**：用户可以删除未提交的文件

### files（永久存储）

```sql
-- 永久存储，已关联到 thread
CREATE TABLE files (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    filename TEXT,
    storage_path TEXT,
    file_type TEXT,  -- 'uploaded' 或 'generated'
    ...
);
```

**特点**:
- ♾️ **没有过期时间**：永久保存
- 🔗 **已关联**：通过 thread_files 关联到对话
- 🚫 **不可取消**：已提交的文件不能随意删除

## 表结构详解

```sql
CREATE TABLE upload_sessions (
    -- 基本信息
    id UUID PRIMARY KEY,                 -- 文件 ID
    user_id UUID NOT NULL,               -- 用户 ID
    filename TEXT NOT NULL,              -- 文件名

    -- 大小验证
    expected_size INTEGER NOT NULL,      -- 预期文件大小
    actual_size INTEGER,                 -- 实际上传大小（验证用）

    -- 存储路径
    storage_path TEXT NOT NULL,          -- Supabase Storage 路径

    -- 状态管理
    status TEXT NOT NULL DEFAULT 'pending',  -- 状态机
    -- 状态流转：pending → uploaded → committed
    --                  ↘ error

    committed BOOLEAN NOT NULL DEFAULT FALSE,  -- 是否已提交
    thread_id UUID,                      -- LangGraph thread ID（提交后设置）

    -- 时间管理
    expires_at TIMESTAMPTZ NOT NULL,     -- 过期时间（清理用）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 外键约束（迁移后）
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
```

## 状态机（Status State Machine）

```
[用户选择文件]
      ↓
   pending  ──────────────────→ error (上传失败)
      ↓
  (上传中...)
      ↓
   uploaded ──────────────────→ error (提交失败)
      ↓                           ↑
  (用户发送消息)                  │
      ↓                           │
   committed ───────────────────┘ (如果已过期)
```

## 使用场景示例

### 场景 1: 正常流程

```
时间线:
14:00:00 - 用户选择文件 data.csv
14:00:01 - 文件上传完成 → upload_sessions (status='uploaded', committed=false)
14:00:30 - 用户输入问题："分析这个文件"
14:00:31 - 用户点击发送
14:00:32 - 创建 thread_id
14:00:33 - commitFiles() → upload_sessions (committed=true, thread_id='xxx')
           同时创建 files + thread_files 记录
14:00:34 - 文件永久关联到对话 ✅
```

### 场景 2: 用户改变主意（未提交）

```
时间线:
14:00:00 - 用户选择文件 data.csv
14:00:01 - 文件上传完成 → upload_sessions (status='uploaded', committed=false)
14:05:00 - 用户关闭页面，没有发送消息
...
15:00:01 - 后台清理任务运行
15:00:02 - 发现过期且未提交的文件
15:00:03 - 删除 upload_sessions 记录 ✅
15:00:04 - 删除 Storage 中的文件 ✅
```

### 场景 3: 批量上传

```
时间线:
14:00:00 - 用户选择 3 个文件
14:00:01 - file1.csv 上传 → upload_sessions (id='file-1', committed=false)
14:00:02 - file2.csv 上传 → upload_sessions (id='file-2', committed=false)
14:00:03 - file3.csv 上传 → upload_sessions (id='file-3', committed=false)
14:00:10 - 用户点击发送
14:00:11 - commitFiles(['file-1', 'file-2', 'file-3'], threadId)
14:00:12 - 所有 3 个文件都关联到同一个 thread ✅
```

## 后台清理机制

系统会定期清理过期的未提交文件：

```python
async def cleanup_expired_uploads():
    """
    删除过期且未提交的上传会话
    """
    # 查找过期的记录
    expired = await supabase.table("upload_sessions")\
        .select("*")\
        .eq("committed", False)\
        .lt("expires_at", datetime.now())\
        .execute()

    # 删除 Storage 文件
    for session in expired.data:
        await storage.remove([session["storage_path"]])

    # 删除数据库记录
    await supabase.table("upload_sessions")\
        .delete()\
        .eq("committed", False)\
        .lt("expires_at", datetime.now())\
        .execute()
```

## 优势总结

### 1. 用户体验优化
- ✅ 文件立即上传，无需等待用户输入消息
- ✅ 用户可以先上传文件，慢慢思考问题
- ✅ 上传进度实时显示

### 2. 系统可靠性
- ✅ 避免"孤立文件"：过期文件自动清理
- ✅ 原子性操作：文件要么完全关联，要么不关联
- ✅ 错误恢复：上传失败不影响对话创建

### 3. 性能优化
- ✅ 文件上传与对话创建异步进行
- ✅ 减少前端等待时间
- ✅ 批量提交减少网络请求

### 4. 安全性
- ✅ RLS 策略：用户只能访问自己的上传会话
- ✅ 过期机制：防止存储空间被占满
- ✅ 大小验证：expected_size vs actual_size

## API 端点

### 上传文件（阶段 1）
```http
POST /files/upload
Content-Type: multipart/form-data

file: <binary>
→ 创建 upload_sessions 记录
→ 返回 file_id
```

### 提交文件（阶段 2）
```http
POST /uploads/commit
Content-Type: application/json

{
  "file_ids": ["file-uuid-1", "file-uuid-2"],
  "thread_id": "thread-uuid-123"
}
→ 更新 upload_sessions (committed=true)
→ 创建 files + thread_files 记录
```

### 查询待提交文件
```http
GET /uploads/pending
→ 返回用户所有未提交的上传会话
```

### 取消上传
```http
DELETE /uploads/{file_id}
→ 删除 upload_sessions 记录
→ 删除 Storage 文件
```

## 与其他表的关系

```
upload_sessions (暂存区)
        ↓
   [用户提交]
        ↓
    ┌───────┐
    │ files │ ← 永久文件记录
    └───────┘
        │
        ├─→ thread_files (关联到 thread)
        │
        └─→ 可被多个 threads 引用
```

## 总结

`upload_sessions` 表实现了一个 **优雅的暂存机制**：

1. **解耦**: 文件上传与对话创建分离
2. **灵活**: 用户可以先上传，后决定
3. **可靠**: 自动清理，防止垃圾文件
4. **高效**: 异步处理，提升用户体验

这是一个经典的 **Staging Pattern**（暂存模式），广泛应用于需要两阶段提交的场景。
