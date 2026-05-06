import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import {
  journalStore,
  sessionStore,
  allCategories,
  customCategoriesStore,
  profileStore,
  type JournalEntry,
  type PracticeSession,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, MessageSquareText, Sparkles } from "lucide-react";

export const Route = createFileRoute("/journal")({
  component: () => (
    <AuthGate>
      <Journal />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Journal — SHED" }] }),
});

function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("All");

  async function refresh() {
    if (!user) return;
    const [e, s, c] = await Promise.all([
      journalStore.list(user.id),
      sessionStore.list(user.id),
      allCategories(user.id),
    ]);
    setEntries(e);
    setSessions(s);
    setCats(c);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (filter === "All" || e.category === filter) &&
          (q === "" ||
            `${e.title ?? ""} ${e.content ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [entries, q, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    const standalone: JournalEntry[] = [];
    for (const e of filtered) {
      if (e.session_id) {
        if (!map.has(e.session_id)) map.set(e.session_id, []);
        map.get(e.session_id)!.push(e);
      } else {
        standalone.push(e);
      }
    }
    return { map, standalone };
  }, [filtered]);

  return (
    <AppLayout>
      <div className="mb-6 flex items-end justify-between">
        <PageHeader eyebrow="Track" title="Practice journal" />
        <Button onClick={() => setOpen(true)} size="sm" className="mb-2">
          <Plus size={14} className="mr-1" /> New
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search size={14} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search entries…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>

      <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {["All", ...cats].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
          >
            {c}
          </button>
        ))}
      </div>

      {open && (
        <NewEntryForm
          categories={cats}
          onCancel={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No journal entries yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Notes you save during practice will appear here, grouped by session.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.map.entries()).map(([sid, items]) => {
            const session = sessions.find((s) => s.id === sid);
            return (
              <div key={sid} className="rounded-2xl border border-border bg-surface p-3">
                <div className="mb-2 px-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {session
                      ? `${session.practice_category ?? "Practice"} · ${new Date(session.created_at).toLocaleDateString()}`
                      : "Session"}
                  </p>
                  {session?.session_goal && (
                    <p className="text-sm font-medium">{session.session_goal}</p>
                  )}
                </div>
                <ul className="space-y-2">
                  {items.map((e) => (
                    <EntryCard key={e.id} e={e} />
                  ))}
                </ul>
              </div>
            );
          })}
          {grouped.standalone.length > 0 && (
            <Section title="Standalone entries">
              <ul className="space-y-2">
                {grouped.standalone.map((e) => (
                  <EntryCard key={e.id} e={e} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/dashboard" className="text-xs text-muted-foreground">
          ← Back to dashboard
        </Link>
      </div>
    </AppLayout>
  );
}

function EntryCard({ e }: { e: JournalEntry }) {
  const Icon = e.entry_type === "session_reflection" ? Sparkles : MessageSquareText;
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Icon size={12} />
          {e.entry_type === "session_reflection"
            ? "Reflection"
            : e.entry_type === "quick_note"
              ? "Quick note"
              : (e.category ?? "Entry")}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {new Date(e.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {e.title && <p className="mt-1 font-serif text-base">{e.title}</p>}
      {e.session_elapsed_seconds != null && (
        <p className="text-[11px] text-muted-foreground">
          {Math.floor(e.session_elapsed_seconds / 60)}:
          {(e.session_elapsed_seconds % 60).toString().padStart(2, "0")} into session
          {e.instrument ? ` · ${e.instrument}` : ""}
        </p>
      )}
      {e.content && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">{e.content}</p>
      )}
      {(e.tempo || e.duration_minutes) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {e.tempo ? `${e.tempo} BPM` : ""}
          {e.tempo && e.duration_minutes ? " · " : ""}
          {e.duration_minutes ? `${e.duration_minutes} min` : ""}
        </p>
      )}
      {e.next_step && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Next:</span> {e.next_step}
        </p>
      )}
    </li>
  );
}

function NewEntryForm({
  onSaved,
  onCancel,
  categories,
}: {
  onSaved: () => void;
  onCancel: () => void;
  categories: string[];
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(categories[0] ?? "Repertoire");
  const [piece, setPiece] = useState("");
  const [tempo, setTempo] = useState<string>("");
  const [dur, setDur] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const profile = await profileStore.get(user.id);
    await journalStore.add({
      user_id: user.id,
      session_id: null,
      entry_type: "standalone_note",
      title: piece || "Journal entry",
      content: notes,
      category,
      tempo: tempo ? Number(tempo) : null,
      duration_minutes: dur ? Number(dur) : null,
      next_step: next || null,
      instrument: profile?.instrument ?? null,
      session_elapsed_seconds: null,
    });
    setBusy(false);
    onSaved();
  }

  async function addCategory() {
    if (!user || !newCat.trim()) return;
    await customCategoriesStore.add(user.id, newCat.trim());
    setCategory(newCat.trim());
    setNewCat("");
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-4 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Add custom category"
            className="bg-card h-9 text-xs"
          />
          <Button type="button" variant="secondary" onClick={addCategory} size="sm">
            Add
          </Button>
        </div>
      </div>
      <Input
        required
        value={piece}
        onChange={(e) => setPiece(e.target.value)}
        placeholder="Piece or exercise"
        className="bg-card h-11"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          placeholder="Tempo (BPM)"
          inputMode="numeric"
          className="bg-card h-11"
        />
        <Input
          value={dur}
          onChange={(e) => setDur(e.target.value)}
          placeholder="Duration (min)"
          inputMode="numeric"
          className="bg-card h-11"
        />
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Notes…"
        className="bg-card"
      />
      <Input
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="Next step"
        className="bg-card h-11"
      />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className="flex-1">
          {busy ? "Saving…" : "Save entry"}
        </Button>
      </div>
    </form>
  );
}
