import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { PRACTICE_CATEGORIES, type PracticeCategory, sessionStore, uid } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/session/new")({
  component: () => <AuthGate><NewSession /></AuthGate>,
  head: () => ({ meta: [{ title: "Start session — SHED" }] }),
});

const DURATIONS = [10, 20, 30, 45, 60, 90];

function NewSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState<PracticeCategory>("Technique");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const id = uid();
    sessionStore.add({
      id, user_id: user.id, date: new Date().toISOString(),
      duration_minutes: duration, category, session_goal: goal,
      pre_session_notes: notes, distractions_count: 0, completed: false,
      created_at: new Date().toISOString(),
    });
    navigate({ to: "/session/$id", params: { id } });
  }

  return (
    <AppLayout>
      <PageHeader eyebrow="Plan" title="Set the session." subtitle="Choose your duration, category, and a single clear goal." />

      <form onSubmit={start} className="space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
                  duration === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
          <input type="range" min={5} max={180} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-4 w-full accent-[var(--color-primary)]" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRACTICE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Session goal</Label>
          <Input value={goal} onChange={(e) => setGoal(e.target.value)} required className="bg-card h-11" placeholder="e.g. Clean bars 12–24 at 80 BPM" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pre-session notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-card" placeholder="Mental prep, intentions, etc." />
        </div>

        <Button type="submit" className="h-12 w-full">Begin session</Button>
      </form>
    </AppLayout>
  );
}
