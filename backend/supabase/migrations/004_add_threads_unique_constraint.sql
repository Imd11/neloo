-- ============================================================================
-- Migration: Add UNIQUE constraint to threads table
-- Version: 004
-- Description: Prevent duplicate threads for same user + langgraph_thread_id
-- ============================================================================

-- Add UNIQUE constraint on (user_id, langgraph_thread_id)
-- This ensures each user can only have one thread per langgraph_thread_id
--
-- NOTE: Before running this migration, ensure there are no duplicate records:
-- SELECT user_id, langgraph_thread_id, COUNT(*)
-- FROM public.threads
-- GROUP BY user_id, langgraph_thread_id
-- HAVING COUNT(*) > 1;
--
-- If duplicates exist, clean them up first:
-- DELETE FROM public.threads a USING public.threads b
-- WHERE a.id > b.id
-- AND a.user_id = b.user_id
-- AND a.langgraph_thread_id = b.langgraph_thread_id;

ALTER TABLE public.threads
ADD CONSTRAINT threads_user_langgraph_unique
UNIQUE (user_id, langgraph_thread_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT threads_user_langgraph_unique ON public.threads IS
'Ensures each user can only have one thread per langgraph_thread_id. This prevents duplicate thread creation from concurrent requests (e.g., from /api/threads and /uploads/commit).';
