# Phase 6 — Drawing Tools Foundation: Validation

## Automated Checks

All of the following must pass via `npm run validate`:

### Type Checking

- No TypeScript errors introduced by new or modified files.
- `window.d.ts` declarations updated for new preload bridge methods.

### Unit & Integration Tests (Vitest)

| Area                    | What to test                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| Database schema         | `slide_drawings` table created; insert, read, update, delete work |
| IPC: `drawing:get`      | Returns saved data for a slide; returns `null` when none exists   |
| IPC: `drawing:save`     | Upserts canvas data; overwrites previous save                     |
| IPC: `drawing:clear`    | Deletes the row; subsequent `get` returns `null`                  |
| DrawingCanvas component | Mounts/unmounts; `pointer-events` toggles with drawing mode       |
| Pen logic               | Stroke path built correctly from pointer events                   |
| Eraser logic            | Composite operation set to `destination-out` when eraser active   |
| Tool state hook         | Tool switching updates state; defaults are correct                |
| Persistence round-trip  | Save canvas → load canvas → pixel data matches                    |
| Navigation sync         | Slide change triggers save of old + load of new                   |

### Lint & Format

- ESLint and Prettier pass with no new warnings or errors.

## Manual Smoke Tests

Perform after all automated checks pass:

### Drawing Flow

1. Import a `.pptx` deck with multiple slides.
2. Click "Draw" in the header — floating toolbar appears at bottom.
3. Draw freehand strokes on slide 1 with the pen (red, visible).
4. Switch to eraser — circular cursor appears; paint over strokes to
   erase pixels.
5. Switch back to pen — draw more.
6. Click "Clear" — canvas is wiped clean.
7. Draw again on slide 1.

### Navigation Persistence

8. Navigate to slide 2 — canvas is blank (no drawing saved yet).
9. Draw on slide 2.
10. Navigate back to slide 1 — original drawing from step 7 is restored.
11. Navigate to slide 2 — drawing from step 9 is restored.

### App Restart Persistence

12. Quit the application.
13. Relaunch and open the same deck.
14. Navigate to slide 1 — drawing is still there.
15. Navigate to slide 2 — drawing is still there.

### Non-Interference

16. With drawing mode **off**, verify arrow keys and spacebar still
    navigate slides normally.
17. With drawing mode **on**, verify arrow keys still navigate slides
    (only pointer events are captured by the canvas).
18. Click "Notes" and "Show minimap" — both still work regardless of
    drawing mode state.

### Edge Cases

19. Resize the window while drawing mode is active — canvas resizes to
    match the slide without losing content.
20. Import a new deck while drawing mode is active — drawing mode
    resets; old drawings are not shown on new deck's slides.
21. Toggle a slide as hidden in the minimap, then navigate past it —
    no crash or stale canvas state.

## Merge Criteria

- [ ] `npm run validate` passes (types, lint, tests).
- [ ] All manual smoke tests above pass.
- [ ] No regressions in existing functionality (import, navigation,
      notes, minimap).
- [ ] Code reviewed and approved.
