# MEMORY.md — Long-Term Project Memory

**Role:** durable project knowledge for future sessions — human or AI.
Facts, decisions, deferrals, and trade-offs that are *not* design
specifications. Design lives in the
[Architecture Handbook](docs/architecture/Architecture-Index.md); execution
planning lives in [PLANS.md](PLANS.md); per-session operating rules live in
[CLAUDE.md](CLAUDE.md). This file records **why things are the way they
are** and what future sessions must not rediscover the hard way.

**Maintenance:** append to Session Notes each significant session; edit
other sections only when a durable fact changes (with a note in Session
Notes saying so). Never let this file restate handbook content — link it.

---

## Project Purpose

Build an open, owned, domain-first Presentation Engine — the fourth option
between bespoke editors, canvas libraries, and closed commercial SDKs
(Vision.md §2) — powering our own product family first and, potentially,
third parties later.

## Long-term Vision

Five years out: multiple shipped products on one un-forked core; at least
one absorbed rendering-technology shift with no domain-model break; a
plugin ecosystem; collaboration added as a layer, not a rewrite; the
year-one abstractions still recognizable (Vision.md §4).

## Architectural Philosophy

- The Domain Model is the truth; everything else translates (Vision.md §7).
- Closed core, open extension — first-party code has no privileges.
- Deterministic core, effectful edges — everything nondeterministic is
  injected.
- Earn abstractions; don't predict them (the reason ai/collab packages
  don't exist yet).
- Boundary tables are load-bearing; most cross-layer bugs are a missed
  boundary rule.

## Core Principles

The 14 numbered principles in
[Design-Principles.md](docs/architecture/vision/Design-Principles.md) —
every design argument in the project traces to one of them. Read them once
per major piece of work; they settle most debates before they start.

## Important Decisions (chronological record)

| Decision | Where recorded |
| --- | --- |
| 2026-07-12 — Architecture Readiness Review found the handbook internally contradictory; verdict ❌ | Session Notes below |
| Dependency graph direction: Domain is root, runtime orchestrates; "Architecture" doc struck | ADR-0001 |
| Intent→Command translation owned solely by the Interaction Manager via the Intent Interpreter Registry | ADR-0002 |
| Validation is incremental (O(touch)); whole-document only at load/import | ADR-0003 |
| One canonical `RendererAdapter`; SDK split into engine scope (registries) and session scope (operations) | ADR-0004 |
| Sandboxed plugins limited to data-shaped contributions; AI providers get a streaming seam; ordering jitter uses injected RNG; command payloads get migrations | ADR-0005 |
| Text measurement is one injected `TextMeasurer`; Text-System.md required before the Text widget | ADR-0006 |
| Commands are the only mutation mechanism (relocated from Command-System.md §2) | ADR-0007 |
| Workspace tooling: pnpm/Turborepo/tsdown/TS7-refs/Biome/depcruise/knip/Changesets/lefthook; Node ≥20.19 baseline | ADR-0008 |
| License: MIT | LICENSE, user decision 2026-07-12 |
| npm names: bare, exactly as Package-Structure.md records; packages `private: true` until a publishing ADR | ADR-0008 |
| `presentation-ai` / `presentation-collaboration` deliberately not scaffolded | README, Principle 7 |
| 2026-07-13 — Short package dirs + `@presentation/*` npm scope (supersedes ADR-0008 bare names) | ADR-0009 |

## Architectural Invariants (never violate — enforcement copy in CLAUDE.md)

1. Commands are the only mutation mechanism (ADR-0007).
2. One door into the Store; reads only via `DocumentQuery`
   (State-Management.md §4).
3. Renderers never mutate, never dispatch — they emit normalized input
   only (Rendering-Architecture.md §4, ADR-0002).
4. The Event Bus never carries mutation requests (Event-System.md §2, §17).
5. Validation is incremental, O(touch) (ADR-0003).
6. Ephemeral state (selection, hover, viewport, history, previews, derived
   order caches) is never serialized (Serialization.md §4).
7. No ambient nondeterminism in core — IDs/RNG/clock/text metrics are
   injected (Principle 8, ADR-0005 §3, ADR-0006).
8. Plugins have no privileged path; neither does first-party code
   (Principle 6).
9. Engine units only in core; unit conversion lives in adapters
   (Principle 5).
10. Universal packages touch no DOM/Node APIs (tsconfig-preset-enforced).
11. Text is measured by the injected `TextMeasurer`, never by a renderer
    (ADR-0006); no Text widget before Text-System.md exists.

## Naming Conventions

- **Ubiquitous language** = the handbook's vocabulary, verbatim:
  `PresentationDocument`, `Page` (never "Slide" in engine code),
  `WidgetInstance` (data) vs `WidgetDefinition` (behavior),
  `DocumentSession`, `InteractionIntent`, `ChangeSet`, `RenderState`,
  `Snapshot`. Don't invent synonyms; if a concept has no handbook name,
  that's a governance conversation.
- Packages (ADR-0009): handbook logical name `presentation-<x>` = npm
  `@presentation/<x>` = directory `packages/<x>`, mapped 1:1. Bare short
  npm names were rejected (`react`/`events` collisions).
- Commit scopes: package short-names (`domain`, `state`, `renderer-dom`,…)
  plus `docs`, `repo`, `ci`, `examples`, `deps`, `release`
  (commitlint.config.mjs is the enum).
- Tasks: `T-###` (TASKS.md); ADRs: `ADR-NNNN` sequential.

## Package Boundaries

Rings 0–3 per Package-Structure.md §2/§3, projected 1:1 into `packages/`.
`pnpm lint:deps` (configs/dependency-cruiser.cjs) is the law and is
negative-tested — an illegal edge fails CI by rule name. Changing any
package's dependencies requires updating Package-Structure.md, the Index,
and the depcruise config in the same PR. pnpm's strict isolation is the
first line of defense: an undeclared cross-package import fails to resolve
— when you hit that error, first suspect the import is architecturally
illegal.

## Coding Philosophy

Strict TS (`isolatedDeclarations`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`); no `any`; transcribe handbook interface shapes
exactly; comments cite governing sections, not narration; small PRs; match
the handbook's vocabulary in identifiers.

## Testing Philosophy

- Package tests: no DOM, no network, no real renderer — inject everything.
- `presentation-testing` accumulates fixtures + conformance suites;
  contract tests exist *before* dependents build on a layer.
- Property tests (fast-check) are mandatory for handbook-stated
  invariants: fractional ordering, replay determinism, migration chains,
  structural sharing, serialization round-trips.
- Never weaken an assertion to go green; a red test is information.

## Documentation Rules

- Finalized handbook docs change only via ADR / Amendment / Follow-up
  Patch + version changelog entry (Index §11).
- A document referenced anywhere must be tracked in the Index (§11 rule 4).
- Whitespace-only `lint:md --fix` changes are governance-exempt.
- Execution docs (this file, PLANS.md, TASKS.md) update in the same PR as
  the work they describe.

## Things We Intentionally Deferred (with un-defer triggers)

| Deferred | Trigger to un-defer |
| --- | --- |
| `presentation-ai`, `presentation-collaboration` packages + their documents | A committed product feature (Index §12; PLANS.md P17 is the checkpoint) |
| Playwright / e2e infrastructure | Phase 10 (first browser app) |
| npm publishing (all packages `private: true`) | Publishing ADR; check bare-name availability then |
| Node 22 baseline (unpins dependency-cruiser ^16, cspell ^9) | Any time after CI matrix proves it; low urgency |
| Sandboxed tier for function-bearing plugin contributions (widgets/tools/renderers) | Dedicated ADR with a real untrusted-plugin scenario (ADR-0005 §1) |
| Multi-viewport-linked selection; collaborative undo protocol | Real product need (S&I §20, Command-System.md §14) |
| Animation/timeline, layout engine, theme cascading, asset providers detail | Their future documents (Index §12) |
| React peer deps in `presentation-react` | Phase 14 start |
| Undo-grouping across streamed AI batches | AI.md (ADR-0005 §2 names it) |

## Known Trade-offs

- **TypeScript 7 (native)** for typecheck speed; consequently
  dependency-cruiser parses via `@swc/core`, not the TS API.
- **depcruise ^16 and cspell ^9 pinned** for the Node 20 baseline;
  Renovate will nag about majors until the baseline bump.
- **tsdown needs `unrun` at the workspace root** to load TS configs —
  non-obvious; removing it breaks every package build.
- **`exports` → `src/index.ts` during the private phase** (with
  `publishConfig` pointing at `dist/`): great DX for vitest/tsc, but
  running built output *inside this repo* via node resolves to source —
  fine until publishing, revisit at the publishing ADR.
- **Fractional-index jitter** lengthens keys slightly in exchange for
  collision resistance; accepted by Ordering-Strategy.md.
- **Command ceremony for trivial mutations** — the accepted cost of
  ADR-0007; do not add shortcuts.
- **Handbook markdown was whitespace-normalized** by markdownlint during
  bootstrap (content unchanged) — diffs against pre-bootstrap copies will
  show formatting noise.

## Future Ideas (NOT accepted architecture — do not build from this list)

WebGL renderer family for stroke-heavy whiteboards; plugin marketplace +
compiled plugin VM; mobile bindings; visual regression lane for renderer
families; a docs site in `apps/`; codemod tooling for major-version
migrations; CRDT-based collab provider as the first
`CollabProviderContribution`. Each needs a governance artifact before any
code exists.

## Session Notes (append-only; newest last)

Format: `### YYYY-MM-DD — short title` + outcomes, decisions, and anything
the next session must know. Keep entries under ~10 lines; durable facts
graduate into the sections above.

### 2026-07-12 — Architecture Readiness Review + reconciliation

Full-handbook review found cross-document contradictions (intent pipeline,
renderer contract, validation semantics, circular index graph); verdict
"not ready." Reconciled the same day: ADR-0001…0007 created, every
document bumped to 1.1.0, State-Management.md written, index rewritten
truthfully. Handbook considered source-of-truth from this point.

### 2026-07-12/13 — Repository bootstrap (commit `282831f`)

pnpm monorepo, 19 placeholder packages with real dependency edges,
executable import law (negative-tested), full toolchain (ADR-0008), CI,
governance surface, CLAUDE.md. Decisions: MIT license, bare npm names.
Gotchas recorded in Known Trade-offs (TS7/swc, unrun, version pins).

### 2026-07-13 — Execution planning system

Added PLANS.md (phases P0–P17, milestones M1–M10, gates, DoD), this file,
and TASKS.md. ROADMAP.md reduced to a pointer at PLANS.md to avoid two
competing phase lists. Phase order corrected against the dependency graph
(runtime after events/state/commands; widget contract before rendering
core). Next real work: Phase 1 (`presentation-domain`), tasks T-001…T-005.

### 2026-07-13 — Package naming shortened (ADR-0009)

Owner found `presentation-*` directory names redundant. Renamed all 19
packages: dirs to short form (`packages/commands`), npm names to
`@presentation/<short>`. Literal bare names were impossible (`react`,
`events` collisions). Handbook prose untouched — Package-Structure.md 1.2.0
defines the three-form mapping. Import law re-negative-tested under scoped
`node_modules/@presentation/` paths. Gotcha learned: `git checkout -- <dir>`
after `git mv` restores mv-time content and silently reverts unstaged
rewrites — re-verify after using it.
