import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { ChevronRight, User, Bell, Palette, LogOut, Map, BookOpen, ShieldAlert } from "lucide-react";

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
  const { user, signOut, prefs } = useAuth();

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
