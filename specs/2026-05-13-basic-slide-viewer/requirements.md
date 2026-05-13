# Phase 3 — Basic Slide Viewer: Requirements

## Goal

Render imported slides in the main application window. Display one slide
at a time, scaled to fit the window, using rasterized images.

## In Scope

- **Slide rasterization** — convert imported presentations into a PNG image per
  slide during import. Prefer native PowerPoint-compatible conversion through
  LibreOffice and Poppler, then fall back to structured slide data rendering if
  native conversion is unavailable.
- **Single-slide display** — show the first slide's rasterized image in
  the renderer process after a successful import.
- **Aspect-ratio scaling** — the slide image scales to fit the available
  window area while preserving its original aspect ratio (no stretching).
- **Window resize** — the displayed slide re-scales smoothly when the
  window is resized.
- **IPC data flow** — the main process serves slide image data to the
  renderer via Electron IPC (or a local file path the renderer can load).

## Out of Scope (deferred to later phases)

- Slide navigation / next-previous (Phase 4)
- Hiding slides (Phase 4)
- Presenter notes panel (Phase 5)
- Drawing / annotation overlay (Phase 7+)
- Editing slide content

## Key Decisions

| Decision             | Choice                                                                                                           | Rationale                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering approach   | Rasterized PNG images                                                                                            | Avoids the complexity of converting hundreds of PowerPoint shape types to HTML/SVG. Slides are read-only — pixel-perfect fidelity matters more than text selectability. |
| Rasterization engine | LibreOffice Impress -> PDF, then Poppler `pdftoppm` -> PNG. Built-in TypeScript software rasterizer is fallback. | Native document rendering gives much better fidelity for real corporate decks. The fallback keeps import usable when native tools are not installed.                    |
| Image storage        | SQLite BLOBs in `slide_images`                                                                                   | Keep images co-located with the rest of the imported data for portability.                                                                                              |
| Renderer display     | `<img>` tag with CSS `object-fit: contain`                                                                       | Simplest approach; one element, no layout complexity.                                                                                                                   |

## Dependencies

- Phase 2 import pipeline (complete) — provides structured slide data in
  SQLite (`presentations`, `slides`, `shapes`, `text_runs`, `media` tables).
- Electron main process has access to the database.

## Constraints

- Must work offline (no network calls for rendering).
- Must not require Microsoft PowerPoint.
- High-fidelity rendering requires LibreOffice and Poppler installed locally.
  Without them, the app must complete imports using the basic fallback renderer.
- Rasterization should complete in reasonable time (< 2 s per slide for
  typical decks of ≤ 50 slides).
