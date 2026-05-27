import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  profileStore,
  sessionStore,
  settingsStore,
  activeSessionStore,
  weeklyStats,
  currentStreak,
  type Profile,
  type PracticeSession,
  type ActiveSessionState,
} from "@/lib/store";
import { ArrowRight, Sparkles, Play, Flame } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Dashboard — SHED" }] }),
});

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [nextFocus, setNextFocus] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveSessionState | null>(null);

  useEffect(() => {
    if (!user) return;
    profileStore.get(user.id).then(setProfile);
    sessionStore.list(user.id).then(setSessions);
    settingsStore.get(user.id).then((s) => setNextFocus(s.next_focus));
    setActive(activeSessionStore.get(user.id));
  }, [user]);

  const completed = sessions.filter((s) => s.status === "completed");
  const stats = weeklyStats(sessions);
  const streak = currentStreak(sessions);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppLayout>
      <header className="mb-7">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {today}
        </p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.05]">
          Hello,{" "}
          <span className="italic">
            {profile?.display_name?.split(" ")[0] ?? "musician"}
          </span>
          .
        </h1>
        {profile?.instrument && (
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.instrument} · {profile.skill_level}
          </p>
        )}
      </header>

      {active && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <Link
            to="/session/$id"
            params={{ id: active.session_id }}
            className="flex min-w-0 flex-1 items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-primary">
                Session in progress
              </p>
              <p className="mt-1 text-sm">Tap to resume</p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-primary" />
          </Link>
          <button
            type="button"
            onClick={async () => {
              if (!user) return;
              if (
                !confirm(
                  "Discard this practice session? You can start a new one right after.",
                )
              )
                return;
              try {
                activeSessionStore.clear(user.id);
              } catch {
                /* ignore */
              }
              try {
                await sessionStore.update(
                  active.session_id,
                  { status: "abandoned", end_time: new Date().toISOString() },
                  user.id,
                );
              } catch {
                /* ignore */
              }
              setActive(null);
            }}
            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Discard
          </button>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Today's focus
        </p>
        {nextFocus ? (
          <p className="mt-2 font-serif text-2xl leading-tight">{nextFocus}</p>
        ) : (
          <p className="mt-2 font-serif text-2xl leading-tight">
            Aim for{" "}
            <span className="text-primary">
              {profile?.preferred_practice_duration ?? 45} minutes
            </span>{" "}
            of focused work.
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            to="/session/new"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-medium text-primary-foreground"
          >
            <Play size={16} /> Start practice
          </Link>
          <Link
            to="/routine"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-medium"
          >
            <Sparkles size={16} /> AI routine
          </Link>
        </div>
      </div>

      <Section title="This week">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Minutes" value={stats.minutes.toString()} />
          <Stat label="Sessions" value={stats.count.toString()} />
          <Stat label="Avg focus" value={stats.focus ? stats.focus.toFixed(1) : "—"} suffix="/5" />
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

      <Section
        title="Recent sessions"
        action={
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">
            All
          </Link>
        }
      >
        {completed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sessions yet. Start your first focused practice session.
          </div>
        ) : (
          <ul className="space-y-2">
            {completed.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link
                  to="/session/$id/summary"
                  params={{ id: s.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {s.practice_category ?? "Practice"}
                    </p>
                    <p className="mt-0.5 truncate text-sm">{s.session_goal || "Practice"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{s.practice_minutes}m</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
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
