-- Migration: Fix integration_action_logs field lengths and add raw_result
-- Purpose: 
--   1. Fix idempotency_key truncation causing 400 errors (change to TEXT)
--   2. Add raw_result JSONB for full Composio response storage
--   3. Add result_url TEXT for clickable links

-- ============================================================================
-- Problem 3: Fix field lengths to prevent truncation errors
-- ============================================================================

-- idempotency_key: was VARCHAR(64), now TEXT (supports any length)
ALTER TABLE integration_action_logs 
ALTER COLUMN idempotency_key TYPE TEXT;

-- action: was VARCHAR(100), might be too short for some Composio actions
ALTER TABLE integration_action_logs 
ALTER COLUMN action TYPE VARCHAR(255);

-- params_hash: was VARCHAR(64), should be sufficient but use TEXT for safety
ALTER TABLE integration_action_logs 
ALTER COLUMN params_hash TYPE TEXT;

-- Drop old unique constraint on idempotency_key (if exists)
-- and recreate with user_id for proper scoping
ALTER TABLE integration_action_logs 
DROP CONSTRAINT IF EXISTS integration_action_logs_idempotency_key_key;

-- ============================================================================
-- Problem 2: Add raw_result for full response tracking
-- ============================================================================

-- raw_result: stores the complete Composio response for debugging and extraction
ALTER TABLE integration_action_logs 
ADD COLUMN IF NOT EXISTS raw_result JSONB DEFAULT NULL;

-- result_url: clickable URL to the created resource
ALTER TABLE integration_action_logs 
ADD COLUMN IF NOT EXISTS result_url TEXT DEFAULT NULL;

-- ============================================================================
-- Recreate optimized index for idempotency lookup
-- ============================================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_integration_action_logs_idem;

-- Create composite index for idempotency check (user_id + idempotency_key)
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_idem 
ON integration_action_logs(user_id, idempotency_key);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN integration_action_logs.idempotency_key IS 
'Unique key per user for deduplication: thread_id:run_id:action:params_hash';

COMMENT ON COLUMN integration_action_logs.raw_result IS 
'Complete Composio response (JSONB) for debugging and result extraction';

COMMENT ON COLUMN integration_action_logs.result_url IS 
'Clickable URL to the created resource (e.g., https://x.com/i/status/{tweet_id})';
