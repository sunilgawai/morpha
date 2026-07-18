# ADR-0011 — Development Applications Are First-Class Engineering Infrastructure

**Status:** Accepted
**Date:** 2026-07-18
**Resolves:** the tension between the owner's decision to stand up a
Playground, Inspector, Docs site, a numbered Examples ladder, and an
expanded Tests taxonomy *now*, versus the bootstrap-era stance recorded in
`apps/README.md`, `tests/e2e/README.md`, and the `examples/*` scaffolds that
"apps are empty by design until the packages they consume exist (Design
Principle 7)."

## Context

The bootstrap (ADR-0008, commit `282831f`) left `apps/` deliberately empty
and the examples/tests trees minimal, each citing **Design Principle 7 —
Earn Abstractions, Don't Predict Them**. Read literally, DP7 forbids
building speculative machinery ahead of two real consumers.

The owner now requires the opposite for a specific, bounded category of
software: **development applications** — a Playground (daily development
environment), an Inspector (runtime debugger), a Docs site, an educational
Examples ladder, and a professional Tests taxonomy. These are explicitly
*not* demos and *not* throwaway examples; they are the instruments through
which every future engine feature is built, visualized, debugged, taught,
and validated.

The forces:

- **DP7's actual target is speculative *engine* abstractions** (a general
  animation system, a maximal plugin lifecycle) — internal generality built
  for hypothetical future needs. A development harness is not that: it is
  tooling for the engineers building the engine, and its "consumer" (the
  developer) exists today. Reading DP7 to forbid a dev harness overloads the
  principle beyond its stated intent (Design-Principles.md §Principle 7).
- **The engine must not depend on its tools.** Whatever we build must sit
  strictly downstream of the packages, consume only their public exports,
  and never become part of the engine's own build/test gate — otherwise the
  dependency direction (Principle 2) is inverted through the back door.
- **Placeholders that display nothing are acceptable here** precisely
  because the value is the *harness*, not today's output. "Initially it may
  display very little" is the expected, intended state.

## Decision

**Development applications are first-class, permanent engineering
infrastructure, governed separately from the product/adapter code the
engine ships.** DP7 is scoped, not reversed: DP7 governs speculative
*engine* abstractions; it does not govern the developer-facing harness used
to build the engine.

Concretely:

1. **`apps/` is populated now** with three runnable applications, each with
   a single architectural responsibility:
   - `apps/playground` — the daily development environment (a lightweight
     presentation editor as the engine grows). Vite + React.
   - `apps/inspector` — the runtime debugger (DevTools-class). Vite + React.
   - `apps/docs` — the public documentation website. **Astro + Starlight**
     (rationale below).
2. **`examples/` becomes a numbered educational ladder** (`01`…`17`), each
   example teaching exactly one concept. Examples remain structure-only
   until the packages they teach exist; they are reference applications, not
   tests and not demos.
3. **`tests/` gains a professional cross-package taxonomy** (contract,
   property, regression, golden, snapshot, example-validation, plus the
   existing integration/benchmarks/e2e and a future visual-regression lane).
   Single-package unit/contract/property/snapshot tests continue to live in
   each package's own `test/` (CLAUDE.md testing philosophy); the `tests/`
   tree is *only* for suites that cross package boundaries.
4. **The hard invariant — public-API-only consumption.** Every app, example,
   and cross-package test consumes the engine exactly as an external
   developer would: only `@morpha/*` public exports, never package
   internals. This is already mechanically enforced (pnpm strict isolation +
   each package exposing only its `.` export map entry). If a feature cannot
   be built on public APIs, the package API is improved through governance —
   the encapsulation is never bypassed.
5. **Apps and examples are excluded from the engine CI gate.** `pnpm build`,
   `pnpm typecheck`, and the `pnpm check` gauntlet remain package-scoped. The
   apps/examples have their own scripts (`dev:*`, `build:apps`). This keeps
   the engine's correctness gate independent of a Vite/Astro app build and
   preserves the dependency direction.

### Documentation framework: Astro + Starlight

Chosen over VitePress, Nextra, and Docusaurus:

- **Content-first, ~zero JS by default** — matches "the narrowest thing"
  (DP7) for a docs site whose primary payload is the existing markdown
  handbook.
- **First-class MDX** — `docs/architecture/*.md` drops in with minimal
  reshaping; the handbook stays the source of truth.
- **Framework-agnostic islands** — React components (a future embedded
  Playground) mount as islands without committing the whole site to one
  framework. This mirrors the engine's own framework-agnostic core; a
  Vue-based VitePress or an all-React Nextra/Docusaurus would not.
- **TypeScript-native & monorepo-friendly**, and integrates TypeDoc for the
  generated SDK reference.

Rejected: **VitePress** (Vue-coupled, mismatches the React binding that
ships first), **Nextra** (ties the docs site to a full Next.js runtime),
**Docusaurus** (heavier React runtime and config surface than a
content-first handbook needs).

## Consequences

- **Documents changed** (each is a workspace README, not a versioned
  handbook document, so no Version Changelog entry is required): `apps/README.md`,
  `tests/README.md`, `tests/e2e/README.md`, and the `examples/*` scaffolds
  are rewritten to reference this ADR instead of citing DP7 as a
  prohibition. Design-Principles.md is **not** modified — DP7's text already
  supports this scoping; this ADR records the interpretation.
- **Architecture-Index.md** is unchanged: this ADR adds no handbook
  document and shifts no dependency edge (Index §11 rules 4–5). It lives in
  `adr/` as the governance record.
- **Packages/code affected:** none. New workspace members (`apps/*`) are
  added to `pnpm-workspace.yaml`; a shared `configs/typescript/tsconfig.app.json`
  preset is added for application (non-library) compilation.
- **Easier:** every future feature now has a home to be built, seen,
  debugged, taught, and validated in (the workflow ladder below).
- **Harder / watch items:** apps add heavier dev dependencies (Vite, React,
  Astro) to the workspace; they are quarantined from the engine gate to
  contain that cost. `dependency-cruiser` scans `packages/` only, so app
  internal-import hygiene rests on pnpm isolation rather than a cruiser rule
  — acceptable because packages expose no internal paths to import.
- **Follow-ups:** wire example-validation and visual-regression lanes when
  the first runnable example and browser app land (tracked in TASKS.md;
  these remain deliberately empty until then, consistent with DP7's actual
  intent).
