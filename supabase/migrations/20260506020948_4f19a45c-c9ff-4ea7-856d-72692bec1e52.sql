-- Helper for updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  instrument text,
  secondary_instrument text,
  skill_level text,
  goals text,
  weaknesses text,
  favorite_styles text,
  preferred_practice_duration integer default 45,
  typical_practice_days text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles own select" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles own delete" on public.profiles for delete using (auth.uid() = user_id);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- practice_sessions
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  start_time timestamptz,
  end_time timestamptz,
  planned_duration_minutes integer not null default 30,
  elapsed_seconds integer default 0,
  practice_minutes integer default 0,
  practice_category text,
  session_goal text,
  pre_session_notes text,
  distraction_count integer not null default 0,
  exit_attempt_count integer not null default 0,
  focus_score numeric,
  was_resumed boolean not null default false,
  active_session_state jsonb,
  last_active_at timestamptz,
  completion_method text,
  focus_rating integer,
  progress_rating integer,
  what_practiced text,
  what_improved text,
  what_was_difficult text,
  next_step text,
  final_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practice_sessions_user_idx on public.practice_sessions(user_id, created_at desc);
alter table public.practice_sessions enable row level security;
create policy "sessions own select" on public.practice_sessions for select using (auth.uid() = user_id);
create policy "sessions own insert" on public.practice_sessions for insert with check (auth.uid() = user_id);
create policy "sessions own update" on public.practice_sessions for update using (auth.uid() = user_id);
create policy "sessions own delete" on public.practice_sessions for delete using (auth.uid() = user_id);
create trigger sessions_updated before update on public.practice_sessions for each row execute function public.set_updated_at();

-- journal_entries
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete set null,
  title text,
  content text,
  entry_type text not null default 'standalone_note',
  session_elapsed_seconds integer,
  instrument text,
  category text,
  next_step text,
  tempo integer,
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_user_idx on public.journal_entries(user_id, created_at desc);
create index journal_entries_session_idx on public.journal_entries(session_id);
alter table public.journal_entries enable row level security;
create policy "journal own select" on public.journal_entries for select using (auth.uid() = user_id);
create policy "journal own insert" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "journal own update" on public.journal_entries for update using (auth.uid() = user_id);
create policy "journal own delete" on public.journal_entries for delete using (auth.uid() = user_id);
create trigger journal_updated before update on public.journal_entries for each row execute function public.set_updated_at();

-- session_exit_attempts
create table public.session_exit_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  attempt_type text not null,
  session_elapsed_seconds integer,
  created_at timestamptz not null default now()
);
create index exit_attempts_session_idx on public.session_exit_attempts(session_id);
alter table public.session_exit_attempts enable row level security;
create policy "exit own select" on public.session_exit_attempts for select using (auth.uid() = user_id);
create policy "exit own insert" on public.session_exit_attempts for insert with check (auth.uid() = user_id);
create policy "exit own delete" on public.session_exit_attempts for delete using (auth.uid() = user_id);

-- practice_categories
create table public.practice_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
alter table public.practice_categories enable row level security;
create policy "cats own select" on public.practice_categories for select using (auth.uid() = user_id);
create policy "cats own insert" on public.practice_categories for insert with check (auth.uid() = user_id);
create policy "cats own update" on public.practice_categories for update using (auth.uid() = user_id);
create policy "cats own delete" on public.practice_categories for delete using (auth.uid() = user_id);
create trigger cats_updated before update on public.practice_categories for each row execute function public.set_updated_at();

-- repertoire_items
create table public.repertoire_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  composer_or_artist text,
  category text,
  status text default 'Learning',
  notes text,
  last_practiced_date date,
  target_tempo integer,
  current_tempo integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.repertoire_items enable row level security;
create policy "rep own select" on public.repertoire_items for select using (auth.uid() = user_id);
create policy "rep own insert" on public.repertoire_items for insert with check (auth.uid() = user_id);
create policy "rep own update" on public.repertoire_items for update using (auth.uid() = user_id);
create policy "rep own delete" on public.repertoire_items for delete using (auth.uid() = user_id);
create trigger rep_updated before update on public.repertoire_items for each row execute function public.set_updated_at();

-- user_settings
create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  appearance_mode text default 'dark',
  visual_theme text default 'minimal',
  session_alerts_enabled boolean default true,
  alert_type text default 'visual',
  default_instrument text,
  default_practice_duration integer default 45,
  preferred_categories text[] default '{}',
  next_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "settings own select" on public.user_settings for select using (auth.uid() = user_id);
create policy "settings own insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "settings own update" on public.user_settings for update using (auth.uid() = user_id);
create policy "settings own delete" on public.user_settings for delete using (auth.uid() = user_id);
create trigger settings_updated before update on public.user_settings for each row execute function public.set_updated_at();

-- handle new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();