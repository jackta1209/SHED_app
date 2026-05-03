import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  profileStore, sessionStore, weeklyStats, currentStreak,
  type MusicianProfile, type PracticeSession,
} from "@/lib/store";
import { ArrowRight, Sparkles, Play, Flame } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => <AuthGate><Dashboard /></AuthGate>,
  head: () => ({ meta: [{ title: "Dashboard — SHED" }] }),
});

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MusicianProfile | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);

  useEffect(() => {
    if (!user) return;
    setProfile(profileStore.get(user.id));
    setSessions(sessionStore.list(user.id));
  }, [user]);

  const stats = weeklyStats(sessions);
  const streak = currentStreak(sessions);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppLayout>
      <header className="mb-7">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">{today}</p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.05]">
          Hello, <span className="italic">{profile?.name?.split(" ")[0] ?? "musician"}</span>.
        </h1>
        {profile?.main_instrument && (
          <p className="mt-1 text-sm text-muted-foreground">{profile.main_instrument} · {profile.skill_level}</p>
        )}
      </header>

      {/* Today's focus */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Today's focus</p>
        <p className="mt-2 font-serif text-2xl leading-tight">
          Aim for <span className="text-primary">{profile?.preferred_practice_duration ?? 45} minutes</span> of focused work.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link to="/session/new" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-medium text-primary-foreground">
            <Play size={16} /> Start practice
          </Link>
          <Link to="/routine" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-medium">
            <Sparkles size={16} /> AI routine
          </Link>
        </div>
      </div>

      {/* Stats */}
      <Section title="This week">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Minutes" value={stats.minutes.toString()} />
          <Stat label="Sessions" value={stats.count.toString()} />
          <Stat label="Avg focus" value={stats.focus ? stats.focus.toFixed(1) : "—"} suffix="/5" />
          <Stat label="Avg progress" value={stats.progress ? stats.progress.toFixed(1) : "—"} suffix="/5" />
        </div>
      </Section>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Flame size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{streak} day streak</p>
          <p className="text-xs text-muted-foreground">
            {streak === 0 ? "Practice today to start one." : "Keep showing up."}
          </p>
        </div>
      </div>

      <Section title="Recent sessions" action={<Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">All</Link>}>
        {sessions.filter((s) => s.completed).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sessions yet. Your first one will live here.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.filter((s) => s.completed).slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link to="/history" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.category}</p>
                    <p className="mt-0.5 truncate text-sm">{s.session_goal || "Practice"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{s.duration_minutes}m</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppLayout>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none">
        {value}
        {suffix && <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}
