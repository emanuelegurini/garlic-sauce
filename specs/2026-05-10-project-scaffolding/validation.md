# Validation — Phase 1: Project Scaffolding

Every criterion below must pass before this branch is merged.

## 1. App launches

`npm start` opens an Electron `BrowserWindow` displaying the placeholder React
component. The DevTools console shows **no errors**.

## 2. Type checking passes

`npm run typecheck` completes with **zero TypeScript errors**.

## 3. Linting passes

`npm run lint` completes with **zero warnings and zero errors**.

## 4. Formatting passes

`npm run format:check` (Prettier) reports **no formatting issues**.

## 5. Tests pass

`npm test` runs co-located Vitest tests (`src/**/*.test.ts`) in a Node
environment and **all tests pass**. At minimum, one SQLite smoke test exists.

## 6. SQLite works

A Vitest test creates/opens an in-memory SQLite database, writes a row, updates
metadata, reads values back, and **succeeds without error**.

## 7. Validation script passes

`npm run validate` completes successfully, running typecheck, lint,
`format:check`, and Vitest in sequence.

## 8. Test watch mode is configured

`npm run test:watch` starts Vitest watch mode for local development.

## 9. HMR works

Editing a React component while `npm start` is running reflects the change in
the Electron window **without a full page reload**.

## 10. Build produces an artifact

`npm run make` (or `npm run package`) completes successfully and produces a
distributable artifact in the output directory.
