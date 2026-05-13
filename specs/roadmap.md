# Roadmap

Each phase is intentionally small — one shippable increment of work.

## Phase 1 — Project Scaffolding (Complete)

Set up the Electron + React + TypeScript boilerplate with dev tooling
(Vite, ESLint, Prettier, Vitest). Integrate SQLite for local storage.
Verify the app launches an empty window.

## Phase 2 — PowerPoint Import (Complete)

Parse `.pptx` files directly (no external applications). Extract slides,
layouts, fonts, colours, and embedded media. Preserve the original slide
formatting faithfully.

## Phase 3 — Basic Slide Viewer (Complete)

Render imported slides in the main application window. Display one slide
at a time, scaled to fit the window. High-fidelity previews are rendered via
LibreOffice and Poppler when available, with a basic in-process rasterizer as a
fallback.

## Phase 4 — Slide Navigation (Complete)

Add next/previous navigation with keyboard shortcuts. Allow the trainer
to hide individual slides so they are skipped during presentation.

## Phase 5 — Presenter Notes Panel

Display slide notes alongside the current slide inside the main window.

## Phase 6 — Detached Notes Window

Open notes in a separate Electron window so the trainer can share only
the slide window while reading notes privately on another screen (or in
another area of the same screen).

## Phase 7 — Drawing Tools Foundation

Overlay a transparent canvas on the slide view. Support freehand drawing
with basic pen and eraser.

## Phase 8 — Drawing Tool Palette

Add a mouse-friendly tool-switcher tab with shapes (rectangle, ellipse,
arrow, line) and text insertion. Tools are selected by clicking the tab.

## Phase 9 — Whiteboard Mode

Provide a blank canvas the trainer can switch to at any time without
leaving the application, then switch back to slides.

## Phase 10 — Rich Text Note Editor

Replace the plain-text notes panel with a rich-text editor supporting
bold, italic, font selection, and other formatting — editable directly
inside the app.

## Phase 11 — Polish & Packaging

App icon, installer builds for macOS / Windows / Linux, window management
refinements, and final UX polish.
