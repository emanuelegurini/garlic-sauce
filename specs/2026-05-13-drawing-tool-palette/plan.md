# Phase 7 — Drawing Tool Palette: Plan

## Task Group 1 — Extend Tool Types & State Management

1. Extend the `DrawingTool` type in `drawing-canvas-model.ts` to
   include: `'rectangle' | 'ellipse' | 'arrow' | 'line'`.
2. Update `useDrawingTools` reducer to handle the new tools (default
   remains `'pen'`).
3. Add `undoStack` and `redoStack` arrays to the drawing tools state
   (per-slide, in-memory, capped at 50 entries).
4. Add `undo` and `redo` actions to the reducer.
5. Add a `clearHistory` action that empties both stacks (called on
   slide change).
6. Write Vitest tests for the extended reducer: tool switching, undo/
   redo push/pop, stack cap enforcement, and history clearing.

## Task Group 2 — Undo/Redo Infrastructure

7. Define a `CanvasSnapshot` type (PNG data URL string representing
   the canvas state at a point in time).
8. Before each drawing operation (stroke complete, shape commit,
   element move, clear), push the current drawing snapshot onto the undo
   stack and clear the redo stack.
9. On undo: pop from undo stack, push current state onto redo stack,
   restore the popped snapshot to the canvas.
10. On redo: pop from redo stack, push current state onto undo stack,
    restore the popped snapshot to the canvas.
11. Wire toolbar Undo and Redo buttons to restore snapshots.
12. Write Vitest tests for snapshot capture, stack operations, and
    toolbar undo/redo dispatch.

## Task Group 3 — Shape Rendering Engine

13. Create a `shape-renderer.ts` module with functions:
    - `renderRectangle(ctx, startPoint, endPoint, brush)`
    - `renderEllipse(ctx, startPoint, endPoint, brush)`
    - `renderLine(ctx, startPoint, endPoint, brush)`
    - `renderArrow(ctx, startPoint, endPoint, brush)`
14. Rectangle: `strokeRect` using the bounding box defined by start
    and end points. Normalise coordinates so dragging in any direction
    works.
15. Ellipse: use `ellipse()` on a path inscribed in the bounding box.
16. Line: `moveTo(start)` → `lineTo(end)` → `stroke`.
17. Arrow: render a line plus a triangular arrowhead at the end point.
    Arrowhead size proportional to stroke width (min 8 px).
18. All shapes use the current pen colour and width via
    `getDrawingBrushSettings`.
19. Enforce minimum size: if `|endX - startX| < 4 && |endY - startY|
< 4`, discard the shape (return without rendering).
20. Write Vitest tests for each shape renderer (mock canvas context,
    verify correct method calls and coordinate normalisation).

## Task Group 4 — Shape Interaction (Drag Preview)

21. In `DrawingCanvas`, detect when the active tool is a shape tool
    (`rectangle`, `ellipse`, `arrow`, `line`).
22. On `pointerdown`: record the start point; begin preview mode.
23. On `pointermove` (while dragging): render the existing canvas
    content from a saved snapshot, then overlay the shape preview at
    the current pointer position. This gives a live rubber-band
    effect.
24. On `pointerup`: commit the final shape to the canvas (render
    permanently). Push undo snapshot. Mark canvas as dirty.
25. If the shape is below minimum size on `pointerup`, discard it
    (restore the pre-drag snapshot, do not push to undo).
26. Write Vitest tests for the drag lifecycle (start → move → commit,
    start → move → discard-below-threshold).

## Task Group 5 — Text Insertion Deferred

27. Do not expose a text tool in the toolbar for now.
28. Do not create text elements from canvas clicks or toolbar drops.
29. Preserve compatibility with older persisted drawing records that
    may contain text metadata by ignoring unsupported text elements
    safely.
30. Revisit text creation once the inline editing and movement model is
    specified.

## Task Group 6 — Tool Palette UI

33. Expand `DrawingToolbar` to include buttons for all tools:
    Pen, Eraser, Rectangle, Ellipse, Arrow, Line.
34. Each button shows an icon (SVG or emoji placeholder) and has an
    `aria-label` and `title` with the tool name.
35. Active tool button has the `--active` modifier class.
36. Add Undo and Redo buttons before Clear and Close.
37. Ensure the toolbar doesn't overflow on narrow windows (use
    horizontal scroll or wrap if needed).
38. Write Vitest tests for toolbar rendering with all tools, active
    state, and accessibility attributes.

## Task Group 7 — Button-Only Controls

39. Do not register drawing-mode keyboard shortcuts for tool selection.
40. Ensure toolbar buttons can switch tools and place supported tools
    by dragging onto the slide.
41. Ensure drawing mode does not intercept normal slide navigation keys.
42. Ensure Undo/Redo are exposed as toolbar buttons.
43. Write Vitest tests for the button and drag toolbar behaviour.

## Task Group 8 — Persistence & Navigation Sync

44. Verify that the existing `saveDrawing` / `getDrawing` round-trip
    works with canvases containing freehand pixels and movable shapes.
45. On slide change: call `clearHistory` to reset undo/redo stacks.
46. Ensure the pre-drag snapshot mechanism (Task Group 4) does not
    interfere with the persistence save (only the committed canvas
    state is saved).
47. Write Vitest tests confirming shapes survive the save → navigate →
    return → load cycle.

## Task Group 9 — Integration & Validation

48. Ensure keyboard navigation (arrow keys, spacebar) still works when
    drawing mode is active.
49. Ensure unsupported persisted text metadata is ignored safely.
50. Run `npm run validate` — all type checks, lint, and tests pass.
51. Manual smoke test: import a deck, activate drawing mode, use each
    shape tool, drag shapes around the slide, undo/redo, navigate
    between slides, quit and relaunch — all drawings persist.
