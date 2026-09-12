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
| 2026-07-13 — Short package dirs + `@morpha/*` npm scope (supersedes ADR-0008 bare names) | ADR-0009 |
| 2026-07-18 — Development applications are engineering infrastructure; DP7 scoped to engine abstractions | ADR-0011 |
| 2026-09-12 — Test fixtures are published by the contract-owning package via `./testing` subpaths; `presentation-testing` is the Ring 2-3 surface only | ADR-0012; Package-Structure.md 1.4.0 |
| 2026-09-12 — Testing doctrine finalized before Phase 1; release cuts v0.1-v0.3 and a two-track (code / document) execution model adopted | Testing-Strategy.md 1.0.0; PLANS.md §3.1, §4.1 |
| 2026-09-12 — Inner rings declare structural ports for contracts they consume from outer rings; `validateDocument` takes `WidgetTypeLookup`, not `WidgetRegistry` | ADR-0013 (accepted); Domain-Model.md 1.3.0 |

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
  `@morpha/<x>` = directory `packages/<x>`, mapped 1:1. Bare short
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
- Doctrine is owned by
  [Testing-Strategy.md](docs/architecture/quality/Testing-Strategy.md) —
  read §5 (required property rows) and §6 (required conformance suites)
  before starting a layer, since they are what its gate is measured against.
- Fixtures live on the owning package's `./testing` subpath (ADR-0012);
  `presentation-testing` holds the engine harness and Ring 2-3 conformance
  suites and **cannot** be imported by Rings 0-1. Contract tests exist
  *before* dependents build on a layer.
- Never `vi.mock()` a first-party module. A missing seam is an architecture
  finding, not a mocking problem (Testing-Strategy.md §3.1).
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
| `Theme`/`Asset` domain shape transcription | The phase that first consumes them — deferred out of Phase 1 on 2026-09-12 because Theme-System.md / Asset-System.md do not exist (PLANS.md Phase 1 scope note) |
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
- **`pnpm <script>` can be shadowed by npm.** pnpm forwards commands it does
  not recognize to npm, so a script named `docs` was never run by `pnpm docs`
  — npm's `docs` command opened a browser instead, which is why the CI docs job
  failed on literally every run from the bootstrap until 2026-09-12. The script
  is now `docs:check` and CI calls `pnpm run`. Audited every other script name;
  only `test` collides and that one is a real pnpm builtin that runs the script.
- **Git hooks must be disabled in CI** (`LEFTHOOK: 0`). `pnpm install` runs
  `prepare` → `lefthook install` on the runner, so any CI step that commits
  gets the commit-msg hook. That is what broke the Release workflow the moment
  the first changeset existed: the changesets action's "Version Packages"
  subject is not a Conventional Commit. commitlint also `ignores` that subject
  now, for the same commit made locally.
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
`@morpha/<short>`. Literal bare names were impossible (`react`,
`events` collisions). Handbook prose untouched — Package-Structure.md 1.2.0
defines the three-form mapping. Import law re-negative-tested under scoped
`node_modules/@morpha/` paths. Gotcha learned: `git checkout -- <dir>`
after `git mv` restores mv-time content and silently reverts unstaged
rewrites — re-verify after using it.

### 2026-07-13 — Project named "morpha" (ADR-0010)

Owner named the project **morpha**; npm scope is now `@morpha/*` (root
package `morpha`, repo directory still `slide-core` on disk). Handbook
logical names (`presentation-*`) unchanged; Package-Structure.md 1.3.0
updates the mapping. Owner's examples `@morpha/widgets` / `@morpha/pptx`
were treated as illustrative — `widgets-base` and the separate
`export-pptx`/`import-pptx` packages were kept (the split is deliberate,
Package-Structure.md §3); flagged to the owner for follow-up if a real
rename/merge is wanted.

### 2026-07-18 — Development environment stood up (ADR-0011)

Owner asked for the long-term dev environment before engine work. Built
`apps/playground` (Vite+React daily driver → :4173), `apps/inspector`
(read-only runtime debugger → :4174), `apps/docs` (Astro+Starlight → :4175),
renumbered `examples/` into a 01–17 educational ladder (git-mv'd the 6
existing dirs, created 11 new; all structure-only), and expanded `tests/`
into a cross-package taxonomy (contract/property/golden/snapshot/regression/
example-validation + deferred visual-regression). Root scripts `dev:*`,
`build:apps`; `pnpm-workspace.yaml` gains `apps/*`; shared
`configs/typescript/tsconfig.app.json`.

Governance decision: **ADR-0011 scopes DP7** rather than reversing it — DP7
forbids speculative *engine* abstractions, not the developer harness used to
build the engine. Rewrote the bootstrap-era "apps empty by design" READMEs
(`apps/`, `tests/`, `tests/e2e/`) to cite ADR-0011. Design-Principles.md left
untouched (DP7's text already supports the scoping). Index not touched — the
ADR adds no handbook doc and shifts no dependency edge.

Hard invariant carried into tooling: apps/examples/tests consume **public
`@morpha/*` exports only** (mechanically safe — packages expose only their
`.` export). Apps are **excluded from the engine CI gate** (`build`/`typecheck`/
`check` stay `--filter=./packages/*`) so engine correctness never depends on a
Vite/Astro build. Docs framework = Astro+Starlight (content-first, MDX, framework-
agnostic islands for a future embedded Playground).

Gotcha: the sandbox nondeterministically strips `PATH` inside piped/loop
subshells (`mkdir: command not found`), even with `dangerouslyDisableSandbox`.
Workaround that worked: create all dirs in one non-loop command, then write
files in a loop using only shell builtins (`printf` + `>` redirection).

### 2026-09-12 — Status review; testing doctrine and re-plan before Phase 1

Returned after ~8 weeks idle (last commit `e24263f`, 2026-07-18). Verified
the foundation is intact: `pnpm check` green end-to-end (19 builds, 20 test
files, 39 placeholder tests, 0 depcruise errors). Confirmed the real state —
**zero engine code**; all 19 packages are ~15-LOC placeholders; ~6,600 lines
of finalized handbook awaiting a first implementation.

Found and fixed five planning defects before writing any Phase 1 code:

1. **PLANS.md §6 gate 2 was mechanically unsatisfiable for Rings 0-1.** It
   required conformance suites in `presentation-testing`, whose dependency
   closure contains domain/events/state/commands/runtime — i.e. Phases 1-5.
   *Measured*, don't re-derive: adding `@morpha/testing` as a devDependency of
   `@morpha/domain` makes `turbo` refuse every task with `Cyclic dependency
   detected: @morpha/events#build … @morpha/domain#build`, and `tsc --build`
   fails separately because `packages/*/tsconfig.json` includes `test`, so a
   test-only import needs a project reference and `packages/testing` already
   references `../domain`. **devDependency status exempts you from neither
   tool** — both use the union of deps and devDeps. Resolved by ADR-0012:
   fixtures live on the owning package's `./testing` subpath, which adds no
   graph edge. A Ring 0 `testing-core` package was rejected — it would need
   domain's types and hit the same cycle one package later.
2. **Testing-Strategy.md was scheduled last but gates everything.** Written
   now as 1.0.0 (`docs/architecture/quality/`); its §5 property-row checklist
   (P1-P15) and §6 conformance-suite table are what phase gates 2-3 now cite.
3. **T-002 depended on T-005 in fact but not on paper** (jitter needs `Rng`).
   Ready is now sequenced T-001 → T-005 → {T-002, T-003} → T-004.
4. **Phase 0.5 (ADR-0011) was never recorded in PLANS.md** despite that
   file's own maintenance rule. Recorded retroactively, plus Phase 0.75 for
   this session's doctrine work.
5. **No release cuts existed** — 17 phases, nothing shippable in between.
   Added §4.1 (v0.1 core loop = P1-5; v0.2 editable = P6-11; v0.3 open =
   P12-13) and §3.1's two-track model so gated documents stop competing with
   code for WIP ≤ 3.

Also narrowed Phase 1 to the M1 domain subset (`Theme`/`Asset` deferred —
their owning documents don't exist, so transcribing their shapes is the
over-modeling that phase's own risk line warns about), and added gate 8: each
phase records a **handbook contact report** in these notes, naming what the
specification got wrong. Phases 1-5 test the handbook as much as the code.

Next session: T-001. No engine code was written in this one.

### 2026-09-12 — T-001: domain model transcribed (first engine code)

`packages/domain/src` now holds the Domain-Model.md §3-§10 shapes across nine
modules, plus `Serialized*` projections for the persisted form. 46 tests green,
`pnpm check` clean. The §13 canonical example is transcribed into the test
suite typed as `SerializedPresentationDocument`, so a transcription drift that
re-admitted a derived cache would stop compiling.

**Handbook contact report** (PLANS.md §6 gate 8) — four findings, first time
these interfaces were ever compiled:

1. **`LayoutConstraints` had no shape anywhere.** Referenced by §5, and §14
   defers only *resolution order* to Layout-System.md. Follow-up patch
   (Domain-Model.md → 1.2.0): declared deliberately opaque, `unknown` in code,
   narrowing left to Layout-System.md.
2. **`LayoutId` was referenced by `Page.layoutRef` (§4) but absent from §10's
   ID list.** Same follow-up patch registers it.
3. **PLANS.md's own Phase 1 narrowing did not compile.** Deferring `Theme`/
   `Asset` *shape* transcription is impossible — `.assets`/`.themes` are
   non-optional, `Background` needs `AssetId`, `ColorValue` needs
   `ThemeColorToken`. Corrected same day: shapes in, semantics out. Lesson for
   future scope-narrowing: check the type graph, not the section headings.
4. **`Omit<>` is weaker than it looks.** TypeScript does not
   excess-property-check spreads, so `{ ...livePage }` still satisfies
   `SerializedPage` while carrying `widgetOrder` at runtime. The types prevent
   *declaring* and *reading* a derived cache, nothing more; stripping at the
   persistence boundary needs a runtime guarantee (property row P12). A test
   documents the limit so nobody re-derives it.

**Two decisions the owner should settle before T-003 and Phase 3** (raised,
deliberately not decided):

- **§12's `validateDocument(doc, registry: WidgetRegistry)` is a Ring 0 → Ring
  2 reference.** `WidgetRegistry` lives in `presentation-widget-api`; domain
  imports nothing. Domain must own the narrow port it actually needs (look up
  a widget type's validator), which is a contract change to §12 and probably
  an ADR. Blocks T-003's signature.
- **Immutability is not expressed in the types.** State-Management.md §2
  requires an immutable structurally-shared value, but the transcribed
  interfaces are mutable, because that is what the handbook prints. Making
  them deeply `readonly` is a real improvement and a real deviation — an ADR,
  not a unilateral edit. Cheapest to decide now, before Ring 1 builds on the
  mutable shape.

Next: T-005 (injected capabilities + the first `./testing` subpath, which also
lands T-047/T-048), then T-002/T-003.

### 2026-09-12 — T-005/T-047/T-048: injected capabilities and the first `./testing` subpath

`@morpha/domain/testing` now exists and ADR-0012 is proven rather than
asserted: `packages/state/test` (Ring 1, cannot import `@morpha/testing`)
consumes `fixtureDocument()`/`seededRng()` across its existing `state → domain`
edge, with no new dependency, no project reference, and no depcruise
exception. 67 tests green.

Shipped: `IdGenerator`/`Rng`/`Clock`/`TextMeasurer` interfaces (src/capabilities.ts),
`sequentialIdGenerator`/`seededRng`/`fixedClock`/`recordingTextMeasurer` and the
document fixture builders on the subpath, the `no-testing-subpath-from-src`
depcruise rule (**negative-tested** — fires by rule name on an `src/` →
`src/testing/` edge), and the multi-entry tsdown/`exports` wiring.

**Handbook contact report** (gate 8):

1. **The handbook prints no signature for `IdGenerator`, `Rng`, or `Clock`** —
   only the mechanism (Domain-Model.md §10, Ordering-Strategy.md,
   Command-System.md §15). Implemented as minimal single-method interfaces
   (`next()`, `next()`, `now()`), marked provisional in code. The first real
   consumer (Phase 3/4) may need more; that is an amendment, not a bug.
   Note §10 says ID generation is an injected "function" — a single-method
   interface is a deliberate, flagged deviation, chosen so a second method
   later is not a breaking change.
2. **ADR-0006's `TextMeasurer` signature is not implementable yet.**
   `measure(runs: TextRun[], constraints: MeasureConstraints): TextLayout`
   names three types that only Text-System.md can define. All three are opaque
   (`unknown`), same treatment as `LayoutConstraints`. Consequence: the test
   measurer is a **recording stub**, not table-driven — no implementation can
   produce metrics while `TextLayout` is opaque. Both Testing-Strategy.md
   (→ 1.0.1) and Package-Structure.md (→ 1.4.1) were corrected, since both had
   promised "table-driven". This strengthens the Text-System.md gate rather
   than contradicting it.
3. **Pre-existing Index defect:** the §6 status table listed
   Package-Structure.md at 1.1.0 while the document was at 1.3.0 — ADR-0009 and
   ADR-0010 bumped the doc without updating the Index, which §11 rule 5
   requires. Corrected, and all sixteen rows were audited against their
   documents; the rest agreed. Worth re-auditing whenever an ADR bumps a doc.
4. **Golden values must be measured, not written.** The `seededRng` stability
   test was first committed with invented expected values and failed
   immediately. Generate, inspect, then commit — for every golden.

Next: T-002 (ordering utility, property rows P1-P2) — unblocked. T-003 is
**blocked** on the `WidgetRegistry` decision from the previous session, now
recorded in TASKS.md's Blocked table so it cannot be silently picked up.

### 2026-09-12 — CI was never green; two independent bugs fixed

Owner reported failing CI after merging #3 and #4. Neither failure came from
the merged work; both are repo-infrastructure bugs, and one predates every
commit in the project.

1. **CI docs job — broken since the bootstrap.** `pnpm docs` never ran the
   `docs` script; pnpm forwarded it to `npm docs`, which tries to open the
   package homepage (`xdg-open`, exit 3 on a runner). Every CI run in the
   repository's history failed on this, including the bootstrap and the
   development-environment PR — `gh run list` shows no successful CI run, ever.
   Fixed by renaming the script to `docs:check` and calling `pnpm run`.
2. **Release job — broke when the first changeset appeared.** The changesets
   action commits "Version Packages"; lefthook's commit-msg hook ran commitlint
   against it and rejected it. Release had been passing only because there were
   no changesets to act on, so the action no-op'd. Fixed with `LEFTHOOK: 0` on
   the release job, plus a commitlint `ignores` entry for that subject.

Both verified locally: `pnpm run docs:check` clean, `pnpm test -- --coverage`
green (67 tests), `pnpm install --frozen-lockfile` clean, `Version Packages`
now passes commitlint while junk subjects still fail.

Lesson worth keeping: **a green local `pnpm check` is not a green CI.** CI runs
two steps `check` does not — `pnpm run docs:check` and `pnpm test --coverage` —
and the Release workflow runs none of them. Nobody had looked at a CI run's
result since the repository was created.

### 2026-09-12 — T-002: fractional-index ordering (property rows P1, P2)

`packages/domain/src/ordering.ts` implements Ordering-Strategy.md:
`generateKeyBetween`, `generateNKeysBetween`, jitter from the injected `Rng`,
and `compareOrdered`'s order-then-id total order. 115 tests green; P1 and P2 are
marked ✅ in Testing-Strategy.md §5.

The base-62 algorithm is **vendored, not depended upon** — Ordering-Strategy.md's
Reference Implementation Note directs us to adopt the established
implementation, and Package-Structure.md gives this package zero runtime
dependencies, so the two together mean vendoring with attribution in the file
header.

**Handbook contact report** (gate 8):

1. **Jitter as specified can break the ordering invariant.** Ordering-Strategy.md
   says to "append a short random suffix on generation". If the generated key is
   a proper prefix of the upper bound (`"a1"` below `"a1V"`), any suffix can sort
   *past* that bound. Resolved in implementation with a guard: jitter is applied
   only while the result stays below the bound, otherwise the unjittered key is
   returned. Correct ordering is not negotiable; collision resistance is a
   probability. **Not** raised as an amendment — the document states an intent
   and this is the faithful way to honor it — but if anyone later reads the
   jitter promise as unconditional, this is the reason it isn't.
2. **The key space has a hard floor.** Prepending eventually generates the
   reserved smallest integer, which the validator then rejects as *input*, so
   the next prepend throws. Inherited from the reference algorithm and now
   pinned by a test. Practically unreachable (~62²⁶ prepends below `"a0"`), and
   it fails loudly rather than returning a key that sorts wrong — which is the
   behavior we want.
3. **Verification caught my expectations, not the code.** Property tests passed
   on the first run, which on an algorithm this fiddly is a warning sign, so I
   checked the unjittered output against the reference's published value table:
   17 of 19 matched, and all four eventual mismatches were *my* wrong
   expectations (an `A`-headed integer part is 27 characters, so `"Az"` is
   malformed, not merely unusual). The table is now a committed test — order
   keys are persisted data, so a silent change to generated keys would affect
   every document written afterward.

Next: T-004 (migration contract shapes) is the only unblocked Phase 1 task left.
T-003 still needs the `WidgetRegistry` ring decision.

### 2026-09-12 — T-004: migration contract shapes; Phase 1 one task from its gate

`packages/domain/src/migration.ts` fixes the document and widget-data migration
contracts (Serialization.md §15, Widget-System.md §10): `CURRENT_SCHEMA_VERSION`,
`UnknownDocument`, `DocumentMigration` (single-version steps by construction),
`MigrateDocument`, `MigrateWidgetData`, `WidgetDataMigrator`,
`needsWidgetDataMigration`, and two typed errors. Shapes only — the load-time
runner is `presentation-serialization`'s. 130 tests green.

**Handbook contact report** (gate 8):

1. **The narrow-port pattern now has working precedent, and it answers T-003.**
   Widget-System.md §10's flow needs `def.version`/`def.migrate` from a widget
   definition that lives in Ring 2. Rather than reach for it, Ring 0 declares
   `WidgetDataMigrator` — the minimum surface it consumes — and the real
   `WidgetDefinition` satisfies it structurally. This is exactly the move
   Domain-Model.md §12's `validateDocument(doc, registry: WidgetRegistry)`
   needs, so T-003's blocker is no longer a design question, only a governance
   one: the pattern is proven, an ADR just has to accept it and amend §12's
   printed signature.
2. **A migration's input cannot be typed as the current shape.** A
   `schemaVersion: 1` document is not today's `SerializedPresentationDocument`,
   so `UnknownDocument` (`Record<string, unknown>`) is the honest input type and
   only the completed chain yields the real type. Typing it otherwise would
   force every migration author to cast their way out of a lie.
3. **`UnsupportedSchemaVersionError` was homed here, slightly ahead of T-003's
   "shared typed errors" scope.** Serialization.md §15 names it as part of the
   migration contract, so the contract is incomplete without it. If T-003
   introduces a shared error base, re-homing these two under it is a widening,
   not a break.

**Phase 1 gate status:** exit criteria are met except property row P3 and
`validateDocument` accepting/rejecting the handbook's example documents — both
T-003. Everything else (P1, P2, the `./testing` subpath proven from Ring 1, zero
platform APIs, real README) is done.

### 2026-09-12 — T-003: validation. Phase 1 code-complete, one gate item open

ADR-0013 accepted by the owner, so the governance edits landed with the code:
Domain-Model.md → 1.3.0, Package-Structure.md → 1.4.2, Index → 1.5.1.
`validateDocument` ships with referential integrity, parent-cycle detection,
theme/asset reference checks, and optional derived-cache checking. Property row
P3 done. 163 tests green.

**Handbook contact report** (gate 8):

1. **`ValidationResult` was referenced by three documents and defined by none.**
   Domain-Model.md §12, Widget-System.md §3, and Plugin-System.md §10 all name
   it. Shape fixed in Domain-Model.md 1.3.0 (the document that owns validation),
   with `ValidationIssue` carrying a stable machine-readable `code`, a human
   `message`, and a `path`. Issues **accumulate rather than throw** — a caller
   needs every problem at once to quarantine (Serialization.md §11); throwing is
   for Engine-Lifecycle.md §9's fail-loud rows only.
2. **Parent cycles are structurally possible and nothing said so.**
   Domain-Model.md §5 makes grouping a flat `parentId`, which means nothing
   prevents a cycle, and a cycle hangs every tree walk. The validator detects it
   with a settled-set walk, so a fully cyclic document terminates instead of
   spinning. Worth remembering when the group widget lands (T-034).
3. **Testing-Strategy.md §6 had omitted the injected capabilities.** Hosts supply
   their own `IdGenerator`/`Clock`/`Rng` — a coordinated scheme for
   collaboration, a virtual clock for export — so they are third-party-implemented
   contracts like any other and now have a row (due Phase 5).
4. **Mutation testing earned its keep.** The property tests passed first run
   again, so I broke the validator three ways: disabling cycle detection (4
   tests failed), forcing `valid: true` (8 failed), and skipping the
   cross-page-parent check (**only 1 failed** — the property generator never
   produced that violation). Added the missing breakage, plus a guard that
   asserts each breakage actually applied at least once, since a mutation that
   never applies makes its property vacuously true. **Do this for every property
   suite**: a green property test is not evidence until something has been
   broken and seen to fail.

**Phase 1 gate: 7 of 8 items met.** Gate 6 fails — the `readonly`/immutability
question is an open governance item against the layer's owning document. Left
open deliberately rather than quietly decided, and **Phase 2 must not start
until it closes**, because every Ring 1 package gets written against whichever
shape wins. T-050 tracks it and is the only Ready task.

### 2026-09-12 — T-050: ADR-0014 drafted on domain-model immutability (Proposed)

The open Phase 1 gate-6 item now has a decision in reviewable form. Not written
from first principles — **measured** against Phase 1's merged code, and the
numbers changed what the ADR recommends:

- Deep `readonly` on `PresentationDocument`/`Page`/`WidgetInstance`: **0**
  typecheck errors, 163 tests still green.
- Extended to every remaining shape: **1** error, in the fixture test that
  deliberately mutates to assert builders return mutable copies.
- The four write patterns `presentation-state` will need — single-entity spread,
  incremental multi-entity build, derived-cache array rebuild, reference-identity
  preservation — compile against readonly types with **0 casts and no `Mutable<T>`
  draft type**.

That third measurement is why the ADR recommends plain deep `readonly` rather
than the Immer-style public-readonly/internal-draft split I expected to land on.
The standard objection to readonly domain types is an unbearable write path; it
is simply not true here, because a fresh mutable local spread into a readonly
field assigns in the safe direction. Proposing a draft type anyway would have
been speculative machinery (DP7).

Also worth keeping: **`readonly` is already this handbook's idiom** — Command-System.md
§3, Event-System.md §6 and Plugin-System.md §9 all print it. Domain-Model.md is
the outlier, so this is drift repair, not a new convention.

Runtime freezing is deliberately left undecided (T-051): it is the only option
that binds JavaScript callers, but it costs per-entity work on the write path and
Performance.md does not exist to price it.

**Cost of delay, concretely: 1 test line today, four packages after Phase 2-5.**
