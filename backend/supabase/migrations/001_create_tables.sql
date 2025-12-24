-- ============================================================================
-- Data Analyst App - Database Schema Migration
-- Version: 001
-- Description: Create tables for user threads, files, and their relationships
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: threads (用户的对话/任务)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Task',
    langgraph_thread_id TEXT,  -- LangGraph SDK 的 thread_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON public.threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_langgraph_id ON public.threads(langgraph_thread_id);

-- ============================================================================
-- Table: files (用户的文件)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,  -- Supabase Storage 路径
    file_size BIGINT,
    content_type TEXT,
    file_type TEXT NOT NULL CHECK (file_type IN ('uploaded', 'generated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON public.files(file_type);

-- ============================================================================
-- Table: thread_files (多对多关联表)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.thread_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(thread_id, file_id)  -- 防止重复关联
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_thread_files_thread_id ON public.thread_files(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_files_file_id ON public.thread_files(file_id);

-- ============================================================================
-- Function: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for threads table
DROP TRIGGER IF EXISTS update_threads_updated_at ON public.threads;
CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON public.threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_files ENABLE ROW LEVEL SECURITY;

-- Threads policies: users can only access their own threads
CREATE POLICY "Users can view own threads"
    ON public.threads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads"
    ON public.threads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
    ON public.threads FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
    ON public.threads FOR DELETE
    USING (auth.uid() = user_id);

-- Files policies: users can only access their own files
CREATE POLICY "Users can view own files"
    ON public.files FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
    ON public.files FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
    ON public.files FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
    ON public.files FOR DELETE
    USING (auth.uid() = user_id);

-- Thread_files policies: users can only access thread_files for their own threads
CREATE POLICY "Users can view own thread_files"
    ON public.thread_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE threads.id = thread_files.thread_id
            AND threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own thread_files"
    ON public.thread_files FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE threads.id = thread_files.thread_id
            AND threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own thread_files"
    ON public.thread_files FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.threads
            WHERE threads.id = thread_files.thread_id
            AND threads.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Storage Bucket Policies
-- ============================================================================
-- Note: Run this in Supabase Dashboard -> Storage -> Policies

-- Create bucket if not exists (run in SQL editor):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies are created via Supabase Dashboard or using:
-- CREATE POLICY "Users can upload own files"
--     ON storage.objects FOR INSERT
--     WITH CHECK (
--         bucket_id = 'user-files' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can view own files"
--     ON storage.objects FOR SELECT
--     USING (
--         bucket_id = 'user-files' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can delete own files"
--     ON storage.objects FOR DELETE
--     USING (
--         bucket_id = 'user-files' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- ============================================================================
-- Helpful Views
-- ============================================================================

-- View: Get all files for a user with thread count
CREATE OR REPLACE VIEW public.user_files_with_threads AS
SELECT
    f.*,
    COUNT(tf.thread_id) as thread_count
FROM public.files f
LEFT JOIN public.thread_files tf ON f.id = tf.file_id
GROUP BY f.id;

-- View: Get all threads for a user with file count
CREATE OR REPLACE VIEW public.user_threads_with_files AS
SELECT
    t.*,
    COUNT(tf.file_id) as file_count
FROM public.threads t
LEFT JOIN public.thread_files tf ON t.id = tf.thread_id
GROUP BY t.id;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
