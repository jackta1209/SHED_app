## Goal

Restore the exact font loading that existed before the trademark update, while keeping the trademark text and a clean CSS build.

## Root cause

The original `src/styles.css` had four `@import` statements stacked at the top, in this order, with no regular CSS rules between them:

1. `@import "tailwindcss" source(none);`
2. `@source "../src";`
3. `@import "tw-animate-css";`
4. `@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap");`

This is valid for Lightning CSS — all `@import`s precede the first non-`@import`/non-`@charset` rule. The build broke earlier only because an edit moved the Google Fonts `@import` below `@custom-variant dark`. The follow-up fix moved that font import out of CSS into `<link>` tags in `src/routes/__root.tsx` and rewrote the URL to use `ital,wght@0,400;1,400` plus an extra `700` weight. That URL change is what made the typography feel different across the app.

## Change

Two small edits, no copy/logic/component/route changes:

1. `src/styles.css` — put the original Google Fonts `@import url(...)` back, on the line directly after `@import "tw-animate-css";` and before `@custom-variant dark`. Use the exact original URL:

   ```text
   @import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap");
   ```

2. `src/routes/__root.tsx` — in the `links` array, remove the three font-related entries added during the import-order fix:

   - `{ rel: "preconnect", href: "https://fonts.googleapis.com" }`
   - `{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }`
   - `{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" }`

   Keep `{ rel: "stylesheet", href: appCss }` exactly as is.

Nothing else changes. Trademark footer line, page copy ("Welcome back", "Welcome to the shed.", "Enter the shed"), meta tags, components, routes, auth, Supabase, edge functions, timer/tool logic, and `@theme inline` font tokens are all left untouched.

## Why this is safe for the Lightning CSS error

The original error said `@import` rules must precede all non-`@import`/`@charset`/`@layer` rules. In the proposed file, all four `@import`s sit at the very top with only `@source` between them (which is a Tailwind directive, not a regular CSS rule), and `@custom-variant dark` comes after — same shape that compiled cleanly before the TM update.

## Verification checklist

- Vite/Lightning CSS overlay does not return.
- `/src/styles.css` returns 200 (no 500 from the dev server).
- Landing headline "Welcome to the shed." renders in Instrument Serif with the italic accent on "the shed.".
- Quote card text renders in Instrument Serif.
- "Welcome back", "Welcome to the shed.", and "Enter the shed" copy unchanged.
- Footer still reads "© 2026 Jack Ta. Hit The Shed™ is a trademark of Jack Ta."
- No "SHED™" anywhere. No "®" anywhere.
