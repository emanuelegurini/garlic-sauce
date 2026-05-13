# Plan — Phase 1: Project Scaffolding

## 1. Initialize Electron + React + TypeScript project

- Bootstrap the project with **Electron Forge** using the Vite + TypeScript
  template.
- Verify the generated structure compiles and the app starts with a default
  window.

## 2. Configure dev tooling

- Install and configure **ESLint** with TypeScript rules.
- Add a `typecheck` script that runs TypeScript with `noEmit`.
- Install and configure **Prettier**; add a `format:check` script.
- Install and configure **Vitest** for `src/**/*.test.ts` files in a Node
  environment; add `test` and `test:watch` scripts.
- Add a `validate` script that runs typecheck, lint, formatting, and tests.
- Ensure ESLint and Prettier do not conflict (use `eslint-config-prettier` or
  equivalent).

## 3. Integrate SQLite

- Install `better-sqlite3` and its TypeScript types.
- Configure Electron Forge / Vite to handle the native module rebuild.
- Create a minimal database module that opens (or creates) a `.db` file in the
  app's user-data directory.
- Write co-located Vitest tests that create an in-memory database, write rows,
  update metadata, and read values back.

## 4. Create minimal app shell

- Replace the default boilerplate content with a single React component
  rendering a "Garlic Sauce" title/placeholder.
- Ensure the component renders inside the main `BrowserWindow` without errors.

## 5. Verify launch & dev workflow

- Confirm `npm start` opens the Electron window with the React component.
- Confirm HMR reflects changes without a full reload.
- Confirm `npm run validate` passes.
- Confirm `npm run test:watch` starts Vitest watch mode for local development.
- Confirm `npm run make` (or `npm run package`) produces a distributable
  artifact.
