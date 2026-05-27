import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { findActiveSessionPointer } from "@/lib/active-session";

/**
 * Shows a "Return to Session" banner if an active practice session exists in
 * localStorage. Rendered on pages where a user could be stranded away from
 * their in-progress session (e.g. /session/new, /tools).
 */
export function ActiveSessionBanner({ label }: { label?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const ptr = findActiveSessionPointer();
      setSessionId(ptr?.sessionId ?? null);
    };
    check();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("shed.active.")) check();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", check);
    };
  }, []);

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
        <Link
          to="/session/$id"
          params={{ id: sessionId }}
          className="shrink-0 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Return to Session
        </Link>
      </div>
    </div>
  );
}
