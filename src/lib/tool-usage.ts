// Shared practice-tool usage logging.
// - Logging only happens when an active practice session is present (via context).
// - All failures are swallowed so tool UX never breaks.
// - One row per tool open: insert on open, patch usage_data locally, finalize on close.

import { createContext, useContext, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ToolName =
  | "metronome"
  | "slow_downer"
  | "sheet_music_reader"
  | "ai_assistant";

interface ToolSessionCtx {
  sessionId: string | null;
  userId: string | null;
}

export const ToolSessionContext = createContext<ToolSessionCtx>({
  sessionId: null,
  userId: null,
});

export function useToolSession() {
  return useContext(ToolSessionContext);
}

type UsageData = Record<string, unknown>;

/**
 * Log a tool usage record while the component is mounted AND an active
 * practice session is present. No-op otherwise.
 *
 * Returned `update(patch)` shallow-merges into local usage_data; nothing is
 * persisted until close (unmount or session end).
 */
export function useToolUsageLogger(tool: ToolName) {
  const { sessionId, userId } = useToolSession();
  const rowIdRef = useRef<string | null>(null);
  const openedAtRef = useRef<number>(0);
  const dataRef = useRef<UsageData>({});

  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    openedAtRef.current = Date.now();
    dataRef.current = {};

    (async () => {
      try {
        const { data, error } = await supabase
          .from("practice_tool_usage")
          .insert({
            user_id: userId,
            session_id: sessionId,
            tool_name: tool,
            opened_at: new Date(openedAtRef.current).toISOString(),
            usage_data: {},
          })
          .select("id")
          .single();
        if (!cancelled && !error && data?.id) rowIdRef.current = data.id;
      } catch {
        /* logging never blocks tool */
      }
    })();

    const finalize = async () => {
      const id = rowIdRef.current;
      if (!id) return;
      const total = Math.round((Date.now() - openedAtRef.current) / 1000);
      try {
        await supabase
          .from("practice_tool_usage")
          .update({
            closed_at: new Date().toISOString(),
            total_seconds: total,
            usage_data: dataRef.current as never,
          })
          .eq("id", id)
          .eq("user_id", userId);
      } catch {
        /* swallow */
      }
      rowIdRef.current = null;
    };

    const onBeforeUnload = () => {
      // Best-effort sync close on navigation away.
      void finalize();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onBeforeUnload);
      void finalize();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, tool]);

  /** Merge keys into local usage_data (persisted on close). */
  const update = (patch: UsageData) => {
    if (!rowIdRef.current) return;
    dataRef.current = { ...dataRef.current, ...patch };
  };

  /** Append a value to a deduped Set tracked under `key`. */
  const track = (key: string, value: unknown) => {
    if (!rowIdRef.current) return;
    const cur = dataRef.current[key];
    const arr = Array.isArray(cur) ? [...cur] : [];
    if (!arr.some((v) => JSON.stringify(v) === JSON.stringify(value))) {
      arr.push(value);
      dataRef.current[key] = arr;
    }
  };

  /** Increment a numeric counter under `key`. */
  const increment = (key: string, by = 1) => {
    if (!rowIdRef.current) return;
    const cur = typeof dataRef.current[key] === "number" ? (dataRef.current[key] as number) : 0;
    dataRef.current[key] = cur + by;
  };

  return { update, track, increment };
}

/**
 * Safety net: close any still-open practice_tool_usage rows for a session.
 * Sets closed_at = now() and computes total_seconds from opened_at when missing.
 * Swallows all errors — never blocks the caller.
 */
export async function finalizeOpenToolUsage(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("practice_tool_usage")
      .select("id, opened_at, total_seconds")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .is("closed_at", null);
    if (error || !data) return;
    const now = Date.now();
    await Promise.all(
      data.map((row) => {
        const openedMs = row.opened_at ? new Date(row.opened_at).getTime() : now;
        const total =
          row.total_seconds && row.total_seconds > 0
            ? row.total_seconds
            : Math.max(0, Math.round((now - openedMs) / 1000));
        return supabase
          .from("practice_tool_usage")
          .update({
            closed_at: new Date(now).toISOString(),
            total_seconds: total,
          })
          .eq("id", row.id)
          .eq("user_id", userId);
      }),
    );
  } catch {
    /* swallow */
  }
}

export interface ToolUsageRow {
  id: string;
  tool_name: string;
  opened_at: string;
  closed_at: string | null;
  total_seconds: number;
  usage_data: Record<string, unknown>;
}

export async function loadToolUsageForSession(
  userId: string,
  sessionId: string,
): Promise<ToolUsageRow[]> {
  try {
    const { data, error } = await supabase
      .from("practice_tool_usage")
      .select("id, tool_name, opened_at, closed_at, total_seconds, usage_data")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("opened_at", { ascending: true });
    if (error || !data) return [];
    return data as unknown as ToolUsageRow[];
  } catch {
    return [];
  }
}

