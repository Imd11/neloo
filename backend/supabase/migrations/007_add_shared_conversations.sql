-- Migration: Add shared_conversations table for share link feature
-- Share links are references to original threads (not snapshots)
-- When original thread is deleted, share link becomes invalid

CREATE TABLE IF NOT EXISTS public.shared_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id TEXT UNIQUE NOT NULL,           -- Short unique identifier (e.g., "a1b2c3d4")
    thread_id TEXT NOT NULL,                 -- Reference to langgraph_thread_id in threads table
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by share_id
CREATE INDEX IF NOT EXISTS idx_shared_conversations_share_id 
ON public.shared_conversations(share_id);

-- Index for listing user's shares
CREATE INDEX IF NOT EXISTS idx_shared_conversations_user_id 
ON public.shared_conversations(user_id);

-- Index for checking if thread has shares (for cleanup when thread is deleted)
CREATE INDEX IF NOT EXISTS idx_shared_conversations_thread_id 
ON public.shared_conversations(thread_id);

-- Comment
COMMENT ON TABLE public.shared_conversations IS 
'Stores share links for conversations. Links become invalid when source thread is deleted.';

-- RLS Policies
ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only create/delete their own shares
CREATE POLICY "Users can manage own shares" ON public.shared_conversations
    FOR ALL
    USING (auth.uid() = user_id);

-- Service role can do anything (for backend operations)
CREATE POLICY "Service role full access" ON public.shared_conversations
    FOR ALL
    TO service_role
    USING (true);
