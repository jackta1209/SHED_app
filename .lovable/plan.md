## Trademark Update — Minimal Text-Only Changes

### Scope
Add the "™" symbol only to the full brand name "Hit The Shed" on the landing page, plus one subtle footer legal line. Touch nothing else.

### Changes

1. **Landing page metadata (`src/routes/index.tsx`)**
   - Update `title`, `og:title`, and `twitter:title` from `"SHED — The Practice Workspace for Musicians"` to `"Hit The Shed™ — The Practice Workspace for Musicians"`.
   - Leave `description`, `og:description`, and `twitter:description` unchanged (they do not contain the full brand name).

2. **Landing page footer line (`src/routes/index.tsx`)**
   - Add one minimal line below the existing CTA area:
     `"© 2026 Jack Ta. Hit The Shed™ is a trademark of Jack Ta."`
   - Style with existing muted text utilities (`text-[11px] text-muted-foreground text-center`) so it does not look like a new design element.
   - Do not create a large footer or move any existing content.

### Verification
- Confirm no "®" symbol appears anywhere in the codebase.
- Confirm no "SHED™" appears anywhere.
- Confirm "Welcome back" on login remains unchanged.
- Confirm "Welcome to the shed." remains unchanged.
- Confirm "Enter the shed" remains unchanged.
- Confirm all navigation labels, cards, buttons, tool names, and session text remain untouched.
- Ensure the app builds and runs as before.
