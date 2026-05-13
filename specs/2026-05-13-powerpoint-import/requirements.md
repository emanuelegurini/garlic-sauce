# Requirements — Phase 2: PowerPoint Import

## Goal

Parse `.pptx` and `.ppt` files directly in-process (no external applications),
extracting slides, layouts, fonts, colours, and embedded media. Persist the
imported data to SQLite so subsequent phases can render and navigate slides.

## In Scope

| Area               | Detail                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| File formats       | `.pptx` (Office Open XML) and `.ppt` (legacy binary format)            |
| Slide extraction   | Slide order, layouts, dimensions, backgrounds                          |
| Text extraction    | All text content with formatting (bold, italic, size, colour, etc.)    |
| Font handling      | Extract font metadata; prompt user to download missing fonts via modal |
| Colour fidelity    | Theme colours, custom colours, gradients preserved                     |
| Shapes & positions | Rectangles, ellipses, lines, arrows, text boxes with exact positioning |
| Embedded media     | Images (PNG, JPEG, SVG, EMF, WMF), audio, video files                  |
| Pixel-perfect goal | Rendering fidelity targets pixel-perfect reproduction of the original  |
| Persistence        | All extracted data stored in SQLite (presentations, slides, media)     |
| Import UX          | File-open dialog, progress indicator, cancel support                   |
| Error handling     | Corrupt/invalid files produce user-friendly error messages (no crash)  |
| Processing model   | Import runs in a **worker/utility process** (non-blocking)             |

## Out of Scope

- Slide rendering in the UI (Phase 3).
- Slide navigation or hiding (Phase 4).
- Editing or re-saving imported presentations (future phase).
- File-size or slide-count limits (none enforced).
- Multi-window support (Phase 6).

## Key Decisions

| Decision                           | Rationale                                                    |
| ---------------------------------- | ------------------------------------------------------------ |
| Support both `.pptx` and `.ppt`    | Trainers may have legacy files; maximises compatibility      |
| Pixel-perfect rendering target     | Trainers expect slides to look identical to PowerPoint       |
| Font download prompt (modal)       | Ensures fidelity without silently downloading; user controls |
| Read-only import (no edit/re-save) | Keeps Phase 2 focused; edit capability deferred              |
| Worker/utility process for import  | Keeps UI responsive; enables progress bar and cancel         |
| No file-size or slide-count limits | Real-world decks vary widely; no artificial constraints      |
| SQLite for persistence             | Consistent with Phase 1 foundation; fast local access        |

## Context

- See `specs/mission.md` — "self-contained" principle means no external apps.
- See `specs/tech-stack.md` — `.pptx` parsed directly (ZIP + XML).
- See `specs/roadmap.md` — this is Phase 2 of 11.
- Phase 1 established the SQLite foundation via `better-sqlite3`.
