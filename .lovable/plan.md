# Pre-Beta Diagnosis Report

## 1. Executive Summary

**Verdict: Ready but warn testers — fix Issue 3 and Issue 4 before wide invites.**

Two of the four issues are real correctness bugs in the Slow Downer (Issues 1 & 2) but only affect the video-import path, which is a secondary use case. Issue 3 (iPhone audio import being silently rejected) blocks the core mobile Slow Downer flow and should be fixed first. Issue 4 (Google in-app browser) is the kind of "looks broken to a new user" failure that disproportionately damages first impressions, so a graceful fallback is warranted before beta. None of the four corrupt data or touch auth/Supabase, so a small private beta can proceed in parallel with these fixes.

---

## 2. Issue 1 — Desktop: video black + no waveform

**Root cause (two stacked problems):**

1. **Black video display:** In `src/components/SlowDowner.tsx` the `<video>` element is rendered with `className="mt-3 w-full rounded-lg bg-black"` and **no `controls`, no `poster`, no `preload` set above `metadata`**. The transport buttons call `el.play()` correctly, so playback technically works — but until the user hits Play the element shows the `bg-black` background (no first-frame preview), and even during playback Safari/Chrome on desktop will keep showing black for many `.mov`/HEVC files because the codec audio decodes but the video track does not. Combined with the fact that there is no visible `<video>` control surface, the user perceives the video as "broken / black".
2. **No waveform for video:** `Waveform.tsx` `decodePeaks()` does `fetch(url) → arrayBuffer → ctx.decodeAudioData(...)`. `decodeAudioData` only accepts a complete file whose container is a supported *audio* format. For MP4/MOV containers, all major browsers either reject the buffer outright or return `EncodingError`. The catch handler sets `error="Could not analyze audio"` and renders the generic "Waveform unavailable" overlay. This is by design of the Web Audio API, not a bug in the decoder loop.

**Files involved:** `src/components/SlowDowner.tsx` (video element), `src/components/Waveform.tsx` (decode path).

**Severity:** Minor (video path is secondary; playback + speed + A/B all work).

**Minimal fix:**
- Add `controls`, `preload="metadata"`, and a `poster` (or just rely on `preload="metadata"` so the first frame shows) to the `<video>` element. Remove `bg-black` or make it conditional on `mediaType === "audio"`.
- In `Waveform.tsx`, accept an optional `disabled` / `kind` prop. When `mediaType === "video"`, skip `decodePeaks` and render a neutral timeline strip with the message "Waveform unavailable for video — use the scrubber below." (Generating peaks from the video's audio track would require `<canvas captureStream>` or `MediaElementAudioSourceNode + ScriptProcessor` — out of scope for a minimal fix.)

**Blocks beta?** No.

---

## 3. Issue 2 — Mobile: video waveform missing + timeline/slider out of sync

**Root cause:**

1. **Waveform missing:** Same `decodeAudioData` limitation as Issue 1, with the additional iOS Safari constraint that even when the container *is* decodable, iOS will reject buffers above ~50 MB on older devices. Always fails for video on iPhone.
2. **Timeline/slider drift on iPhone Safari:** `SlowDowner.tsx` updates `currentTime` state only on the element's `onTimeUpdate` event. iOS Safari fires `timeupdate` at **~4 Hz for video** (every ~250 ms), and at non-1.0 playback rates this becomes irregular — the slider visibly stutters and falls behind the actual `videoEl.currentTime`. Additionally, when `loopOn` is true, `onTimeUpdate` reassigns `el.currentTime = loopA`, which on iOS Safari can race with the element's own timeupdate emission and momentarily desync React state vs the element. The `Waveform` playhead masks this on desktop because it reads `media.currentTime` directly inside a rAF loop, but the React `<input type="range">` slider and `fmt(currentTime)` readout do not — they read state, which only ticks at the slow `timeupdate` rate.
3. **(Adjacent risk):** `mediaRef = mediaType === "video" ? videoRef : audioRef` is recomputed on every render. The value is referentially unstable, but because both `videoRef` and `audioRef` are stable `useRef` objects, this is benign — confirmed not an active bug.

**Files involved:** `src/components/SlowDowner.tsx` (onTimeUpdate handler, loop logic, slider binding), `src/components/Waveform.tsx`.

**Severity:** Minor → Major (depending on how much the user relies on the slider on mobile). The audio-only path is unaffected, so this is paired with Issue 1.

**Minimal fix:**
- Drive `currentTime` updates from a single `requestAnimationFrame` loop while `playing` is true (read `mediaRef.current.currentTime` each frame), and fall back to `onTimeUpdate` only when paused. This already exists for the Waveform playhead — extract it to the parent.
- Move A/B loop enforcement off `onTimeUpdate` into the same rAF loop so seeks happen at frame cadence.
- For video, hide/grey out the waveform with a clear caption (see Issue 1 fix).

**Blocks beta?** No.

---

## 4. Issue 3 — iPhone Safari: audio file import rejected

**Root cause:**

In `SlowDowner.tsx > handleFile()`:
```ts
const isAudio = file.type.startsWith("audio/");
const isVideo = file.type.startsWith("video/");
if (!isAudio && !isVideo) {
  toast.error("Unsupported file. Please choose an audio or video file.");
  return;
}
```

iOS Safari and the iOS Files picker frequently return **`file.type === ""`** for files chosen from iCloud Drive, Files, or even Voice Memos exports (especially `.m4a` and `.wav`). Some `.mp3` files come back as `audio/mpeg`, but many `.m4a` files from the Files app arrive with empty `type`. The strict prefix check therefore silently rejects valid audio files.

Additionally, the `<input accept="audio/*,video/*">` filter itself is a **soft hint** on iOS — iOS Files presents all files anyway — but combined with empty MIME types it leads to the user perceiving the picker as broken.

A secondary contributor: there's only one `<input>` accepting both audio and video, which on iPhone causes the OS to default to the camera/photo-library picker instead of Files. iOS users hitting "Import" land in the photo gallery, where audio files don't exist.

**Files involved:** `src/components/SlowDowner.tsx` (only).

**Severity:** **Major** — blocks the primary mobile use case.

**Minimal fix:**
1. Fall back to **extension sniffing** when `file.type` is empty: treat `.mp3 .m4a .aac .wav .flac .ogg .oga .opus` as audio and `.mp4 .mov .m4v .webm` as video.
2. Split the picker into two buttons: **"Import audio"** (`accept="audio/*,.mp3,.m4a,.aac,.wav,.flac"`) and **"Import video"** (`accept="video/*,.mp4,.mov,.m4v"`). The explicit extensions in `accept` materially improve the iOS Files picker behavior.
3. Replace the silent rejection with a clearer toast when both checks fail.

**Blocks beta?** Yes — fix before sending invites to mobile-first testers.

---

## 5. Issue 4 — Google in-app browser does not load app

**Most likely cause (in order of probability):**

1. **In-app browser is Googlebot's WebView (Google Search app / Gmail / LinkedIn / Instagram) which strips/blocks third-party storage.** TanStack Start + Supabase Auth try to read `localStorage` and set cookies on first paint via `AuthProvider`. In WebViews that restrict storage, `supabase.auth.getSession()` can either hang or throw, leaving `loading === true` indefinitely. In `src/routes/index.tsx > Landing` the early return is `if (loading || user) return null;` — so when `loading` never resolves, **the landing page renders nothing**, exactly matching the "app does not load" symptom.
2. Less likely: SSR/edge headers (Cloudflare workerd) returning a `Set-Cookie` with `SameSite=None` requirements that the Google WebView strips.
3. Unlikely: CSP — no custom CSP headers are set in `__root.tsx`. Service worker — none registered. Apex vs `www.` — both alias to the same deploy, but worth verifying the apex doesn't 301 in a way that breaks in-app browsers.

**Files involved:** `src/routes/index.tsx` (the `loading` gate), `src/lib/auth-context.tsx` (where `getSession()` is awaited), `src/integrations/supabase/client.ts` (auth storage config — read-only file, but relevant context).

**Severity:** **Major** — Google search is the most common discovery path; a blank page on first click is a silent funnel killer.

**Minimal fix (UX, not architectural):**
1. In `Landing`, render a **static hero immediately** (don't gate the entire page on `loading`). Only the "Enter the shed" CTA needs to wait for auth; the marketing content above the fold can render unconditionally so the page never appears blank.
2. Detect known in-app browsers via `navigator.userAgent` (`GSA/`, `FBAN/`, `FBAV/`, `Instagram`, `Line/`, `Twitter`) and show a small **"Open in Safari"** banner with a `target="_blank"` link. This is the industry-standard mitigation.
3. Add a 5-second timeout on `auth.getSession()` in `AuthProvider`; on timeout, set `loading=false` and treat the user as signed-out so the landing renders.

**Blocks beta?** Yes, soft-blocks — fix at least step 1 (un-gated landing render) before beta.

---

## 6. Recommended Fix Order

**Must fix before beta:**
1. Issue 3 — iPhone audio import (extension fallback + split inputs).
2. Issue 4 step 1 — un-gate the landing page so Google WebView never sees a blank.

**Fix during beta:**
3. Issue 4 steps 2–3 — in-app browser banner + auth timeout.
4. Issue 1 — video display polish (controls, preload, conditional bg-black).
5. Issue 2 — rAF-driven timeline updates on mobile.

**Document as known limitation:**
- Waveform unavailable for video files (decodeAudioData cannot read MP4/MOV containers). Show inline notice instead of silent failure.

**Fix later:**
- True video-track audio analysis (would need `MediaElementAudioSourceNode` + offline rendering; non-trivial, out of scope for beta).

---

## 7. Files Likely Needing Changes

- `src/components/SlowDowner.tsx` — Issues 1, 2, 3 (file input, video element, timeline rAF, loop logic).
- `src/components/Waveform.tsx` — Issues 1, 2 (skip-for-video mode + clearer caption).
- `src/routes/index.tsx` — Issue 4 step 1 (un-gate landing render).
- `src/lib/auth-context.tsx` — Issue 4 step 3 (auth timeout).
- *(Optionally new)* `src/lib/in-app-browser.ts` — Issue 4 step 2 (UA detection + banner component).

No changes to Supabase, RLS, auth schema, AI assistant, journal, history, metronome, or sheet reader.

---

## 8. Proposed Minimal Build-Mode Prompt (highest-priority fixes)

> Fix the two beta-blocking issues found in pre-beta diagnosis: iPhone Safari audio import rejection, and Google in-app browser blank landing page.
>
> **Scope — do not exceed:**
> - Edit only `src/components/SlowDowner.tsx` and `src/routes/index.tsx`.
> - Do not touch Supabase, RLS, auth schema, the metronome, journal, history, session, AI assistant, or sheet reader.
> - Do not redesign the landing page or the Slow Downer UI; only the minimum needed for the fixes.
>
> **Fix 1 — iPhone Safari audio import (`SlowDowner.tsx > handleFile`):**
> 1. When `file.type === ""` or doesn't start with `audio/`/`video/`, fall back to extension sniffing. Treat `.mp3 .m4a .aac .wav .flac .ogg .oga .opus` as audio and `.mp4 .mov .m4v .webm` as video.
> 2. Replace the single combined Import button with two buttons: **"Import audio"** (`accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus"`) and **"Import video"** (`accept="video/*,.mp4,.mov,.m4v,.webm"`). Keep the same styling and the same empty-state copy.
> 3. Improve the rejection toast to name the detected type/extension.
>
> **Fix 2 — Google in-app browser blank landing (`src/routes/index.tsx`):**
> 1. Remove the `if (loading || user) return null;` early return. Always render the marketing hero immediately.
> 2. Only the "Enter the shed" CTA should react to auth: when `user` is set, the `useEffect` redirect handles navigation; when `loading`, render the CTA in a disabled state with the same label (or "Loading…"); when signed out, render the normal Link.
> 3. Do not change copy, layout, fonts, or colors. Do not add an in-app-browser banner in this pass.
>
> **Verification:**
> - Typecheck/build passes.
> - Desktop landing still redirects authenticated users to `/dashboard`.
> - Desktop Slow Downer audio import still works.
> - Tell me what to test on iPhone Safari and what to test by opening the site from Google search.
