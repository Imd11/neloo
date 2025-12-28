-- Migration: Create upload_sessions table for staging area pattern
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- This table tracks pending uploads before they're committed to a thread
-- Part of the two-phase upload architecture that decouples file upload from thread creation

CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    expected_size INTEGER NOT NULL,
    actual_size INTEGER,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'committed', 'error')),
    committed BOOLEAN NOT NULL DEFAULT FALSE,
    thread_id TEXT,  -- LangGraph thread ID (set when committed)
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);

-- Index for cleanup queries (expired + uncommitted)
CREATE INDEX IF NOT EXISTS idx_upload_sessions_cleanup ON upload_sessions(committed, expires_at);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_upload_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_upload_sessions_updated_at ON upload_sessions;
CREATE TRIGGER trigger_upload_sessions_updated_at
    BEFORE UPDATE ON upload_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_upload_sessions_updated_at();

-- Enable RLS
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own upload sessions
DROP POLICY IF EXISTS upload_sessions_user_policy ON upload_sessions;
CREATE POLICY upload_sessions_user_policy ON upload_sessions
    FOR ALL
    USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON upload_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON upload_sessions TO service_role;

-- Comment
COMMENT ON TABLE upload_sessions IS 'Staging area for file uploads before they are committed to a thread. Part of two-phase upload pattern.';
