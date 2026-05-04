import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gauge, Play, Square } from "lucide-react";
import { toast } from "sonner";

export function Metronome({ compact = false }: { compact?: boolean }) {
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
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
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
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [running, bpm, signature]);

  // Stop when component unmounts
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Metronome</p>
        <div className="flex gap-1">
          {Array.from({ length: signature }).map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full transition-colors ${running && beat === i ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <div className={compact ? "my-3 text-center" : "my-5 text-center"}>
        <p className={compact ? "font-mono text-4xl tabular-nums" : "font-mono text-6xl tabular-nums"}>{bpm}</p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">BPM</p>
      </div>

      <input
        type="range"
        min={30}
        max={240}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />

      <div className="mt-3 flex gap-2">
        <Button onClick={() => setRunning((r) => !r)} className="h-10 flex-1">
          {running ? (<><Square size={14} className="mr-2" /> Stop</>) : (<><Play size={14} className="mr-2" /> Start</>)}
        </Button>
        <Button variant="secondary" onClick={tap} className="h-10">
          <Gauge size={14} className="mr-2" /> Tap
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Time signature</span>
        <div className="flex gap-1">
          {[3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => setSignature(n)}
              className={`rounded-md border px-2 py-1 ${signature === n ? "border-primary text-primary" : "border-border"}`}
            >
              {n}/4
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
