// Lightweight helper to detect an active practice session from localStorage.
// Keys are written by activeSessionStore as `shed.active.${userId}`.

export interface ActiveSessionPointer {
  userId: string;
  sessionId: string;
}

export function findActiveSessionPointer(): ActiveSessionPointer | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("shed.active.")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as {
          session_id?: string;
          user_id?: string;
        };
        if (parsed?.session_id && parsed?.user_id) {
          return { userId: parsed.user_id, sessionId: parsed.session_id };
        }
      } catch {
        /* ignore malformed entry */
      }
    }
  } catch {
    /* ignore storage access errors */
  }
  return null;
}
