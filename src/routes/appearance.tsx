import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { prefsStore, type AppearanceMode, type VisualTheme } from "@/lib/store";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Switch } from "@/components/ui/switch";
import type { AlertType } from "@/lib/store";

export const Route = createFileRoute("/appearance")({
  component: () => <AuthGate><Appearance /></AuthGate>,
  head: () => ({ meta: [{ title: "Appearance — SHED" }] }),
});

const MODES: { id: AppearanceMode; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

const THEMES: { id: VisualTheme; label: string; desc: string }[] = [
  { id: "minimal", label: "Minimal", desc: "Calm neutrals, warm accent" },
  { id: "warm", label: "Warm", desc: "Earthy tones, low glare" },
  { id: "contrast", label: "High contrast", desc: "Maximum legibility" },
  { id: "studio", label: "Studio dark", desc: "Cool blue, late-night sessions" },
];

function Appearance() {
  const { user, prefs, refreshPrefs } = useAuth();
  if (!user || !prefs) return null;

  function setMode(m: AppearanceMode) {
    if (!user || !prefs) return;
    prefsStore.save({ ...prefs, appearance_mode: m, updated_at: new Date().toISOString() });
    refreshPrefs();
  }
  function setTheme(t: VisualTheme) {
    if (!user || !prefs) return;
    prefsStore.save({ ...prefs, visual_theme: t, updated_at: new Date().toISOString() });
    refreshPrefs();
  }
  function setAlerts(enabled: boolean) {
    if (!user || !prefs) return;
    prefsStore.save({ ...prefs, session_alerts_enabled: enabled, updated_at: new Date().toISOString() });
    refreshPrefs();
  }
  function setAlertType(type: AlertType) {
    if (!user || !prefs) return;
    prefsStore.save({ ...prefs, alert_type: type, updated_at: new Date().toISOString() });
    refreshPrefs();
  }

  const ALERT_TYPES: { id: AlertType; label: string }[] = [
    { id: "visual", label: "Visual only" },
    { id: "sound", label: "Sound" },
    { id: "vibration", label: "Vibration" },
    { id: "sound_vibration", label: "Sound + vibration" },
  ];

  return (
    <AppLayout>
      <BackButton fallback="/settings" />
      <PageHeader eyebrow="Adjust" title="Appearance" subtitle="Personalize the workspace. The design stays minimalist regardless." />

      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</p>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {MODES.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setMode(id)} className={`flex flex-col items-center gap-2 rounded-xl border py-4 text-xs ${prefs.appearance_mode === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Theme</p>
      <div className="space-y-2">
        {THEMES.map((t) => {
          const on = prefs.visual_theme === t.id;
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${on ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex-1">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              {on && <Check size={16} className="text-primary" />}
            </button>
          );
        })}
      </div>

      <p className="mt-8 mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Session alerts</p>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Timer alerts</p>
            <p className="text-xs text-muted-foreground">Notify at 10 min, 1 min, and end</p>
          </div>
          <Switch checked={prefs.session_alerts_enabled} onCheckedChange={setAlerts} />
        </div>
        {prefs.session_alerts_enabled && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ALERT_TYPES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAlertType(a.id)}
                className={`rounded-lg border px-3 py-2 text-xs ${prefs.alert_type === a.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
