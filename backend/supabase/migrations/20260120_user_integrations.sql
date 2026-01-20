-- User Integrations Table for Composio Connected Apps
-- Stores the connection state between users and third-party apps

CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    app_name VARCHAR(50) NOT NULL,           -- e.g., "twitter", "gmail", "github"
    
    -- Composio connection ID (same ID for initiate, get, delete)
    composio_connection_id VARCHAR(255),
    
    -- Status: pending | connected | disconnected | failed | expired
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Timestamps
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- One connection per user per app
    UNIQUE(user_id, app_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);

-- Comment
COMMENT ON TABLE user_integrations IS 'Stores Composio connected app state for each user';
