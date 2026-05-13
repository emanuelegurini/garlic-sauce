# Requirements — Phase 1: Project Scaffolding

## Goal

Set up the foundational Electron + React + TypeScript project with dev tooling
and SQLite, so every future phase starts from a working, lint-clean, tested
codebase.

## In Scope

| Area              | Detail                                                      |
| ----------------- | ----------------------------------------------------------- |
| Desktop framework | Electron, managed by **Electron Forge**                     |
| UI library        | React, rendered in the main `BrowserWindow`                 |
| Language          | TypeScript end-to-end (main process + renderer)             |
| Bundler           | Vite (via Electron Forge Vite plugin)                       |
| Type checking     | `tsc --noEmit`, exposed through `npm run typecheck`         |
| Linting           | ESLint with TypeScript rules                                |
| Formatting        | Prettier, with a `format:check` npm script                  |
| Testing           | Vitest in Node, with co-located `src/**/*.test.ts` files    |
| Validation        | `npm run validate` runs typecheck, lint, format, and tests  |
| Database          | SQLite via `better-sqlite3`, with native rebuild configured |
| App shell         | Single window displaying a placeholder React component      |
| Dev experience    | `npm start` launches the app; HMR and `test:watch` work     |

## Out of Scope

- Any UI beyond a placeholder screen.
- PowerPoint parsing, slide rendering, or navigation (Phase 2+).
- Multi-window support (Phase 6).
- Drawing tools, whiteboard, rich-text editing (Phase 7+).

## Key Decisions

| Decision                        | Rationale                                         |
| ------------------------------- | ------------------------------------------------- |
| Electron Forge + Vite template  | Recommended by tech-stack.md; fast dev, good DX   |
| `better-sqlite3` (not `sql.js`) | Fast, synchronous, mature Electron support        |
| Vitest (not Jest)               | Specified in roadmap; Vite-native, fast           |
| Co-located tests                | Keeps behaviour checks near the source under test |
| `eslint-config-prettier`        | Prevents ESLint ↔ Prettier rule conflicts         |

## Context

- See `specs/mission.md` for product vision and guiding principles.
- See `specs/tech-stack.md` for the full technology table.
- See `specs/roadmap.md` — this is Phase 1 of 11.
