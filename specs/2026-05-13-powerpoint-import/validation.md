# Validation — Phase 2: PowerPoint Import

Every criterion below must pass before this branch is merged.

## 1. PPTX import succeeds

Import a sample `.pptx` file. All slides are stored in SQLite with correct
order and dimensions.

## 2. PPT (legacy) import succeeds

Import a sample `.ppt` file. All slides are stored in SQLite with correct
order and dimensions.

## 3. Text content is extracted accurately

Imported slides contain all text runs with correct content, font name, font
size, bold/italic flags, and colour values.

## 4. Visual properties are preserved

Shapes (rectangles, ellipses, lines, arrows, text boxes) are extracted with
correct positioning, dimensions, fills, and stroke properties.

## 5. Colours and themes are correct

Theme colours, custom colours, and gradients are extracted and match the
original file.

## 6. Embedded media is extracted

Images (PNG, JPEG, SVG, EMF, WMF) embedded in slides are extracted and stored.
Audio and video references are captured.

## 7. Font detection works

After import, missing fonts are identified. A modal prompts the user to
download each missing font, clearly stating what will be downloaded.

## 8. Import is non-blocking

The import runs in a worker/utility process. The UI remains responsive during
import. A progress indicator updates as slides are processed.

## 9. Cancellation works

The user can cancel an in-progress import. The worker stops, partial data is
cleaned up, and the app returns to a clean state.

## 10. Corrupt files are handled gracefully

Importing a corrupt or invalid file produces a user-friendly error message.
The app does not crash. No partial data is left in the database.

## 11. Transactional integrity

If import fails mid-way (e.g. out of memory, unexpected format), no partial
presentation data remains in SQLite. The import is all-or-nothing.

## 12. Tests pass

`npm test` runs all new and existing tests. At minimum:

- Unit tests for PPTX XML parsing.
- Unit tests for PPT binary parsing.
- Integration test importing a real `.pptx` fixture with assertions.
- Integration test importing a real `.ppt` fixture with assertions.
- Edge-case tests for corrupt/empty files.

## 13. Validation script passes

`npm run validate` completes successfully (typecheck, lint, format, tests).
