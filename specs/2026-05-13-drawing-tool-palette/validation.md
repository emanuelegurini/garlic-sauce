# Phase 7 — Drawing Tool Palette: Validation

## Automated Checks

All of the following must pass via `npm run validate`:

### Type Checking

- No TypeScript errors introduced by new or modified files.
- `DrawingTool` type extended; all consumers updated.
- `window.d.ts` unchanged (no new preload methods needed this phase).

### Unit & Integration Tests (Vitest)

| Area                      | What to test                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| Extended reducer          | New tools selectable; defaults unchanged; invalid tools rejected         |
| Undo/redo state           | Push/pop correct; stack capped at 50; clear empties both stacks          |
| Shape renderer: rectangle | Correct `strokeRect` call; coordinates normalised for any drag direction |
| Shape renderer: ellipse   | Correct `ellipse()` path; inscribed in bounding box                      |
| Shape renderer: line      | `moveTo` → `lineTo` → `stroke` with correct points                       |
| Shape renderer: arrow     | Line rendered plus arrowhead triangle at end point                       |
| Minimum size guard        | Shapes < 4×4 px discarded; no canvas mutation; no undo entry             |
| Drag lifecycle            | Start → move → commit adds to undo; start → discard restores snapshot    |
| Text tool deferred        | No text button or text creation path is exposed                          |
| Toolbar rendering         | Shape/freehand tool buttons + Undo, Redo, Clear, Close render correctly  |
| Toolbar active state      | Only the active tool has `--active` class                                |
| Button-only controls      | Tool switching is available through toolbar buttons, not shortcuts       |
| Drag-to-place controls    | Shape toolbar buttons can be dragged onto the slide canvas               |
| Undo/redo buttons         | Undo and redo toolbar buttons restore canvas snapshots                   |
| Persistence round-trip    | Canvas with freehand pixels and shapes survives save → load cycle        |
| Navigation history clear  | Slide change clears undo/redo stacks                                     |

### Lint & Format

- ESLint and Prettier pass with no new warnings or errors.

## Manual Smoke Tests

Perform after all automated checks pass:

### Shape Tools

1. Import a `.pptx` deck. Click "Draw" to enter drawing mode.
2. Select Rectangle from the toolbar. Click-drag on the slide — a live
   preview rectangle follows the cursor. Release — rectangle is
   committed in red.
3. Select Ellipse from the toolbar. Click-drag — live preview ellipse.
   Release — ellipse committed.
4. Select Arrow from the toolbar. Click-drag — live preview arrow with
   arrowhead at the drag end. Release — arrow committed.
5. Select Line from the toolbar. Click-drag — live preview line.
   Release — line committed.
6. Try a micro-click (barely move the mouse) with any shape tool —
   nothing is drawn (minimum size guard).
7. Drag in all four directions (top-left to bottom-right, bottom-right
   to top-left, etc.) — shapes render correctly regardless of drag
   direction.

### Text Tool Deferred

8. Verify there is no Text button in the drawing toolbar.
9. Click and drag on the slide with each visible tool — no text input
   or textbox appears.

### Undo/Redo

10. Draw several shapes and strokes.
11. Click Undo — last operation is undone (shape disappears).
12. Click Undo repeatedly — operations undo in reverse order.
13. Click Redo — last undo is redone (shape reappears).
14. After undoing, draw something new — redo stack is cleared (cannot
    redo the previously undone operations).

### Tool Palette UI

15. Verify all tool buttons are visible in the floating toolbar.
16. Click each button — it becomes highlighted; canvas behaviour
    matches the selected tool.
17. Verify tooltips show tool names (e.g., "Rectangle").
18. Resize window to narrow width — toolbar remains usable (scrolls
    or wraps, does not overflow off-screen).
19. Drag Rectangle, Ellipse, Arrow, and Line from the toolbar onto the
    slide — each appears at the drop location.

### Button-Only Controls

20. With drawing mode active, click each tool button — tool switches
    accordingly.
21. With drawing mode active, use slide navigation keys — navigation is
    not intercepted by drawing shortcuts.
22. With drawing mode off, drawing toolbar buttons are hidden.

### Persistence & Navigation

23. Draw shapes on slide 1.
24. Navigate to slide 2 — canvas is blank.
25. Navigate back to slide 1 — all shapes are restored.
26. Quit the app. Relaunch. Open the same deck. Navigate to slide 1 —
    drawings persist.
27. Verify undo stack is empty after navigation (cannot undo drawings
    from a previous slide visit).

### Non-Interference

28. With drawing mode off, arrow keys and spacebar navigate slides.
29. With drawing mode on, arrow keys still navigate slides.
30. "Notes" button and minimap still function regardless of drawing
    mode state.

### Edge Cases

31. Draw a shape, undo it, navigate away, navigate back — the undone
    shape is gone (only committed state is persisted).
32. Rapidly undo 50+ times — stack bottoms out gracefully, no crash.
33. Import a new deck while drawing mode is active — drawing mode
    resets; old drawings not shown on new deck.

## Merge Criteria

- [x] `npm run validate` passes (types, lint, tests).
- [ ] All manual smoke tests above pass.
- [ ] No regressions in existing functionality (import, navigation,
      notes, minimap, freehand pen, eraser).
- [ ] Code reviewed and approved.
