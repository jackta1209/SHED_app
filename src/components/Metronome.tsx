import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gauge, Maximize2, Minimize2, Play, Square, Volume2, VolumeX, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useToolUsageLogger } from "@/lib/tool-usage";

/**
 * SHED Metronome — Web Audio scheduled, low-drift.
 *
 * Public API preserved for existing callers:
 *   <Metronome compact stopSignal={n} />
 */

type BeatState = "accent" | "normal" | "off";
type Subdivision = 1 | 2 | 3 | 4;
type SoundKind = "click" | "woodblock" | "beep" | "cowbell";

const MIN_BPM = 20;
const MAX_BPM = 300;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

const SUBDIV_LABEL: Record<Subdivision, string> = {
  1: "None",
  2: "8ths",
  3: "Triplets",
  4: "16ths",
};

const SOUND_LABEL: Record<SoundKind, string> = {
  click: "Classic Click",
  woodblock: "Woodblock",
  beep: "Beep",
  cowbell: "Cowbell",
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

const GAP_PRESETS: { name: string; on: number; off: number }[] = [
  { name: "1 on / 1 off", on: 1, off: 1 },
  { name: "2 on / 2 off", on: 2, off: 2 },
  { name: "4 on / 4 off", on: 4, off: 4 },
  { name: "1 on / 2 off", on: 1, off: 2 },
  { name: "1 on / 3 off", on: 1, off: 3 },
];

function clampBpm(v: number) {
  if (!Number.isFinite(v)) return 80;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
}
function clampBars(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(16, Math.round(v)));
}
function defaultBeats(n: number): BeatState[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "accent" : "normal"));
}

// ---------- Sound synthesis ----------
// Each sound returns audio nodes scheduled at `time`. `kind` is which beat
// type (accent/normal/sub). All routed to `out` (master gain).
function scheduleSound(
  ctx: AudioContext,
  out: GainNode,
  time: number,
  sound: SoundKind,
  kind: "accent" | "normal" | "sub",
) {
  const accent = kind === "accent";
  const sub = kind === "sub";

  if (sound === "click") {
    // Original oscillator click
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    let freq = 900, peak = 0.5, dur = 0.05;
    if (accent) { freq = 1500; peak = 0.7; dur = 0.06; }
    else if (sub) { freq = 700; peak = 0.22; dur = 0.035; }
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    return;
  }

  if (sound === "beep") {
    // Pure sine beep, sustained slightly
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    let freq = 880, peak = 0.45, dur = 0.08;
    if (accent) { freq = 1320; peak = 0.6; dur = 0.1; }
    else if (sub) { freq = 660; peak = 0.18; dur = 0.05; }
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    return;
  }

  if (sound === "woodblock") {
    // Triangle + quick decay → woody pluck
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    let freq = 1200, peak = 0.55, dur = 0.04;
    if (accent) { freq = 1800; peak = 0.75; dur = 0.045; }
    else if (sub) { freq = 950; peak = 0.2; dur = 0.025; }
    osc.frequency.setValueAtTime(freq * 1.6, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.01);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    return;
  }

  if (sound === "cowbell") {
    // Two detuned squares through bandpass → cowbell-ish
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    o1.type = "square"; o2.type = "square";
    let f1 = 800, f2 = 540, peak = 0.35, dur = 0.18;
    if (accent) { f1 = 900; f2 = 620; peak = 0.5; dur = 0.22; }
    else if (sub) { f1 = 700; f2 = 480; peak = 0.14; dur = 0.08; }
    o1.frequency.value = f1;
    o2.frequency.value = f2;
    bp.type = "bandpass";
    bp.frequency.value = (f1 + f2) / 2;
    bp.Q.value = 4;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o1.connect(bp); o2.connect(bp);
    bp.connect(env).connect(out);
    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.02); o2.stop(time + dur + 0.02);
    return;
  }
}

export function Metronome({
  compact = false,
  stopSignal = 0,
}: {
  compact?: boolean;
  stopSignal?: number;
}) {
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
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [sound, setSound] = useState<SoundKind>("click");

  // Gap mode
  const [gapOn, setGapOn] = useState(false);
  const [barsOn, setBarsOn] = useState(1);
  const [barsOff, setBarsOff] = useState(1);
  const [barInCycle, setBarInCycle] = useState(0); // 0..(barsOn+barsOff-1)

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  const subRef = useRef(0);
  const barRef = useRef(0); // bar position within gap cycle

  const bpmRef = useRef(bpm);
  const numRef = useRef(num);
  const beatsRef = useRef(beats);
  const subdivisionRef = useRef(subdivision);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const soundRef = useRef(sound);
  const gapOnRef = useRef(gapOn);
  const barsOnRef = useRef(barsOn);
  const barsOffRef = useRef(barsOff);

  const tapsRef = useRef<number[]>([]);

  // ---------- Temporary mobile audio diagnostics (gated by ?debugAudio=1) ----------
  // Remove this block + the <DebugPanel/> render + the dbg(...) calls to clean up.
  const [debugOn, setDebugOn] = useState(false);
  const debugOnRef = useRef(false);
  const [, setDebugTick] = useState(0);
  const debugEventsRef = useRef<{ t: number; ev: string; data?: unknown }[]>([]);
  const schedulerTickCountRef = useRef(0);
  const lastSchedulerTickRef = useRef(0);
  const scheduledNodeCountRef = useRef(0);
  const lastSoundRef = useRef<Record<string, unknown> | null>(null);
  const unlockStatusRef = useRef<Record<string, unknown>>({ attempted: false });
  const visibilityStatusRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const on = new URLSearchParams(window.location.search).get("debugAudio") === "1";
      debugOnRef.current = on;
      setDebugOn(on);
    } catch { /* noop */ }
  }, []);
  const dbg = useCallback((ev: string, data?: unknown) => {
    if (!debugOnRef.current) return;
    const arr = debugEventsRef.current;
    arr.push({ t: Date.now(), ev, data });
    if (arr.length > 30) arr.splice(0, arr.length - 30);
    setDebugTick((n) => (n + 1) % 1000000);
  }, []);
  // ---------- end diagnostics block ----------

  // Tool usage logging (only active during a practice session).
  const usage = useToolUsageLogger("metronome");
  useEffect(() => { usage.track("bpm_values_used", bpm); }, [bpm]);
  useEffect(() => { usage.track("time_signatures_used", `${num}/${den}`); }, [num, den]);
  useEffect(() => { usage.track("subdivisions_used", SUBDIV_LABEL[subdivision]); }, [subdivision]);
  useEffect(() => { usage.update({ sound_used: sound }); }, [sound]);
  useEffect(() => { usage.track("beat_patterns_used", beats.join(",")); }, [beats]);
  useEffect(() => { usage.update({ gap_mode_used: gapOn, bars_on: barsOn, bars_off: barsOff }); }, [gapOn, barsOn, barsOff]);


  // Visual queue: queue (beat, bar, time) and flush via rAF.
  const visualQueueRef = useRef<{ beat: number; bar: number; time: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { numRef.current = num; }, [num]);
  useEffect(() => { beatsRef.current = beats; }, [beats]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { gapOnRef.current = gapOn; }, [gapOn]);
  useEffect(() => { barsOnRef.current = barsOn; }, [barsOn]);
  useEffect(() => { barsOffRef.current = barsOff; }, [barsOff]);
  useEffect(() => {
    volumeRef.current = volume;
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.01);
    }
  }, [volume]);

  const ensureCtx = useCallback(() => {
    const stateBefore = ctxRef.current?.state ?? "none";
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
      dbg("ctx_created", { state: ctx.state, sampleRate: ctx.sampleRate });
      // iOS Safari unlock: synchronously play an inaudible 1-sample buffer
      // inside the user gesture so the audio hardware is fully enabled before
      // the scheduler's setInterval starts creating oscillators.
      unlockStatusRef.current = { attempted: true };
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
        unlockStatusRef.current = { attempted: true, startOk: true };
        dbg("unlock_buffer_ok");
      } catch (e) {
        const err = e as Error;
        unlockStatusRef.current = { attempted: true, startOk: false, name: err?.name, message: err?.message };
        dbg("unlock_buffer_failed", { name: err?.name, message: err?.message });
        console.warn("iOS audio unlock buffer failed:", e);
      }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().then(
        () => dbg("resume_resolved", { state: ctxRef.current?.state }),
        (e: Error) => dbg("resume_rejected", { name: e?.name, message: e?.message }),
      );
    }
    dbg("ensureCtx", { stateBefore, stateAfter: ctxRef.current.state });
    return ctxRef.current;
  }, [dbg]);

  const playClick = useCallback((time: number, kind: "accent" | "normal" | "sub") => {
    if (mutedRef.current) return;
    const ctx = ctxRef.current;
    const out = masterGainRef.current;
    if (!ctx || !out) return;
    try {
      scheduleSound(ctx, out, time, soundRef.current, kind);
      scheduledNodeCountRef.current += 1;
      if (debugOnRef.current) {
        lastSoundRef.current = {
          kind, sound: soundRef.current, scheduledTime: time,
          ctxCurrentTime: ctx.currentTime, startOk: true,
        };
        dbg("sound_scheduled", { kind, sound: soundRef.current, t: time, now: ctx.currentTime });
      }
    } catch (e) {
      const err = e as Error;
      lastSoundRef.current = { kind, startOk: false, name: err?.name, message: err?.message };
      dbg("sound_failed", { kind, name: err?.name, message: err?.message });
    }
  }, [dbg]);

  // Scheduler
  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (debugOnRef.current) {
      schedulerTickCountRef.current += 1;
      lastSchedulerTickRef.current = Date.now();
    }
    const sub = subdivisionRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const t = nextNoteTimeRef.current;
      const bIdx = beatRef.current;
      const sIdx = subRef.current;
      const state: BeatState = beatsRef.current[bIdx] ?? "normal";

      // Determine if current bar is audible in gap mode
      const gap = gapOnRef.current;
      const on = Math.max(1, barsOnRef.current);
      const off = Math.max(1, barsOffRef.current);
      const cycle = on + off;
      const audible = !gap || (barRef.current % cycle) < on;

      if (sIdx === 0) {
        if (audible) {
          if (state === "accent") playClick(t, "accent");
          else if (state === "normal") playClick(t, "normal");
        }
        visualQueueRef.current.push({ beat: bIdx, bar: barRef.current, time: t });
      } else {
        if (audible && state !== "off") playClick(t, "sub");
      }

      const secondsPerBeat = 60 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat / sub;
      subRef.current += 1;
      if (subRef.current >= sub) {
        subRef.current = 0;
        const n = Math.max(1, numRef.current);
        const nextBeat = beatRef.current + 1;
        if (nextBeat >= n) {
          beatRef.current = 0;
          // Advance bar
          if (gap) {
            barRef.current = (barRef.current + 1) % cycle;
          } else {
            barRef.current = 0;
          }
        } else {
          beatRef.current = nextBeat;
        }
      }
    }
  }, [playClick]);

  // Visual playhead loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setCurrentBeat(-1);
      setBarInCycle(0);
      return;
    }
    const tick = () => {
      const ctx = ctxRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        let nextBeat: number | null = null;
        let nextBar: number | null = null;
        const q = visualQueueRef.current;
        while (q.length && q[0].time <= now) {
          const ev = q.shift()!;
          nextBeat = ev.beat;
          nextBar = ev.bar;
        }
        if (nextBeat !== null) setCurrentBeat(nextBeat);
        if (nextBar !== null) setBarInCycle(nextBar);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  const resetCycle = useCallback(() => {
    beatRef.current = 0;
    subRef.current = 0;
    barRef.current = 0;
    nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
    visualQueueRef.current = [];
  }, []);

  const start = useCallback(() => {
    if (running) return;
    dbg("start_tapped");
    const ctx = ensureCtx();
    beatRef.current = 0;
    subRef.current = 0;
    barRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.06;
    visualQueueRef.current = [];
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    setRunning(true);
    dbg("scheduler_started", { interval: LOOKAHEAD_MS });
  }, [running, ensureCtx, scheduler, dbg]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    visualQueueRef.current = [];
    setRunning(false);
    setCurrentBeat(-1);
    setBarInCycle(0);
  }, []);

  const toggle = useCallback(() => { running ? stop() : start(); }, [running, start, stop]);

  useEffect(() => { if (stopSignal > 0) stop(); }, [stopSignal, stop]);

  // Resume AudioContext when returning to a backgrounded tab on iOS Safari.
  // Only resumes if the metronome is supposed to be running; never restarts.
  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => {
    const onVis = () => {
      const vs = document.visibilityState;
      visibilityStatusRef.current = { ...visibilityStatusRef.current, lastEvent: vs, at: Date.now() };
      dbg("visibilitychange", { state: vs, running: runningRef.current });
      if (
        vs === "visible" &&
        runningRef.current &&
        ctxRef.current &&
        ctxRef.current.state === "suspended"
      ) {
        visibilityStatusRef.current = { ...visibilityStatusRef.current, resumeAttempted: true };
        ctxRef.current.resume().then(
          () => {
            visibilityStatusRef.current = { ...visibilityStatusRef.current, resumeResolved: true, stateAfter: ctxRef.current?.state };
            dbg("vis_resume_resolved", { state: ctxRef.current?.state });
          },
          (e: Error) => {
            visibilityStatusRef.current = { ...visibilityStatusRef.current, resumeRejected: true, name: e?.name };
            dbg("vis_resume_rejected", { name: e?.name, message: e?.message });
          },
        );
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [dbg]);

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
    if (running) resetCycle();
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
    if (running) resetCycle();
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

  useEffect(() => {
    if (!running || !ctxRef.current) return;
    subRef.current = 0;
    nextNoteTimeRef.current = ctxRef.current.currentTime + 0.05;
  }, [subdivision, running]);

  // Reset gap cycle when gap settings change while running
  const setBarsOnSafe = (v: number) => {
    setBarsOn(clampBars(v));
    if (running && gapOnRef.current) {
      barRef.current = 0;
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };
  const setBarsOffSafe = (v: number) => {
    setBarsOff(clampBars(v));
    if (running && gapOnRef.current) {
      barRef.current = 0;
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };
  const setGapOnSafe = (v: boolean) => {
    setGapOn(v);
    if (running) {
      barRef.current = 0;
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };
  const applyGapPreset = (on: number, off: number) => {
    setBarsOn(on);
    setBarsOff(off);
    if (running && gapOnRef.current) {
      barRef.current = 0;
      beatRef.current = 0;
      subRef.current = 0;
      nextNoteTimeRef.current = (ctxRef.current?.currentTime ?? 0) + 0.05;
      visualQueueRef.current = [];
    }
  };

  const body = (
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
      sound={sound}
      setSound={setSound}
      gapOn={gapOn}
      setGapOn={setGapOnSafe}
      barsOn={barsOn}
      setBarsOn={setBarsOnSafe}
      barsOff={barsOff}
      setBarsOff={setBarsOffSafe}
      barInCycle={barInCycle}
      onGapPreset={applyGapPreset}
    />
  );

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
  sound: SoundKind;
  setSound: (s: SoundKind) => void;
  gapOn: boolean;
  setGapOn: (v: boolean) => void;
  barsOn: number;
  setBarsOn: (n: number) => void;
  barsOff: number;
  setBarsOff: (n: number) => void;
  barInCycle: number;
  onGapPreset: (on: number, off: number) => void;
}

function MetronomeBody(p: BodyProps) {
  const big = p.fullscreen;
  const cycle = Math.max(1, p.barsOn) + Math.max(1, p.barsOff);
  const posInCycle = p.barInCycle % cycle;
  const isAudible = !p.gapOn || posInCycle < p.barsOn;
  const phaseLabel = !p.gapOn
    ? null
    : isAudible
      ? `Audible bar ${posInCycle + 1} of ${p.barsOn}`
      : `Silent bar ${posInCycle - p.barsOn + 1} of ${p.barsOff}`;

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

      <div className={big ? "my-4 text-center" : p.compact ? "my-2 text-center" : "my-4 text-center"}>
        <p className={`font-mono tabular-nums ${big ? "text-7xl" : p.compact ? "text-4xl" : "text-6xl"}`}>
          {p.bpm}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">BPM</p>
      </div>

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

      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={p.bpm}
        onChange={(e) => {
          const v = clampBpm(Number(e.target.value));
          p.setBpmInput(String(v));
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

      {/* Sound selector */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Sound</p>
        <select
          value={p.sound}
          onChange={(e) => p.setSound(e.target.value as SoundKind)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Click sound"
        >
          {(Object.keys(SOUND_LABEL) as SoundKind[]).map((s) => (
            <option key={s} value={s}>{SOUND_LABEL[s]}</option>
          ))}
        </select>
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

      {/* Gap trainer */}
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gap trainer</p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={p.gapOn}
              onChange={(e) => p.setGapOn(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            {p.gapOn ? "On" : "Off"}
          </label>
        </div>
        {p.gapOn && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">Bars on</label>
              <input
                type="number"
                min={1}
                max={16}
                value={p.barsOn}
                onChange={(e) => p.setBarsOn(Number(e.target.value) || 1)}
                className="h-9 w-16 rounded-md border border-border bg-background text-center font-mono"
                aria-label="Bars on"
              />
              <label className="text-xs text-muted-foreground">Bars off</label>
              <input
                type="number"
                min={1}
                max={16}
                value={p.barsOff}
                onChange={(e) => p.setBarsOff(Number(e.target.value) || 1)}
                className="h-9 w-16 rounded-md border border-border bg-background text-center font-mono"
                aria-label="Bars off"
              />
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {GAP_PRESETS.map((g) => (
                <button
                  key={g.name}
                  onClick={() => p.onGapPreset(g.on, g.off)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    p.barsOn === g.on && p.barsOff === g.off
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            {p.running && phaseLabel && (
              <div
                className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                  isAudible
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {phaseLabel}
              </div>
            )}
          </>
        )}
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
