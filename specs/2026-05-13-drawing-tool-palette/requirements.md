# Phase 7 — Drawing Tool Palette: Requirements

## Scope

This phase extends the drawing system introduced in Phase 6 with:

- Shape tools: rectangle, ellipse, arrow (single-headed), and line.
- A mouse-friendly tool palette (expanded floating bar, bottom-centre).
- Button controls for switching tools and undo/redo.
- Drag-from-toolbar placement for shapes.
- Undo/redo for all drawing operations.
- Persistence of shapes across navigation and app restarts.

This phase does **not** include:

- Double-headed arrows — single-headed only.
- Text insertion/editing — temporarily deferred until the interaction model
  is revisited.
- Rich-text formatting inside text boxes (bold, italic, etc.).
- Whiteboard mode — deferred to Phase 8.
- Colour picker UI or custom width slider — shapes reuse the existing pen
  colour and width settings from Phase 6.

## Decisions

| Decision                | Choice                                | Rationale                                                    |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Shape interaction model | Corner-to-corner bounding box (Figma) | Most familiar UX; consistent with mainstream tools           |
| Arrow style             | Single-headed only                    | Keeps scope small; double-headed can be added later          |
| Colour/width for shapes | Reuse existing pen colour & width     | Simpler UI; fewer controls to manage                         |
| Tool palette placement  | Expanded floating bar, bottom-centre  | Consistent with Phase 6; doesn't obscure slide content       |
| Undo/redo               | In scope                              | Essential for comfortable drawing; reduces fear of mistakes  |
| Undo/redo scope         | Per-slide, in-memory stack            | Matches per-slide persistence model; cleared on slide change |
| Persistence format      | Extend PNG blob with element metadata | Keeps shapes movable while preserving existing save/load     |
| Tool switching          | Toolbar buttons and drag-to-place     | Keeps drawing mode mouse-first and avoids accidental key use |

## Functional Requirements

### FR-1: Extended Tool Set

The drawing system supports the following tools: pen, eraser, rectangle,
ellipse, arrow, and line. Text is temporarily disabled.

### FR-2: Rectangle Tool

When the rectangle tool is active, the trainer clicks and drags to
define a bounding box (corner-to-corner). On release, a rectangle is
rendered using the current pen colour and width as the stroke. The
rectangle is not filled (stroke only).

### FR-3: Ellipse Tool

When the ellipse tool is active, the trainer clicks and drags to define
a bounding box. On release, an ellipse inscribed within that bounding
box is rendered using the current pen colour and width.

### FR-4: Arrow Tool

When the arrow tool is active, the trainer clicks to set the tail point
and drags to the head point. On release, a line with a single arrowhead
at the end is rendered using the current pen colour and width.

### FR-5: Line Tool

When the line tool is active, the trainer clicks to set the start point
and drags to the end point. On release, a straight line is rendered
using the current pen colour and width.

### FR-6: Shape Preview During Drag

While the trainer is dragging to define a shape (rectangle, ellipse,
arrow, or line), a live preview of the shape is shown on the canvas.
The preview updates on every pointer move.

### FR-7: Text Tool Deferred

No text tool is exposed in this phase. Existing persisted text metadata
must not crash the drawing surface, but new text cannot be created or
edited until a better interaction model is specified.

### FR-8: Tool Palette UI

The floating toolbar is expanded to show all available tools as icon
buttons: Pen, Eraser, Rectangle, Ellipse, Arrow, Line, plus Undo, Redo,
Clear, and Close. The active tool is visually highlighted. The palette
remains at bottom-centre of the slide area.

### FR-9: Button And Drag Tool Controls

Tool switching is controlled by the floating toolbar buttons. Drawing
mode does not install single-key tool shortcuts, so typing and slide
navigation are not intercepted by drawing tools.

Shape buttons can also be dragged onto the slide. Dropping a shape
places a default-sized element at the drop location.

### FR-10: Undo/Redo

The trainer can undo and redo drawing operations using toolbar buttons.
The undo stack is per-slide and stored in memory. It is cleared when
navigating away from a slide (the persisted PNG is the canonical state).

### FR-11: Persistence Compatibility

Freehand strokes continue to use the existing PNG-blob save/load
mechanism from Phase 6. Shapes are stored as movable drawing metadata
alongside the PNG so they can be dragged after placement.

### FR-12: Minimum Shape Size

Shapes smaller than 4×4 pixels are discarded (treated as accidental
clicks). No shape is rendered or added to the undo stack.

## Non-Functional Requirements

- **Performance**: Shape preview during drag must render at ≥ 60 fps
  with no perceptible lag.
- **Accessibility**: All tool palette buttons have accessible labels and
  descriptive tooltips.
- **Memory**: Undo stack is capped at 50 operations per slide to bound
  memory usage.

## Context

- **Mission alignment**: Supports "Draw & annotate directly on slides
  with mouse-friendly tools" — this phase makes the tools comfortable
  and complete for mouse users.
- **Tech stack**: React components in the renderer process; Canvas 2D
  API for rendering; existing SQLite persistence via IPC.
- **Dependencies**: Builds directly on Phase 6 (Drawing Tools
  Foundation) — extends `DrawingTool`, `useDrawingTools`,
  `DrawingToolbar`, and `DrawingCanvas`.
