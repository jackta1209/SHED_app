import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppLayout, PageHeader, Section } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Gauge, Music2, FileMusic, Sparkles, ListMusic, Disc3, Mic, Activity, Play, Square } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tools")({
  component: () => <AuthGate><Tools /></AuthGate>,
  head: () => ({ meta: [{ title: "Tools — SHED" }] }),
});

function Tools() {
  return (
    <AppLayout>
      <PageHeader eyebrow="Workspace" title="Tools" subtitle="A growing collection of focused practice utilities." />
      <Section title="Available">
        <Metronome />
      </Section>

      <Section title="Coming soon">
        <div className="grid grid-cols-2 gap-3">
          {[
            { Icon: Music2, label: "Audio Slow Downer" },
            { Icon: FileMusic, label: "Sheet Music Viewer" },
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

function Metronome() {
  const [bpm, setBpm] = useState(80);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const [signature, setSignature] = useState(4);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const tapRef = useRef<number[]>([]);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setBeat(0);
      return;
    }
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const interval = 60000 / bpm;
    let count = 0;
    const tick = () => {
      const ctx = ctxRef.current!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = count % signature === 0 ? 1400 : 900;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      setBeat(count % signature);
      count++;
    };
    tick();
    timerRef.current = window.setInterval(tick, interval);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [running, bpm, signature]);

  function tap() {
    const now = Date.now();
    tapRef.current.push(now);
    tapRef.current = tapRef.current.filter((t) => now - t < 3000);
    if (tapRef.current.length >= 2) {
      const diffs = tapRef.current.slice(1).map((t, i) => t - tapRef.current[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= 30 && newBpm <= 240) setBpm(newBpm);
    } else {
      toast("Tap a few more times…");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Metronome</p>
        <div className="flex gap-1">
          {Array.from({ length: signature }).map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full transition-colors ${running && beat === i ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <div className="my-5 text-center">
        <p className="font-mono text-6xl tabular-nums">{bpm}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">BPM</p>
      </div>

      <input type="range" min={30} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />

      <div className="mt-3 flex gap-2">
        <Button onClick={() => setRunning((r) => !r)} className="h-11 flex-1">
          {running ? <><Square size={14} className="mr-2" /> Stop</> : <><Play size={14} className="mr-2" /> Start</>}
        </Button>
        <Button variant="secondary" onClick={tap} className="h-11"><Gauge size={14} className="mr-2" /> Tap</Button>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Time signature</span>
        <div className="flex gap-1">
          {[3, 4, 5, 6, 7].map((n) => (
            <button key={n} onClick={() => setSignature(n)} className={`rounded-md border px-2 py-1 ${signature === n ? "border-primary text-primary" : "border-border"}`}>{n}/4</button>
          ))}
        </div>
      </div>
    </div>
  );
}
