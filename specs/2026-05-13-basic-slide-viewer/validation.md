# Phase 3 — Basic Slide Viewer: Validation

## Automated Checks

All of these must pass before the branch can be merged:

- [x] `npm run validate` passes (TypeScript type-check + ESLint + Vitest).
- [x] No regressions in existing Phase 2 import tests.
- [x] New unit tests cover the rasterization module (at least: solid
      background, text rendering, image compositing, error/fallback case).
- [x] New unit tests cover the native slide renderer using fake `soffice` and
      `pdftoppm` executables.
- [x] Integration test: import a `.pptx` fixture → verify a PNG buffer
      is produced for each slide and is non-empty.

## Manual / Visual Checks

- [x] Install high-fidelity native render dependencies on macOS:
      `brew install --cask libreoffice` and `brew install poppler`.
- [x] Smoke-test the AWS Discovery Day deck through LibreOffice and Poppler:
      PDF conversion succeeds and 31 PNG pages are produced.
- [x] Open the app, import a `.pptx` file → the first slide appears in
      the window after import completes.
- [x] The slide image is scaled to fit the window without stretching
      (aspect ratio preserved).
- [x] Resize the window → the slide re-scales smoothly, remaining
      centred.
- [x] Import a deck with text, shapes, images, and a background → all
      elements are visibly rendered in the rasterized image (visual
      comparison against the original `.pptx` opened in PowerPoint or
      LibreOffice).
- [x] Import a deck with many slides (20+) → rasterization completes
      within a reasonable time and progress is reported to the UI.
- [x] If native rendering is unavailable or fails, the app does not crash — it
      falls back to the basic renderer and reports the fallback in progress.
- [x] If a slide fails to rasterize in the fallback path, the app does not crash — a
      placeholder or error message is shown instead.

## Merge Criteria

1. All automated checks green.
2. Manual visual checks confirmed by at least one reviewer.
3. No new lint warnings or TypeScript errors introduced.
4. Branch is up to date with `main`.
