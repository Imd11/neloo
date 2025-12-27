-- ============================================================================
-- Data Analyst App - Database Schema Migration
-- Version: 002
-- Description: Expand files schema for DB-driven library + thread file views
-- ============================================================================

-- 1) Expand file_type to include chart + code
-- Drop old CHECK constraint if present (name may vary if created by Supabase)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'files_file_type_check'
      AND conrelid = 'public.files'::regclass
  ) THEN
    ALTER TABLE public.files DROP CONSTRAINT files_file_type_check;
  END IF;
END $$;

ALTER TABLE public.files
  ADD CONSTRAINT files_file_type_check
  CHECK (file_type IN ('uploaded', 'generated', 'chart', 'code'));

-- 2) Add metadata columns for UI + downloads (idempotent)
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS download_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3) Backfill original_filename if missing
UPDATE public.files
SET original_filename = filename
WHERE original_filename IS NULL;

-- 4) Trigger updated_at for files (optional but useful)
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

