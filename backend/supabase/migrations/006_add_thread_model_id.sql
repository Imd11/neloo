-- ============================================================================
-- Migration: Add model_id to threads table
-- Version: 006
-- Description: Store per-thread model preference for cross-device sync
-- ============================================================================

-- Add model_id column to threads table
-- NULL means use the default model
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS model_id TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.threads.model_id IS 
'Model ID used for this thread (e.g., deepseek-r1, qwen-plus). NULL means use default model.';

-- Index for potential future queries by model
CREATE INDEX IF NOT EXISTS idx_threads_model_id ON public.threads(model_id);
