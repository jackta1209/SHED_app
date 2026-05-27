import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { findActiveSessionPointer } from "@/lib/active-session";
import { activeSessionStore, sessionStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

/**
 * Shows a "Return to Session" banner if an active practice session exists in
 * localStorage. Also offers a Discard escape hatch so a broken or stale
 * active-session pointer can never strand the user. Fails closed.
 */
export function ActiveSessionBanner({ label }: { label?: string }) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pointerUserId, setPointerUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    try {
      const ptr = findActiveSessionPointer();
      const id =
        ptr && typeof ptr.sessionId === "string" && ptr.sessionId.trim().length > 0
          ? ptr.sessionId
          : null;
      setSessionId(id);
      setPointerUserId(ptr?.userId ?? null);
    } catch {
      setSessionId(null);
      setPointerUserId(null);
    }
  }

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      try {
        if (!e.key || e.key.startsWith("shed.active.")) refresh();
      } catch {
        /* ignore */
      }
    };
    try {
      window.addEventListener("storage", onStorage);
      window.addEventListener("focus", refresh);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("focus", refresh);
      } catch {
        /* ignore */
      }
    };
  }, []);

  async function discard() {
    if (busy) return;
    if (!confirm("Discard this practice session? You can start a new one right after.")) return;
    setBusy(true);
    const uid = user?.id ?? pointerUserId;
    try {
      if (uid) {
        try {
          activeSessionStore.clear(uid);
        } catch {
          /* ignore */
        }
        if (sessionId && user?.id) {
          // Best-effort: mark the row abandoned so analytics/dashboard
          // stop treating it as active. Ignore failures (row may be
          // missing, already completed, or offline).
          try {
            await sessionStore.update(
              sessionId,
              { status: "abandoned", end_time: new Date().toISOString() },
              user.id,
            );
          } catch {
            /* ignore */
          }
        }
      }
      refresh();
      toast.success("Session discarded.");
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) return null;

  return (
    <div className="mb-4 max-w-full min-w-0 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlayCircle size={16} className="shrink-0 text-primary" />
          <p className="min-w-0 break-words text-sm">
            {label ?? "You have an active practice session."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Discard
          </button>
          <Link
            to="/session/$id"
            params={{ id: sessionId }}
            className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Return to Session
          </Link>
        </div>
      </div>
    </div>
  );
}
