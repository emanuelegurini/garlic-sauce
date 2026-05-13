# Implementation Notes — Phase 2: PowerPoint Import

## Chosen Approach

- `.pptx` files are parsed directly in-process using a small ZIP reader built on
  Node `zlib` and targeted XML extraction helpers.
- `.ppt` files are parsed directly from OLE compound files where possible, then
  normalized into the same import model. Legacy formatting extraction is
  best-effort because the binary format is substantially less regular than OOXML.
- Import work runs in a Node worker thread launched from the bundled Electron
  main entry. The renderer receives progress, completion, and error events over
  IPC.
- Extracted presentations are persisted transactionally to SQLite using
  normalized presentation, slide, shape, text, media, theme, and font tables.
- After persistence, the import pipeline renders preview PNGs for every slide.
  It prefers LibreOffice + Poppler native conversion for fidelity, then falls
  back to the in-process TypeScript rasterizer when native tools are unavailable.

## Captured Data

- Slide order, slide dimensions, layout name, and background fill.
- Text runs with content, font family, size, bold, italic, colour, and alignment
  when present in the source XML.
- Shape geometry, preset type, fill, stroke, and media relationship references.
- Embedded image, audio, and video relationship targets when the media blob is
  present in the package.
- Required font families and missing-font detection against local system font
  directories.

## Current Limits

- `.pptx` extraction is intentionally dependency-light and targets common OOXML
  slide content. Native conversion is used for high-fidelity preview images, so
  the structured extraction model does not need to implement every DrawingML
  rendering rule before the viewer can display accurate slides.
- Legacy `.ppt` support extracts compound-file streams, slide records, document
  dimensions, and text atoms, but does not yet recover full binary formatting or
  embedded media records.
- High-fidelity preview rendering depends on local native tools. On macOS:
  `brew install --cask libreoffice` and `brew install poppler`.
- The missing-font modal prompts for download, but an approved font-source
  provider still needs to be wired before files can be downloaded safely.
