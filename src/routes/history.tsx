import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { sessionStore, PRACTICE_CATEGORIES, type PracticeCategory, type PracticeSession } from "@/lib/store";

export const Route = createFileRoute("/history")({
  component: () => <AuthGate><History /></AuthGate>,
  head: () => ({ meta: [{ title: "History — SHED" }] }),
});

function History() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [filter, setFilter] = useState<PracticeCategory | "All">("All");
  const [minRating, setMinRating] = useState(0);

  useEffect(() => { if (user) setSessions(sessionStore.list(user.id).filter((s) => s.completed)); }, [user]);

  const filtered = useMemo(() => sessions.filter((s) =>
    (filter === "All" || s.category === filter) &&
    (s.focus_rating ?? 0) >= minRating
  ), [sessions, filter, minRating]);

  return (
    <AppLayout>
      <PageHeader eyebrow="Track" title="Practice history" subtitle={`${sessions.length} completed sessions`} />

      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["All", ...PRACTICE_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setFilter(c as typeof filter)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{c}</button>
        ))}
      </div>
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Min focus rating:</span>
        {[0, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setMinRating(n)} className={`rounded-md border px-2 py-1 ${minRating === n ? "border-primary text-primary" : "border-border"}`}>{n === 0 ? "Any" : `${n}+`}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No sessions match these filters.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.category}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(s.date).toLocaleDateString()}</p>
              </div>
              <p className="mt-1 font-serif text-lg">{s.session_goal}</p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Mini label="Min" value={`${s.duration_minutes}`} />
                <Mini label="Focus" value={`${s.focus_rating ?? "—"}/5`} />
                <Mini label="Progress" value={`${s.progress_rating ?? "—"}/5`} />
                <Mini label="Distract" value={`${s.distractions_count}`} />
              </div>
              {s.what_improved && <p className="mt-3 text-xs text-muted-foreground"><span className="uppercase tracking-wider">Improved:</span> {s.what_improved}</p>}
              {s.next_step && <p className="mt-1 text-xs text-muted-foreground"><span className="uppercase tracking-wider">Next:</span> {s.next_step}</p>}
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
