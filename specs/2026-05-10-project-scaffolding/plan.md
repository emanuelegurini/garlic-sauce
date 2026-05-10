# Plan — Phase 1: Project Scaffolding

## 1. Initialize Electron + React + TypeScript project

- Bootstrap the project with **Electron Forge** using the Vite + TypeScript
  template.
- Verify the generated structure compiles and the app starts with a default
  window.

## 2. Configure dev tooling

- Install and configure **ESLint** with TypeScript rules.
- Install and configure **Prettier**; add a `format:check` script.
- Install and configure **Vitest**; add a `test` script.
- Ensure ESLint and Prettier do not conflict (use `eslint-config-prettier` or
  equivalent).

## 3. Integrate SQLite

- Install `better-sqlite3` and its TypeScript types.
- Configure Electron Forge / Vite to handle the native module rebuild.
- Create a minimal database module that opens (or creates) a `.db` file in the
  app's user-data directory.
- Write a Vitest test that creates an in-memory database, writes a row, and
  reads it back.

## 4. Create minimal app shell

- Replace the default boilerplate content with a single React component
  rendering a "Garlic Sauce" title/placeholder.
- Ensure the component renders inside the main `BrowserWindow` without errors.

## 5. Verify launch & dev workflow

- Confirm `npm start` opens the Electron window with the React component.
- Confirm HMR reflects changes without a full reload.
- Confirm `npm run lint`, `npm run format:check`, and `npm test` all pass.
- Confirm `npm run make` (or `npm run package`) produces a distributable
  artifact.
