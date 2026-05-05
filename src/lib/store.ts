// Local-first data store using localStorage.
// Structured so a Supabase backend can replace these functions later.

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
// Back-compat alias still imported by some routes.
export const PRACTICE_CATEGORIES = DEFAULT_PRACTICE_CATEGORIES;

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface MusicianProfile {
  id: string;
  user_id: string;
  name: string;
  main_instrument: string;
  secondary_instrument?: string;
  skill_level: SkillLevel;
  goals: string;
  weaknesses: string;
  favorite_styles: string;
  preferred_practice_duration: number;
  typical_practice_days: string[];
  created_at: string;
  updated_at: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  date: string;
  duration_minutes: number;
  planned_duration_minutes?: number;
  practice_minutes?: number;
  elapsed_seconds?: number;
  start_time?: string;
  end_time?: string;
  status?: "active" | "completed" | "abandoned";
  completion_method?: "manual_finish" | "timer_complete";
  category: PracticeCategory;
  session_goal: string;
  pre_session_notes?: string;
  quick_notes?: string;
  what_practiced?: string;
  what_improved?: string;
  what_was_difficult?: string;
  next_step?: string;
  focus_rating?: number;
  progress_rating?: number;
  distractions_count: number;
  completed: boolean;
  created_at: string;
}

export type JournalEntryType = "manual" | "quick_note" | "session_reflection";

export interface JournalEntry {
  id: string;
  user_id: string;
  session_id?: string;
  entry_type: JournalEntryType;
  title: string;
  content: string;
  // legacy / optional structured fields
  category?: PracticeCategory;
  piece_or_exercise?: string;
  tempo?: number;
  duration_minutes?: number;
  notes?: string;
  next_step?: string;
  instrument?: string;
  session_elapsed_seconds?: number;
  date: string;
  created_at: string;
  updated_at: string;
}

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

export type AppearanceMode = "light" | "dark" | "system";
export type VisualTheme = "minimal" | "warm" | "contrast" | "studio";
export type AlertType = "visual" | "sound" | "vibration" | "sound_vibration";

export interface UserPreferences {
  id: string;
  user_id: string;
  appearance_mode: AppearanceMode;
  visual_theme: VisualTheme;
  session_alerts_enabled: boolean;
  alert_type: AlertType;
  next_focus?: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveSessionState {
  session_id: string;
  user_id: string;
  started_at: number; // epoch ms
  duration_seconds: number;
  remaining_seconds: number;
  paused: boolean;
  paused_at?: number;
  distractions: number;
  notes_draft: string;
}

const K = {
  user: "shed.user",
  profile: (uid: string) => `shed.profile.${uid}`,
  sessions: (uid: string) => `shed.sessions.${uid}`,
  journal: (uid: string) => `shed.journal.${uid}`,
  reminders: (uid: string) => `shed.reminders.${uid}`,
  routines: (uid: string) => `shed.routines.${uid}`,
  prefs: (uid: string) => `shed.prefs.${uid}`,
  active: (uid: string) => `shed.active.${uid}`,
  customCats: (uid: string) => `shed.cats.${uid}`,
};

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}
function remove(key: string) {
  if (isBrowser()) localStorage.removeItem(key);
}
export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- auth (mock) ---
export const auth = {
  current(): User | null {
    return read<User | null>(K.user, null);
  },
  signUp(email: string): User {
    const u: User = { id: uid(), email, created_at: new Date().toISOString() };
    write(K.user, u);
    return u;
  },
  signIn(email: string): User {
    const existing = read<User | null>(K.user, null);
    if (existing && existing.email === email) return existing;
    return this.signUp(email);
  },
  signOut() {
    remove(K.user);
  },
};

export const profileStore = {
  get(uid: string) {
    return read<MusicianProfile | null>(K.profile(uid), null);
  },
  save(p: MusicianProfile) {
    write(K.profile(p.user_id), p);
  },
};

export const sessionStore = {
  list(uid: string) {
    return read<PracticeSession[]>(K.sessions(uid), []);
  },
  get(uid: string, id: string) {
    return this.list(uid).find((s) => s.id === id) ?? null;
  },
  add(s: PracticeSession) {
    const all = this.list(s.user_id);
    all.unshift(s);
    write(K.sessions(s.user_id), all);
  },
  update(s: PracticeSession) {
    const all = this.list(s.user_id).map((x) => (x.id === s.id ? s : x));
    write(K.sessions(s.user_id), all);
  },
};

export const journalStore = {
  list(uid: string) {
    return read<JournalEntry[]>(K.journal(uid), []);
  },
  forSession(uid: string, sessionId: string) {
    return this.list(uid).filter((e) => e.session_id === sessionId);
  },
  add(e: JournalEntry) {
    const all = this.list(e.user_id);
    all.unshift(e);
    write(K.journal(e.user_id), all);
  },
  update(e: JournalEntry) {
    const all = this.list(e.user_id).map((x) => (x.id === e.id ? e : x));
    write(K.journal(e.user_id), all);
  },
};

export const remindersStore = {
  get(uid: string) {
    return read<Reminder | null>(K.reminders(uid), null);
  },
  save(r: Reminder) {
    write(K.reminders(r.user_id), r);
  },
};

export const routineStore = {
  list(uid: string) {
    return read<AIRoutine[]>(K.routines(uid), []);
  },
  add(r: AIRoutine) {
    const all = this.list(r.user_id);
    all.unshift(r);
    write(K.routines(r.user_id), all);
  },
};

export const prefsStore = {
  get(uid: string): UserPreferences {
    const stored = read<Partial<UserPreferences> | null>(K.prefs(uid), null);
    const now = new Date().toISOString();
    return {
      id: uid,
      user_id: uid,
      appearance_mode: "dark",
      visual_theme: "minimal",
      session_alerts_enabled: true,
      alert_type: "visual",
      created_at: now,
      updated_at: now,
      ...(stored ?? {}),
    };
  },
  save(p: UserPreferences) {
    write(K.prefs(p.user_id), p);
  },
};

export const activeSessionStore = {
  get(uid: string) {
    return read<ActiveSessionState | null>(K.active(uid), null);
  },
  save(s: ActiveSessionState) {
    write(K.active(s.user_id), s);
  },
  clear(uid: string) {
    remove(K.active(uid));
  },
};

export const customCategoriesStore = {
  list(uid: string) {
    return read<string[]>(K.customCats(uid), []);
  },
  add(uid: string, name: string) {
    const cleaned = name.trim();
    if (!cleaned) return;
    const all = this.list(uid);
    if (
      all.includes(cleaned) ||
      (DEFAULT_PRACTICE_CATEGORIES as readonly string[]).includes(cleaned)
    )
      return;
    all.push(cleaned);
    write(K.customCats(uid), all);
  },
  remove(uid: string, name: string) {
    write(
      K.customCats(uid),
      this.list(uid).filter((c) => c !== name),
    );
  },
};

export function allCategories(uid: string): string[] {
  return [...DEFAULT_PRACTICE_CATEGORIES, ...customCategoriesStore.list(uid)];
}

// --- mock AI routine generator ---
export function generateRoutine(input: {
  minutes: number;
  focus: string;
  profile?: MusicianProfile | null;
  recent?: PracticeSession[];
}): AIRoutine["generated_routine"] {
  const total = Math.max(10, Math.min(240, input.minutes));
  const inst = input.profile?.main_instrument ?? "your instrument";
  const weak = input.profile?.weaknesses?.split(",")[0]?.trim() || "weak spots";
  const recentCats = new Set((input.recent ?? []).slice(0, 5).map((s) => s.category));
  const blocks: { pct: number; title: string; detail: string }[] = [
    {
      pct: 0.15,
      title: "Warm-up",
      detail: `Long tones, scales, or technical fundamentals on ${inst}. Move slowly; quality over speed.`,
    },
    {
      pct: 0.25,
      title: "Technique",
      detail: `Target ${weak}. Use a metronome, isolate the smallest unit that's failing, and loop it.`,
    },
    {
      pct: 0.3,
      title: input.focus || "Repertoire",
      detail: `Apply your warm-up gains to real material. ${recentCats.has("Repertoire") ? "Continue current piece." : "Pick a piece aligned with your goals."}`,
    },
    {
      pct: 0.2,
      title: recentCats.has("Improvisation") ? "Transcription" : "Improvisation",
      detail:
        "Connect the ear to the hands. 10–15 min of single-line transcription or guided improv.",
    },
    {
      pct: 0.1,
      title: "Reflection",
      detail: "Write 2 sentences: what improved, what to try tomorrow.",
    },
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
    (s) => new Date(s.date) >= start && (s.status === "completed" || s.completed),
  );
  const minutes = week.reduce((a, s) => a + (s.practice_minutes ?? s.duration_minutes), 0);
  const focus = week.length ? week.reduce((a, s) => a + (s.focus_rating ?? 0), 0) / week.length : 0;
  const progress = week.length
    ? week.reduce((a, s) => a + (s.progress_rating ?? 0), 0) / week.length
    : 0;
  return { count: week.length, minutes, focus, progress };
}

export function currentStreak(sessions: PracticeSession[]) {
  const days = new Set(
    sessions
      .filter((s) => s.status === "completed" || s.completed)
      .map((s) => new Date(s.date).toDateString()),
  );
  let streak = 0;
  const cur = new Date();
  while (days.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
