import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { sessionStore, type PracticeSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pause, Play, X, Music2, Gauge, FileMusic, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/session/$id")({
  component: ActiveSession,
  head: () => ({ meta: [{ title: "Session — SHED" }] }),
});

function ActiveSession() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(true);
  const [distractions, setDistractions] = useState(0);
  const [strict, setStrict] = useState(false);
  const [notes, setNotes] = useState("");
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    const s = sessionStore.list(user.id).find((x) => x.id === id);
    if (!s) {
      navigate({ to: "/dashboard" });
      return;
    }
    setSession(s);
    setRemaining(s.duration_minutes * 60);
    setNotes(s.quick_notes ?? "");
    setDistractions(s.distractions_count ?? 0);
  }, [id, user, navigate]);

  // tick
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  // distraction detection: tab visibility / blur
  // TODO (native): on a native mobile build, use AppState (RN) or background events
  // to track real app exits. Strict Focus Mode could use a kiosk lock there.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === "hidden") {
        setDistractions((d) => d + 1);
        if (strict) toast.warning("Stay in the session.");
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [strict]);

  // strict mode: warn before leaving
  useEffect(() => {
    if (!strict) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [strict]);

  if (!session) return null;

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = 1 - remaining / (session.duration_minutes * 60);

  function finish() {
    if (!session) return;
    const elapsed = Math.round((Date.now() - startedAt.current) / 60000);
    const final: PracticeSession = {
      ...session,
      duration_minutes: Math.max(1, Math.min(session.duration_minutes, elapsed || session.duration_minutes - Math.floor(remaining / 60))),
      distractions_count: distractions,
      quick_notes: notes,
    };
    sessionStore.update(final);
    navigate({ to: "/session/$id/reflect", params: { id: session.id } });
  }

  function abandon() {
    if (strict && !confirm("Strict Focus is on. Leave anyway?")) return;
    if (!confirm("End this session without saving a reflection?")) return;
    navigate({ to: "/dashboard" });
  }

  if (remaining === 0 && running) {
    setRunning(false);
    toast.success("Time's up. Reflect on your session.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{session.category}</p>
            <p className="mt-1 max-w-[18rem] truncate text-sm">{session.session_goal}</p>
          </div>
          <button onClick={abandon} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="my-10 flex flex-col items-center">
          <div className="relative h-64 w-64">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-border)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="46" fill="none"
                stroke="var(--color-primary)" strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-6xl tracking-tight tabular-nums">{mm}:{ss}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {running ? "Focused" : "Paused"}
              </p>
            </div>
          </div>
          <p className="mt-6 font-serif text-lg italic text-muted-foreground">"Stay in the session."</p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <Button variant="secondary" className="h-12 flex-1" onClick={() => setRunning((r) => !r)}>
            {running ? <><Pause size={16} className="mr-2" /> Pause</> : <><Play size={16} className="mr-2" /> Resume</>}
          </Button>
          <Button className="h-12 flex-1" onClick={finish}>Finish</Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => setDistractions((d) => d + 1)} className="rounded-xl border border-border bg-card p-3 text-left">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <AlertTriangle size={12} /> Distractions
            </div>
            <p className="mt-1 font-mono text-2xl">{distractions}</p>
            <p className="text-[11px] text-muted-foreground">Tap to log</p>
          </button>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Strict focus</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm">{strict ? "On" : "Off"}</span>
              <Switch checked={strict} onCheckedChange={setStrict} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Warns on exit</p>
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Quick notes…"
          className="mt-4 w-full rounded-xl border border-border bg-card p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { Icon: Gauge, label: "Metronome" },
            { Icon: Music2, label: "Slow Down" },
            { Icon: FileMusic, label: "Sheets" },
            { Icon: Sparkles, label: "AI" },
          ].map(({ Icon, label }) => (
            <button key={label} onClick={() => toast("Coming soon", { description: label })} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
