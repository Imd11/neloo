-- ============================================================================
-- Migration 003: Add 'chart' and 'code' file types
-- Description: Extend file_type CHECK constraint to support all file types
-- ============================================================================

-- Drop the old CHECK constraint
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_file_type_check;

-- Add new CHECK constraint with all file types
ALTER TABLE public.files ADD CONSTRAINT files_file_type_check
  CHECK (file_type IN ('uploaded', 'generated', 'chart', 'code'));

-- Update existing 'generated' files metadata to be more specific if needed
-- (No data migration needed as this is additive)

COMMENT ON COLUMN public.files.file_type IS 'File type: uploaded (user upload), generated (AI generated data), chart (AI generated visualization), code (AI generated code)';
