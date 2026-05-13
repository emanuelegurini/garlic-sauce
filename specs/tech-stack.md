# Tech Stack

## Runtime

| Layer    | Technology                    | Notes                                        |
| -------- | ----------------------------- | -------------------------------------------- |
| Desktop  | **Electron**                  | Multi-window support, mature ecosystem       |
| UI       | **React**                     | Component-driven UI                          |
| Language | **TypeScript**                | End-to-end type safety (main + renderer)     |
| Database | **SQLite** (`better-sqlite3`) | Local storage for slides, notes, preferences |

## PowerPoint Import

`.pptx` files are parsed **directly** in-process (they are ZIP archives
containing XML and media assets). `.ppt` files are parsed directly from OLE
compound streams on a best-effort basis. No external application is invoked for
metadata extraction or persistence.

## Slide Rendering

Imported slide previews are stored as PNG images in SQLite.

Preferred rendering path:

1. LibreOffice Impress converts the source `.ppt` / `.pptx` to PDF.
2. Poppler `pdftoppm` rasterizes PDF pages to PNG.
3. The app stores each PNG in the `slide_images` table.

On macOS, the app launches LibreOffice conversion through LaunchServices to
avoid direct headless `soffice` startup crashes seen on some systems. The
in-process TypeScript rasterizer remains as a basic fallback when native tools
are missing or conversion fails.

Local tool requirements for high-fidelity rendering on macOS:

```sh
brew install --cask libreoffice
brew install poppler
```

## Testing & Validation

| Tool           | Purpose                        | npm script           |
| -------------- | ------------------------------ | -------------------- |
| **TypeScript** | Static type checking           | `npm run typecheck`  |
| **Vitest**     | Unit & integration tests       | `npm test`           |
| **Vitest**     | Watch mode during dev          | `npm run test:watch` |
| **npm**        | Full local validation pipeline | `npm run validate`   |

Tests live alongside source code (`src/**/*.test.ts`) and run in a
Node environment (`vitest.config.ts`). Every feature and bug-fix should
include corresponding Vitest tests to verify behaviour before merging.
`npm run validate` is the required pre-merge check for non-packaging changes.

## Build & Dev Tooling

| Tool              | Purpose                   |
| ----------------- | ------------------------- |
| Electron Forge    | Scaffold, build, package  |
| Vite              | Fast dev server & HMR     |
| ESLint + Prettier | Code quality & formatting |
| Vitest            | Unit & integration tests  |
