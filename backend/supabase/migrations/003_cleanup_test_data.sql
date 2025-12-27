-- ============================================================================
-- Data Analyst App - Cleanup Test Data
-- Version: 003
-- Description: Clean up all test data from files, thread_files, and threads
-- WARNING: This will delete ALL existing data. Only run in development!
-- ============================================================================

-- Delete all thread-file associations
DELETE FROM public.thread_files;

-- Delete all file records (will cascade to thread_files if not already deleted)
DELETE FROM public.files;

-- Delete all threads (optional - only if you want to clear conversation history too)
-- DELETE FROM public.threads;

-- Reset sequences (optional - to start IDs from 1 again)
-- ALTER SEQUENCE files_id_seq RESTART WITH 1;
-- ALTER SEQUENCE threads_id_seq RESTART WITH 1;
-- ALTER SEQUENCE thread_files_id_seq RESTART WITH 1;
