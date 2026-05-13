# Phase 6 — Drawing Tools Foundation: Requirements

## Scope

This phase delivers the foundational drawing capability for Garlic Sauce:
a transparent HTML5 Canvas overlay on the slide viewer with freehand pen
and pixel-level eraser tools. Drawings are persisted per-slide in SQLite
so they survive navigation and app restarts.

This phase does **not** include:

- Shape tools (rectangle, ellipse, arrow, line) — deferred to Phase 7.
- Text insertion — deferred to Phase 7.
- Keyboard shortcuts for tool switching — deferred to Phase 7.
- Undo/redo — deferred to a future phase.
- Whiteboard mode — deferred to Phase 8.

## Decisions

| Decision               | Choice                          | Rationale                                                  |
| ---------------------- | ------------------------------- | ---------------------------------------------------------- |
| Canvas technology      | HTML5 Canvas 2D API             | Simpler for freehand pixel drawing; good performance       |
| Eraser type            | Pixel-level (`destination-out`) | More intuitive paint-over-to-erase UX for trainers         |
| Persistence            | Per-slide in SQLite (PNG blob)  | Drawings survive navigation and restart; self-contained    |
| Toolbar placement      | Floating overlay, bottom-centre | Doesn't obscure slide content; disappears when not drawing |
| Default pen colour     | Red (`#FF0000`)                 | High contrast on most slide backgrounds                    |
| Default pen width      | 3 px                            | Visible but not overly thick                               |
| Default eraser radius  | 20 px                           | Large enough to erase comfortably with a mouse             |
| Keyboard shortcuts     | None this phase                 | Deferred to Phase 7 (Drawing Tool Palette)                 |
| Pointer event handling | `pointer-events: none` when off | Ensures click-through to navigation when not drawing       |

## Functional Requirements

### FR-1: Drawing Mode Toggle

The main window header displays a "Draw" button. Clicking it activates
drawing mode. Clicking it again (or the toolbar "Close" button)
deactivates drawing mode.

### FR-2: Transparent Canvas Overlay

When drawing mode is active, a transparent `<canvas>` element is
rendered on top of the current slide. It matches the slide dimensions
exactly and resizes with the slide container.

### FR-3: Freehand Pen

When the pen tool is active, the trainer can draw freehand strokes on
the canvas by clicking and dragging. Strokes use the configured colour
and width (defaults: red, 3 px). Lines are smooth (`lineCap: round`,
`lineJoin: round`).

### FR-4: Pixel-Level Eraser

When the eraser tool is active, the trainer can paint over existing
strokes to erase those pixels. The eraser uses
`globalCompositeOperation: 'destination-out'` with a circular brush
(default radius 20 px). A circular cursor indicator shows the eraser
size.

### FR-5: Floating Toolbar

A floating toolbar appears at the bottom-centre of the slide area when
drawing mode is active. It contains: Pen, Eraser, Clear, and Close
buttons. The active tool is visually highlighted.

### FR-6: Clear Canvas

The "Clear" button removes all drawing from the current slide's canvas
and deletes the persisted data for that slide.

### FR-7: Per-Slide Persistence

Each slide's canvas content is saved as a PNG blob in SQLite. Saving
happens automatically when the trainer navigates away from a slide
(debounced). When returning to a slide, the saved drawing is restored
onto the canvas.

### FR-8: Navigation Sync

When the trainer navigates to a different slide:

1. The current canvas is saved (if dirty).
2. The canvas is cleared.
3. The new slide's saved drawing (if any) is loaded and rendered.

### FR-9: Non-Interference with Navigation

Keyboard navigation (arrow keys, spacebar) continues to work even when
drawing mode is active. Only pointer events are captured by the canvas.

### FR-10: Persistence Across Restarts

Drawings are stored in SQLite and survive application quit and relaunch.
On app close, any unsaved canvas state is flushed to the database.

## Non-Functional Requirements

- **Performance**: Drawing must feel responsive with no perceptible lag
  on pointer move (target < 16 ms per frame).
- **Memory**: Canvas data is stored as compressed PNG; large
  presentations should not cause excessive memory usage.
- **Accessibility**: The "Draw" button and toolbar buttons have
  accessible labels. The canvas is marked `aria-hidden="true"` since
  its content is visual-only.

## Context

- **Mission alignment**: Supports "Draw & annotate directly on slides
  with mouse-friendly tools" from the product vision.
- **Tech stack**: React component in the renderer process; SQLite
  persistence via IPC from the main process; Vitest for testing.
- **Dependencies**: Builds on the existing `SlideViewer` component and
  slide navigation system from Phases 3–4.
