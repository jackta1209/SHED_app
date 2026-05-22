CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_one_session_reflection_per_user_session
ON public.journal_entries (user_id, session_id)
WHERE entry_type = 'session_reflection' AND session_id IS NOT NULL;