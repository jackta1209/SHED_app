-- One active session per user. Prevents duplicate-active-session races
-- where two concurrent inserts (double-tap, second tab) both pass the
-- client-side "is there already an active session?" check.
CREATE UNIQUE INDEX IF NOT EXISTS practice_sessions_one_active_per_user
  ON public.practice_sessions (user_id)
  WHERE status = 'active';