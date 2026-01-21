-- Migration: Add oauth_state column to user_integrations
-- Purpose: Store cryptographic state token for CSRF protection during OAuth flow
-- The state is generated when initiating connection and validated in callback

-- Add oauth_state column (TEXT to handle secrets.token_urlsafe(32) output)
ALTER TABLE user_integrations 
ADD COLUMN IF NOT EXISTS oauth_state TEXT DEFAULT NULL;

-- Add unique index on oauth_state (only for non-null values)
-- This prevents state collision attacks and ensures unique matching
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_integrations_oauth_state 
ON user_integrations (oauth_state) 
WHERE oauth_state IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN user_integrations.oauth_state IS 
'Cryptographic state token for OAuth CSRF protection. Set on connect initiation, validated and cleared in callback.';
