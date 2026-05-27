import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  sessionStore,
  allCategories,
  customCategoriesStore,
  settingsStore,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/BackButton";
import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/session/new")({
  component: () => (
    <AuthGate>
      <NewSession />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Start session — SHED" }] }),
});

const DURATIONS = [10, 20, 30, 45, 60, 90];
const MAX_CATEGORIES = 5;

function NewSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [duration, setDuration] = useState(30);
  const [selectedCats, setSelectedCats] = useState<string[]>(["Technique"]);
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [newCat, setNewCat] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [nextFocus, setNextFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    allCategories(user.id).then(setCats);
    settingsStore.get(user.id).then((s) => setNextFocus(s.next_focus));
  }, [user]);

  function toggleCat(c: string) {
    setSelectedCats((prev) => {
      if (prev.includes(c)) {
        // Keep at least one selected
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== c);
      }
      if (prev.length >= MAX_CATEGORIES) {
        toast.message(`You can choose up to ${MAX_CATEGORIES} topics.`);
        return prev;
      }
      return [...prev, c];
    });
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (selectedCats.length === 0) {
      toast.error("Choose at least one topic.");
      return;
    }
    setBusy(true);
    try {
      const existing = await sessionStore.findActive(user.id);
      if (existing) {
        toast.message("You already have an active session. Resuming it instead.");
        navigate({ to: "/session/$id", params: { id: existing.id } });
        return;
      }

      const primary = selectedCats[0];
      const secondaries = selectedCats.slice(1);
      // Schema stores a single practice_category. Persist primary there for
      // analytics/history compatibility, and prepend secondary focus tags to
      // pre_session_notes so the info isn't lost.
      const notesParts: string[] = [];
      if (secondaries.length > 0) {
        notesParts.push(`Also focusing on: ${secondaries.join(", ")}`);
      }
      if (notes.trim()) notesParts.push(notes.trim());
      const composedNotes = notesParts.join("\n\n");

      const created = await sessionStore.create({
        user_id: user.id,
        planned_duration_minutes: duration,
        practice_category: primary,
        session_goal: goal,
        pre_session_notes: composedNotes,
      });
      if (!created) {
        toast.error("Could not start session.");
        return;
      }
      navigate({ to: "/session/$id", params: { id: created.id } });
    } catch (err) {
      console.error("session.new start", err);
      toast.error("Could not start session. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!user || !newCat.trim()) return;
    const name = newCat.trim();
    await customCategoriesStore.add(user.id, name);
    setCats(await allCategories(user.id));
    setSelectedCats((prev) => {
      if (prev.includes(name)) return prev;
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, name];
    });
    setNewCat("");
  }

  return (
    <AppLayout>
      <BackButton fallback="/dashboard" />
      <ActiveSessionBanner />
      <PageHeader
        eyebrow="Plan"
        title="Set the session."
        subtitle="Choose your duration, topics, and a single clear goal."
      />

      {nextFocus && (
        <button
          type="button"
          onClick={() => setGoal(nextFocus)}
          className="mb-5 flex w-full items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left"
        >
          <Sparkles size={14} className="mt-0.5 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary">
              Suggested next focus
            </p>
            <p className="mt-0.5 text-sm">{nextFocus}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Tap to use as session goal</p>
          </div>
        </button>
      )}

      <form onSubmit={start} className="space-y-6">
        <div>
          <div className="flex items-baseline justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Duration
            </Label>
            <p className="text-xs tabular-nums text-muted-foreground">
              <span className="font-mono text-sm text-foreground">{duration}</span> min
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-xl border px-3 py-3 text-sm transition-colors ${duration === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
              >
                {d} min
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={180}
            step={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--color-primary)]"
            aria-label="Session duration in minutes"
          />
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            Duration: {duration} {duration === 1 ? "minute" : "minutes"}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Topics
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {selectedCats.length}/{MAX_CATEGORIES} · first is primary
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cats.map((c) => {
              const isSelected = selectedCats.includes(c);
              const isPrimary = selectedCats[0] === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
                  aria-pressed={isSelected}
                >
                  {isPrimary && selectedCats.length > 1 ? "★ " : ""}
                  {c}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Add your own"
              className="bg-card h-9 text-xs"
            />
            <Button type="button" variant="secondary" onClick={addCategory} size="sm">
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Session goal
          </Label>
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
            className="bg-card h-11"
            placeholder="e.g. Clean bars 12–24 at 80 BPM"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Pre-session notes (optional)
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bg-card"
            placeholder="Mental prep, intentions, etc."
          />
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? "Starting…" : "Begin session"}
        </Button>
      </form>
    </AppLayout>
  );
}
