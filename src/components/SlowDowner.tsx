import { useEffect, useRef, useState } from "react";
import { useToolUsageLogger } from "@/lib/tool-usage";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Upload,
  RotateCcw,
  SkipBack,
  SkipForward,
  Repeat,
  Flag,
  Trash2,
  Plus,
  Minus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/Waveform";
import { FullscreenShell, FullscreenButton } from "@/components/FullscreenShell";

type Marker = { id: string; label: string; time: number };

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function clampSpeed(v: number) {
  return Math.max(0.25, Math.min(2.0, Math.round(v * 100) / 100));
}

export type SlowDownerProps = {
  compact?: boolean;
  onInsertTimestamp?: (label: string) => void;
};

export function SlowDowner({ compact = false, onInsertTimestamp }: SlowDownerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"audio" | "video" | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [pitchPreserved, setPitchPreserved] = useState<boolean | null>(null);
  const [loopOn, setLoopOn] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  const usage = useToolUsageLogger("slow_downer");
  useEffect(() => { if (fileName) usage.update({ file_used: fileName }); }, [fileName]);
  useEffect(() => { usage.track("speed_values_used", speed); }, [speed]);
  useEffect(() => {
    if (loopA != null && loopB != null) usage.track("loop_points_used", [loopA, loopB]);
  }, [loopA, loopB]);
  useEffect(() => { if (fullscreen) usage.update({ fullscreen_used: true }); }, [fullscreen]);

  const mediaRef = mediaType === "video" ? videoRef : audioRef;

  function getMedia(): HTMLMediaElement | null {
    return mediaType === "video" ? videoRef.current : audioRef.current;
  }

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Apply speed + pitch preservation whenever element/speed changes
  useEffect(() => {
    const el = getMedia();
    if (!el) return;
    try {
      el.playbackRate = speed;
      type PP = HTMLMediaElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      const pp = el as PP;
      let supported = false;
      if ("preservesPitch" in pp) {
        pp.preservesPitch = true;
        supported = true;
      }
      if ("mozPreservesPitch" in pp) {
        pp.mozPreservesPitch = true;
        supported = true;
      }
      if ("webkitPreservesPitch" in pp) {
        pp.webkitPreservesPitch = true;
        supported = true;
      }
      setPitchPreserved(supported);
    } catch {
      /* ignore */
    }
  }, [speed, mediaUrl, mediaType]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    if (!isAudio && !isVideo) {
      toast.error("Unsupported file. Please choose an audio or video file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setMediaUrl(url);
    setMediaType(isAudio ? "audio" : "video");
    setFileName(file.name);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setLoopA(null);
    setLoopB(null);
    setLoopOn(false);
    setMarkers([]);
    setSpeed(1.0);
    e.target.value = "";
  }

  function togglePlay() {
    const el = getMedia();
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => toast.error("Playback failed. Tap play again."));
    } else {
      el.pause();
    }
  }

  function seek(t: number) {
    const el = getMedia();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(duration || 0, t));
  }

  function onTimeUpdate() {
    const el = getMedia();
    if (!el) return;
    const t = el.currentTime;
    setCurrentTime(t);
    if (loopOn && loopA != null && loopB != null && loopB > loopA) {
      if (t >= loopB) el.currentTime = loopA;
      if (t < loopA) el.currentTime = loopA;
    }
  }

  function bumpSpeed(delta: number) {
    setSpeed((s) => clampSpeed(s + delta));
  }

  function setA() {
    setLoopA(currentTime);
    if (loopB != null && currentTime >= loopB) setLoopB(null);
  }
  function setB() {
    if (loopA == null) {
      toast("Set point A first.");
      return;
    }
    if (currentTime <= loopA) {
      toast("B must be after A.");
      return;
    }
    setLoopB(currentTime);
    setLoopOn(true);
  }
  function clearLoop() {
    setLoopA(null);
    setLoopB(null);
    setLoopOn(false);
  }

  function addMarker() {
    const label = prompt("Marker name", `Marker ${markers.length + 1}`);
    if (!label) return;
    setMarkers((m) =>
      [...m, { id: crypto.randomUUID(), label, time: currentTime }].sort(
        (a, b) => a.time - b.time,
      ),
    );
  }

  function insertTimestamp() {
    if (!onInsertTimestamp) {
      toast("Open inside a practice session to attach to Quick Notes.");
      return;
    }
    onInsertTimestamp(`[Slow Downer ${fmt(currentTime)} @ ${Math.round(speed * 100)}%]`);
  }

  const speedPct = Math.round(speed * 100);

  return (
    <FullscreenShell active={fullscreen} onToggle={() => setFullscreen((v) => !v)} title="Slow Downer">
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Slow Downer</p>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            <input
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={handleFile}
            />
            <span className="inline-flex items-center gap-1">
              <Upload size={12} /> Import
            </span>
          </label>
          <FullscreenButton active={fullscreen} onToggle={() => setFullscreen((v) => !v)} />
        </div>
      </div>

      {!mediaUrl && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-center">
          <p className="text-xs text-muted-foreground">
            Import an audio or video file to slow it down, loop difficult sections, and
            practice without leaving SHED.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            <Upload size={12} />
            Import File
            <input
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Local files are not uploaded. Re-import after closing or refreshing the app.
          </p>
        </div>
      )}

      {mediaUrl && (
        <>
          {mediaType === "video" ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="mt-3 w-full rounded-lg bg-black"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => toast.error("Could not play this file.")}
              playsInline
            />
          ) : (
            <audio
              ref={audioRef}
              src={mediaUrl}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => toast.error("Could not play this file.")}
              className="hidden"
            />
          )}

          <div className="mt-3 truncate text-[11px] text-muted-foreground">
            {fileName} · {mediaType}
            {pitchPreserved === false ? " · pitch lock unavailable" : ""}
          </div>

          {/* Waveform */}
          <div className="mt-3">
            <Waveform
              mediaUrl={mediaUrl}
              mediaRef={mediaRef}
              duration={duration}
              currentTime={currentTime}
              playing={playing}
              loopA={loopA}
              loopB={loopB}
              onSeek={(t) => seek(t)}
              height={fullscreen ? 220 : 96}
            />
          </div>

          {/* Scrubber */}
          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => seek(0)} aria-label="Restart">
              <RotateCcw size={14} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => seek(currentTime - 5)}
              aria-label="Back 5s"
            >
              <SkipBack size={14} />
            </Button>
            <Button onClick={togglePlay} className="h-12 w-20">
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => seek(currentTime + 5)}
              aria-label="Forward 5s"
            >
              <SkipForward size={14} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSpeed(1.0)}
              aria-label="Reset speed"
              title="Reset speed"
            >
              <span className="text-[10px]">100%</span>
            </Button>
          </div>

          {/* Speed controls */}
          <div className="mt-4 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Speed
              </span>
              <span className="font-mono text-sm">{speedPct}%</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => bumpSpeed(-0.05)}
                className="h-12 flex-1"
                disabled={speed <= 0.25}
              >
                <Minus size={14} className="mr-1" /> 5%
              </Button>
              <Button
                variant="secondary"
                onClick={() => bumpSpeed(0.05)}
                className="h-12 flex-1"
                disabled={speed >= 2.0}
              >
                <Plus size={14} className="mr-1" /> 5%
              </Button>
            </div>
            <input
              type="range"
              min={0.25}
              max={2.0}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(clampSpeed(Number(e.target.value)))}
              className="mt-3 w-full accent-[var(--color-primary)]"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {pitchPreserved
                ? "Pitch preserved while slowing down."
                : pitchPreserved === false
                  ? "This browser may not preserve pitch."
                  : ""}
            </p>
          </div>

          {/* Loop */}
          <div className="mt-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                A/B Loop
              </span>
              <button
                onClick={() => setLoopOn((v) => !v)}
                disabled={loopA == null || loopB == null}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                  loopOn ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
              >
                <Repeat size={12} /> {loopOn ? "On" : "Off"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={setA} className="h-10">
                Set A {loopA != null ? `· ${fmt(loopA)}` : ""}
              </Button>
              <Button variant="secondary" onClick={setB} className="h-10">
                Set B {loopB != null ? `· ${fmt(loopB)}` : ""}
              </Button>
              <Button
                variant="ghost"
                onClick={() => loopA != null && seek(loopA)}
                disabled={loopA == null}
                className="h-9"
              >
                Jump to A
              </Button>
              <Button
                variant="ghost"
                onClick={() => loopB != null && seek(loopB)}
                disabled={loopB == null}
                className="h-9"
              >
                Jump to B
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {loopA != null && loopB != null
                  ? `Loop ${fmt(Math.max(0, loopB - loopA))}`
                  : "Set A and B"}
              </span>
              <button onClick={clearLoop} className="hover:text-foreground">
                Clear
              </button>
            </div>
          </div>

          {/* Markers */}
          <div className="mt-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Markers
              </span>
              <Button size="sm" variant="secondary" onClick={addMarker}>
                <Flag size={12} className="mr-1" /> Add
              </Button>
            </div>
            {markers.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No markers yet. Tap Add to bookmark a moment.
              </p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {markers.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-border px-2 py-1.5"
                  >
                    <button
                      onClick={() => seek(m.time)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {fmt(m.time)}
                      </span>
                      <span className="truncate text-xs">{m.label}</span>
                    </button>
                    <button
                      onClick={() =>
                        setMarkers((arr) => arr.filter((x) => x.id !== m.id))
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete marker"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {onInsertTimestamp && (
            <Button
              variant="outline"
              onClick={insertTimestamp}
              className="mt-3 h-10 w-full"
            >
              <Clock size={14} className="mr-2" /> Add timestamp to Quick Note
            </Button>
          )}
        </>
      )}
      {compact ? null : null}
    </div>
    </FullscreenShell>
  );
}
