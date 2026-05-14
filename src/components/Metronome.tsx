import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gauge, Maximize2, Minimize2, Play, Square, Volume2, VolumeX, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

/**
 * SHED Metronome — Web Audio scheduled, low-drift.
 *
 * Public API preserved for existing callers:
 *   <Metronome compact stopSignal={n} />
 *
 * Engine: lookahead scheduler (Chris Wilson pattern). A 25ms setInterval looks
 * 100ms ahead and schedules click oscillators on exact AudioContext times so
 * tempo is sample-accurate regardless of main-thread jitter.
 *
 * Beat states cycle: accent → normal → off (and back).
 * Subdivisions: none / eighths / triplets / sixteenths — quieter clicks placed
 * between main beats.
 *
 * NOTE: A per-tool usage log table is not yet present in the schema; per spec
 * we leave a TODO and do not block the metronome on logging.
 */

type BeatState = "accent" | "normal" | "off";
type Subdivision = 1 | 2 | 3 | 4; // clicks per beat (1 = none)

const MIN_BPM = 20;
const MAX_BPM = 300;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1; // seconds

const SUBDIV_LABEL: Record<Subdivision, string> = {
  1: "None",
  2: "8ths",
  3: "Triplets",
  4: "16ths",
};

interface Preset {
  name: string;
  num: number;
  den: number;
  beats: BeatState[];
  sub: Subdivision;
}
const PRESETS: Preset[] = [
  { name: "4/4", num: 4, den: 4, beats: ["accent", "normal", "normal", "normal"], sub: 1 },
  { name: "3/4 Waltz", num: 3, den: 4, beats: ["accent", "normal", "normal"], sub: 1 },
  { name: "6/8", num: 6, den: 8, beats: ["accent", "normal", "normal", "accent", "normal", "normal"], sub: 1 },
  { name: "5/4", num: 5, den: 4, beats: ["accent", "normal", "normal", "accent", "normal"], sub: 1 },
  { name: "7/8", num: 7, den: 8, beats: ["accent", "normal", "normal", "accent", "normal", "accent", "normal"], sub: 1 },
  { name: "Backbeat", num: 4, den: 4, beats: ["off", "accent", "off", "accent"], sub: 1 },
  { name: "Internal", num: 4, den: 4, beats: ["accent", "off", "off", "off"], sub: 1 },
];
const TS_OPTIONS = [
  [2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [9, 8], [12, 8],
] as const;
const DEN_OPTIONS = [2, 4, 8, 16] as const;

function clampBpm(v: number) {
  if (!Number.isFinite(v)) return 80;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
}
function defaultBeats(n: number): BeatState[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "accent" : "normal"));
}

export function Metronome({
  compact = false,
  stopSignal = 0,
}: {
  compact?: boolean;
  stopSignal?: number;
}) {
  // ---- UI state (persisted across fullscreen because component instance is reused) ----
  const [bpm, setBpm] = useState(80);
  const [bpmInput, setBpmInput] = useState("80");
  const [num, setNum] = useState(4);
  const [den, setDen] = useState(4);
  const [beats, setBeats] = useState<BeatState[]>(() => defaultBeats(4));
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1); // -1 when stopped

  // ---- Refs the scheduler reads (avoid re-creating timer on every change) ----
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0); // index into beats[]
  const subRef = useRef(0);  // 0..subdivision-1

  const bpmRef = useRef(bpm);
  const numRef = useRef(num);
  const beatsRef = useRef(beats);
  const subdivisionRef = useRef(subdivision);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);

  const tapsRef = useRef<number[]>([]);

  // Visual highlight scheduling — queue (beatIndex, audioTime) and flush via rAF.
  const visualQueueRef = useRef<{ beat: number; time: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { numRef.current = num; }, [num]);
  useEffect(() => { beatsRef.current = beats; }, [beats]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => {
    volumeRef.current = volume;
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.01);
    }
  }, [volume]);

  // ---- Audio setup ----
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const g = ctx.createGain();
      g.gain.value = volumeRef.current;
      g.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = g;
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const scheduleClick = useCallback((time: number, kind: "accent" | "normal" | "sub") => {
    if (mutedRef.current) return;
    const ctx = ctxRef.current!;
    const out = masterGainRef.current!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    let freq = 900, peak = 0.5, dur = 0.05;
    if (kind === "accent") { freq = 1500; peak = 0.7; dur = 0.06; }
    else if (kind === "sub") { freq = 700; peak = 0.22; dur = 0.035; }
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }, []);

  // ---- Scheduler ----
  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const sub = subdivisionRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const t = nextNoteTimeRef.current;
      const bIdx = beatRef.current;
      const sIdx = subRef.current;
      const state: BeatState = beatsRef.current[bIdx] ?? "normal";

      if (sIdx === 0) {
        // Main beat
        if (state === "accent") scheduleClick(t, "accent");
        else if (state === "normal") scheduleClick(t, "normal");
        // off → silent
        visualQueueRef.current.push({ beat: bIdx, time: t });
      } else {
        // Subdivision: only sound if main beat isn't off
        if (state !== "off") scheduleClick(t, "sub");
      }

      // Advance
      const secondsPerBeat = 60 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat / sub;
      subRef.current += 1;
      if (subRef.current >= sub) {
        subRef.current = 0;
        const n = numRef.current;
        beatRef.current = (beatRef.current + 1) % Math.max(1, n);
      }
    }
  }, [scheduleClick]);

  // Visual playhead loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setCurrentBeat(-1);
      return;
    }
    const tick = () => {
      const ctx = ctxRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        let next: number | null = null;
        const q = visualQueueRef.current;
        while (q.length && q[0].time <= now) {
          next = q.shift()!.beat;
        }
        if (next !== null) setCurrentBeat(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  // Start/stop control
  const start = useCallback(() => {
    if (running) return;
    const ctx = ensureCtx();
    beatRef.current = 0;
    subRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.06;
    visualQueueRef.current = [];
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    setRunning(true);
  }, [running, ensureCtx, scheduler]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    visualQueueRef.current = [];
    setRunning(false);
    setCurrentBeat(-1);
  }, []);

  const toggle = useCallback(() => { running ? stop() : start(); }, [running, start, stop]);

  // External stop signal (used by parent screens)
  useEffect(() => { if (stopSignal > 0) stop(); }, [stopSignal, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) {
        try { void ctxRef.current.close(); } catch { /* noop */ }
      }
      ctxRef.current = null;
      masterGainRef.current = null;
    };
  }, []);

  // ---- Mutators ----
  const applyBpm = (v: number) => {
    const c = clampBpm(v);
    setBpm(c);
    setBpmInput(String(c));
  };
  const nudge = (d: number) => applyBpm(bpm + d);

  const setNumerator = (n: number) => {
    const safe = Math.max(1, Math.min(16, Math.round(n)));
    setNum(safe);
    setBeats((prev) => {
      if (safe === prev.length) return prev;
      if (safe < prev.length) return prev.slice(0, safe);
      return [...prev, ...defaultBeats(safe - prev.length).map((_, i) => (prev.length + i === 0 ? "accent" : "normal" as BeatState))];
    });
    if (running) {
      // Resync to beat 1 of new bar without retriggering audio gap
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };

  const setDenominator = (d: number) => setDen(d);

  const cycleBeat = (i: number) => {
    setBeats((prev) => {
      const next = prev.slice();
      const order: BeatState[] = ["accent", "normal", "off"];
      const idx = order.indexOf(next[i] ?? "normal");
      next[i] = order[(idx + 1) % order.length];
      return next;
    });
  };

  const applyPreset = (p: Preset) => {
    setNum(p.num);
    setDen(p.den);
    setBeats(p.beats.slice());
    setSubdivision(p.sub);
    if (running) {
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };

  const tap = () => {
    const now = performance.now();
    tapsRef.current.push(now);
    tapsRef.current = tapsRef.current.filter((t) => now - t < 2500);
    if (tapsRef.current.length >= 2) {
      const arr = tapsRef.current;
      const diffs = arr.slice(1).map((t, i) => t - arr[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      applyBpm(60000 / avg);
    } else {
      toast("Keep tapping…");
    }
  };

  const onBpmInputCommit = () => {
    const n = parseInt(bpmInput, 10);
    if (Number.isNaN(n)) {
      setBpmInput(String(bpm));
      return;
    }
    applyBpm(n);
  };

  // Resync when subdivision changes mid-play
  useEffect(() => {
    if (!running || !ctxRef.current) return;
    subRef.current = 0;
    nextNoteTimeRef.current = ctxRef.current.currentTime + 0.05;
  }, [subdivision, running]);

  // ---- Body (shared between compact, default, and fullscreen) ----
  const body = useMemo(() => (
    <MetronomeBody
      compact={compact}
      fullscreen={fullscreen}
      bpm={bpm}
      bpmInput={bpmInput}
      setBpmInput={setBpmInput}
      onBpmCommit={onBpmInputCommit}
      nudge={nudge}
      num={num}
      den={den}
      setNum={setNumerator}
      setDen={setDenominator}
      beats={beats}
      cycleBeat={cycleBeat}
      currentBeat={currentBeat}
      running={running}
      toggle={toggle}
      tap={tap}
      subdivision={subdivision}
      setSubdivision={setSubdivision}
      muted={muted}
      setMuted={setMuted}
      volume={volume}
      setVolume={setVolume}
      onPreset={applyPreset}
      onFullscreen={() => setFullscreen((f) => !f)}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [compact, fullscreen, bpm, bpmInput, num, den, beats, currentBeat, running, subdivision, muted, volume]);

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border bg-background/95 px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Metronome</p>
          <Button size="sm" variant="ghost" onClick={() => setFullscreen(false)} aria-label="Exit fullscreen">
            <X size={14} className="mr-1" /> Close
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto w-full max-w-2xl">{body}</div>
        </div>
      </div>,
      document.body,
    );
  }
  return body;
}

// =====================================================================

interface BodyProps {
  compact: boolean;
  fullscreen: boolean;
  bpm: number;
  bpmInput: string;
  setBpmInput: (s: string) => void;
  onBpmCommit: () => void;
  nudge: (d: number) => void;
  num: number;
  den: number;
  setNum: (n: number) => void;
  setDen: (n: number) => void;
  beats: BeatState[];
  cycleBeat: (i: number) => void;
  currentBeat: number;
  running: boolean;
  toggle: () => void;
  tap: () => void;
  subdivision: Subdivision;
  setSubdivision: (s: Subdivision) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  onPreset: (p: Preset) => void;
  onFullscreen: () => void;
}

function MetronomeBody(p: BodyProps) {
  const big = p.fullscreen;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Metronome</p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => p.setMuted(!p.muted)}
            aria-label={p.muted ? "Unmute" : "Mute"}
            title={p.muted ? "Unmute" : "Mute"}
          >
            {p.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          <Button size="sm" variant="ghost" onClick={p.onFullscreen} aria-label="Fullscreen" title="Fullscreen">
            {p.fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
      </div>

      {/* BPM display */}
      <div className={big ? "my-4 text-center" : p.compact ? "my-2 text-center" : "my-4 text-center"}>
        <p className={`font-mono tabular-nums ${big ? "text-7xl" : p.compact ? "text-4xl" : "text-6xl"}`}>
          {p.bpm}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">BPM</p>
      </div>

      {/* BPM controls */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="secondary" className="h-9 w-12" onClick={() => p.nudge(-5)}>-5</Button>
        <Button size="sm" variant="secondary" className="h-9 w-12" onClick={() => p.nudge(-1)}>-1</Button>
        <input
          type="number"
          inputMode="numeric"
          value={p.bpmInput}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={(e) => p.setBpmInput(e.target.value)}
          onBlur={p.onBpmCommit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-9 w-20 rounded-md border border-border bg-background text-center font-mono tabular-nums"
          aria-label="BPM"
        />
        <Button size="sm" variant="secondary" className="h-9 w-12" onClick={() => p.nudge(1)}>+1</Button>
        <Button size="sm" variant="secondary" className="h-9 w-12" onClick={() => p.nudge(5)}>+5</Button>
      </div>

      {/* BPM slider */}
      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={p.bpm}
        onChange={(e) => {
          const v = clampBpm(Number(e.target.value));
          p.setBpmInput(String(v));
          // applyBpm via commit — but we want live, so emulate nudge to absolute
          p.nudge(v - p.bpm);
        }}
        className="w-full accent-[var(--color-primary)]"
      />

      {/* Beat grid */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Beats</p>
          <p className="text-[11px] text-muted-foreground">Tap to cycle: accent → normal → off</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.beats.map((s, i) => {
            const active = p.running && p.currentBeat === i;
            const cls =
              s === "accent"
                ? "bg-primary text-primary-foreground border-primary"
                : s === "normal"
                  ? "bg-secondary text-secondary-foreground border-border"
                  : "bg-transparent text-muted-foreground border-dashed border-border";
            return (
              <button
                key={i}
                onClick={() => p.cycleBeat(i)}
                className={`relative flex items-center justify-center rounded-lg border font-mono text-sm transition-all ${cls} ${
                  big ? "h-16 w-16 text-base" : "h-12 w-12"
                } ${active ? "ring-2 ring-primary scale-105" : ""}`}
                aria-label={`Beat ${i + 1} (${s})`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time signature */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Time signature</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={16}
            value={p.num}
            onChange={(e) => p.setNum(Number(e.target.value) || 1)}
            className="h-9 w-16 rounded-md border border-border bg-background text-center font-mono"
            aria-label="Beats per bar"
          />
          <span className="text-muted-foreground">/</span>
          <select
            value={p.den}
            onChange={(e) => p.setDen(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 font-mono"
            aria-label="Beat unit"
          >
            {DEN_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="ml-2 flex flex-wrap gap-1">
            {TS_OPTIONS.map(([n, d]) => (
              <button
                key={`${n}/${d}`}
                onClick={() => { p.setNum(n); p.setDen(d); }}
                className={`rounded-md border px-2 py-1 text-xs ${
                  p.num === n && p.den === d ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {n}/{d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subdivisions */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Subdivision</p>
        <div className="flex flex-wrap gap-1">
          {([1, 2, 3, 4] as Subdivision[]).map((s) => (
            <button
              key={s}
              onClick={() => p.setSubdivision(s)}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                p.subdivision === s ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {SUBDIV_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Volume</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">{Math.round(p.volume * 100)}%</p>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.volume}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
      </div>

      {/* Presets */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Presets</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => p.onPreset(preset)}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Transport */}
      <div className="mt-4 flex gap-2">
        <Button onClick={p.toggle} className={big ? "h-14 flex-1 text-base" : "h-11 flex-1"}>
          {p.running ? <><Square size={14} className="mr-2" /> Stop</> : <><Play size={14} className="mr-2" /> Start</>}
        </Button>
        <Button variant="secondary" onClick={p.tap} className={big ? "h-14 px-6" : "h-11"}>
          <Gauge size={14} className="mr-2" /> Tap
        </Button>
      </div>
    </div>
  );
}
