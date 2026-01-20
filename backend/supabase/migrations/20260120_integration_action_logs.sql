-- Integration Action Logs Table for Composio Operations
-- Records all actions executed through Composio integrations
-- Includes idempotency key with unique constraint to prevent duplicate executions

CREATE TABLE IF NOT EXISTS integration_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    thread_id VARCHAR(255),
    
    -- Idempotency key (unique constraint prevents duplicate executions)
    idempotency_key VARCHAR(64) UNIQUE,
    
    -- Action details
    app_name VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    params_hash VARCHAR(64),
    
    -- Result
    result_id VARCHAR(255),  -- e.g., tweet_id, email_id
    status VARCHAR(20) NOT NULL DEFAULT 'success',  -- success, failed
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_user ON integration_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_thread ON integration_action_logs(thread_id);
CREATE INDEX IF NOT EXISTS idx_integration_action_logs_created ON integration_action_logs(created_at DESC);

-- Comment
COMMENT ON TABLE integration_action_logs IS 'Audit log for all Composio integration actions with idempotency protection';
