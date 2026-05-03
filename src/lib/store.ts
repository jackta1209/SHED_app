// Local-first data store using localStorage.
// Structured so a Supabase backend can replace these functions later.

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Professional";

export const PRACTICE_CATEGORIES = [
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
export type PracticeCategory = (typeof PRACTICE_CATEGORIES)[number];

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
  preferred_practice_duration: number; // minutes
  typical_practice_days: string[]; // ["Mon", "Tue", ...]
  created_at: string;
  updated_at: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  date: string;
  duration_minutes: number;
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

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  category: PracticeCategory;
  piece_or_exercise: string;
  tempo?: number;
  duration_minutes?: number;
  notes: string;
  next_step: string;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  reminder_time: string; // "HH:MM"
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

export interface UserPreferences {
  id: string;
  user_id: string;
  appearance_mode: AppearanceMode;
  visual_theme: VisualTheme;
  created_at: string;
  updated_at: string;
}

const K = {
  user: "shed.user",
  profile: (uid: string) => `shed.profile.${uid}`,
  sessions: (uid: string) => `shed.sessions.${uid}`,
  journal: (uid: string) => `shed.journal.${uid}`,
  reminders: (uid: string) => `shed.reminders.${uid}`,
  routines: (uid: string) => `shed.routines.${uid}`,
  prefs: (uid: string) => `shed.prefs.${uid}`,
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
    if (isBrowser()) localStorage.removeItem(K.user);
  },
};

// --- profile ---
export const profileStore = {
  get(uid: string) {
    return read<MusicianProfile | null>(K.profile(uid), null);
  },
  save(p: MusicianProfile) {
    write(K.profile(p.user_id), p);
  },
};

// --- sessions ---
export const sessionStore = {
  list(uid: string) {
    return read<PracticeSession[]>(K.sessions(uid), []);
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

// --- journal ---
export const journalStore = {
  list(uid: string) {
    return read<JournalEntry[]>(K.journal(uid), []);
  },
  add(e: JournalEntry) {
    const all = this.list(e.user_id);
    all.unshift(e);
    write(K.journal(e.user_id), all);
  },
};

// --- reminders ---
export const remindersStore = {
  get(uid: string) {
    return read<Reminder | null>(K.reminders(uid), null);
  },
  save(r: Reminder) {
    write(K.reminders(r.user_id), r);
  },
};

// --- routines ---
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

// --- preferences ---
export const prefsStore = {
  get(uid: string): UserPreferences {
    return read<UserPreferences>(K.prefs(uid), {
      id: uid,
      user_id: uid,
      appearance_mode: "dark",
      visual_theme: "minimal",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },
  save(p: UserPreferences) {
    write(K.prefs(p.user_id), p);
  },
};

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
      detail: `Apply your warm-up gains to real material. ${
        recentCats.has("Repertoire") ? "Continue current piece." : "Pick a piece aligned with your goals."
      }`,
    },
    {
      pct: 0.2,
      title: recentCats.has("Improvisation") ? "Transcription" : "Improvisation",
      detail: "Connect the ear to the hands. 10–15 min of single-line transcription or guided improv.",
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

// --- stats ---
export function weeklyStats(sessions: PracticeSession[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  const week = sessions.filter((s) => new Date(s.date) >= start && s.completed);
  const minutes = week.reduce((a, s) => a + s.duration_minutes, 0);
  const focus = week.length ? week.reduce((a, s) => a + (s.focus_rating ?? 0), 0) / week.length : 0;
  const progress = week.length
    ? week.reduce((a, s) => a + (s.progress_rating ?? 0), 0) / week.length
    : 0;
  return { count: week.length, minutes, focus, progress };
}

export function currentStreak(sessions: PracticeSession[]) {
  const days = new Set(
    sessions.filter((s) => s.completed).map((s) => new Date(s.date).toDateString()),
  );
  let streak = 0;
  const cur = new Date();
  while (days.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
