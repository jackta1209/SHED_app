import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  generateRoutine,
  profileStore,
  routineStore,
  sessionStore,
  uid,
  type AIRoutine,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/routine")({
  component: () => (
    <AuthGate>
      <Routine />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "AI routine — SHED" }] }),
});

function Routine() {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState(45);
  const [focus, setFocus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [last, setLast] = useState<AIRoutine | null>(null);

  useEffect(() => {
    if (!user) return;
    const r = routineStore.list(user.id)[0];
    if (r) setLast(r);
  }, [user]);

  function gen(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const profile = profileStore.get(user.id);
    const recent = sessionStore
      .list(user.id)
      .filter((s) => s.status === "completed" || s.completed)
      .slice(0, 5);
    const generated = generateRoutine({ minutes, focus, profile, recent });
    const r: AIRoutine = {
      id: uid(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      available_minutes: minutes,
      focus_area: focus,
      user_prompt: prompt,
      generated_routine: generated,
    };
    routineStore.add(r);
    setLast(r);
  }

  return (
    <AppLayout>
      <BackButton fallback="/dashboard" />
      <PageHeader
        eyebrow="Plan"
        title="AI practice routine"
        subtitle="A structured plan tuned to your profile and recent sessions."
      />

      <form onSubmit={gen} className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Available time — {minutes} min
          </Label>
          <input
            type="range"
            min={10}
            max={180}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Main focus area
          </Label>
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Repertoire, Time feel"
            className="bg-surface h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Question or concern (optional)
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="bg-surface"
          />
        </div>
        <Button type="submit" className="h-12 w-full">
          <Sparkles size={14} className="mr-2" /> Generate routine
        </Button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Routines are generated from your profile and practice history. Full AI coaching can be
        connected later.
      </p>

      {last && (
        <div className="mt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Latest routine · {last.available_minutes} min
          </p>
          {last.generated_routine.map((b, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-xl">
                  {i + 1}. {b.title}
                </p>
                <p className="font-mono text-sm text-primary">{b.minutes} min</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{b.detail}</p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
