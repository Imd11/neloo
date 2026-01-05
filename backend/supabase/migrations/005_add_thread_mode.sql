-- ============================================================================
-- Data Analyst App - Database Schema Migration
-- Version: 005
-- Description: Add mode column to threads table for web development mode support
-- ============================================================================

-- Add mode column to threads table
-- Possible values: 'default', 'web-dev'
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Add check constraint for valid mode values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'threads_mode_check'
    ) THEN
        ALTER TABLE public.threads
        ADD CONSTRAINT threads_mode_check CHECK (mode IN ('default', 'web-dev'));
    END IF;
END $$;

-- Create index for faster filtering by mode
CREATE INDEX IF NOT EXISTS idx_threads_mode ON public.threads(mode);

-- Add comment for documentation
COMMENT ON COLUMN public.threads.mode IS 'Thread mode: default (data analysis) or web-dev (web development with code preview)';
