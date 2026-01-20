-- Migration: Add result_url column and composite unique constraint
-- For Composio Runtime Dispatcher pattern

-- Add result_url column if not exists
ALTER TABLE integration_action_logs
ADD COLUMN IF NOT EXISTS result_url TEXT;

-- Drop old single-column unique constraint if exists
ALTER TABLE integration_action_logs
DROP CONSTRAINT IF EXISTS integration_action_logs_idempotency_key_key;

-- Add composite unique constraint (user_id + idempotency_key)
-- This allows same idempotency_key for different users
ALTER TABLE integration_action_logs
ADD CONSTRAINT unique_user_idempotency 
    UNIQUE (user_id, idempotency_key);

-- Add index for faster idempotency lookups
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_idem 
ON integration_action_logs(user_id, idempotency_key);

COMMENT ON COLUMN integration_action_logs.result_url IS 'URL to the created resource (e.g., tweet URL)';
