# Phase 6 — Drawing Tools Foundation: Plan

## Task Group 1 — Database: Drawings Table

1. Create a `slide_drawings` table:
   ```sql
   CREATE TABLE IF NOT EXISTS slide_drawings (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     slide_id INTEGER NOT NULL UNIQUE,
     presentation_id INTEGER NOT NULL,
     canvas_data BLOB NOT NULL,
     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
     FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
   );
   ```
   `canvas_data` stores the PNG image data exported from the canvas
   (`toDataURL` → base64 or `toBlob` → raw bytes).
2. Add an index on `(presentation_id, slide_id)`.
3. Write Vitest tests confirming the table is created and basic CRUD
   (insert, read, update, delete) works.

## Task Group 2 — IPC Handlers for Drawings

4. Create `drawing:get` IPC handler — given a `slideId`, returns the
   saved canvas data (or `null` if no drawing exists).
5. Create `drawing:save` IPC handler — given a `slideId` and canvas data
   (base64 PNG string), upserts the row in `slide_drawings`.
6. Create `drawing:clear` IPC handler — given a `slideId`, deletes the
   row (clears the drawing for that slide).
7. Write Vitest tests for each handler.

## Task Group 3 — Preload Bridge

8. Expose `getDrawing(slideId)` through the preload bridge.
9. Expose `saveDrawing(slideId, canvasData)` through the preload bridge.
10. Expose `clearDrawing(slideId)` through the preload bridge.
11. Update `window.d.ts` type declarations.

## Task Group 4 — Canvas Overlay Component

12. Create a `DrawingCanvas` React component that renders an HTML5
    `<canvas>` element absolutely positioned over the `SlideViewer`.
13. The canvas must match the slide dimensions exactly and resize when
    the slide container resizes (use `ResizeObserver`).
14. When drawing mode is **off**, the canvas must have
    `pointer-events: none` so clicks pass through to navigation and
    other UI elements beneath.
15. When drawing mode is **on**, the canvas captures pointer events for
    drawing.
16. Write Vitest tests for mount/unmount and pointer-events toggling.

## Task Group 5 — Pen Tool

17. Implement freehand drawing using Canvas 2D `beginPath` /
    `lineTo` / `stroke` on `pointerdown` → `pointermove` →
    `pointerup` events.
18. Default pen: red colour (`#FF0000`), 3 px stroke width,
    `lineCap: 'round'`, `lineJoin: 'round'`.
19. Support pressure-insensitive drawing (mouse-friendly, no tablet
    pressure mapping needed).
20. Write Vitest tests verifying stroke recording logic (unit-test the
    event-to-path conversion, not the actual canvas rendering).

## Task Group 6 — Eraser Tool

21. Implement pixel-level eraser using `globalCompositeOperation:
'destination-out'` on the canvas context.
22. Eraser draws with a configurable radius (default 20 px) — painting
    over existing strokes removes those pixels.
23. Show a circular cursor indicator when eraser is active.
24. Write Vitest tests for eraser mode toggling and composite operation
    setup.

## Task Group 7 — Floating Toolbar

25. Create a `DrawingToolbar` React component rendered as a floating bar
    at the bottom-centre of the slide area.
26. Toolbar contains: Pen button, Eraser button, Clear button, Close
    (exit drawing mode) button.
27. Active tool is visually highlighted.
28. Toolbar is only visible when drawing mode is active.
29. Add a "Draw" button to the main window header (next to "Notes" and
    "Show minimap") that toggles drawing mode on/off.
30. Write Vitest tests for toolbar rendering and tool switching.

## Task Group 8 — Tool State Management

31. Create a `useDrawingTools` hook (or React context) managing:
    - `isDrawingMode: boolean`
    - `activeTool: 'pen' | 'eraser'`
    - `penColour: string` (default `#FF0000`)
    - `penWidth: number` (default `3`)
    - `eraserRadius: number` (default `20`)
32. Wire the toolbar buttons to update this state.
33. Wire the `DrawingCanvas` to read from this state.

## Task Group 9 — Persistence & Navigation Sync

34. On slide change: save the current canvas to SQLite via
    `saveDrawing(slideId, canvasData)` (debounced, only if dirty).
35. On slide change: load the new slide's drawing from SQLite via
    `getDrawing(slideId)` and restore it onto the canvas
    (`drawImage` from a loaded `Image` of the saved PNG).
36. On "Clear" button press: clear the canvas and call
    `clearDrawing(slideId)`.
37. On app quit / window close: save any unsaved canvas state.
38. Write Vitest tests for the save/load round-trip logic.

## Task Group 10 — Integration & Validation

39. Ensure the drawing canvas does not interfere with keyboard
    navigation (arrow keys, spacebar still navigate slides even when
    drawing mode is on — only pointer events are captured).
40. Run `npm run validate` — all type checks and tests pass.
41. Manual smoke test: import a deck, enable drawing, draw on slide 1,
    navigate to slide 2, draw something different, return to slide 1 —
    original drawing is restored. Use eraser. Clear canvas. Close and
    reopen app — drawings persist.
