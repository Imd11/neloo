-- Chat Messages Persistence Migration
-- Run this in Supabase SQL Editor

-- 1. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  message_data JSONB NOT NULL,
  seq INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(thread_id, message_id),
  UNIQUE(thread_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_seq ON chat_messages(thread_id, seq);

-- 2. Create thread_seq table for atomic seq generation
CREATE TABLE IF NOT EXISTS thread_seq (
  thread_id TEXT PRIMARY KEY,
  next_seq INTEGER NOT NULL DEFAULT 1
);

-- 3. Create atomic get_next_seq function
CREATE OR REPLACE FUNCTION get_next_seq(p_thread_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO thread_seq (thread_id, next_seq)
  VALUES (p_thread_id, 2)
  ON CONFLICT (thread_id) 
  DO UPDATE SET next_seq = thread_seq.next_seq + 1
  RETURNING next_seq - 1 INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant permissions (if using RLS)
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE thread_seq ENABLE ROW LEVEL SECURITY;
