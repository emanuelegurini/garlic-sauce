# Phase 4 — Slide Navigation: Validation

## Automated Checks (merge gate)

All of the following must pass via `npm run validate`:

- **TypeScript** — no type errors (`npm run typecheck`).
- **Vitest** — all unit and integration tests green (`npm test`).
- **ESLint + Prettier** — no lint or formatting violations.

## Unit / Integration Tests Required

| Area                          | What to test                                           |
| ----------------------------- | ------------------------------------------------------ |
| Database migration            | `hidden` column exists; default value is `0`           |
| `get-slide-list` handler      | Returns correct array with `hidden` flags              |
| `toggle-slide-hidden` handler | Flips flag; returns updated value                      |
| `useSlideNavigation` hook     | Next/prev skip hidden slides                           |
| `useSlideNavigation` hook     | Boundaries: can't go before first or past last visible |
| `useSlideNavigation` hook     | All-hidden edge case returns a sentinel state          |
| Navigation keyboard handler   | Left/Right arrow trigger prev/next                     |
| Navigation keyboard handler   | Keys ignored when an input element is focused          |

## Manual QA Checklist

Perform before merging:

1. Import a deck with 10+ slides.
2. Verify Previous/Next buttons appear and work.
3. Verify Left/Right arrow keys advance slides.
4. Verify slide counter updates correctly ("3 / 12").
5. Toggle the minimap open — all thumbnails visible.
6. Hide a slide from the minimap — it dims immediately.
7. Navigate past the hidden slide — it is skipped.
8. Un-hide the slide — it reappears in the navigation flow.
9. Hide the currently-displayed slide — app advances to next visible.
10. Hide all slides — a friendly "no visible slides" message appears.
11. Close the minimap — navigation still works via buttons and keys.
12. Import a single-slide deck — prev/next disabled, no crash.

## Acceptance Criteria Summary

- Trainer can navigate slides with on-screen buttons and arrow keys.
- Hidden slides are skipped during navigation.
- Minimap shows all slides, indicates hidden state, and allows toggling.
- No regressions in import or slide rendering.
- `npm run validate` passes cleanly.
