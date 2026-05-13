# Phase 5+6 — Presenter Notes Window: Plan

## Task Group 1 — Database: Notes Table

1. Create a `slide_notes` table:
   ```sql
   CREATE TABLE IF NOT EXISTS slide_notes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     slide_id INTEGER NOT NULL UNIQUE,
     presentation_id INTEGER NOT NULL,
     content_json TEXT NOT NULL DEFAULT '{}',
     plain_text TEXT NOT NULL DEFAULT '',
     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
     FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
   );
   ```
   `content_json` stores the rich-text document (TipTap/ProseMirror JSON).
   `plain_text` stores a plain-text fallback for search and display.
2. Add an index on `(presentation_id, slide_id)`.
3. Write Vitest tests confirming the table is created and basic CRUD works.

## Task Group 2 — PPTX Import: Notes Extraction

4. In the PPTX parser, locate `ppt/notesSlides/notesSlideN.xml` entries
   inside the ZIP archive.
5. Parse each notes XML to extract the text content (plain text paragraphs).
6. Add a `notes?: string` field to `ImportedSlide`.
7. In the persistence layer, insert extracted notes into `slide_notes`
   during import (store as plain text initially; convert to rich-text JSON
   on first edit or on read).
8. Write Vitest tests: import a `.pptx` with notes → verify `slide_notes`
   rows are created with correct content.

## Task Group 3 — IPC Handlers for Notes

9. Create `notes:get` IPC handler — given a `slideId`, returns the note
   content (JSON + plain text).
10. Create `notes:save` IPC handler — given a `slideId` and new
    `content_json` / `plain_text`, upserts the row.
11. Create `notes:get-for-presentation` IPC handler — returns all notes
    for a presentation (used to pre-fetch on window open).
12. Write Vitest tests for each handler.

## Task Group 4 — Preload Bridge

13. Expose `getNotes(slideId)` through the preload bridge.
14. Expose `saveNotes(slideId, contentJson, plainText)` through the
    preload bridge.
15. Expose `getNotesForPresentation(presentationId)` through the preload
    bridge.
16. Update `window.d.ts` type declarations.

## Task Group 5 — Notes Window: Electron Shell

17. Create a second `BrowserWindow` factory function
    (`createNotesWindow`) that opens a frameless or minimal-chrome window.
18. Add a menu item and/or toolbar button in the main window:
    "Open Notes Window".
19. Wire IPC so the main window can notify the notes window of slide
    changes (`notes-window:slide-changed` event with `slideId`).
20. Handle window lifecycle: closing the notes window doesn't quit the
    app; re-opening reuses the existing window if still open.

## Task Group 6 — Notes Window: React UI

21. Create a `NotesEditor` React component using TipTap (or a lightweight
    rich-text library) with bold, italic, underline, and bullet list
    toolbar buttons.
22. Create a `NotesWindow` root component that:
    - Listens for `slide-changed` IPC events.
    - Loads the note for the current slide.
    - Renders the `NotesEditor`.
    - Auto-saves on change (debounced, e.g. 500 ms).
23. Add an optional slide thumbnail at the bottom of the notes window,
    toggled via a small button. Thumbnail fetched via existing
    `getSlideImage` bridge call.
24. Style the notes window to be clean and readable (dark/light follows
    system theme if possible).

## Task Group 7 — Main Window Integration

25. Add a "Notes" button to the main window toolbar/header that opens
    the notes window.
26. When the trainer navigates slides (next/prev/minimap click), send
    the `slide-changed` event to the notes window.
27. If the notes window is closed, navigation events are simply not sent
    (no error).

## Task Group 8 — Edge Cases & Polish

28. Handle no-notes state: show an empty TipTap editor ready for input.
29. Handle presentation switch: if the trainer imports a new deck while
    the notes window is open, refresh the notes window.
30. Handle rapid navigation: debounce or cancel in-flight saves before
    switching slides to avoid data races.
31. Ensure the notes window doesn't appear in screen-share app pickers
    on macOS (investigate `excludedFromSharing` or similar Electron API).

## Task Group 9 — Validation

32. Run `npm run validate` — all type checks and tests pass.
33. Manual smoke test: import a deck with notes, open notes window,
    verify notes display, edit, navigate, confirm sync and persistence.
