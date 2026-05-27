// Lightweight helper to detect an active practice session from localStorage.
// Keys are written by activeSessionStore as `shed.active.${userId}`.
//
// IMPORTANT: this helper runs from UI components (banners) that render on
// every page. It must NEVER throw — restricted/private browsers, quota errors,
// stale entries from older app versions, and partial writes are all expected
// in the wild. Always fail closed (return null) and let the page render
// normally.

export interface ActiveSessionPointer {
  userId: string;
  sessionId: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function findActiveSessionPointer(): ActiveSessionPointer | null {
  if (typeof window === "undefined") return null;
  let storage: Storage;
  try {
    storage = window.localStorage;
    if (!storage) return null;
  } catch {
    return null;
  }

  try {
    // Snapshot keys first so cleanup during iteration is safe.
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("shed.active.")) keys.push(k);
    }

    for (const k of keys) {
      let raw: string | null = null;
      try {
        raw = storage.getItem(k);
      } catch {
        continue;
      }
      if (!raw) {
        safeRemove(k);
        continue;
      }
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        safeRemove(k);
        continue;
      }
      if (!parsed || typeof parsed !== "object") {
        safeRemove(k);
        continue;
      }
      const obj = parsed as { session_id?: unknown; user_id?: unknown };
      if (!isNonEmptyString(obj.session_id) || !isNonEmptyString(obj.user_id)) {
        // Stale/corrupt shape from older builds — drop it.
        safeRemove(k);
        continue;
      }
      return { userId: obj.user_id, sessionId: obj.session_id };
    }
  } catch {
    /* ignore storage access errors */
  }
  return null;
}
