// Supabase-backed data store for SHED.
// Active-session timer state and a few non-critical local prefs (reminders, AI routines)
// remain in localStorage as a safe fallback per the spec.

import { supabase } from "@/integrations/supabase/client";

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Professional";

export const DEFAULT_PRACTICE_CATEGORIES = [
  "Technique",
  "Repertoire",
  "Transcription",
  "Improvisation",
  "Sight-reading",
  "Ear training",
  "Time feel",
  "Composition",
  "Warm-up",
  "Other",
] as const;
export type PracticeCategory = string;
export const PRACTICE_CATEGORIES = DEFAULT_PRACTICE_CATEGORIES;

// --- Types (DB-aligned) ---

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  instrument: string | null;
  secondary_instrument: string | null;
  skill_level: SkillLevel | null;
  goals: string | null;
  weaknesses: string | null;
  favorite_styles: string | null;
  preferred_practice_duration: number;
  typical_practice_days: string[];
  created_at: string;
  updated_at: string;
}

export type SessionStatus = "active" | "completed" | "abandoned";
export type CompletionMethod = "manual_finish" | "timer_complete";

export interface PracticeSession {
  id: string;
  user_id: string;
  status: SessionStatus;
  start_time: string | null;
  end_time: string | null;
  planned_duration_minutes: number;
  elapsed_seconds: number;
  practice_minutes: number;
  practice_category: string | null;
  session_goal: string | null;
  pre_session_notes: string | null;
  distraction_count: number;
  exit_attempt_count: number;
  focus_score: number | null;
  was_resumed: boolean;
  completion_method: CompletionMethod | null;
  focus_rating: number | null;
  progress_rating: number | null;
  what_practiced: string | null;
  what_improved: string | null;
  what_was_difficult: string | null;
  next_step: string | null;
  final_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type JournalEntryType =
  | "quick_note"
  | "session_reflection"
  | "standalone_note";

export interface JournalEntry {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string | null;
  content: string | null;
  entry_type: JournalEntryType;
  session_elapsed_seconds: number | null;
  instrument: string | null;
  category: string | null;
  next_step: string | null;
  tempo: number | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export type AppearanceMode = "light" | "dark" | "system";
export type VisualTheme = "minimal" | "warm" | "contrast" | "studio";
export type AlertType = "visual" | "sound" | "vibration" | "sound_vibration";

export interface UserSettings {
  id: string;
  user_id: string;
  appearance_mode: AppearanceMode;
  visual_theme: VisualTheme;
  session_alerts_enabled: boolean;
  alert_type: AlertType;
  default_instrument: string | null;
  default_practice_duration: number;
  preferred_categories: string[];
  next_focus: string | null;
  inactivity_timeout_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface ActiveSessionState {
  session_id: string;
  user_id: string;
  started_at: number;
  duration_seconds: number;
  remaining_seconds: number;
  paused: boolean;
  paused_at?: number;
  distractions: number;
  exit_attempts: number;
  notes_draft: string;
}

// Reminder / AIRoutine kept local for now (not in required persistence scope)
export interface Reminder {
  id: string;
  user_id: string;
  reminder_time: string;
  days_of_week: string[];
  reminder_message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface AIRoutine {
  id: string;
  user_id: string;
  created_at: string;
  available_minutes: number;
  focus_area: string;
  user_prompt?: string;
  generated_routine: { title: string; minutes: number; detail: string }[];
}

// --- localStorage helpers (active session only) ---
const isBrowser = () => typeof window !== "undefined";
const K = {
  active: (uid: string) => `shed.active.${uid}`,
  reminders: (uid: string) => `shed.reminders.${uid}`,
  routines: (uid: string) => `shed.routines.${uid}`,
};
function lsRead<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsWrite<T>(key: string, value: T) {
  if (isBrowser()) localStorage.setItem(key, JSON.stringify(value));
}
function lsRemove(key: string) {
  if (isBrowser()) localStorage.removeItem(key);
}

// ---------- Profiles ----------
export const profileStore = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("profile.get", error);
      return null;
    }
    return data as Profile | null;
  },
  async save(input: Partial<Profile> & { user_id: string }): Promise<Profile | null> {
    const payload = { ...input };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (error) {
      console.error("profile.save", error);
      return null;
    }
    return data as Profile;
  },
};

// ---------- Sessions ----------
export const sessionStore = {
  async list(userId: string): Promise<PracticeSession[]> {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("sessions.list", error);
      return [];
    }
    return (data ?? []) as PracticeSession[];
  },
  async listCompleted(userId: string): Promise<PracticeSession[]> {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("sessions.listCompleted", error);
      return [];
    }
    return (data ?? []) as PracticeSession[];
  },
  async findActive(userId: string): Promise<PracticeSession | null> {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("sessions.findActive", error);
      return null;
    }
    return data as PracticeSession | null;
  },
  async get(userId: string, id: string): Promise<PracticeSession | null> {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("sessions.get", error);
      return null;
    }
    return data as PracticeSession | null;
  },
  async create(input: {
    user_id: string;
    planned_duration_minutes: number;
    practice_category: string;
    session_goal: string;
    pre_session_notes?: string;
  }): Promise<PracticeSession | null> {
    const { data, error } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: input.user_id,
        status: "active",
        start_time: new Date().toISOString(),
        planned_duration_minutes: input.planned_duration_minutes,
        practice_category: input.practice_category,
        session_goal: input.session_goal,
        pre_session_notes: input.pre_session_notes ?? null,
      })
      .select()
      .single();
    if (error) {
      // Postgres unique_violation. Means a concurrent insert (or a leftover
      // active session) already exists — fall back to the existing one so
      // the user is taken into their real session instead of seeing an error.
      if ((error as { code?: string }).code === "23505") {
        const existing = await this.findActive(input.user_id);
        if (existing) return existing;
      }
      console.error("sessions.create", error);
      return null;
    }
    return data as PracticeSession;
  },
  async update(id: string, patch: Partial<PracticeSession>, userId?: string): Promise<PracticeSession | null> {
    let q = supabase.from("practice_sessions").update(patch).eq("id", id);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q.select().single();
    if (error) {
      console.error("sessions.update", error);
      return null;
    }
    return data as PracticeSession;
  },
};

// ---------- Journal ----------
export const journalStore = {
  async list(userId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("journal.list", error);
      return [];
    }
    return (data ?? []) as JournalEntry[];
  },
  async forSession(userId: string, sessionId: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("journal.forSession", error);
      return [];
    }
    return (data ?? []) as JournalEntry[];
  },
  async add(
    input: Omit<JournalEntry, "id" | "created_at" | "updated_at"> & {
      id?: string;
    },
  ): Promise<JournalEntry | null> {
    const { data, error } = await supabase
      .from("journal_entries")
      .insert(input)
      .select()
      .single();
    if (error) {
      console.error("journal.add", error);
      return null;
    }
    return data as JournalEntry;
  },
  /**
   * Idempotent upsert for a session's reflection entry. If a
   * session_reflection row already exists for (user_id, session_id), it is
   * updated; otherwise a new one is inserted. Prevents duplicate reflection
   * entries on double-click, back/forward navigation, or resubmit.
   */
  async upsertSessionReflection(
    input: Omit<JournalEntry, "id" | "created_at" | "updated_at">,
  ): Promise<JournalEntry | null> {
    const { user_id, session_id } = input;
    if (!session_id) {
      // Fall back to insert if there's no session id to dedupe against.
      return this.add(input);
    }
    const { data: existing, error: findErr } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("user_id", user_id)
      .eq("session_id", session_id)
      .eq("entry_type", "session_reflection")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (findErr) {
      console.error("journal.upsertSessionReflection.find", findErr);
      return null;
    }
    if (existing) {
      const { data, error } = await supabase
        .from("journal_entries")
        .update({
          title: input.title,
          content: input.content,
          category: input.category,
          instrument: input.instrument,
          next_step: input.next_step,
          tempo: input.tempo,
          duration_minutes: input.duration_minutes,
        })
        .eq("id", existing.id)
        .eq("user_id", user_id)
        .select()
        .single();
      if (error) {
        console.error("journal.upsertSessionReflection.update", error);
        return null;
      }
      return data as JournalEntry;
    }
    return this.add(input);
  },
};

// ---------- Exit attempts ----------
export type ExitAttemptType =
  | "route_change_attempt"
  | "browser_refresh_attempt"
  | "tab_hidden"
  | "page_unload_attempt"
  | "back_button_attempt";

export const exitAttemptsStore = {
  async log(input: {
    user_id: string;
    session_id: string;
    attempt_type: ExitAttemptType;
    session_elapsed_seconds?: number;
  }) {
    const { error } = await supabase.from("session_exit_attempts").insert(input);
    if (error) console.error("exit.log", error);
  },
  async forSession(userId: string, sessionId: string) {
    const { data, error } = await supabase
      .from("session_exit_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId);
    if (error) {
      console.error("exit.forSession", error);
      return [];
    }
    return data ?? [];
  },
};

// ---------- Settings ----------
export const settingsStore = {
  async get(userId: string): Promise<UserSettings> {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data as UserSettings;
    // Ensure row exists. UPSERT (not INSERT) so a concurrent insert that
    // raced ahead of us doesn't crash with a unique-constraint error and
    // leave callers with `null`.
    const { data: created, error: upsertErr } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId }, { onConflict: "user_id" })
      .select()
      .single();
    if (created) return created as UserSettings;
    // Last-ditch: re-read in case upsert conflict path returned nothing.
    const { data: refetched } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (refetched) return refetched as UserSettings;
    if (upsertErr) console.error("settings.get.upsert", upsertErr);
    // Defensive: synthesize a minimal in-memory settings object so callers
    // can still render and field-access without crashing.
    return { user_id: userId } as UserSettings;
  },
  async save(userId: string, patch: Partial<UserSettings>): Promise<UserSettings | null> {
    const { data, error } = await supabase
      .from("user_settings")
      .update(patch)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) {
      console.error("settings.save", error);
      return null;
    }
    return data as UserSettings;
  },
};
// alias for legacy name
export const prefsStore = settingsStore;

// ---------- Custom categories ----------
export const customCategoriesStore = {
  async list(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("practice_categories")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("cats.list", error);
      return [];
    }
    return (data ?? []).map((r: { name: string }) => r.name);
  },
  async add(userId: string, name: string) {
    const cleaned = name.trim();
    if (!cleaned) return;
    if ((DEFAULT_PRACTICE_CATEGORIES as readonly string[]).includes(cleaned)) return;
    const { error } = await supabase
      .from("practice_categories")
      .insert({ user_id: userId, name: cleaned });
    if (error && error.code !== "23505") console.error("cats.add", error);
  },
  async remove(userId: string, name: string) {
    await supabase
      .from("practice_categories")
      .delete()
      .eq("user_id", userId)
      .eq("name", name);
  },
};

export async function allCategories(userId: string): Promise<string[]> {
  const custom = await customCategoriesStore.list(userId);
  return [...DEFAULT_PRACTICE_CATEGORIES, ...custom];
}

// ---------- Active session state (local) ----------
export const activeSessionStore = {
  get(userId: string) {
    return lsRead<ActiveSessionState | null>(K.active(userId), null);
  },
  save(s: ActiveSessionState) {
    lsWrite(K.active(s.user_id), s);
  },
  clear(userId: string) {
    lsRemove(K.active(userId));
  },
};

// ---------- Reminders / Routines (local fallback) ----------
export const remindersStore = {
  get(uid: string) {
    return lsRead<Reminder | null>(K.reminders(uid), null);
  },
  save(r: Reminder) {
    lsWrite(K.reminders(r.user_id), r);
  },
};
export const routineStore = {
  list(uid: string) {
    return lsRead<AIRoutine[]>(K.routines(uid), []);
  },
  add(r: AIRoutine) {
    const all = this.list(r.user_id);
    all.unshift(r);
    lsWrite(K.routines(r.user_id), all);
  },
};

// ---------- Pure helpers ----------
export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function generateRoutine(input: {
  minutes: number;
  focus: string;
  profile?: Profile | null;
  recent?: PracticeSession[];
}): AIRoutine["generated_routine"] {
  const total = Math.max(10, Math.min(240, input.minutes));
  const inst = input.profile?.instrument ?? "your instrument";
  const weak = input.profile?.weaknesses?.split(",")[0]?.trim() || "weak spots";
  const recentCats = new Set(
    (input.recent ?? []).slice(0, 5).map((s) => s.practice_category ?? ""),
  );
  const blocks = [
    { pct: 0.15, title: "Warm-up", detail: `Long tones, scales, or technical fundamentals on ${inst}.` },
    { pct: 0.25, title: "Technique", detail: `Target ${weak}. Use a metronome, isolate the smallest unit.` },
    {
      pct: 0.3,
      title: input.focus || "Repertoire",
      detail: recentCats.has("Repertoire") ? "Continue current piece." : "Pick a piece aligned with your goals.",
    },
    {
      pct: 0.2,
      title: recentCats.has("Improvisation") ? "Transcription" : "Improvisation",
      detail: "Connect the ear to the hands. 10–15 min of single-line transcription or guided improv.",
    },
    { pct: 0.1, title: "Reflection", detail: "Write 2 sentences: what improved, what to try tomorrow." },
  ];
  return blocks.map((b) => ({
    title: b.title,
    minutes: Math.max(2, Math.round(total * b.pct)),
    detail: b.detail,
  }));
}

export function weeklyStats(sessions: PracticeSession[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  const week = sessions.filter(
    (s) => s.status === "completed" && new Date(s.created_at) >= start,
  );
  const minutes = week.reduce((a, s) => a + (s.practice_minutes ?? 0), 0);
  const focus = week.length ? week.reduce((a, s) => a + (s.focus_rating ?? 0), 0) / week.length : 0;
  const progress = week.length
    ? week.reduce((a, s) => a + (s.progress_rating ?? 0), 0) / week.length
    : 0;
  return { count: week.length, minutes, focus, progress };
}

export function currentStreak(sessions: PracticeSession[]) {
  const days = new Set(
    sessions
      .filter((s) => s.status === "completed")
      .map((s) => new Date(s.created_at).toDateString()),
  );
  let streak = 0;
  const cur = new Date();
  while (days.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
