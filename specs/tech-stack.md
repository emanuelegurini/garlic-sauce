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
containing XML and media assets). No external application is invoked.

Candidate libraries will be evaluated during Phase 2; the key requirement
is that slide layout, fonts, colours, and embedded media are faithfully
preserved.

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
