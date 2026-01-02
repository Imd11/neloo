-- Migration: Fix upload_sessions table column types and add foreign keys
-- Date: 2025-12-29
-- Description:
--   1. Change user_id from text to uuid
--   2. Change thread_id from text to uuid
--   3. Add foreign key constraints

-- Step 1: Check if there's existing data (if yes, you may need to clean or migrate it first)
-- Run this query first to see if there's any data:
-- SELECT COUNT(*) FROM upload_sessions;

-- Step 2: Start transaction
BEGIN;

-- Step 3: If there's existing data with invalid UUIDs, you'll need to handle it
-- This will delete any rows with invalid user_id or thread_id
-- Comment out if you want to preserve data
DELETE FROM upload_sessions
WHERE user_id IS NOT NULL AND user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR thread_id IS NOT NULL AND thread_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 4: Change user_id column type from text to uuid
ALTER TABLE upload_sessions
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Step 5: Change thread_id column type from text to uuid
ALTER TABLE upload_sessions
  ALTER COLUMN thread_id TYPE uuid USING thread_id::uuid;

-- Step 6: Add foreign key constraint for user_id referencing auth.users
-- Note: This assumes auth.users exists and has an id column
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Step 7: Add foreign key constraint for thread_id referencing threads
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_thread_id_fkey
  FOREIGN KEY (thread_id)
  REFERENCES threads(id)
  ON DELETE CASCADE;

-- Step 8: Verify the changes
DO $$
BEGIN
  -- Check column types
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'upload_sessions'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'upload_sessions'
      AND column_name = 'thread_id'
      AND data_type = 'uuid'
  ) THEN
    RAISE NOTICE 'Column types successfully changed to uuid';
  ELSE
    RAISE EXCEPTION 'Column type change failed';
  END IF;

  -- Check foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'upload_sessions_user_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'upload_sessions_thread_id_fkey'
  ) THEN
    RAISE NOTICE 'Foreign key constraints successfully added';
  ELSE
    RAISE EXCEPTION 'Foreign key constraint creation failed';
  END IF;
END $$;

COMMIT;

-- Optional: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_thread_id ON upload_sessions(thread_id);

-- Display final table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'upload_sessions'
ORDER BY ordinal_position;
