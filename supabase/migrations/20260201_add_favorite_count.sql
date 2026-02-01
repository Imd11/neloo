-- Add favorite_count column to agents table
-- Run this in Supabase SQL Editor

-- 1. Add favorite_count column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS favorite_count INT DEFAULT 0;

-- 2. Create index for sorting by favorite_count
CREATE INDEX IF NOT EXISTS idx_agents_favorites ON agents(favorite_count DESC);

-- 3. Function to increment favorite count when agent is copied
CREATE OR REPLACE FUNCTION increment_agent_favorite(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET favorite_count = favorite_count + 1 WHERE id = agent_uuid;
END;
$$ language 'plpgsql' SECURITY DEFINER;
