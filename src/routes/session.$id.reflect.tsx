import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  sessionStore,
  journalStore,
  prefsStore,
  profileStore,
  uid,
  type PracticeSession,
  type JournalEntry,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/session/$id/reflect")({
  component: () => (
    <AuthGate>
      <Reflect />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Reflect — SHED" }] }),
});

function Reflect() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState<PracticeSession | null>(null);
  const [notes, setNotes] = useState<JournalEntry[]>([]);
  const [practiced, setPracticed] = useState("");
  const [improved, setImproved] = useState("");
  const [difficult, setDifficult] = useState("");
  const [next, setNext] = useState("");
  const [focus, setFocus] = useState(4);
  const [progress, setProgress] = useState(3);
  const [final, setFinal] = useState("");
  const [tempoStart, setTempoStart] = useState("");
  const [tempoEnd, setTempoEnd] = useState("");

  useEffect(() => {
    if (!user) return;
    setS(sessionStore.get(user.id, id));
    setNotes(journalStore.forSession(user.id, id));
  }, [id, user]);

  if (!s) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !user) return;
    const now = new Date().toISOString();
    const updated: PracticeSession = {
      ...s,
      completed: true,
      status: "completed",
      what_practiced: practiced,
      what_improved: improved,
      what_was_difficult: difficult,
      next_step: next,
      focus_rating: focus,
      progress_rating: progress,
      quick_notes: [s.quick_notes, final].filter(Boolean).join("\n\n"),
    };
    sessionStore.update(updated);

    // Save reflection as journal entry
    const profile = profileStore.get(user.id);
    const entry: JournalEntry = {
      id: uid(),
      user_id: user.id,
      session_id: s.id,
      entry_type: "session_reflection",
      title: `Reflection — ${s.category}`,
      content: [
        practiced && `Practiced: ${practiced}`,
        improved && `Improved: ${improved}`,
        difficult && `Difficult: ${difficult}`,
        next && `Next: ${next}`,
        final,
      ]
        .filter(Boolean)
        .join("\n\n"),
      category: s.category,
      instrument: profile?.main_instrument,
      next_step: next,
      tempo: tempoEnd ? Number(tempoEnd) : undefined,
      duration_minutes: s.practice_minutes ?? s.duration_minutes,
      date: now,
      created_at: now,
      updated_at: now,
    };
    journalStore.add(entry);

    // Carry next focus forward
    if (next.trim()) {
      const prefs = prefsStore.get(user.id);
      prefsStore.save({ ...prefs, next_focus: next.trim(), updated_at: now });
    }

    toast.success("Session logged.");
    navigate({ to: "/session/$id/summary", params: { id: s.id } });
  }

  return (
    <AppLayout hideNav>
      <PageHeader
        eyebrow="Reflect"
        title="What did you learn?"
        subtitle="Two minutes here makes tomorrow's practice better."
      />

      {notes.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Quick notes from this session
          </p>
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="text-[11px] text-muted-foreground">
                  {n.session_elapsed_seconds !== undefined
                    ? `${Math.floor(n.session_elapsed_seconds / 60)}:${(n.session_elapsed_seconds % 60).toString().padStart(2, "0")} in`
                    : ""}
                </p>
                <p className="whitespace-pre-wrap">{n.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        <Field label="What did you practice?">
          <Textarea
            rows={2}
            value={practiced}
            onChange={(e) => setPracticed(e.target.value)}
            className="bg-card"
          />
        </Field>
        <Field label="What improved?">
          <Textarea
            rows={2}
            value={improved}
            onChange={(e) => setImproved(e.target.value)}
            className="bg-card"
          />
        </Field>
        <Field label="What was difficult?">
          <Textarea
            rows={2}
            value={difficult}
            onChange={(e) => setDifficult(e.target.value)}
            className="bg-card"
          />
        </Field>
        <Field label="What should you work on next?">
          <Textarea
            rows={2}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="bg-card"
          />
        </Field>

        <Rating label="Focus" value={focus} onChange={setFocus} />
        <Rating label="Progress" value={progress} onChange={setProgress} />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start tempo (optional)">
            <Input
              value={tempoStart}
              onChange={(e) => setTempoStart(e.target.value)}
              inputMode="numeric"
              placeholder="BPM"
              className="bg-card"
            />
          </Field>
          <Field label="End tempo (optional)">
            <Input
              value={tempoEnd}
              onChange={(e) => setTempoEnd(e.target.value)}
              inputMode="numeric"
              placeholder="BPM"
              className="bg-card"
            />
          </Field>
        </div>

        <Field label="Final notes">
          <Textarea
            rows={2}
            value={final}
            onChange={(e) => setFinal(e.target.value)}
            className="bg-card"
          />
        </Field>

        <Button type="submit" className="h-12 w-full">
          Save reflection
        </Button>
        <Link to="/dashboard" className="block text-center text-xs text-muted-foreground">
          Skip for now
        </Link>
      </form>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label} — {value}/5
      </Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 flex-1 rounded-lg border text-sm transition-colors ${
              n <= value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
