# Phase 3 — Basic Slide Viewer: Plan

## Task Groups

### 1. Slide Rasterization Engine

Build modules in `src/main/` that produce a PNG image for each slide. Prefer
native conversion from the original PowerPoint file, with structured-data
rasterization as fallback.

- [x] Evaluate rasterization approach (offscreen BrowserWindow, `sharp`, Node
      `canvas`, or external document conversion) — pick one and document the
      choice.
- [x] Implement native conversion path: LibreOffice Impress -> PDF -> Poppler
      PNG.
- [x] Implement a `renderSlideToImage(slideId)` function that reads
      shapes, text runs, media, and background from SQLite and produces a PNG
      buffer as a fallback renderer.
- [x] Handle text rendering (font family, size, bold/italic, colour,
      alignment).
- [x] Handle shape rendering (rectangles, basic presets) with fill and
      stroke.
- [x] Handle embedded images (pull BLOB from `media` table, composite
      onto the slide at the correct position/size).
- [x] Handle slide backgrounds (solid colour, gradient, image).
- [x] Write unit tests for the rasterizer with fixture data.

### 2. Batch Rasterization on Import

Integrate the rasterizer into the import pipeline so all slides are
rendered after parsing.

- [x] After the import persists slide data, trigger rasterization for
      every slide in the presentation.
- [x] Prefer native rendering and fall back to the basic TypeScript renderer if
      LibreOffice or Poppler is unavailable.
- [x] Store the resulting PNG as a BLOB in a new `slide_images` table
      (or alongside the slide row).
- [x] Report rasterization progress via the existing `ImportProgress`
      mechanism.
- [x] Handle errors gracefully (if a slide fails to render, store a
      placeholder and continue).

### 3. IPC: Serve Slide Images to Renderer

Expose an IPC channel so the renderer can request a slide image.

- [x] Add an IPC handler `get-slide-image` that accepts
      `{ presentationId, slideOrder }` and returns the PNG buffer (or a
      data URL / file path).
- [x] Expose the handler via the preload script (`window.garlicSauce`).
- [x] Add TypeScript types for the new IPC contract.

### 4. Slide Viewer Component

Build the React component that displays the slide image.

- [x] Create `src/renderer/SlideViewer.tsx` — an `<img>` element that
      fills the available space with `object-fit: contain`.
- [x] On successful import, request the first slide image via IPC and
      display it.
- [x] Handle loading state (show a spinner or skeleton while the image
      loads).
- [x] Handle error state (show a message if the image can't be loaded).
- [x] Ensure the image re-scales on window resize (CSS handles this
      automatically with `object-fit`).

### 5. App Layout Update

Update `App.tsx` to transition from the import UI to the viewer after a
successful import.

- [x] After import completes, switch the main view from the import
      surface to the `SlideViewer`.
- [x] Provide a way to return to the import view (e.g. a menu item or
      button to import another deck).
- [x] Preserve the import summary info (slide count, etc.) somewhere
      accessible.

### 6. Integration & Polish

End-to-end verification and cleanup.

- [x] Integration test: import a `.pptx` fixture, verify a slide image
      is produced and can be loaded in the renderer.
- [x] Native renderer test: fake `soffice` and `pdftoppm` executables produce
      deterministic PNG pages without requiring native tools in CI.
- [x] Real-deck smoke test: AWS Discovery Day deck produced 31 PNG pages through
      LibreOffice and Poppler on macOS.
- [x] Verify aspect ratio is preserved at various window sizes.
- [x] Ensure `npm run validate` passes (typecheck + lint + tests).
- [x] Update README or internal docs if needed.
