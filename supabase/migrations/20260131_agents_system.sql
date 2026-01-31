-- Custom Agents System Database Migration
-- Run this in Supabase SQL Editor

-- 1. agents table - stores user-created agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🤖',
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tools JSONB DEFAULT '["search_web"]'::jsonb,
  is_public BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for agents
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count DESC);

-- RLS policies for agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Users can view their own agents
CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view public agents
CREATE POLICY "Anyone can view public agents" ON agents
  FOR SELECT USING (is_public = true);

-- Users can create agents
CREATE POLICY "Users can create agents" ON agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own agents
CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own agents
CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE USING (auth.uid() = user_id);

-- 2. scheduled_triggers table - stores scheduled execution config
CREATE TABLE IF NOT EXISTS scheduled_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Shanghai',
  default_prompt TEXT,
  notification_method TEXT DEFAULT 'in_app' CHECK (notification_method IN ('email', 'in_app', 'none')),
  enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'dispatching', 'running')),
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  missed_policy TEXT DEFAULT 'skip' CHECK (missed_policy IN ('skip', 'run_once')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for scheduled_triggers
CREATE INDEX IF NOT EXISTS idx_triggers_user ON scheduled_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_triggers_agent ON scheduled_triggers(agent_id);
CREATE INDEX IF NOT EXISTS idx_triggers_next_run ON scheduled_triggers(next_run) WHERE enabled = true;

-- RLS policies for scheduled_triggers
ALTER TABLE scheduled_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own triggers" ON scheduled_triggers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create triggers" ON scheduled_triggers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own triggers" ON scheduled_triggers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own triggers" ON scheduled_triggers
  FOR DELETE USING (auth.uid() = user_id);

-- 3. trigger_execution_logs table - stores execution history
CREATE TABLE IF NOT EXISTS trigger_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES scheduled_triggers(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  thread_id UUID,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  error_message TEXT,
  UNIQUE(trigger_id, run_id)
);

-- Indexes for trigger_execution_logs
CREATE INDEX IF NOT EXISTS idx_logs_trigger ON trigger_execution_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON trigger_execution_logs(status);

-- RLS policies for trigger_execution_logs (via trigger ownership)
ALTER TABLE trigger_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own execution logs" ON trigger_execution_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scheduled_triggers st
      WHERE st.id = trigger_id AND st.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on agents
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_agent_usage(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET usage_count = usage_count + 1 WHERE id = agent_uuid;
END;
$$ language 'plpgsql' SECURITY DEFINER;
