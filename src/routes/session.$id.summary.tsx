import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { sessionStore, journalStore, type PracticeSession, type JournalEntry } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/session/$id/summary")({
  component: () => <AuthGate><Summary /></AuthGate>,
  head: () => ({ meta: [{ title: "Summary — SHED" }] }),
});

function Summary() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [s, setS] = useState<PracticeSession | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    setS(sessionStore.get(user.id, id));
    setEntries(journalStore.forSession(user.id, id));
  }, [id, user]);

  if (!s) return null;
  const notes = entries.filter((e) => e.entry_type === "quick_note");

  return (
    <AppLayout hideNav>
      <div className="mb-6 flex items-center gap-2 text-primary">
        <CheckCircle2 size={20} />
        <p className="text-[11px] uppercase tracking-[0.24em]">Session complete</p>
      </div>
      <PageHeader title="Nice work." subtitle={s.session_goal} />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat label="Duration" value={`${s.practice_minutes ?? s.duration_minutes}m`} />
        <Stat label="Category" value={s.category} />
        <Stat label="Focus" value={`${s.focus_rating ?? "—"}/5`} />
        <Stat label="Progress" value={`${s.progress_rating ?? "—"}/5`} />
        <Stat label="Distractions" value={`${s.distractions_count}`} />
        <Stat label="Notes saved" value={`${notes.length}`} />
      </div>

      {s.what_improved && <Block label="Improved">{s.what_improved}</Block>}
      {s.what_was_difficult && <Block label="Difficult">{s.what_was_difficult}</Block>}
      {s.next_step && <Block label="Next focus" highlight>{s.next_step}</Block>}

      {notes.length > 0 && (
        <div className="mt-2 mb-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Quick notes</p>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="text-[11px] text-muted-foreground">{new Date(n.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                <p className="mt-1 whitespace-pre-wrap">{n.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link to="/dashboard" className="rounded-xl border border-border bg-card py-3 text-center text-sm">Back to home</Link>
        <Link to="/session/new" className="rounded-xl bg-primary py-3 text-center text-sm text-primary-foreground">New session</Link>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

function Block({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`mb-3 rounded-xl border p-4 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{children}</p>
    </div>
  );
}
