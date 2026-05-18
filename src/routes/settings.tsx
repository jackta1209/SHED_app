import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { settingsStore } from "@/lib/store";
import { ChevronRight, User, Bell, Palette, LogOut, Map, BookOpen, ShieldAlert, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: () => <AuthGate><SettingsPage /></AuthGate>,
  head: () => ({ meta: [{ title: "Settings — SHED" }] }),
});

const ROADMAP = [
  "Audio slow-downer for local files",
  "Local sheet music / PDF viewer",
  "Spotify integration (limited — streaming services restrict slow-down/looping)",
  "Apple Music integration (limited — same restrictions)",
  "Lead sheet & chord chart library",
  "Backing tracks (styles, tempos, keys)",
  "Real AI chat assistant",
  "AI weakness detection",
  "Weekly analytics",
  "App-exit tracking (native mobile)",
  "Strict focus / kiosk mode (native)",
];

function SettingsPage() {
  const { user, signOut, prefs, refreshPrefs } = useAuth();
  const currentTimeout =
    prefs?.inactivity_timeout_minutes === undefined ? 15 : prefs.inactivity_timeout_minutes;
  const [saving, setSaving] = useState(false);

  async function changeTimeout(value: number | null) {
    if (!user) return;
    setSaving(true);
    const prev = currentTimeout;
    const res = await settingsStore.save(user.id, { inactivity_timeout_minutes: value });
    if (!res) {
      toast.error("Couldn't save. Keeping previous value.");
      setSaving(false);
      return;
    }
    await refreshPrefs();
    setSaving(false);
    void prev;
  }

  return (
    <AppLayout>
      <PageHeader eyebrow="Adjust" title="Settings" subtitle={user?.email} />

      <ul className="space-y-2">
        <Row to="/profile/setup" Icon={User} label="Profile" hint="Instrument, goals, weaknesses" />
        <Row to="/appearance" Icon={Palette} label="Appearance" hint={`${prefs?.appearance_mode ?? "dark"} · ${prefs?.visual_theme ?? "minimal"}`} />
        <Row to="/reminders" Icon={Bell} label="Reminders" hint="Daily practice nudge" />
        <Row to="/history" Icon={BookOpen} label="Practice history" hint="All completed sessions" />
        <Row to="/account" Icon={ShieldAlert} label="Account" hint="Delete account" />
      </ul>

      <Section title="Session">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-2 text-muted-foreground">
            <Clock size={14} className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Auto logout after inactivity</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Refreshing the page or putting your device to sleep will not log you out
                unless your inactivity limit has passed.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { v: 5, label: "5 min" },
              { v: 10, label: "10 min" },
              { v: 15, label: "15 min" },
              { v: 20, label: "20 min" },
              { v: 30, label: "30 min" },
              { v: 60, label: "1 hour" },
              { v: null as number | null, label: "Manual only" },
            ]).map((opt) => {
              const on = currentTimeout === opt.v;
              return (
                <button
                  key={String(opt.v)}
                  disabled={saving}
                  onClick={() => changeTimeout(opt.v)}
                  className={`rounded-lg border px-3 py-2 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"} disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Roadmap">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Map size={14} />
            <p className="text-xs uppercase tracking-wider">What's next</p>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {ROADMAP.map((r) => (
              <li key={r} className="flex gap-2 text-foreground/80">
                <span className="text-primary">·</span> {r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Streaming integrations stay roadmap-only because services like Spotify / Apple Music
            restrict slow-down, looping, and pitch shifting.
          </p>
        </div>
      </Section>

      <button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm text-muted-foreground hover:text-foreground">
        <LogOut size={14} /> Sign out
      </button>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">SHED · v0.1</p>
    </AppLayout>
  );
}

function Row({ to, Icon, label, hint }: { to: "/profile/setup" | "/appearance" | "/reminders" | "/history" | "/account"; Icon: typeof User; label: string; hint?: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground">
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </Link>
    </li>
  );
}
