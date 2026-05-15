CREATE TABLE public.practice_tool_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid,
  tool_name text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  total_seconds integer NOT NULL DEFAULT 0,
  usage_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tool_usage own select" ON public.practice_tool_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tool_usage own insert" ON public.practice_tool_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tool_usage own update" ON public.practice_tool_usage
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tool_usage own delete" ON public.practice_tool_usage
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_tool_usage_updated_at
  BEFORE UPDATE ON public.practice_tool_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tool_usage_user_session ON public.practice_tool_usage(user_id, session_id);
CREATE INDEX idx_tool_usage_user_tool ON public.practice_tool_usage(user_id, tool_name);
