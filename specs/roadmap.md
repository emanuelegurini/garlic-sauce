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

## Phase 5 — Presenter Notes Window

Extract presenter notes from imported PowerPoint files, display and edit
them in a separate Electron window (screen-share-safe), with basic
rich-text formatting (bold, italic, underline, bullet lists). The notes
window follows slide navigation and is opened manually by the trainer.
_(Combines the original Phase 5 and Phase 6 into a single deliverable.)_

## Phase 6 — Drawing Tools Foundation

Overlay a transparent canvas on the slide view. Support freehand drawing
with basic pen and eraser.

## Phase 7 — Drawing Tool Palette

Add a mouse-friendly tool-switcher tab with shapes (rectangle, ellipse,
arrow, line) and text insertion. Tools are selected by clicking the tab.

## Phase 8 — Whiteboard Mode

Provide a blank canvas the trainer can switch to at any time without
leaving the application, then switch back to slides.

## Phase 9 — Rich Text Note Editor

Replace the basic notes formatting with a full rich-text editor supporting
font selection, colours, headings, and other advanced formatting.

## Phase 10 — Polish & Packaging

App icon, installer builds for macOS / Windows / Linux, window management
refinements, and final UX polish.
