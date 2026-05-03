import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { sessionStore, type PracticeSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/session/$id/reflect")({
  component: () => <AuthGate><Reflect /></AuthGate>,
  head: () => ({ meta: [{ title: "Reflect — SHED" }] }),
});

function Reflect() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState<PracticeSession | null>(null);
  const [practiced, setPracticed] = useState("");
  const [improved, setImproved] = useState("");
  const [difficult, setDifficult] = useState("");
  const [next, setNext] = useState("");
  const [focus, setFocus] = useState(4);
  const [progress, setProgress] = useState(3);
  const [final, setFinal] = useState("");

  useEffect(() => {
    if (!user) return;
    setS(sessionStore.list(user.id).find((x) => x.id === id) ?? null);
  }, [id, user]);

  if (!s) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    sessionStore.update({
      ...s, completed: true,
      what_practiced: practiced, what_improved: improved, what_was_difficult: difficult,
      next_step: next, focus_rating: focus, progress_rating: progress,
      quick_notes: [s.quick_notes, final].filter(Boolean).join("\n\n"),
    });
    toast.success("Session logged.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AppLayout hideNav>
      <PageHeader eyebrow="Reflect" title="What did you learn?" subtitle="Two minutes here makes tomorrow's practice better." />

      <form onSubmit={save} className="space-y-5">
        <Field label="What did you practice?"><Textarea rows={2} value={practiced} onChange={(e) => setPracticed(e.target.value)} className="bg-card" /></Field>
        <Field label="What improved?"><Textarea rows={2} value={improved} onChange={(e) => setImproved(e.target.value)} className="bg-card" /></Field>
        <Field label="What was difficult?"><Textarea rows={2} value={difficult} onChange={(e) => setDifficult(e.target.value)} className="bg-card" /></Field>
        <Field label="What should you work on next?"><Textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} className="bg-card" /></Field>

        <Rating label="Focus" value={focus} onChange={setFocus} />
        <Rating label="Progress" value={progress} onChange={setProgress} />

        <Field label="Final notes"><Textarea rows={2} value={final} onChange={(e) => setFinal(e.target.value)} className="bg-card" /></Field>

        <Button type="submit" className="h-12 w-full">Save reflection</Button>
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

function Rating({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label} — {value}/5</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" onClick={() => onChange(n)}
            className={`h-10 flex-1 rounded-lg border text-sm transition-colors ${
              n <= value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
