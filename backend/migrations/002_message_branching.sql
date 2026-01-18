-- Message Branching Feature Migration
-- Adds columns for share truncation and thread forking

-- 1. Add target_ai_message_id to shared_conversations table
-- This replaces the old message_index approach with stable message IDs
ALTER TABLE shared_conversations 
ADD COLUMN IF NOT EXISTS target_ai_message_id TEXT;

-- 2. Add fork-related columns to threads table
-- parent_thread_id: The thread this was forked from
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS parent_thread_id TEXT;

-- fork_target_ai_message_id: The AI message user clicked to regenerate
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS fork_target_ai_message_id TEXT;

-- fork_anchor_human_message_id: The human message used as anchor for regeneration
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS fork_anchor_human_message_id TEXT;

-- Optional: Add index for faster fork lookups
CREATE INDEX IF NOT EXISTS idx_threads_parent_thread_id ON threads(parent_thread_id);
