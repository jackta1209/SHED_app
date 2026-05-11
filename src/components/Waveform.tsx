import { useEffect, useRef, useState, type RefObject } from "react";

type Props = {
  /** Object URL or remote URL for the audio source. */
  mediaUrl: string | null;
  /** Ref to the actual <audio>/<video> element used for playback (source of truth). */
  mediaRef: RefObject<HTMLMediaElement | null>;
  duration: number;
  currentTime: number;
  playing: boolean;
  loopA: number | null;
  loopB: number | null;
  onSeek: (time: number) => void;
  height?: number;
};

type Peaks = { min: Float32Array; max: Float32Array } | null;

/** Decode an audio file URL to mono peaks via OfflineAudio/AudioContext. */
async function decodePeaks(url: string, buckets: number, signal: AbortSignal): Promise<Peaks> {
  const res = await fetch(url, { signal });
  const arr = await res.arrayBuffer();
  if (signal.aborted) return null;
  const AC: typeof AudioContext =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("AudioContext unavailable");
  const ctx = new AC();
  try {
    const audio = await new Promise<AudioBuffer>((resolve, reject) => {
      // decodeAudioData with both promise + callback signatures for Safari.
      try {
        const p = ctx.decodeAudioData(arr.slice(0), resolve, reject);
        if (p && typeof (p as Promise<AudioBuffer>).then === "function") {
          (p as Promise<AudioBuffer>).then(resolve, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    if (signal.aborted) return null;
    const channels = audio.numberOfChannels;
    const length = audio.length;
    const samplesPerBucket = Math.max(1, Math.floor(length / buckets));
    const min = new Float32Array(buckets);
    const max = new Float32Array(buckets);
    // Mix down channels lazily by reading each channel.
    const data: Float32Array[] = [];
    for (let c = 0; c < channels; c++) data.push(audio.getChannelData(c));
    for (let b = 0; b < buckets; b++) {
      const start = b * samplesPerBucket;
      const end = Math.min(length, start + samplesPerBucket);
      let lo = 1.0;
      let hi = -1.0;
      for (let i = start; i < end; i++) {
        let s = 0;
        for (let c = 0; c < channels; c++) s += data[c][i];
        s /= channels;
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
      min[b] = lo;
      max[b] = hi;
    }
    return { min, max };
  } finally {
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }
}

export function Waveform({
  mediaUrl,
  mediaRef,
  duration,
  currentTime,
  playing,
  loopA,
  loopB,
  onSeek,
  height = 96,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const peaksRef = useRef<Peaks>(null);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumps to trigger redraw

  // Track container width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Decode whenever the URL changes.
  useEffect(() => {
    peaksRef.current = null;
    setError(null);
    setVersion((v) => v + 1);
    if (!mediaUrl) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const buckets = 1600; // generous; canvas downsamples visually
    decodePeaks(mediaUrl, buckets, ctrl.signal)
      .then((p) => {
        if (ctrl.signal.aborted) return;
        peaksRef.current = p;
        setLoading(false);
        setVersion((v) => v + 1);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        peaksRef.current = null;
        setError(e instanceof Error ? e.message : "Could not analyze audio");
        setLoading(false);
        setVersion((v) => v + 1);
      });
    return () => ctrl.abort();
  }, [mediaUrl]);

  // Draw waveform (only when peaks/width changes — not every frame).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    const mid = h / 2;
    const styles = getComputedStyle(canvas);
    const wave = styles.getPropertyValue("--wf-color").trim() || styles.color || "#888";
    const muted = styles.getPropertyValue("--wf-muted").trim() || "rgba(255,255,255,0.18)";

    // Center line
    ctx.fillStyle = muted;
    ctx.fillRect(0, mid - 0.5, w, 1);

    if (!peaks) return;
    const buckets = peaks.max.length;
    ctx.fillStyle = wave;
    // Render one vertical line per pixel column, sampling peaks.
    for (let x = 0; x < w; x++) {
      const i0 = Math.floor((x / w) * buckets);
      const i1 = Math.max(i0 + 1, Math.floor(((x + 1) / w) * buckets));
      let lo = 1.0;
      let hi = -1.0;
      for (let i = i0; i < i1 && i < buckets; i++) {
        if (peaks.min[i] < lo) lo = peaks.min[i];
        if (peaks.max[i] > hi) hi = peaks.max[i];
      }
      const yTop = mid + lo * (mid - 2);
      const yBot = mid + hi * (mid - 2);
      ctx.fillRect(x, Math.min(yTop, yBot), 1, Math.max(1, Math.abs(yBot - yTop)));
    }
  }, [width, height, version]);

  // Smooth playhead via rAF while playing, otherwise sync to currentTime prop.
  useEffect(() => {
    const el = playheadRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const media = mediaRef.current;
      const dur = media?.duration || duration || 0;
      const t = media?.currentTime ?? currentTime;
      const pct = dur > 0 ? Math.min(1, Math.max(0, t / dur)) : 0;
      el.style.transform = `translateX(${pct * width}px)`;
      if (playing) raf = requestAnimationFrame(update);
    };
    update();
    if (playing) raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [playing, width, duration, currentTime, mediaRef]);

  function pointerToTime(clientX: number): number {
    const el = containerRef.current;
    if (!el || !duration) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (x / rect.width) * duration;
  }

  function handleClick(e: React.PointerEvent) {
    if (!mediaUrl) return;
    e.preventDefault();
    onSeek(pointerToTime(e.clientX));
  }

  const aPct = duration && loopA != null ? (loopA / duration) * 100 : null;
  const bPct = duration && loopB != null ? (loopB / duration) * 100 : null;
  const showLoop =
    aPct != null && bPct != null && bPct > aPct;

  return (
    <div
      ref={containerRef}
      onPointerDown={handleClick}
      className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-[var(--color-muted)]"
      style={
        {
          height,
          touchAction: "none",
          // expose CSS vars to canvas via getComputedStyle
          ["--wf-color" as string]: "var(--primary)",
          ["--wf-muted" as string]: "color-mix(in oklab, var(--foreground) 18%, transparent)",
          cursor: mediaUrl ? "crosshair" : "default",
        } as React.CSSProperties
      }
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Loop region */}
      {showLoop && (
        <div
          className="pointer-events-none absolute inset-y-0 bg-[var(--primary)]/15"
          style={{ left: `${aPct}%`, width: `${(bPct as number) - (aPct as number)}%` }}
        />
      )}
      {/* A marker */}
      {aPct != null && (
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--primary)]"
          style={{ left: `${aPct}%` }}
        >
          <span className="absolute -top-0 left-0.5 rounded-br-sm bg-[var(--primary)] px-1 text-[9px] font-bold text-[var(--primary-foreground)]">
            A
          </span>
        </div>
      )}
      {/* B marker */}
      {bPct != null && (
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--primary)]"
          style={{ left: `${bPct}%` }}
        >
          <span className="absolute -top-0 right-0.5 rounded-bl-sm bg-[var(--primary)] px-1 text-[9px] font-bold text-[var(--primary-foreground)]">
            B
          </span>
        </div>
      )}
      {/* Playhead */}
      <div
        ref={playheadRef}
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-foreground/90 will-change-transform"
      />

      {/* Loading / error overlays */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-[11px] text-muted-foreground">
          Analyzing waveform…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
          Waveform unavailable. Playback still works.
        </div>
      )}
    </div>
  );
}
