
-- AI usage tracking table (server-side writes only via service role)
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  feature text NOT NULL DEFAULT 'ai-practice-assistant',
  model text,
  status text NOT NULL CHECK (status IN ('success','failed','blocked')),
  reason text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer
);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage rows (useful for showing remaining quota).
DROP POLICY IF EXISTS "ai_usage own select" ON public.ai_usage_events;
CREATE POLICY "ai_usage own select" ON public.ai_usage_events
  FOR SELECT USING (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE policies: only service role (edge function) writes.

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_desc_idx
  ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events (user_id, created_at);

-- Safe long-term indexes for hot read paths
CREATE INDEX IF NOT EXISTS practice_sessions_user_created_desc_idx
  ON public.practice_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS journal_entries_user_created_desc_idx
  ON public.journal_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS practice_tool_usage_user_session_idx
  ON public.practice_tool_usage (user_id, session_id);

-- App-level idempotency lookup for session reflection upsert.
-- NOT a unique constraint (existing duplicates would block the migration);
-- the partial index just makes the lookup fast.
CREATE INDEX IF NOT EXISTS journal_entries_user_session_reflection_idx
  ON public.journal_entries (user_id, session_id)
  WHERE entry_type = 'session_reflection';
