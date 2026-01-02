# CommitFiles 机制详解

## 核心问题：upload_sessions 如何与 files 和 thread_files 产生关联？

**简短答案：通过数据复制，而不是外键关联**

`upload_sessions` 和 `files` 之间 **没有直接的外键关系**。关联是通过代码逻辑实现的：
1. 从 `upload_sessions` 读取文件信息
2. 用这些信息创建新的 `files` 记录
3. 创建 `thread_files` 关联
4. 标记 `upload_sessions` 为已提交

## 完整的代码执行流程

### 第 1 步：用户点击发送

```typescript
// frontend/src/app/components/ChatInterface.tsx:193
await fileUpload.commitFiles(newThreadId);
```

### 第 2 步：前端调用 commit API

```typescript
// frontend/src/app/hooks/useDataFileUpload.ts:350
const response = await fetch(`${apiUrl}/uploads/commit`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({
    file_ids: ["abc-123", "def-456"],  // upload_sessions 的 id
    thread_id: "thread-789",           // langgraph_thread_id
  }),
});
```

### 第 3 步：后端处理 commit 请求

```python
# backend/src/api/webapp.py:678
@app.post("/uploads/commit")
async def commit_uploads(data: CommitFilesRequest, user: dict = Depends(get_current_user)):
    user_id = auth_get_user_id(user)
    committed_files = []
    errors = []

    for file_id in data.file_ids:  # 遍历每个文件
        # ===== 步骤 3.1: 从 upload_sessions 获取文件信息 =====
        session = await get_upload_session(file_id, user_id)
        # session = {
        #   "id": "abc-123",
        #   "filename": "data.csv",
        #   "storage_path": "user-1/20251229_xxx.csv",
        #   "expected_size": 1024000,
        #   "actual_size": 1024000,
        #   "status": "uploaded",
        #   "committed": False,
        #   ...
        # }

        if not session:
            errors.append({"file_id": file_id, "error": "Session not found"})
            continue

        if session["status"] != "uploaded":
            errors.append({"file_id": file_id, "error": "Invalid status"})
            continue

        # ===== 步骤 3.2: 确保 thread 存在 =====
        await create_thread(
            user_id=user_id,
            langgraph_thread_id=data.thread_id,  # "thread-789"
            title="New Task",
        )

        # ===== 步骤 3.3: 创建 files 记录（关键！）=====
        await save_file_record(
            user_id=user_id,
            filename=session["filename"],        # 从 session 复制
            storage_path=session["storage_path"], # 从 session 复制
            file_size=session.get("actual_size") or session["expected_size"],
            content_type="text/csv",
            file_type="uploaded",
            thread_id=data.thread_id,  # "thread-789" (langgraph_thread_id)
        )

        # ===== 步骤 3.4: 标记 upload_session 为已提交 =====
        await commit_upload_session(file_id, data.thread_id)

        committed_files.append({
            "file_id": file_id,
            "filename": session["filename"],
            "storage_path": session["storage_path"],
        })

    return {
        "success": len(errors) == 0,
        "committed": committed_files,
        "errors": errors,
    }
```

### 第 4 步：save_file_record 创建 files 和关联

```python
# backend/src/storage/supabase_db.py:70
async def save_file_record(
    user_id: str,
    filename: str,
    storage_path: str,
    file_size: int,
    content_type: str,
    file_type: str,
    thread_id: Optional[str] = None,  # langgraph_thread_id
):
    supabase = await get_supabase_client()

    # ===== 步骤 4.1: 生成新的 file_id =====
    file_id = str(uuid.uuid4())  # "file-999" (新 UUID！)

    # ===== 步骤 4.2: 插入 files 表 =====
    file_data = {
        "id": file_id,              # "file-999" (新生成的)
        "user_id": user_id,         # 从参数
        "filename": filename,        # 从 upload_session 复制来的
        "storage_path": storage_path,  # 从 upload_session 复制来的
        "file_size": file_size,      # 从 upload_session 复制来的
        "content_type": content_type,
        "file_type": "uploaded",
    }

    result = await supabase.table("files").insert(file_data).execute()
    file_record = result.data[0]
    # 现在 files 表有了新记录：
    # {
    #   id: "file-999",  ← 新生成的 UUID
    #   filename: "data.csv",
    #   storage_path: "user-1/20251229_xxx.csv",  ← 与 upload_session 相同
    #   ...
    # }

    # ===== 步骤 4.3: 创建 thread_files 关联 =====
    if thread_id:  # thread_id = "thread-789" (langgraph_thread_id)
        # 先通过 langgraph_thread_id 查找数据库的 thread.id
        thread_record = await get_thread_by_langgraph_id(thread_id)
        # thread_record = {
        #   "id": "db-thread-123",  ← threads 表的数据库 UUID
        #   "langgraph_thread_id": "thread-789",
        #   ...
        # }

        if thread_record:
            # 使用数据库 UUID 创建关联
            await create_thread_file_link(
                thread_id=thread_record["id"],  # "db-thread-123"
                file_id=file_id,                # "file-999"
            )

    return file_record
```

### 第 5 步：create_thread_file_link 插入关联记录

```python
# backend/src/storage/supabase_db.py:157
async def create_thread_file_link(thread_id: str, file_id: str):
    supabase = await get_supabase_client()

    # ===== 插入 thread_files 表 =====
    link_data = {
        "id": str(uuid.uuid4()),     # "link-888" (关联记录的 ID)
        "thread_id": thread_id,      # "db-thread-123" (threads 表的 id)
        "file_id": file_id,          # "file-999" (files 表的 id)
    }

    result = await supabase.table("thread_files").insert(link_data).execute()
    # 现在 thread_files 表有了关联：
    # {
    #   id: "link-888",
    #   thread_id: "db-thread-123",  ← 引用 threads.id
    #   file_id: "file-999",         ← 引用 files.id
    # }

    return True
```

### 第 6 步：commit_upload_session 标记为已提交

```python
# backend/src/storage/supabase_db.py:795
async def commit_upload_session(file_id: str, thread_id: str):
    supabase = await get_supabase_client()

    # ===== 更新 upload_sessions 表 =====
    update_data = {
        "committed": True,
        "thread_id": thread_id,      # "thread-789" (langgraph_thread_id)
        "status": "committed",
        "updated_at": datetime.now().isoformat(),
    }

    result = await supabase.table("upload_sessions")\
        .update(update_data)\
        .eq("id", file_id)\  # "abc-123"
        .execute()

    # 现在 upload_sessions 记录被标记为已提交：
    # {
    #   id: "abc-123",
    #   committed: true,  ← 更新
    #   thread_id: "thread-789",  ← 更新
    #   status: "committed",  ← 更新
    #   ...
    # }

    return True
```

## 数据流转示意图

```
┌────────────────────────────────────────────────────────────────┐
│                     用户点击发送按钮                            │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  前端: commitFiles(threadId)                                   │
│  → POST /uploads/commit                                        │
│    {                                                           │
│      file_ids: ["abc-123"],                                    │
│      thread_id: "thread-789"                                   │
│    }                                                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  步骤 1: 从 upload_sessions 读取文件信息                        │
│                                                                │
│  upload_sessions 表:                                           │
│  ┌──────────┬──────────┬──────────────┬─────────┬─────────┐  │
│  │ id       │ filename │ storage_path │ status  │committed│  │
│  ├──────────┼──────────┼──────────────┼─────────┼─────────┤  │
│  │ abc-123  │ data.csv │ user-1/...   │uploaded │ false   │  │
│  └──────────┴──────────┴──────────────┴─────────┴─────────┘  │
│                    ↓ (读取数据)                                │
│              session = {                                       │
│                id: "abc-123",                                  │
│                filename: "data.csv",                           │
│                storage_path: "user-1/20251229_xxx.csv",       │
│                ...                                             │
│              }                                                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  步骤 2: 用 session 的数据创建 files 记录                       │
│                                                                │
│  file_id = uuid.uuid4()  ← "file-999" (新生成！)               │
│                                                                │
│  INSERT INTO files (                                           │
│    id,                    ← "file-999" (新 UUID)               │
│    filename,              ← "data.csv" (从 session 复制)       │
│    storage_path,          ← "user-1/..." (从 session 复制)     │
│    file_size,             ← 1024000 (从 session 复制)          │
│    ...                                                         │
│  )                                                             │
│                                                                │
│  files 表:                                                     │
│  ┌──────────┬──────────┬──────────────┬──────────┐           │
│  │ id       │ filename │ storage_path │ file_size│           │
│  ├──────────┼──────────┼──────────────┼──────────┤           │
│  │ file-999 │ data.csv │ user-1/...   │ 1024000  │  ← 新记录 │
│  └──────────┴──────────┴──────────────┴──────────┘           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  步骤 3: 查找 threads 表的数据库 ID                             │
│                                                                │
│  SELECT * FROM threads                                         │
│  WHERE langgraph_thread_id = "thread-789"                     │
│                                                                │
│  threads 表:                                                   │
│  ┌───────────────┬─────────────────────┬───────┐             │
│  │ id            │ langgraph_thread_id │ title │             │
│  ├───────────────┼─────────────────────┼───────┤             │
│  │ db-thread-123 │ thread-789          │ Task  │             │
│  └───────────────┴─────────────────────┴───────┘             │
│         ↑                                                      │
│         └─ 获取到数据库 UUID: "db-thread-123"                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  步骤 4: 创建 thread_files 关联                                │
│                                                                │
│  INSERT INTO thread_files (                                    │
│    id,                    ← "link-888" (新生成)                │
│    thread_id,             ← "db-thread-123" (threads 表的 id) │
│    file_id                ← "file-999" (files 表的 id)        │
│  )                                                             │
│                                                                │
│  thread_files 表:                                              │
│  ┌──────────┬───────────────┬──────────┐                     │
│  │ id       │ thread_id     │ file_id  │                     │
│  ├──────────┼───────────────┼──────────┤                     │
│  │ link-888 │ db-thread-123 │ file-999 │  ← 新关联           │
│  └──────────┴───────────────┴──────────┘                     │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  步骤 5: 标记 upload_session 为已提交                          │
│                                                                │
│  UPDATE upload_sessions                                        │
│  SET committed = true,                                         │
│      thread_id = "thread-789",                                │
│      status = "committed"                                     │
│  WHERE id = "abc-123"                                          │
│                                                                │
│  upload_sessions 表:                                           │
│  ┌──────────┬──────────┬───────────┬─────────┬─────────┐    │
│  │ id       │ filename │ thread_id │ status  │committed│    │
│  ├──────────┼──────────┼───────────┼─────────┼─────────┤    │
│  │ abc-123  │ data.csv │thread-789 │committed│ true    │ ←更新│
│  └──────────┴──────────┴───────────┴─────────┴─────────┘    │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                        完成 ✅                                 │
│                                                                │
│  现在三个表的关系：                                             │
│  - upload_sessions: 标记为已提交                               │
│  - files: 有了永久记录                                         │
│  - thread_files: 建立了关联                                    │
└────────────────────────────────────────────────────────────────┘
```

## 关键点总结

### 1. 数据复制，非外键引用

```
upload_sessions 表
     │
     │ (读取数据)
     ↓
  session = {
    filename: "data.csv",
    storage_path: "...",
    file_size: 1024000
  }
     │
     │ (复制数据)
     ↓
files 表 (新记录)
  id: "file-999" ← 新生成的 UUID
  filename: "data.csv" ← 从 session 复制
  storage_path: "..." ← 从 session 复制
```

**upload_sessions 和 files 之间没有外键关系！**
- `upload_sessions.id` = "abc-123"
- `files.id` = "file-999" (完全不同的 ID)
- 它们通过 `storage_path` 字段关联（相同的文件路径）

### 2. ID 映射关系

| 阶段 | upload_sessions.id | files.id | thread_files.file_id |
|------|-------------------|----------|---------------------|
| 上传 | "abc-123" | - | - |
| 提交 | "abc-123" | "file-999" | "file-999" |

- `upload_sessions.id` 是临时 ID
- `files.id` 是新生成的永久 ID
- `thread_files.file_id` 引用 `files.id`（不是 upload_sessions.id）

### 3. Storage Path 是真正的"桥梁"

```
upload_sessions.storage_path = "user-1/20251229_xxx.csv"
                    ↓ (复制)
files.storage_path = "user-1/20251229_xxx.csv"
                    ↑
                 同一个文件
```

虽然 ID 不同，但它们指向 Supabase Storage 中的同一个文件。

### 4. Thread ID 的双重身份

```
前端/API: thread_id = "thread-789" (langgraph_thread_id)
                ↓
       查询 threads 表
                ↓
数据库: thread.id = "db-thread-123" (数据库 UUID)
                ↓
       用于外键关联
                ↓
thread_files.thread_id = "db-thread-123"
```

### 5. 为什么不用外键直接关联？

如果 `files` 表有外键引用 `upload_sessions.id`：

```sql
-- 这样设计会有问题
CREATE TABLE files (
    id UUID PRIMARY KEY,
    upload_session_id UUID REFERENCES upload_sessions(id),  -- ❌
    ...
);
```

**问题**:
- ❌ upload_sessions 会过期被删除
- ❌ 删除 upload_session 会级联删除 files（CASCADE）
- ❌ 或者无法删除 upload_session（RESTRICT）
- ❌ 临时表和永久表耦合

**当前方案**:
- ✅ 数据复制，完全解耦
- ✅ upload_sessions 可以随时清理
- ✅ files 永久保存
- ✅ 两个表独立演进

## 完整的数据库状态变化

### 提交前

```sql
-- upload_sessions 表
id       | filename  | storage_path      | status   | committed | thread_id
---------|-----------|-------------------|----------|-----------|----------
abc-123  | data.csv  | user-1/file.csv   | uploaded | false     | NULL

-- files 表
(空)

-- thread_files 表
(空)
```

### 提交后

```sql
-- upload_sessions 表（已标记）
id       | filename  | storage_path      | status    | committed | thread_id
---------|-----------|-------------------|-----------|-----------|------------
abc-123  | data.csv  | user-1/file.csv   | committed | true      | thread-789

-- files 表（新记录）
id       | filename  | storage_path      | file_type
---------|-----------|-------------------|----------
file-999 | data.csv  | user-1/file.csv   | uploaded

-- thread_files 表（新关联）
id       | thread_id     | file_id
---------|---------------|----------
link-888 | db-thread-123 | file-999
```

## 总结

**关联机制的本质**：

1. **读取** upload_sessions 的文件信息
2. **复制** 数据创建新的 files 记录
3. **查询** threads 表获取数据库 ID
4. **创建** thread_files 关联
5. **标记** upload_sessions 为已提交

这不是数据库层面的外键关联，而是**应用层面的数据流转**。

upload_sessions 就像一个"临时收件箱"：
- 📥 文件先放进收件箱（上传）
- 📋 用户决定要这个文件（发送消息）
- 📤 系统把文件信息复制到永久存储（files）
- 🔗 建立与对话的关联（thread_files）
- ✅ 标记收件箱中的文件为"已处理"（committed）

这是一个优雅的 **数据生命周期管理** 模式！
