# 数据库迁移指南

## 问题概述

当前 `upload_sessions` 表存在以下设计问题：
1. ❌ `user_id` 是 `text` 类型，应该是 `uuid` 类型以匹配 `auth.users.id`
2. ❌ `thread_id` 是 `text` 类型，应该是 `uuid` 类型以匹配 `threads.id`
3. ❌ 缺少外键约束，导致数据完整性风险

## 执行迁移的方法

### 方法 1：在 Supabase Dashboard 中执行（推荐）

1. 访问 Supabase Dashboard: `https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_REF`
2. 登录你的账号
3. 在左侧菜单中选择 **SQL Editor**
4. 点击 **New query** 创建新查询
5. 复制 `docs/legacy/supabase_fix_upload_sessions.sql` 文件的完整内容
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 按钮执行迁移

### 方法 2：使用 psql 命令行工具

如果你有数据库密码，可以使用以下命令：

```bash
# 连接到数据库
PGPASSWORD="your_database_password" psql \
  -h aws-1-YOUR_REGION.pooler.supabase.com \
  -p 5432 \
  -U postgres.YOUR_SUPABASE_PROJECT_REF \
  -d postgres \
  -f docs/legacy/supabase_fix_upload_sessions.sql
```

## 迁移步骤说明

这个迁移会按以下顺序执行：

1. ✅ **检查现有数据** - 删除任何包含无效 UUID 的行
2. ✅ **修改 user_id 类型** - 从 `text` 改为 `uuid`
3. ✅ **修改 thread_id 类型** - 从 `text` 改为 `uuid`
4. ✅ **添加外键约束** - 确保数据引用完整性
   - `user_id` → `auth.users(id)`
   - `thread_id` → `threads(id)`
5. ✅ **创建索引** - 提升查询性能
6. ✅ **验证更改** - 确认迁移成功

## 注意事项

⚠️ **重要警告**：
- 这个迁移会使用 `CASCADE` 删除策略，意味着如果用户或线程被删除，相关的 upload_sessions 也会被自动删除
- 如果表中有现有数据且包含无效的 UUID，这些行会被删除
- 建议在执行前先备份数据库

## 验证迁移成功

迁移完成后，运行以下查询验证：

```sql
-- 检查列类型
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'upload_sessions'
ORDER BY ordinal_position;

-- 检查外键约束
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'upload_sessions';
```

期望结果：
- `user_id` 和 `thread_id` 都应该是 `uuid` 类型
- 应该看到两个外键约束：
  - `upload_sessions_user_id_fkey`
  - `upload_sessions_thread_id_fkey`

## 需要帮助？

如果遇到问题：
1. 检查是否有错误消息
2. 确认数据库连接权限
3. 验证 `auth.users` 和 `threads` 表存在且有 `id` 列

## 回滚（如果需要）

如果迁移失败或需要回滚：

```sql
BEGIN;

-- 删除外键约束
ALTER TABLE upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_user_id_fkey;
ALTER TABLE upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_thread_id_fkey;

-- 改回 text 类型（注意：这会丢失数据！）
ALTER TABLE upload_sessions ALTER COLUMN user_id TYPE text;
ALTER TABLE upload_sessions ALTER COLUMN thread_id TYPE text;

-- 删除索引
DROP INDEX IF EXISTS idx_upload_sessions_user_id;
DROP INDEX IF EXISTS idx_upload_sessions_thread_id;

COMMIT;
```
