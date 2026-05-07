import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  sessionStore,
  journalStore,
  activeSessionStore,
  exitAttemptsStore,
  profileStore,
  type PracticeSession,
  type JournalEntry,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Pause,
  Play,
  X,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  Gauge,
  Sparkles,
  FileMusic,
} from "lucide-react";
import { toast } from "sonner";
import { Metronome } from "@/components/Metronome";
import { SlowDowner } from "@/components/SlowDowner";

export const Route = createFileRoute("/session/$id")({
  component: ActiveSession,
  head: () => ({ meta: [{ title: "Session — SHED" }] }),
});

function ActiveSession() {
  const { id } = Route.useParams();
  const location = useLocation();
  const { user, prefs } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(true);
  const [distractions, setDistractions] = useState(0);
  const [exitAttempts, setExitAttempts] = useState(0);
  const [strict, setStrict] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [sessionNotes, setSessionNotes] = useState<JournalEntry[]>([]);
  const [showMetronome, setShowMetronome] = useState(false);
  const [showSlowDowner, setShowSlowDowner] = useState(false);
  const [metronomeStopSignal, setMetronomeStopSignal] = useState(0);
  const finishedRef = useRef(false);
  const alertedRef = useRef({ ten: false, one: false, done: false });
  const startedAtRef = useRef<number>(Date.now());
  const isActiveSessionRoute = location.pathname === `/session/${id}`;

  // Load session + restore active state
  useEffect(() => {
    if (!isActiveSessionRoute || !user) return;
    sessionStore.get(user.id, id).then(async (s) => {
      if (!s) {
        navigate({ to: "/dashboard" });
        return;
      }
      setSession(s);
      const total = s.planned_duration_minutes * 60;
      setTotalSeconds(total);
      const active = activeSessionStore.get(user.id);
      let wasResumed = false;
      if (active && active.session_id === id) {
        const elapsed = active.paused
          ? Math.floor(((active.paused_at ?? Date.now()) - active.started_at) / 1000)
          : Math.floor((Date.now() - active.started_at) / 1000);
        setRemaining(Math.max(0, active.duration_seconds - elapsed));
        setRunning(!active.paused);
        setDistractions(active.distractions);
        setExitAttempts(active.exit_attempts ?? 0);
        setNoteDraft(active.notes_draft);
        startedAtRef.current = active.started_at;
        wasResumed = true;
      } else {
        setRemaining(total);
        setRunning(true);
        startedAtRef.current = Date.now();
        activeSessionStore.save({
          session_id: s.id,
          user_id: user.id,
          started_at: startedAtRef.current,
          duration_seconds: total,
          remaining_seconds: total,
          paused: false,
          distractions: 0,
          exit_attempts: 0,
          notes_draft: "",
        });
      }
      if (wasResumed && !s.was_resumed) {
        sessionStore.update(s.id, { was_resumed: true });
      }
      const notes = await journalStore.forSession(user.id, id);
      setSessionNotes(notes);
    });
  }, [id, user, navigate, isActiveSessionRoute]);

  // Tick
  useEffect(() => {
    if (!running || !isActiveSessionRoute) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running, isActiveSessionRoute]);

  // Persist active state locally
  useEffect(() => {
    if (!user || !session || finishedRef.current || !isActiveSessionRoute) return;
    activeSessionStore.save({
      session_id: session.id,
      user_id: user.id,
      started_at: startedAtRef.current,
      duration_seconds: totalSeconds,
      remaining_seconds: remaining,
      paused: !running,
      paused_at: !running ? Date.now() : undefined,
      distractions,
      exit_attempts: exitAttempts,
      notes_draft: noteDraft,
    });
  }, [
    user,
    session,
    running,
    remaining,
    distractions,
    exitAttempts,
    noteDraft,
    totalSeconds,
    isActiveSessionRoute,
  ]);

  function logExit(type: Parameters<typeof exitAttemptsStore.log>[0]["attempt_type"]) {
    if (!user || !session || finishedRef.current) return;
    setExitAttempts((n) => n + 1);
    exitAttemptsStore.log({
      user_id: user.id,
      session_id: session.id,
      attempt_type: type,
      session_elapsed_seconds: Math.max(0, totalSeconds - remaining),
    });
  }

  // Tab hidden detection (exit attempt + distraction)
  useEffect(() => {
    if (!isActiveSessionRoute) return;
    function onHidden() {
      if (document.visibilityState === "hidden") {
        setDistractions((d) => d + 1);
        logExit("tab_hidden");
        if (strict) toast.warning("Stay in the session.");
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strict, isActiveSessionRoute, session, totalSeconds, remaining]);

  // beforeunload
  useEffect(() => {
    if (!isActiveSessionRoute) return;
    const handler = (e: BeforeUnloadEvent) => {
      logExit("page_unload_attempt");
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveSessionRoute, session, totalSeconds, remaining]);

  // Timer alerts
  useEffect(() => {
    if (!prefs?.session_alerts_enabled) return;
    const fire = (msg: string) => {
      toast(msg);
      const t = prefs.alert_type;
      if ((t === "vibration" || t === "sound_vibration") && "vibrate" in navigator) {
        navigator.vibrate?.([120, 60, 120]);
      }
    };
    if (!alertedRef.current.ten && remaining === 600 && totalSeconds > 600) {
      alertedRef.current.ten = true;
      fire("10 minutes left — stay focused.");
    }
    if (!alertedRef.current.one && remaining === 60 && totalSeconds > 60) {
      alertedRef.current.one = true;
      fire("1 minute left — finish strong.");
    }
    if (!alertedRef.current.done && remaining === 0) {
      alertedRef.current.done = true;
      fire("Session complete — time to reflect.");
    }
  }, [remaining, prefs, totalSeconds]);

  // Auto-finish on timer end
  useEffect(() => {
    if (!session || finishedRef.current) return;
    if (remaining === 0 && totalSeconds > 0) {
      completeSession("timer_complete");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session, totalSeconds]);

  if (!isActiveSessionRoute) return <Outlet />;
  if (!session) return null;

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = totalSeconds ? 1 - remaining / totalSeconds : 0;

  function elapsedSeconds() {
    return Math.max(0, totalSeconds - remaining);
  }
  function elapsedLabel() {
    const e = elapsedSeconds();
    return `${Math.floor(e / 60)}:${(e % 60).toString().padStart(2, "0")} into session`;
  }

  async function saveQuickNote() {
    if (!user || !session) return;
    const content = noteDraft.trim();
    if (!content) return;
    const profile = await profileStore.get(user.id);
    const now = new Date();
    const title = `Quick Note — ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    await journalStore.add({
      user_id: user.id,
      session_id: session.id,
      entry_type: "quick_note",
      title,
      content,
      category: session.practice_category,
      instrument: profile?.instrument ?? null,
      session_elapsed_seconds: elapsedSeconds(),
      tempo: null,
      duration_minutes: null,
      next_step: null,
    });
    const notes = await journalStore.forSession(user.id, session.id);
    setSessionNotes(notes);
    setNoteDraft("");
    toast.success("Note saved to journal");
  }

  async function completeSession(reason: "manual_finish" | "timer_complete") {
    if (!session || !user) return;
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setMetronomeStopSignal((n) => n + 1);

    const now = new Date().toISOString();
    const elapsedSec = elapsedSeconds();
    const planned = session.planned_duration_minutes;
    const practiceMinutes =
      reason === "timer_complete"
        ? planned
        : Math.max(1, Math.min(planned, Math.ceil(elapsedSec / 60)));
    const focusScore = Math.max(
      0,
      Math.min(100, Math.round(100 - (distractions * 10 + exitAttempts * 5))),
    );

    try {
      await sessionStore.update(session.id, {
        status: "completed",
        completion_method: reason,
        end_time: now,
        elapsed_seconds: reason === "timer_complete" ? planned * 60 : elapsedSec,
        practice_minutes: practiceMinutes,
        distraction_count: distractions,
        exit_attempt_count: exitAttempts,
        focus_score: focusScore,
      });
    } catch (err) {
      console.error("Failed saving session", err);
    }
    try {
      activeSessionStore.clear(user.id);
    } catch {
      /* ignore */
    }
    navigate({ to: "/session/$id/reflect", params: { id: session.id } });
  }

  function finish() {
    if (finishedRef.current) return;
    if (!confirm("Finish this practice session and move to reflection?")) return;
    completeSession("manual_finish");
  }

  async function abandon() {
    if (
      !confirm("End this session without saving a reflection? Your quick notes will still be kept.")
    )
      return;
    if (user && session) {
      await sessionStore.update(session.id, {
        status: "abandoned",
        end_time: new Date().toISOString(),
        elapsed_seconds: elapsedSeconds(),
        distraction_count: distractions,
        exit_attempt_count: exitAttempts,
      });
      activeSessionStore.clear(user.id);
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {session.practice_category}
            </p>
            <p className="mt-1 max-w-[18rem] truncate text-sm">{session.session_goal}</p>
          </div>
          <button
            onClick={abandon}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="my-8 flex flex-col items-center">
          <div className="relative h-60 w-60">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-border)" strokeWidth="2" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-6xl tracking-tight tabular-nums">
                {mm}:{ss}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {running ? "Focused" : "Paused"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-12 flex-1"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? (
              <>
                <Pause size={16} className="mr-2" /> Pause
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" /> Resume
              </>
            )}
          </Button>
          <Button type="button" className="h-12 flex-1" onClick={finish}>
            Finish Session
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => setDistractions((d) => d + 1)}
            className="rounded-xl border border-border bg-card p-3 text-left"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <AlertTriangle size={12} /> Distractions
            </div>
            <p className="mt-1 font-mono text-2xl">{distractions}</p>
            <p className="text-[11px] text-muted-foreground">Tap to log · {exitAttempts} exits</p>
          </button>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Strict focus
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm">{strict ? "On" : "Off"}</span>
              <Switch checked={strict} onCheckedChange={setStrict} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Warns on exit</p>
          </div>
        </div>

        {/* Quick note */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Quick note · {elapsedLabel()}
          </p>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            placeholder="Capture a thought, fix, or breakthrough…"
            className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Saves to journal · {sessionNotes.length} this session
            </p>
            <Button size="sm" onClick={saveQuickNote} disabled={!noteDraft.trim()}>
              <Send size={12} className="mr-1" /> Save note
            </Button>
          </div>
          {sessionNotes.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-border pt-3">
              {sessionNotes.slice(0, 3).map((n) => (
                <li key={n.id} className="text-xs">
                  <p className="text-muted-foreground">
                    {n.session_elapsed_seconds != null
                      ? `${Math.floor(n.session_elapsed_seconds / 60)}:${(n.session_elapsed_seconds % 60).toString().padStart(2, "0")}`
                      : ""}
                  </p>
                  <p className="text-foreground/90 whitespace-pre-wrap">{n.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowMetronome((s) => !s)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            <span>Metronome</span>
            {showMetronome ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showMetronome && (
            <div className="mt-2">
              <Metronome compact stopSignal={metronomeStopSignal} />
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <ToolCard icon={<Gauge size={14} />} label="Slow Downer" status="Coming soon" />
          <ToolCard icon={<Sparkles size={14} />} label="AI Assistant" status="Coming soon" />
          <ToolCard icon={<FileMusic size={14} />} label="Sheet Reader" status="Coming soon" />
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-left opacity-80">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{status}</p>
    </div>
  );
}
