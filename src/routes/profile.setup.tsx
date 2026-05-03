import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { profileStore, uid, type SkillLevel } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/profile/setup")({
  component: ProfileSetup,
  head: () => ({ meta: [{ title: "Profile setup — SHED" }] }),
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const existing = user ? profileStore.get(user.id) : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [main, setMain] = useState(existing?.main_instrument ?? "");
  const [secondary, setSecondary] = useState(existing?.secondary_instrument ?? "");
  const [skill, setSkill] = useState<SkillLevel>(existing?.skill_level ?? "Intermediate");
  const [goals, setGoals] = useState(existing?.goals ?? "");
  const [weak, setWeak] = useState(existing?.weaknesses ?? "");
  const [styles, setStyles] = useState(existing?.favorite_styles ?? "");
  const [duration, setDuration] = useState(existing?.preferred_practice_duration ?? 45);
  const [days, setDays] = useState<string[]>(existing?.typical_practice_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]);

  if (!user) return null;

  function toggleDay(d: string) {
    setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const now = new Date().toISOString();
    profileStore.save({
      id: existing?.id ?? uid(),
      user_id: user.id,
      name, main_instrument: main, secondary_instrument: secondary, skill_level: skill,
      goals, weaknesses: weak, favorite_styles: styles,
      preferred_practice_duration: duration, typical_practice_days: days,
      created_at: existing?.created_at ?? now, updated_at: now,
    });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-12 pt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Profile
        </p>
        <h1 className="mt-3 font-serif text-4xl">Tell us about your practice.</h1>
        <p className="mt-2 text-sm text-muted-foreground">This shapes your routines and reflections.</p>

        <form onSubmit={save} className="mt-8 space-y-5">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required className="bg-card h-11" /></Field>
          <Field label="Main instrument"><Input value={main} onChange={(e) => setMain(e.target.value)} required placeholder="e.g. Tenor saxophone" className="bg-card h-11" /></Field>
          <Field label="Secondary instrument (optional)"><Input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="bg-card h-11" /></Field>
          <Field label="Skill level">
            <Select value={skill} onValueChange={(v) => setSkill(v as SkillLevel)}>
              <SelectTrigger className="bg-card h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Beginner","Intermediate","Advanced","Professional"] as SkillLevel[]).map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Main goals"><Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} placeholder="e.g. Pass juries, learn 5 standards" className="bg-card" /></Field>
          <Field label="Current weaknesses"><Textarea value={weak} onChange={(e) => setWeak(e.target.value)} rows={2} placeholder="e.g. Time feel at slow tempos" className="bg-card" /></Field>
          <Field label="Favorite styles / genres"><Input value={styles} onChange={(e) => setStyles(e.target.value)} placeholder="e.g. Bebop, modern jazz" className="bg-card h-11" /></Field>
          <Field label={`Preferred daily practice — ${duration} min`}>
            <input type="range" min={15} max={180} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
          </Field>
          <Field label="Typical practice days">
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <button type="button" key={d} onClick={() => toggleDay(d)} className={`h-10 w-12 rounded-lg border text-xs font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>

          <Button type="submit" className="h-12 w-full">Save and enter</Button>
        </form>
      </div>
    </div>
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
