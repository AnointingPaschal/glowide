-- ============================================================
-- GlowIDE Row Level Security (RLS) Policies
-- Run AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- Enable RLS on all user-facing tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployed_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE explorer_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE POLICY "Users can manage their own workspaces"
  ON workspaces FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE POLICY "Users can manage their own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public projects"
  ON projects FOR SELECT
  USING (is_public = TRUE);

-- ============================================================
-- FILES
-- ============================================================
CREATE POLICY "Users can manage their own files"
  ON files FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view files in public projects"
  ON files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = files.project_id
      AND projects.is_public = TRUE
    )
  );

-- ============================================================
-- FILE VERSIONS
-- ============================================================
CREATE POLICY "Users can manage their own file versions"
  ON file_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
CREATE POLICY "Users can manage their own chat sessions"
  ON chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE POLICY "Users can manage messages in their sessions"
  ON chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AI USAGE LOGS
-- ============================================================
CREATE POLICY "Users can view their own usage logs"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WALLET CONNECTIONS
-- ============================================================
CREATE POLICY "Users can manage their own wallet connections"
  ON wallet_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WALLET BALANCES
-- ============================================================
CREATE POLICY "Users can manage their own wallet balances"
  ON wallet_balances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DEPLOYED CONTRACTS
-- ============================================================
CREATE POLICY "Users can manage their own deployed contracts"
  ON deployed_contracts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view deployed contracts (blockchain transparency)"
  ON deployed_contracts FOR SELECT
  USING (TRUE);

-- ============================================================
-- DEPLOYMENTS
-- ============================================================
CREATE POLICY "Users can manage their own deployments"
  ON deployments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CONTRACT VERIFICATIONS
-- ============================================================
CREATE POLICY "Users can manage their own verifications"
  ON contract_verifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view verified contracts"
  ON contract_verifications FOR SELECT
  USING (status = 'verified');

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE POLICY "Users can manage their own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- EXPLORER LOOKUPS
-- ============================================================
CREATE POLICY "Users can create explorer lookups"
  ON explorer_lookups FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own explorer lookups"
  ON explorer_lookups FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- SAVED TEMPLATES
-- ============================================================
CREATE POLICY "Users can manage their own templates"
  ON saved_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public templates"
  ON saved_templates FOR SELECT
  USING (is_public = TRUE);

-- ============================================================
-- BUILD JOBS
-- ============================================================
CREATE POLICY "Users can manage their own build jobs"
  ON build_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TEST JOBS
-- ============================================================
CREATE POLICY "Users can manage their own test jobs"
  ON test_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SYSTEM SETTINGS (read-only for users, write for service role)
-- ============================================================
CREATE POLICY "Anyone can read non-secret system settings"
  ON system_settings FOR SELECT
  USING (is_secret = FALSE);

-- Note: Writes to system_settings should only happen via service role key
-- enforced by NOT having an INSERT/UPDATE policy for authenticated users

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUDIT LOGS (insert-only for users, read for admins via service role)
-- ============================================================
CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME subscriptions
-- Enable realtime for relevant tables
-- ============================================================
-- Run these in Supabase Dashboard > Database > Replication
-- or uncomment and run here:

-- ALTER PUBLICATION supabase_realtime ADD TABLE files;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE deployments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE build_jobs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE wallet_balances;
