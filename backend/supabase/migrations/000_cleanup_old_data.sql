-- ============================================================================
-- Data Analyst App - Cleanup Old Data
-- Version: 000
-- Description: Clean up old storage data before migration
-- WARNING: This will DELETE all existing files in user-files bucket!
-- ============================================================================

-- ============================================================================
-- Step 1: Delete all objects from user-files bucket
-- ============================================================================
-- Note: Run this ONLY if you want to clean up old data
-- This is irreversible!

DELETE FROM storage.objects WHERE bucket_id = 'user-files';

-- ============================================================================
-- Step 2: Drop old tables if they exist (from previous versions)
-- ============================================================================
-- Uncomment these if you have old tables that conflict with new schema

-- DROP TABLE IF EXISTS public.thread_files CASCADE;
-- DROP TABLE IF EXISTS public.files CASCADE;
-- DROP TABLE IF EXISTS public.threads CASCADE;

-- ============================================================================
-- Step 3: Drop old views if they exist
-- ============================================================================
-- DROP VIEW IF EXISTS public.user_files_with_threads;
-- DROP VIEW IF EXISTS public.user_threads_with_files;

-- ============================================================================
-- Verification: Check storage is empty
-- ============================================================================
-- Run this to verify cleanup was successful:
-- SELECT COUNT(*) as remaining_files FROM storage.objects WHERE bucket_id = 'user-files';
