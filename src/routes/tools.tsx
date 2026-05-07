import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { Sparkles, ListMusic, Disc3, Mic, Activity } from "lucide-react";
import { Metronome } from "@/components/Metronome";
import { SlowDowner } from "@/components/SlowDowner";
import { SheetMusicReader } from "@/components/SheetMusicReader";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/tools")({
  component: () => <AuthGate><Tools /></AuthGate>,
  head: () => ({ meta: [{ title: "Tools — SHED" }] }),
});

function Tools() {
  return (
    <AppLayout>
      <BackButton fallback="/dashboard" />
      <PageHeader eyebrow="Workspace" title="Tools" subtitle="A growing collection of focused practice utilities." />
      <Section title="Available">
        <Metronome />
        <SlowDowner />
        <SheetMusicReader />
      </Section>

      <Section title="Coming soon">
        <div className="grid grid-cols-2 gap-3">
          {[
            { Icon: Sparkles, label: "AI Practice Assistant" },
            { Icon: ListMusic, label: "Lead Sheets" },
            { Icon: Disc3, label: "Backing Tracks" },
            { Icon: Mic, label: "Recording Tool" },
            { Icon: Activity, label: "Tempo Tracker" },
          ].map(({ Icon, label }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <Icon size={18} className="text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Coming soon</p>
            </div>
          ))}
        </div>
      </Section>
    </AppLayout>
  );
}
