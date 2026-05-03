import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { journalStore, PRACTICE_CATEGORIES, uid, type JournalEntry, type PracticeCategory } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/journal")({
  component: () => <AuthGate><Journal /></AuthGate>,
  head: () => ({ meta: [{ title: "Journal — SHED" }] }),
});

function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PracticeCategory | "All">("All");

  useEffect(() => { if (user) setEntries(journalStore.list(user.id)); }, [user]);

  const filtered = useMemo(() => entries.filter((e) =>
    (filter === "All" || e.category === filter) &&
    (q === "" || (e.piece_or_exercise + e.notes + e.next_step).toLowerCase().includes(q.toLowerCase()))
  ), [entries, q, filter]);

  return (
    <AppLayout>
      <div className="mb-6 flex items-end justify-between">
        <PageHeader eyebrow="Track" title="Practice journal" />
        <Button onClick={() => setOpen(true)} size="sm" className="mb-2"><Plus size={14} className="mr-1" /> New</Button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search size={14} className="text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries…" className="w-full bg-transparent text-sm focus:outline-none" />
      </div>

      <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["All", ...PRACTICE_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setFilter(c as typeof filter)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
            {c}
          </button>
        ))}
      </div>

      {open && (
        <NewEntryForm
          onCancel={() => setOpen(false)}
          onSave={(e) => {
            if (!user) return;
            journalStore.add(e);
            setEntries(journalStore.list(user.id));
            setOpen(false);
          }}
        />
      )}

      <Section title={`${filtered.length} entries`}>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No entries yet. Tap New to log a piece or exercise.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((e) => (
              <li key={e.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{e.category}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(e.date).toLocaleDateString()}</p>
                </div>
                <p className="mt-1 font-serif text-xl">{e.piece_or_exercise}</p>
                {(e.tempo || e.duration_minutes) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.tempo ? `${e.tempo} BPM` : ""}{e.tempo && e.duration_minutes ? " · " : ""}{e.duration_minutes ? `${e.duration_minutes} min` : ""}
                  </p>
                )}
                {e.notes && <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">{e.notes}</p>}
                {e.next_step && <p className="mt-2 text-xs text-muted-foreground"><span className="uppercase tracking-wider">Next:</span> {e.next_step}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppLayout>
  );
}

function NewEntryForm({ onSave, onCancel }: { onSave: (e: JournalEntry) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<PracticeCategory>("Repertoire");
  const [piece, setPiece] = useState("");
  const [tempo, setTempo] = useState<string>("");
  const [dur, setDur] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const now = new Date().toISOString();
    onSave({
      id: uid(), user_id: user.id, date: now, category,
      piece_or_exercise: piece, tempo: tempo ? Number(tempo) : undefined,
      duration_minutes: dur ? Number(dur) : undefined,
      notes, next_step: next, created_at: now, updated_at: now,
    });
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
        <div className="flex flex-wrap gap-2">
          {PRACTICE_CATEGORIES.map((c) => (
            <button type="button" key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
      </div>
      <Input required value={piece} onChange={(e) => setPiece(e.target.value)} placeholder="Piece or exercise" className="bg-card h-11" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="Tempo (BPM)" inputMode="numeric" className="bg-card h-11" />
        <Input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="Duration (min)" inputMode="numeric" className="bg-card h-11" />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes…" className="bg-card" />
      <Input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next step" className="bg-card h-11" />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1">Save entry</Button>
      </div>
    </form>
  );
}
