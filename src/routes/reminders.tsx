import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth-context";
import { remindersStore, uid, type Reminder } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const Route = createFileRoute("/reminders")({
  component: () => <AuthGate><Reminders /></AuthGate>,
  head: () => ({ meta: [{ title: "Reminders — SHED" }] }),
});

function Reminders() {
  const { user } = useAuth();
  const [time, setTime] = useState("18:00");
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [msg, setMsg] = useState("Time to go to the shed.");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;
    const r = remindersStore.get(user.id);
    if (r) {
      setTime(r.reminder_time); setDays(r.days_of_week);
      setMsg(r.reminder_message); setEnabled(r.enabled);
    }
  }, [user]);

  function save() {
    if (!user) return;
    const now = new Date().toISOString();
    const r: Reminder = {
      id: uid(), user_id: user.id, reminder_time: time, days_of_week: days,
      reminder_message: msg, enabled, created_at: now, updated_at: now,
    };
    remindersStore.save(r);
    // TODO (native): wire to native push notifications (e.g. Capacitor LocalNotifications,
    // Expo Notifications, or web push via service worker + Notification API).
    toast.success("Reminder saved.");
  }

  return (
    <AppLayout>
      <PageHeader eyebrow="Adjust" title="Reminders" subtitle="A nudge when it's time to practice." />

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Daily reminder</p>
            <p className="text-xs text-muted-foreground">Notify on selected days</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-surface h-11" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button key={d} onClick={() => setDays((s) => on ? s.filter((x) => x !== d) : [...s, d])} className={`h-10 w-12 rounded-lg border text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} className="bg-surface h-11" />
        </div>

        <Button onClick={save} className="h-12 w-full">Save</Button>
        <p className="text-[11px] text-muted-foreground">Push notifications connect when this runs as a native app.</p>
      </div>
    </AppLayout>
  );
}
