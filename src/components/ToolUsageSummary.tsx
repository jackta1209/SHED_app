import { useEffect, useState } from "react";
import {
  loadToolUsageForSession,
  finalizeOpenToolUsage,
  type ToolUsageRow,
} from "@/lib/tool-usage";
import { Gauge, FileMusic, Sparkles, Music2 } from "lucide-react";

const TOOL_LABEL: Record<string, string> = {
  metronome: "Metronome",
  slow_downer: "Slow Downer",
  sheet_music_reader: "Sheet Music Reader",
  ai_assistant: "AI Assistant",
};

function ToolIcon({ name }: { name: string }) {
  const cls = "h-3.5 w-3.5";
  if (name === "metronome") return <Music2 className={cls} />;
  if (name === "slow_downer") return <Gauge className={cls} />;
  if (name === "sheet_music_reader") return <FileMusic className={cls} />;
  if (name === "ai_assistant") return <Sparkles className={cls} />;
  return null;
}

function fmtDuration(sec: number): string {
  if (!sec || sec < 1) return "<1s";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function isStringy(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number";
}

function arrPreview(v: unknown, max = 6): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const items = v.filter(isStringy).map(String);
  if (!items.length) return null;
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

function uniqStrs(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const x of v) {
    if (isStringy(x)) {
      const s = String(x).trim();
      if (s) seen.add(s);
    }
  }
  return Array.from(seen);
}

function uniqPreview(v: unknown, max = 4): string | null {
  const items = uniqStrs(v);
  if (!items.length) return null;
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

function bpmSummary(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const nums = v
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n)) as number[];
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return `${min} BPM`;
  return `${min}–${max} BPM`;
}

// Summarize beat/accent pattern arrays without dumping the raw array, which
// can be hundreds of chars and break mobile layout.
function patternSummary(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  // beat_patterns_used may itself be an array of arrays (one entry per
  // pattern change) or a single flat array of beat states.
  const isNested = v.some((x) => Array.isArray(x));
  if (isNested) {
    const count = v.length;
    return count > 1 ? "Multiple patterns used" : "Custom pattern used";
  }
  const hasAccent = v.some(
    (x) => typeof x === "string" && /accent|off/i.test(x),
  );
  return hasAccent ? "Accent changes used" : "Custom pattern used";
}

interface DetailLine {
  label: string;
  value: string;
}

function detailsFor(row: ToolUsageRow): DetailLine[] {
  const d = row.usage_data ?? {};
  const out: DetailLine[] = [];
  const push = (label: string, v: unknown) => {
    if (v == null) return;
    if (typeof v === "boolean") {
      if (v) out.push({ label, value: "Yes" });
      return;
    }
    if (Array.isArray(v)) {
      const s = arrPreview(v);
      if (s) out.push({ label, value: s });
      return;
    }
    if (isStringy(v) && String(v).trim() !== "") {
      out.push({ label, value: String(v) });
    }
  };

  if (row.tool_name === "metronome") {
    const bpm = bpmSummary(d.bpm_values_used);
    if (bpm) out.push({ label: "BPM", value: bpm });
    const ts = uniqPreview(d.time_signatures_used);
    if (ts) out.push({ label: "Time signatures", value: ts });
    const sub = uniqPreview(d.subdivisions_used);
    if (sub) out.push({ label: "Subdivisions", value: sub });
    push("Sound", d.sound_used);
    const pat = patternSummary(d.beat_patterns_used);
    if (pat) out.push({ label: "Beat patterns", value: pat });
    if (d.gap_mode_used) {
      push(
        "Gap trainer",
        d.bars_on != null && d.bars_off != null
          ? `${d.bars_on} on / ${d.bars_off} off`
          : "Used",
      );
    }
  } else if (row.tool_name === "slow_downer") {
    push("File", d.file_used);
    push("Speeds", d.speed_values_used);
    push("Loop points", d.loop_points_used);
    push("Fullscreen", d.fullscreen_used);
  } else if (row.tool_name === "sheet_music_reader") {
    push("Score", d.file_used);
    push("Pages viewed", d.page_numbers_viewed);
    push("Reading mode", d.reading_mode_used);
    push("Fullscreen", d.fullscreen_used);
  } else if (row.tool_name === "ai_assistant") {
    if (typeof d.prompt_count === "number") {
      out.push({ label: "Prompts", value: String(d.prompt_count) });
    }
    push("Session context", d.session_context_used);
  }
  return out;
}

export function ToolUsageSummary({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) {
  const [rows, setRows] = useState<ToolUsageRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Safety net: close any orphan rows for this session before loading.
        await finalizeOpenToolUsage(userId, sessionId);
        const r = await loadToolUsageForSession(userId, sessionId);
        if (active) setRows(r);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, sessionId]);

  if (error) {
    return (
      <p className="text-xs text-muted-foreground">Tool usage unavailable.</p>
    );
  }
  if (!rows) return null;
  if (rows.length === 0) return null;

  // Group by tool_name; merge multiple opens (sum seconds, merge details).
  const grouped = new Map<string, ToolUsageRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.tool_name) ?? [];
    list.push(r);
    grouped.set(r.tool_name, list);
  }

  return (
    <div className="mb-6">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Tools used
      </p>
      <ul className="space-y-2">
        {Array.from(grouped.entries()).map(([tool, list]) => {
          const totalSec = list.reduce((a, r) => a + (r.total_seconds ?? 0), 0);
          // Merge details across opens, last value wins per label.
          const map = new Map<string, string>();
          for (const r of list) for (const d of detailsFor(r)) map.set(d.label, d.value);
          const details = Array.from(map.entries());
          const firstOpen = list[0]?.opened_at ?? null;
          const lastClose = list[list.length - 1]?.closed_at ?? null;
          return (
            <li
              key={tool}
              className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-sm">
                  <ToolIcon name={tool} />
                  <span className="min-w-0 truncate">{TOOL_LABEL[tool] ?? tool}</span>
                </p>
                <p className="shrink-0 font-mono text-xs text-muted-foreground">
                  {fmtDuration(totalSec)}
                </p>
              </div>
              {(firstOpen || lastClose) && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fmtTime(firstOpen)}
                  {lastClose ? ` – ${fmtTime(lastClose)}` : ""}
                  {list.length > 1 ? ` · ${list.length} opens` : ""}
                </p>
              )}
              {details.length > 0 && (
                <dl className="mt-2 space-y-1">
                  {details.map((d) => (
                    <div
                      key={d[0]}
                      className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs"
                    >
                      <dt className="shrink-0 text-muted-foreground">{d[0]}</dt>
                      <dd className="min-w-0 max-w-full break-words text-foreground/90">
                        {d[1]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
