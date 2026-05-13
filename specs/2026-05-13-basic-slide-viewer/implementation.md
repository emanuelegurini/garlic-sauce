# Phase 3 — Basic Slide Viewer: Implementation Notes

## Rasterization Approach

The import pipeline now prefers native document conversion for slide images:

1. `src/main/native-slide-renderer.ts` converts the source `.ppt` / `.pptx` to
   PDF using LibreOffice Impress.
2. Poppler `pdftoppm` rasterizes the generated PDF pages to PNG.
3. Each PNG is stored in SQLite through the existing `slide_images` table.

This path replaced the hidden Chromium/browser capture experiment because that
renderer was unstable on real decks: the same deck could render correctly or
blank depending on timing and asset loading. Native conversion gives better
fidelity for master slides, themes, text colours, embedded media, and complex
PowerPoint layout behaviour.

On macOS, direct `soffice --headless --convert-to ...` can abort during AppKit
startup. The implementation therefore uses LaunchServices (`open -W -a
LibreOffice --args ...`) by default on Darwin, while still allowing direct
`soffice` execution for tests and other platforms.

Required local tools for high-fidelity rendering:

```sh
brew install --cask libreoffice
brew install poppler
```

## Fallback Rasterizer

The app keeps an in-process TypeScript software rasterizer in
`src/main/rasterizer.ts` as a fallback when native conversion tools are missing
or fail.

The fallback rasterizer writes PNG buffers directly using a small RGBA canvas
and Node `zlib`.

Implemented coverage:

- Solid, gradient, and PNG image backgrounds.
- Rectangle and ellipse shape fills/strokes, plus basic connector lines.
- Text runs with font size, bold, italic, colour, and alignment using a
  deterministic bitmap text fallback.
- PNG media compositing from the existing `media` table.
- Placeholder PNG storage when a slide render fails.

Rendered images are stored in the `slide_images` table and served to the
renderer as `data:image/png;base64,...` URLs through
`presentation:get-slide-image`.

## Import Flow

- Parse and persist the presentation as before.
- Try native slide rendering.
- If native rendering is unavailable or fails, report progress with a fallback
  message and render with the basic TypeScript rasterizer.
- The renderer only consumes stored PNG images and does not know which rendering
  path produced them.
