// Tracks a short grace window after the user taps a legitimate file-import
// button. While the grace window is active, session visibility-change handlers
// should NOT count the resulting app-switch as a distraction.

const KEY = "__shedImportGraceUntil";

declare global {
  interface Window {
    [KEY]?: number;
  }
}

export function markImportIntent(ms = 60_000) {
  if (typeof window === "undefined") return;
  window[KEY] = Date.now() + ms;
}

export function isInImportGrace(): boolean {
  if (typeof window === "undefined") return false;
  const until = window[KEY];
  return typeof until === "number" && Date.now() < until;
}

export function clearImportGrace() {
  if (typeof window === "undefined") return;
  window[KEY] = 0;
}
