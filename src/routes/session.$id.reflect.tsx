import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  sessionStore,
  journalStore,
  settingsStore,
  profileStore,
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    sessionStore.get(user.id, id).then(setS);
    journalStore.forSession(user.id, id).then(setNotes);
  }, [id, user]);

  if (!s) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !user) return;
    setBusy(true);

    await sessionStore.update(s.id, {
      status: "completed",
      what_practiced: practiced,
      what_improved: improved,
      what_was_difficult: difficult,
      next_step: next,
      focus_rating: focus,
      progress_rating: progress,
      final_notes: final,
    });

    const profile = await profileStore.get(user.id);
    await journalStore.add({
      user_id: user.id,
      session_id: s.id,
      entry_type: "session_reflection",
      title: `Reflection — ${s.practice_category ?? "Practice"}`,
      content: [
        practiced && `Practiced: ${practiced}`,
        improved && `Improved: ${improved}`,
        difficult && `Difficult: ${difficult}`,
        next && `Next: ${next}`,
        final,
      ]
        .filter(Boolean)
        .join("\n\n"),
      category: s.practice_category,
      instrument: profile?.instrument ?? null,
      next_step: next || null,
      tempo: tempoEnd ? Number(tempoEnd) : null,
      duration_minutes: s.practice_minutes,
      session_elapsed_seconds: null,
    });

    if (next.trim()) {
      await settingsStore.save(user.id, { next_focus: next.trim() });
    }

    setBusy(false);
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
                  {n.session_elapsed_seconds != null
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
          <Textarea rows={2} value={practiced} onChange={(e) => setPracticed(e.target.value)} className="bg-card" />
        </Field>
        <Field label="What improved?">
          <Textarea rows={2} value={improved} onChange={(e) => setImproved(e.target.value)} className="bg-card" />
        </Field>
        <Field label="What was difficult?">
          <Textarea rows={2} value={difficult} onChange={(e) => setDifficult(e.target.value)} className="bg-card" />
        </Field>
        <Field label="What should you work on next?">
          <Textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} className="bg-card" />
        </Field>

        <Rating label="Focus" value={focus} onChange={setFocus} />
        <Rating label="Progress" value={progress} onChange={setProgress} />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start tempo (optional)">
            <Input value={tempoStart} onChange={(e) => setTempoStart(e.target.value)} inputMode="numeric" placeholder="BPM" className="bg-card" />
          </Field>
          <Field label="End tempo (optional)">
            <Input value={tempoEnd} onChange={(e) => setTempoEnd(e.target.value)} inputMode="numeric" placeholder="BPM" className="bg-card" />
          </Field>
        </div>

        <Field label="Final notes">
          <Textarea rows={2} value={final} onChange={(e) => setFinal(e.target.value)} className="bg-card" />
        </Field>

        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? "Saving…" : "Save reflection"}
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
            className={`h-10 flex-1 rounded-lg border text-sm transition-colors ${n <= value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
