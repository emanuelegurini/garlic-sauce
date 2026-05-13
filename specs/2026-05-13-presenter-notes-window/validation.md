# Phase 5+6 — Presenter Notes Window: Validation

## Automated Checks (merge gate)

All of the following must pass via `npm run validate`:

- **TypeScript** — no type errors (`npm run typecheck`).
- **Vitest** — all unit and integration tests green (`npm test`).
- **ESLint + Prettier** — no lint or formatting violations.

## Unit / Integration Tests Required

| Area                         | What to test                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| Database migration           | `slide_notes` table exists after `initializeDatabase`          |
| Notes CRUD                   | Insert, read, update, delete notes for a slide                 |
| PPTX notes extraction        | Import a `.pptx` with notes → `slide_notes` rows created       |
| PPTX no-notes slide          | Import a slide without notes → no `slide_notes` row (or empty) |
| `notes:get` IPC handler      | Returns correct content for a given slide                      |
| `notes:save` IPC handler     | Upserts content; updated_at changes                            |
| `notes:get-for-presentation` | Returns all notes for a presentation                           |
| Notes save debounce          | Rapid edits result in a single save call (not N calls)         |
| Slide-changed IPC            | Notes window receives slide ID when main window navigates      |

## Manual QA Checklist

Perform before merging:

1. Import a `.pptx` deck that has speaker notes on at least 3 slides.
2. Open the notes window via the toolbar button / menu item.
3. Verify notes for the first slide are displayed with correct text.
4. Navigate to the next slide — notes window updates automatically.
5. Navigate via minimap click — notes window updates.
6. Edit a note: add bold, italic, underline, and a bullet list.
7. Navigate away and back — edits are persisted.
8. Close the notes window and re-open — edits still there.
9. Import a slide with no notes — empty editor appears (ready to type).
10. Type new notes on a previously-empty slide, navigate away and back —
    notes are saved.
11. Toggle the slide thumbnail at the bottom of the notes window — it
    shows the current slide preview.
12. Screen-share the main slide window — confirm the notes window is NOT
    visible to the audience (test with a screen-share tool).
13. Close the notes window — app continues running normally.
14. Re-open the notes window — it shows notes for the current slide.
15. Import a new presentation while notes window is open — notes window
    refreshes to the new deck.

## Acceptance Criteria Summary

- Presenter notes are extracted from `.pptx` files during import.
- Notes are displayed in a separate Electron window (screen-share-safe).
- Trainer can edit notes with bold, italic, underline, and bullet lists.
- Notes window follows slide navigation in real time.
- Edits are auto-saved and persist across sessions.
- Empty editor shown for slides without notes.
- Optional slide thumbnail toggle at the bottom of the notes window.
- Notes window opened manually (not auto-opened).
- No regressions in import, slide rendering, or navigation.
- `npm run validate` passes cleanly.
