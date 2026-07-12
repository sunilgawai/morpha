# tests/

Cross-package test workspaces. Single-package unit/contract/snapshot tests
live in each package's own `test/` directory — this tree is only for tests
that exercise multiple packages together.

- `integration/` — multi-package integration tests (Vitest, runs in `pnpm test`).
- `benchmarks/` — performance benchmarks (`pnpm bench`, vitest bench). Budgets
  will be defined by the future Performance.md.
- `e2e/` — end-to-end tests. Deliberately empty: Playwright is deferred until
  a browser-facing app exists (Design Principle 7).
