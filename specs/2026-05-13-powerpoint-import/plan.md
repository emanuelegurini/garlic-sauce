# Plan — Phase 2: PowerPoint Import

## 1. Research & select parsing libraries

- Evaluate candidates for `.pptx` parsing (e.g. `jszip` + raw XML parsing,
  `pptx-parser`, `officegen`, or similar).
- Evaluate candidates for `.ppt` (legacy binary) parsing (e.g. `cfb` for
  compound file binary, or a dedicated library).
- Criteria: formatting fidelity, maintenance status, TypeScript support,
  bundle size, Electron compatibility.
- Document the chosen approach and any limitations.

## 2. Design the SQLite schema

- Design tables for presentations, slides, text runs, shapes, and media.
- Ensure the schema captures slide order, dimensions, layout references,
  and all visual properties needed for pixel-perfect rendering.
- Write and test migrations using `better-sqlite3`.

## 3. Implement core PPTX extraction

- Unzip the `.pptx` archive (ZIP containing XML + media).
- Parse `presentation.xml` for slide order and dimensions.
- Parse individual slide XML files for content structure.
- Extract text content with full formatting metadata (font, size, bold,
  italic, colour, alignment).

## 4. Implement legacy PPT extraction

- Parse the `.ppt` compound binary format.
- Extract the same data as the PPTX path: slides, text, formatting, media.
- Normalise output to the same internal data model used by the PPTX parser.

## 5. Extract visual properties

- Parse theme colours, custom colours, and gradients.
- Extract shape geometry (rectangles, ellipses, lines, arrows, text boxes)
  with exact positioning (offsets, dimensions in EMU or points).
- Extract background fills (solid, gradient, image).
- Extract font metadata; identify fonts required for rendering.

## 6. Extract embedded media

- Locate and extract images (PNG, JPEG, SVG, EMF, WMF).
- Locate and extract audio and video files.
- Store media as blobs in SQLite or as files in the app's data directory
  (decide based on performance testing).

## 7. Implement font detection & download prompt

- After import, compare required fonts against system-installed fonts.
- For each missing font, display a modal asking the user whether to download.
- Clearly state what will be downloaded; respect user's choice.

## 8. Build the worker/utility process pipeline

- Run the parsing and extraction logic in an Electron utility process
  (or Node worker thread).
- Communicate progress back to the renderer for the progress bar.
- Support cancellation mid-import.

## 9. Wire up the import UX

- Add a file-open dialog accepting `.pptx` and `.ppt` files.
- Show a progress indicator during import (percentage or slide count).
- Display a cancel button that aborts the worker.
- On completion, confirm success or show a user-friendly error.
- Handle edge cases: empty files, corrupt archives, unsupported features.

## 10. Persist imported data to SQLite

- Write the full import pipeline: parse → transform → insert.
- Store presentations, slides (with order), text runs, shapes, media refs.
- Ensure the import is transactional (all-or-nothing on failure).

## 11. Tests & validation

- Unit tests for XML/binary parsing logic (text, shapes, colours, media).
- Integration test: import a real `.pptx` fixture, assert on parsed output.
- Integration test: import a real `.ppt` fixture, assert on parsed output.
- Edge-case tests: corrupt file, empty file, file with no slides.
- Worker communication tests: progress events, cancellation.
- `npm run validate` passes with all new tests green.
