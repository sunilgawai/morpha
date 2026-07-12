# CLAUDE.md

Instructions for Claude sessions working on this repository. Read this file
in full before making any change.

## What this project is

slide-core is a Presentation Domain Engine — a framework-agnostic core for
visual documents (slides, whiteboards, resumes) built as a pnpm monorepo.
It is **architecture-first**: every structural decision is recorded in the
Architecture Handbook at `docs/architecture/`, reconciled and versioned.
The handbook is the source of truth; this repository is its implementation.

Three execution documents complement the handbook — keep them current
**in the same PR as the work they describe**:

- **PLANS.md** — phases, milestones, quality gates, definition of done.
  Check which phase is active and whether its gate items are met before
  starting a layer.
- **TASKS.md** — the live backlog. Pick work from *Ready*, move it to
  *In Progress* (WIP ≤ 3), record the PR ref on completion. Never reuse
  task IDs.
- **MEMORY.md** — durable project knowledge and the append-only Session
  Notes log. Read it at session start; append a short entry after any
  session that decides something or discovers a gotcha.

## The prime directive

**The handbook wins.** Before working on anything:

1. Read `docs/architecture/Architecture-Index.md` (the Index).
2. Pick the reading path in Index §9 that matches your task (renderer work,
   interaction work, plugin work, …) and read those documents in full.
3. Never propose or write code that contradicts a finalized document's
   boundary tables ("what this layer does NOT do" sections). Those tables
   are load-bearing — most cross-layer bugs come from missing exactly one
   rule stated in exactly one of them.
4. If the architecture seems wrong or blocking, **do not work around it**.
   Raise it: an ADR (decision reversal), Amendment Proposal (change to a
   finalized doc), or Follow-up Patch (small flagged addition), per Index
   §11. "Helpfully" bypassing a boundary is the specific failure mode this
   handbook exists to prevent (Index §10 says this verbatim).

## Architectural invariants — never violate these

These are the non-negotiables, each anchored to its governing document:

1. **Commands are the only mutation mechanism** (ADR-0007,
   Command-System.md). No code path writes to the Store except the
   Transaction Manager executing a dispatched Command. No "fast path," not
   for AI, not for importers, not for tests (tests dispatch Commands too).
2. **One door into the Store.** `applyTransaction` is never public API.
   The read surface is `DocumentQuery` (State-Management.md §4) — nothing
   else.
3. **Renderers never mutate, never dispatch.** They receive `RenderState`,
   emit normalized input events (`PointerInputEvent`/`KeyInputEvent`), and
   that is all (Rendering-Architecture.md §4, ADR-0002).
4. **The Event Bus never carries mutation requests** (Event-System.md §2,
   §17). It transports notifications of facts; intent→Command translation
   happens only in the Interaction Manager via the Intent Interpreter
   Registry (ADR-0002).
5. **Validation is incremental** (ADR-0003): O(what-the-transaction-touched),
   never O(document). Whole-document validation only at load/import.
6. **Ephemeral state is never serialized**: selection, hover, focus,
   viewport, undo history, preview state (Serialization.md §4). Derived
   order caches (`pageOrder`, `widgetOrder`) are runtime-only and rebuilt
   on load.
7. **No ambient nondeterminism in core code**: IDs, randomness, clocks, and
   text measurement are injected capabilities (`EngineConfig`), never
   `Math.random()`/`Date.now()`/`crypto.randomUUID()` inline
   (Design Principle 8, ADR-0005 §3, ADR-0006).
8. **Plugins have no privileged path** (Design Principle 6). First-party
   widgets/tools use exactly the same registration APIs a third party
   would. If a first-party feature needs a core hook a plugin can't use,
   the contract is broken — fix the contract.
9. **Engine units only in core** (Design Principle 5). Unit conversion
   (px, EMU, points) happens exclusively in adapters.
10. **Universal packages touch no platform APIs.** Ring 0/1 packages (and
    most of Ring 2) compile without DOM or Node libs — the tsconfig presets
    enforce this; don't add `lib: ["DOM"]` to escape a compile error.
11. **Text is measured by the injected `TextMeasurer`, never by a
    renderer** (ADR-0006). The Text widget must not be implemented before
    Text-System.md exists (Index §12).

## Package boundaries and import law

The topology is Package-Structure.md (v1.2.0), projected 1:1 into
`packages/`. Naming (ADR-0009): handbook logical name `presentation-<x>`
= npm `@presentation/<x>` = directory `packages/<x>`.

- Ring 0: `domain` (imports nothing)
- Ring 1: `events`, `state`, `commands`, `runtime` (inward + enumerated
  intra-ring edges only)
- Ring 2: `widget-api`, `rendering`, `interaction`, `plugin-api`,
  `serialization`, `widgets-base`, `renderer-{dom,canvas,ssr}`,
  `{export,import}-pptx`
- Ring 3: `react`, `devtools`, `testing`

Rules that matter in practice:

- **Before adding any cross-package import, check Package-Structure.md §3's
  allowed-imports for that package, then run `pnpm lint:deps`.** The
  dependency-cruiser config (`configs/dependency-cruiser.cjs`) encodes the
  ring rules and named forbidden pairs; CI fails on violations.
- Changing a package's `dependencies` requires updating
  `Package-Structure.md` **and** the Index **in the same PR** (Index §11
  rule 4) — and the dependency-cruiser config if edges change.
- pnpm's strict isolation means an undeclared cross-package import fails to
  resolve. If you hit "cannot resolve @presentation/x", the fix is usually
  that the import is architecturally illegal — check before declaring the
  dependency.
- `@presentation/ai` / `@presentation/collaboration` do not exist yet by
  explicit decision. Do not create them "while you're at it."

## Coding standards

- Strict TypeScript everywhere; the base config enables
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `isolatedDeclarations`, `verbatimModuleSyntax`. No `any` (Biome errors
  on it); no `@ts-ignore` without a linked issue.
- Exports need explicit type annotations (`isolatedDeclarations`) — write
  them, don't disable the flag.
- Biome formats and lints; run `pnpm format` before committing (lefthook
  does it for staged files).
- Comments state constraints the code can't show — cite the governing
  architecture doc section (`// State-Management.md §10: deferred FIFO`)
  rather than narrating what the next line does.
- Match existing naming: the handbook's vocabulary (WidgetInstance,
  DocumentSession, InteractionIntent, ChangeSet) is the ubiquitous
  language. Don't invent synonyms.

## Testing philosophy

- Package-local tests (`packages/*/test/`) run with **no DOM, no network,
  no real renderer** — everything injectable is injected
  (`@presentation/testing`'s `createTestEngine()` once it exists).
- Cross-package tests go in `tests/integration/`; benchmarks in
  `tests/benchmarks/`.
- Property-based tests (fast-check) are **required** where the handbook
  states an algebraic/determinism invariant: fractional-index ordering
  (Ordering-Strategy.md), Command replay (Command-System.md §17), migration
  chains (Serialization.md §15).
- Contract tests: every implementation of a handbook contract
  (`RendererAdapter`, `WidgetDefinition`, importers/exporters) gets a
  shared conformance suite so third-party implementations can reuse it.
- A failing test is reported as failing. Never weaken an assertion to make
  CI pass.

## Performance ground rules

Cost is proportional to what changed, never to document size: O(touch)
validation (ADR-0003), write-time ChangeSet tracking — no diffing passes
(State-Management.md §5), structural sharing with reference-equality
guarantees (§2). If your change makes any per-keystroke path O(n) in
widgets, it's wrong regardless of benchmarks. Budgets arrive with
Performance.md; until then, don't regress the complexity class.

## Workflow

- **Commits:** Conventional Commits, scopes from `commitlint.config.mjs`
  (package short-names + `docs`, `repo`, `ci`, `examples`, `deps`,
  `release`). Squash-merge; PR title = commit message.
- **Changesets:** every package-affecting PR includes one
  (`pnpm changeset`); `no-changeset` label for docs/CI-only changes.
- **Before pushing:** `pnpm check` (the full CI gauntlet). Don't push red.
- **PR descriptions:** cite the architecture sections your change
  implements ("Implements State-Management.md §5 ChangeSet derivation").
  Reviewers check against the governance checklist in the PR template.
- **ADR workflow:** new ADRs go in `docs/architecture/adr/` numbered
  sequentially, using `TEMPLATE.md`. An ADR is accepted before affected
  documents change; the document edit bumps its version with a changelog
  entry, and the Index is updated in the same change.

## Editing the Architecture Handbook

- Finalized documents are never silently modified (Index §11). Every edit
  needs a governance artifact (ADR / Amendment / Follow-up Patch) and a
  Version Changelog entry in the edited document.
- Whitespace/formatting fixes from `pnpm lint:md --fix` are exempt from
  governance but must not alter content.
- If you add a reference to a document that doesn't exist yet, register it
  in the Index's status table in the same change — a document referenced
  nowhere in the Index may not be cited by any document (Index §11 rule 4).

## AI-session-specific guidance

- Read the Index first; read only the reading path relevant to the task
  (Index §10 addresses AI assistants directly).
- When the user asks for something the architecture forbids, say so and
  point at the governing section — then offer the governance route, not a
  workaround.
- Never mass-edit handbook documents as a side effect of a code change.
- When implementing a contract, transcribe the handbook's interface shapes
  exactly — the documents contain the canonical TypeScript signatures; do
  not "improve" them inline. Signature changes go through governance.
- Prefer extending `@presentation/testing` fixtures over ad-hoc mocks so
  test infrastructure accumulates in one place.
