# Validation — Phase 1: Project Scaffolding

Every criterion below must pass before this branch is merged.

## 1. App launches

`npm start` opens an Electron `BrowserWindow` displaying the placeholder React
component. The DevTools console shows **no errors**.

## 2. Linting passes

`npm run lint` completes with **zero warnings and zero errors**.

## 3. Formatting passes

`npm run format:check` (Prettier) reports **no formatting issues**.

## 4. Tests pass

`npm test` runs Vitest and **all tests pass**. At minimum, one smoke test
exists.

## 5. SQLite works

A Vitest test (or startup routine) creates/opens a SQLite database, writes a
row, reads it back, and **succeeds without error**.

## 6. HMR works

Editing a React component while `npm start` is running reflects the change in
the Electron window **without a full page reload**.

## 7. Build produces an artifact

`npm run make` (or `npm run package`) completes successfully and produces a
distributable artifact in the output directory.
