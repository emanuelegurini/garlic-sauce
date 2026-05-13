# Phase 4 — Slide Navigation: Plan

## Task Group 1 — Database Migration

1. Add a `hidden INTEGER NOT NULL DEFAULT 0` column to the `slides` table.
2. Write a migration helper that applies the column if it doesn't exist
   (for existing databases).
3. Add a Vitest test confirming the column exists after `initializeDatabase`.

## Task Group 2 — IPC & Main-Process Logic

4. Create a `presentation:get-slide-list` IPC handler that returns an array
   of `{ slideOrder, hidden, thumbnailDataUrl }` for a given presentation.
5. Create a `presentation:toggle-slide-hidden` IPC handler that flips the
   `hidden` flag for a given slide and returns the updated value.
6. Update `getSlideImage` logic so the renderer can still fetch any slide
   (hidden or not) — hiding only affects navigation flow, not data access.
7. Add Vitest tests for both new handlers (happy path + edge cases).

## Task Group 3 — Preload Bridge

8. Expose `getSlideList(presentationId)` through the preload bridge.
9. Expose `toggleSlideHidden(presentationId, slideOrder)` through the
   preload bridge.
10. Update the `window.d.ts` type declarations.

## Task Group 4 — Navigation State (Renderer)

11. Introduce a `useSlideNavigation` hook that manages:
    - `currentSlideOrder` (number)
    - `slideCount` (total)
    - `visibleSlideCount` (non-hidden)
    - `goNext()` / `goPrev()` — skip hidden slides
    - `goTo(slideOrder)` — direct jump from minimap
12. Wire Left/Right arrow key listeners (document-level) to `goNext`/`goPrev`.
13. Add Vitest tests for the hook logic (navigation skipping hidden slides,
    boundary conditions).

## Task Group 5 — On-Screen Navigation UI

14. Add Previous / Next buttons below or beside the slide viewer.
15. Add a slide counter label: "N / M" (current visible position / total
    visible).
16. Disable Previous on first visible slide; disable Next on last visible.
17. Style buttons to match existing `primary-action` / `secondary-action`
    patterns.

## Task Group 6 — Minimap Panel

18. Create a `Minimap` component that renders a vertical list of slide
    thumbnails (small versions of the stored PNGs).
19. Highlight the currently-active slide in the minimap.
20. Dim hidden slides and show a strikethrough or "hidden" badge.
21. Add a toggle button (eye icon or similar) on each thumbnail to
    hide/reveal the slide.
22. Add a header-level button to show/hide the entire minimap panel.
23. Clicking a visible thumbnail in the minimap jumps to that slide.

## Task Group 7 — Edge Cases & Polish

24. Handle edge case: hiding the currently-displayed slide advances to the
    next visible slide (or previous if at end).
25. Handle edge case: all slides hidden — show a friendly message instead
    of a blank screen.
26. Handle single-slide deck gracefully (prev/next disabled, minimap still
    works).
27. Ensure keyboard shortcuts don't fire when a text input is focused
    (future-proofing for Phase 10 rich-text editor).

## Task Group 8 — Validation

28. Run `npm run validate` — all type checks and tests pass.
29. Manual smoke test: import a multi-slide deck, navigate, hide slides,
    toggle minimap, confirm hidden slides are skipped.
