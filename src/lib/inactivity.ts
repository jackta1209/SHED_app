// Tracks user activity and signs out after the user's selected inactivity timeout.
// "manual" mode (timeoutMinutes === null) disables auto-logout entirely.
// Last-active timestamp persists in localStorage so refresh, tab close/reopen,
// and device sleep do NOT log the user out unless the timeout has truly elapsed.

import { useEffect, useRef } from "react";

const LS_KEY = "shed_last_active_at";
const THROTTLE_MS = 5_000; // throttle writes
const CHECK_INTERVAL_MS = 30_000;

export const DEFAULT_INACTIVITY_MINUTES = 15;

export function readLastActive(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = localStorage.getItem(LS_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

export function writeLastActive(ts: number = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, String(ts));
  } catch {
    // ignore quota / privacy errors
  }
}

export function clearLastActive() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Hook: monitors activity and signs the user out after `timeoutMinutes` of
 * inactivity. Pass `null` (or undefined) to disable auto-logout ("manual only").
 *
 * - active: must be true when there is a signed-in user. When false, the hook
 *   is a no-op (no listeners, no checks).
 * - timeoutMinutes: number of minutes, or null to disable auto-logout.
 * - onTimeout: called when inactivity exceeds the threshold. Should sign out.
 */
export function useInactivityLogout(opts: {
  active: boolean;
  timeoutMinutes: number | null;
  onTimeout: () => void;
}) {
  const { active, timeoutMinutes, onTimeout } = opts;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const timedOutRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    timedOutRef.current = false;

    // Seed initial timestamp if missing.
    if (!localStorage.getItem(LS_KEY)) writeLastActive();

    let lastWrite = 0;
    const bump = () => {
      const now = Date.now();
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;
      writeLastActive(now);
    };

    const check = () => {
      if (timeoutMinutes == null || timedOutRef.current) return false; // manual mode
      const last = readLastActive();
      const elapsedMs = Date.now() - last;
      if (elapsedMs >= timeoutMinutes * 60_000) {
        timedOutRef.current = true;
        onTimeoutRef.current();
        return true;
      }
      return false;
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "scroll",
      "touchstart",
      "touchmove",
      "wheel",
    ];
    for (const e of events) {
      window.addEventListener(e, bump, { passive: true });
    }

    const checkThenBump = () => {
      if (!check()) bump();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkThenBump();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", checkThenBump, { passive: true });
    window.addEventListener("popstate", bump, { passive: true });
    window.addEventListener("hashchange", bump, { passive: true });

    // Initial check on mount (covers refresh/sleep-wake case)
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const e of events) window.removeEventListener(e, bump);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", checkThenBump);
      window.removeEventListener("popstate", bump);
      window.removeEventListener("hashchange", bump);
      window.clearInterval(interval);
    };
  }, [active, timeoutMinutes]);
}
