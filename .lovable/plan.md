# SHED Production QA Audit — hittheshed.com

Read-only report. No code changed. Combines: production browser probes (landing page, login, signup, protected-route redirect, CORS preflight from 4 origins), full code review (auth+session, tools+AI, RLS+security) via parallel subagents, security scan, and edge-function log review.

**Constraint hit:** signup requires email confirmation (Supabase default), and I have no inbox access to `yen.ng7979@gmail.com`. All authenticated UI flows below are evaluated by code review + non-authenticated production probes. To live-test the authenticated UI, you'll need to confirm that account and either share the session or run the flows yourself with this report as a checklist.

---

## 1 · Executive summary

**Verdict: Almost ready for private beta — minor-to-major fixes needed.**

Foundations are solid: RLS is correctly defined on all 9 user-owned tables, the `handle_new_user` trigger is hardened (`SECURITY DEFINER` + revoked execute), service-role keys are server-only, the CORS regression fix is verified live, edge-function logs are clean. The landing page renders, redirects work, signup sends the confirmation email.

What's blocking a clean beta is a small set of **race conditions in the practice-session lifecycle** (duplicate sessions on double-tap, auto-finish re-entry loop, settings TOCTOU crash) and a **defense-in-depth gap** where client `UPDATE` queries rely only on RLS for ownership. None expose data today, but all four are easy to hit in real usage by a beta tester on flaky mobile networks.

---

## 2 · Critical blockers (must fix before beta)

### B-1 · `settingsStore.get()` can return null and crash the new-session page
- **Where:** `src/lib/store.ts:426–439`, called from `src/routes/session.new.tsx:46`
- **Repro:** First-ever visit to `/session/new` if the `user_settings` insert from `handle_new_user` and a concurrent fetch race. Second concurrent INSERT hits unique constraint, returns null, then `s.next_focus` throws.
- **Impact:** Uncaught TypeError, new-session form unusable. High likelihood for fresh accounts.
- **Recommended fix:** Use UPSERT in the fallback insert, or null-guard the caller.

### B-2 · Duplicate active practice sessions on double-tap / second tab
- **Where:** `src/routes/session.new.tsx:55–75` + `src/lib/store.ts:228–281`
- **Repro:** Tap "Begin session" twice on slow connection, or open two tabs. `findActive`→`create` is a client-side check-then-act with no DB unique constraint on `(user_id, status='active')`.
- **Impact:** Orphaned `status='active'` rows that never complete; cascading confusion across history/dashboard.
- **Recommended fix:** Add a partial unique index `(user_id) WHERE status='active'`, plus handle the resulting conflict.

### B-3 · Auto-finish re-entry loop on transient DB error
- **Where:** `src/routes/session.$id.tsx:215–221, 264–307`
- **Repro:** Timer hits 0, `sessionStore.update` fails (offline blip), code resets `finishedRef.current = false` → the auto-finish `useEffect` (deps include `remaining=0`) re-fires every render in a tight loop until DB recovers. Risk of duplicate completion writes once it does.
- **Recommended fix:** Don't reset `finishedRef` on failure; expose a "Retry finish" button instead.

### B-4 · `sessionStore.update` / journal update / tool-usage update not scoped by `user_id`
- **Where:** `src/lib/store.ts:285, 370`, `src/lib/tool-usage.ts:76, 156`
- **Status today:** **Not exploitable.** RLS UPDATE policies on all three tables enforce `auth.uid() = user_id`. The security scan flags this as IDOR risk because the *only* gate is RLS — a future RLS edit/regression would immediately become a full cross-user IDOR.
- **Recommended fix:** Add `.eq('user_id', userId)` to every mutating query — defense in depth.

---

## 3 · Major issues (fix during private beta)

| ID | Area | File | Issue |
|---|---|---|---|
| M-1 | Auth | `auth-context.tsx:44–68` | `onAuthStateChange` registered inside `getSession().then()` after `loading=false` — narrow window where `SIGNED_IN`/`TOKEN_REFRESHED` events fire before listener attaches |
| M-2 | Auth | `login.tsx` | No redirect-when-already-authenticated guard; logged-in users see the login form |
| M-3 | Auth | `login.tsx:54–67` | `setBusy(false)` fires before post-login async work; submit re-enables, double-submit window |
| M-4 | Session | `session.$id.tsx:82–91` | Pause-resume math uses only one `paused_at` — multi-pause inflates elapsed and under-reports remaining time on tab reopen |
| M-5 | Session | `session.$id.tsx:178–188` | Async `logExit` inside `beforeunload` is cancelled by the browser — exit attempts on true unloads are silently dropped (need `sendBeacon`) |
| M-6 | Reflection | `store.ts:354–388` | `upsertSessionReflection` SELECT-then-INSERT race on double-tap creates duplicate `session_reflection` rows |
| M-7 | Account | `delete-user-account/index.ts:57–79` | Table rows deleted *before* `auth.admin.deleteUser`. If the Auth delete fails, user is left logged-in with no data — unrecoverable |
| M-8 | Account | `account.tsx:62–63` | Double `signOut` call after deletion |
| M-9 | History | `history.tsx:54` | Filter pills use hard-coded `PRACTICE_CATEGORIES` — user-custom categories never appear as filter options |
| M-10 | AI | `ai-practice-assistant/index.ts:166–200` | TOCTOU on daily/monthly rate-limit: 30+ concurrent calls all pass the count check before any usage row is inserted; user can blow past the cap |
| M-11 | AI | `ai-practice-assistant/index.ts:207–213` | `session_context` truncated by raw `slice(0,2000)` mid-JSON → `JSON.parse` throws → active context silently dropped |
| M-12 | AI | `AssistantChat.tsx` + edge fn | No conversation history forwarded to OpenAI. Every turn is context-free; follow-ups can't reference prior replies |
| M-13 | AI/CORS | `ai-practice-assistant/index.ts:34–39` | Rejected origins receive `Access-Control-Allow-Origin: "null"` (string literal). Sandboxed iframes (origin = literal `null`) may match this in Chromium |
| M-14 | Tools | `tool-usage.ts:44–67` + `Metronome.tsx` | Initial state values (BPM, time sig, etc.) fire before the async insert resolves — first values of every tracked field silently dropped |
| M-15 | SlowDowner | `SlowDowner.tsx:69` + `Waveform.tsx:199` | `mediaRef` is a new object every render → Waveform's rAF tears down and restarts on every `currentTime` update → playhead jank |
| M-16 | SlowDowner | `SlowDowner.tsx:193` | Marker labels use `window.prompt()` — broken/unstyled on iOS Safari |
| M-17 | Metronome | `Metronome.tsx:465–469` | Subdivision change clears `subRef`/`nextNoteTimeRef` but not `visualQueueRef` → ghost beat flashes for ~100 ms |
| M-18 | Sheet reader | `SheetMusicReader.tsx:156–164` + `sheet-music-storage.ts` | No file-size guard; 100 MB PDF loaded into memory; QuotaExceeded detection uses message-text heuristic that breaks on Chrome |

---

## 4 · Minor issues (polish / fix later)

`m-1` Distraction listeners re-registered every tick (`remaining` in dep array) · `m-2` `finalizeOpenToolUsage` throw freezes user post-completion · `m-3` Theme FOUC — `__root.tsx` hard-codes `dark theme-minimal` on `<html>` while user prefs load · `m-4` `/reset-password` 600 ms "checking" delay on valid links · `m-5` Inactivity logout doesn't clear `active` session row — next login lands user in a stale session · `m-6` Empty-email submit silently no-ops · `m-7` `reset-password` stray `setTimeout(navigate, 1200)` without mount guard · `m-8` Journal entries have no edit/delete UI (typos in quick notes are permanent) · `m-9` History shows `created_at` instead of `start_time` · `m-10` Loop points never render in `ToolUsageSummary` (nested-array filter rejects them) · `m-11` `beforeunload` finalize is async → orphans tool-usage rows (needs `sendBeacon`) · `m-12` Multiple Metronome controls under 44 px tap-target minimum · `m-13` AssistantChat shows action-key text (`"suggest today"`) in user bubble, not button label · `m-14` Edge-fn `console.error` calls log only static strings, no error object → blind debugging · `m-15` Sheet reader IndexedDB unavailability (Safari ITP / private mode) shows blank library with no message · `m-16` Waveform `decodeAudioData` uses both callback + promise · `m-17` Metronome `AudioContext` not resumed on `visibilitychange` after iOS background suspend · `m-18` Landing page `<title>` and `og:title` contain a literal newline between "SHED" and "Focused practice…" — renders as broken in social previews · `m-19` No `<link rel="canonical">` on landing page · `m-20` No JSON-LD structured data.

---

## 5 · Security / privacy concerns

- **OK** — Service-role key only in `client.server.ts` and edge functions; grep confirms zero imports from `src/`.
- **OK** — `OPENAI_API_KEY` server-only; never returned in any response body.
- **OK** — Edge-function `console.error` calls log generic strings, no user data; OpenAI response body explicitly not logged.
- **OK** — RLS policies present on all 9 user tables, all scoped to `auth.uid() = user_id`.
- **Medium** — Client UPDATEs rely solely on RLS (B-4 above).
- **Medium** — PII to OpenAI when "Use practice context" is on: `display_name`, `goals`, `weaknesses`, `favorite_styles`, journal-entry content (truncated to 400 chars). Disclosed in UI (`AssistantChat.tsx:192`) but not minimized.
- **Medium** — Prompt-injection surface: untreated journal/note text included in the system-role context block. Soft "treat as data" guard only.
- **Low** — `delete-user-account` uses wildcard `Access-Control-Allow-Origin: *` (inconsistent with `ai-practice-assistant` allowlist). Auth-gated, but a destructive endpoint should mirror the allowlist.
- **Low** — `ai_usage_events.user_id` has no FK to `auth.users` (every other user-scoped table does). No `ON DELETE CASCADE` — explicit deletion in the deletion edge function covers it, but any other deletion path would orphan rows.
- **Low** — `uid()` in `store.ts` uses `Math.random()` for journal/routine/reminder IDs. Not used as auth tokens, so impact is small, but `crypto.randomUUID()` is the safe default.

---

## 6 · Production-only issues

Verified live via curl preflight (Origin → ACAO):

| Origin | Preflight | ACAO |
|---|---|---|
| `https://hittheshed.com` | 200 | `https://hittheshed.com` ✅ |
| `https://www.hittheshed.com` | 200 | `https://www.hittheshed.com` ✅ |
| `https://shed-focus-flow.lovable.app` | 200 | echoed back ✅ |
| `https://evil.example.com` | 200 | `null` (string) — M-13 above |

**Regression check: PASS.** The earlier CORS fix is live on the production endpoint. No production-only issues beyond M-13.

Landing page `<title>`/`og:title` newline (m-18) is a production-visible SEO/social-share defect.

---

## 7 · Mobile issues

- Landing page at 390×844 — readable, centered, no overflow. ✅
- Login page at 390×844 — readable. ✅
- Metronome — multiple controls under 44 px (m-12).
- SlowDowner marker prompt — broken on iOS Safari (M-16).
- Sheet reader — no size guard; large PDFs will crash mobile Safari (M-18).
- `beforeunload`/inactivity paths assume desktop tab semantics; on mobile background ≠ unload — exit logging unreliable (M-5, m-5).

Authenticated screens (dashboard, session, reflection, journal, history, account) **could not be live-tested on mobile** because of the email-confirmation gate. Code review shows the layout pattern is `max-w-md` mobile-first with fixed bottom nav — structurally sound.

---

## 8 · Data integrity issues

- **Duplicate active sessions** (B-2) — most likely to bite beta testers.
- **Duplicate session reflections** (M-6) — second one orphaned.
- **Auto-finish loop double-writes** (B-3).
- **Multi-pause elapsed math wrong** (M-4) — `remaining` under-reported on resume.
- **Distraction undercount** — `beforeunload` and `visibilitychange` listeners re-attached every tick (m-1) leave a ~1 ms hole per second; `logExit` async write dropped on real unloads (M-5).
- **Tool-usage initial values dropped** (M-14) — every metronome session in beta will be missing its starting BPM/TS/subdivision.
- **History date = `created_at`, not `start_time`** (m-9) — conceptually wrong.
- **Loop-point usage never rendered** (m-10).

---

## 9 · Feature-by-feature status

| Feature | Tested | Status | Notes |
|---|---|---|---|
| Landing page | ✅ live + code | **Pass** | Title/og:title newline (m-18); no canonical |
| Signup | ✅ live | **Warning** | Works; email confirm required (good) |
| Login | code only | **Warning** | M-2/M-3 above |
| Logout | code only | **Pass** | Plus minor m-5 |
| Auth persistence | code only | **Warning** | M-1 listener race window |
| Protected-route redirect | ✅ live | **Pass** | `/dashboard` → `/login` confirmed |
| Dashboard | code only | n/a | Not live-tested (gated by email confirm) |
| Practice timer | code only | **Fail** | B-2, B-3, M-4 |
| Reflection | code only | **Warning** | M-6 duplicate-row race |
| Quick notes | code only | **Warning** | m-8 no edit/delete |
| Journal | code only | **Warning** | m-8 |
| History | code only | **Warning** | M-9 filter; m-9 date field |
| Session summary | code only | **Warning** | Depends on M-6 |
| Distraction tracking | code only | **Warning** | M-5, m-1 |
| Analytics | code only | n/a | Not in scope of this audit pass |
| Metronome | code only | **Warning** | M-14, M-17, m-12, m-17 |
| Slow downer | code only | **Warning** | M-15, M-16 |
| Sheet music reader | code only | **Warning** | M-18, m-15 |
| AI assistant | ✅ CORS live + code | **Warning** | M-10/M-11/M-12/M-13 — works but coarse |
| Practice-context toggle | code only | **Pass** | Toggle logic OK; PII disclosure note in §5 |
| Mobile nav | code only | **Pass** | Fixed bottom nav, `pb-[env(safe-area-inset-bottom)]` correct |
| Account deletion | code only | **Warning** | M-7 partial-failure trap |
| Edge functions | ✅ live + logs | **Pass** | CORS verified live, logs clean |
| Supabase persistence + RLS | code + scan | **Pass** | Policies correct; B-4 is defense-in-depth |

---

## 10 · Recommended fix order

**Fix before beta (Critical):** B-1 settings UPSERT · B-2 unique active-session index · B-3 auto-finish loop · B-4 add `user_id` to UPDATEs.

**Fix during private beta (Major):** M-7 deletion ordering · M-6 reflection unique constraint · M-4 multi-pause math · M-5 `sendBeacon` for exit logging · M-2/M-3 login guards · M-10/M-11/M-12 AI assistant correctness · M-13 CORS-null · M-14 tool-usage capture race · M-15/M-16 SlowDowner UX · M-9 history filters.

**Fix later (Minor):** m-* batch, especially m-12 (tap-target sizes), m-3 (theme FOUC), m-18 (landing title newline + canonical), m-15 (sheet reader IndexedDB feedback).

---

## 11 · Files most likely to be touched by fixes

`src/lib/store.ts` · `src/lib/tool-usage.ts` · `src/lib/auth-context.tsx` · `src/routes/session.new.tsx` · `src/routes/session.$id.tsx` · `src/routes/session.$id.reflect.tsx` · `src/routes/login.tsx` · `src/routes/reset-password.tsx` · `src/routes/history.tsx` · `src/routes/account.tsx` · `src/routes/__root.tsx` · `src/components/AssistantChat.tsx` · `src/components/Metronome.tsx` · `src/components/SlowDowner.tsx` · `src/components/Waveform.tsx` · `src/components/SheetMusicReader.tsx` · `src/components/ToolUsageSummary.tsx` · `src/lib/sheet-music-storage.ts` · `supabase/functions/ai-practice-assistant/index.ts` · `supabase/functions/delete-user-account/index.ts` · plus one new SQL migration for the partial unique index on active sessions and unique constraint on `(session_id, entry_type='session_reflection')`.

---

## 12 · Final verdict

**Not ready for private beta yet — but very close.** Ship-block is small and surgical: the 4 critical items in §2 plus M-7 (deletion ordering) and M-6 (reflection unique constraint). Together that's ~half a day of focused work plus one migration. Everything else can land *during* beta without burning testers.

If you push live right now, expect: (1) some testers stuck on the new-session screen with a JS error on first visit (B-1), (2) duplicate active sessions on flaky 4G or impatient double-taps (B-2), (3) at least one tester with a half-deleted account if the Auth delete blips (M-7).

If you fix §2 + M-6 + M-7 and ship, beta will be solid. During beta, watch closely for: duplicate `practice_sessions` rows with `status='active'`, duplicate `journal_entries` with `entry_type='session_reflection'`, and the AI assistant's daily-cap counter being exceeded (M-10).

---

*Reminder: no code was changed. Approve this plan if you want me to switch to build mode and start applying fixes — I'd recommend starting with B-1 through B-4 only, then re-running this audit.*