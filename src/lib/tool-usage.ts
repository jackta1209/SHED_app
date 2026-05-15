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
            usage_data: dataRef.current,
          })
          .eq("id", id);
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
