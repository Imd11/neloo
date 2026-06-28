-- Migration: Fix upload_sessions table column types and add foreign keys (v2)
-- Date: 2025-12-29
-- Description:
--   1. Drop existing RLS policies that depend on user_id
--   2. Change user_id from text to uuid
--   3. Change thread_id from text to uuid
--   4. Add foreign key constraints
--   5. Recreate RLS policies with correct uuid types

BEGIN;

-- Step 1: Drop the existing RLS policy
DROP POLICY IF EXISTS upload_sessions_user_policy ON upload_sessions;

-- Step 2: Check if there's existing data with invalid UUIDs
-- This will delete any rows with invalid user_id or thread_id
DELETE FROM upload_sessions
WHERE user_id IS NOT NULL AND user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR thread_id IS NOT NULL AND thread_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Change user_id column type from text to uuid
ALTER TABLE upload_sessions
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Step 4: Change thread_id column type from text to uuid
ALTER TABLE upload_sessions
  ALTER COLUMN thread_id TYPE uuid USING thread_id::uuid;

-- Step 5: Add foreign key constraint for user_id referencing auth.users
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Step 6: Add foreign key constraint for thread_id referencing threads
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_thread_id_fkey
  FOREIGN KEY (thread_id)
  REFERENCES threads(id)
  ON DELETE CASCADE;

-- Step 7: Recreate the RLS policy with uuid comparison
CREATE POLICY upload_sessions_user_policy
  ON upload_sessions
  FOR ALL
  TO public
  USING (
    user_id = auth.uid() OR
    user_id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
  );

-- Step 8: Add indexes for better query performance (if not already exist)
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_thread_id ON upload_sessions(thread_id);

-- Step 9: Verify the changes
DO $$
DECLARE
  v_user_id_type text;
  v_thread_id_type text;
  v_user_fk_exists boolean;
  v_thread_fk_exists boolean;
  v_policy_exists boolean;
BEGIN
  -- Check column types
  SELECT data_type INTO v_user_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'upload_sessions'
    AND column_name = 'user_id';

  SELECT data_type INTO v_thread_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'upload_sessions'
    AND column_name = 'thread_id';

  IF v_user_id_type = 'uuid' AND v_thread_id_type = 'uuid' THEN
    RAISE NOTICE '✓ Column types successfully changed to uuid';
  ELSE
    RAISE EXCEPTION '✗ Column type change failed: user_id=%, thread_id=%', v_user_id_type, v_thread_id_type;
  END IF;

  -- Check foreign keys
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'upload_sessions_user_id_fkey'
      AND table_name = 'upload_sessions'
  ) INTO v_user_fk_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'upload_sessions_thread_id_fkey'
      AND table_name = 'upload_sessions'
  ) INTO v_thread_fk_exists;

  IF v_user_fk_exists AND v_thread_fk_exists THEN
    RAISE NOTICE '✓ Foreign key constraints successfully added';
  ELSE
    RAISE EXCEPTION '✗ Foreign key constraint creation failed';
  END IF;

  -- Check policy
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'upload_sessions'
      AND policyname = 'upload_sessions_user_policy'
  ) INTO v_policy_exists;

  IF v_policy_exists THEN
    RAISE NOTICE '✓ RLS policy successfully recreated';
  ELSE
    RAISE EXCEPTION '✗ RLS policy creation failed';
  END IF;

  RAISE NOTICE '✓ Migration completed successfully!';
END $$;

COMMIT;

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

-- Display policies
SELECT
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'upload_sessions';
