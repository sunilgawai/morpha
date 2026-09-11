# Testing-Strategy.md

**Status:** Major — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.0.2
**Depends on:** Domain-Model.md, Ordering-Strategy.md, State-Management.md,
Command-System.md, Serialization.md, Widget-System.md,
Rendering-Architecture.md, Selection-and-Interaction.md, Plugin-System.md,
Package-Structure.md, Developer-SDK.md
**Resolves:** Architecture-Index.md §12.4; PLANS.md §6 quality gates 2 and 3
(which demanded conformance suites and property tests without defining
either); the fixture-layering question settled by ADR-0012.

---

## 1. Purpose

This document defines **how this codebase proves itself correct**: the kinds
of test that exist, where each kind lives, which handbook invariants are
required to have property tests, which contracts are required to have
conformance suites, and what "passing" means.

It does not decide *what* the system does. Every invariant named here is
owned by another document and is cited, never restated. When this document
and an owning document disagree, the owning document wins and this one is
amended.

Three convictions shape everything below:

1. **A test suite is an executable copy of the handbook's invariants.** The
   value of the architecture is the boundary tables; a boundary that no test
   enforces will be crossed.
2. **Determinism is a testability property before it is a product feature.**
   The injected capabilities (ADR-0005 §3, ADR-0006) exist so that a test can
   pin the world. Tests that reach for ambient time or randomness give that
   up for everyone downstream.
3. **Tests are the first third-party consumer.** Everything a test needs from
   a package must be reachable through that package's public surface —
   which is how Design Principle 6 (no privileged path) gets verified rather
   than asserted.

## 2. The Test Kinds

Nine kinds, each with one home. The dividing line is **scope**, not
technique: a property-based test of one package is a package-local test that
happens to use fast-check.

| Kind | Proves | Home |
| --- | --- | --- |
| **Unit** | One module's behavior, in isolation, everything injected | `packages/<p>/test/` |
| **Package-local property** | An algebraic/determinism invariant owned by one package | `packages/<p>/test/property/` |
| **Contract / conformance** | Every implementation of a handbook contract satisfies it — including third-party ones | Suite defined in `presentation-testing`; executed from `packages/<p>/test/` and `tests/contract/` |
| **Integration** | Several packages composed behave per the handbook's sequences | `tests/integration/` |
| **Cross-package property** | An invariant that only exists across packages (Command replay, migration chains) | `tests/property/` |
| **Golden file** | Byte- or structure-stable output against a committed fixture (serialization envelopes, exporter output) | `tests/golden/` |
| **Snapshot** | Semantic shape of a projection (SSR output, `RenderState`) | `tests/snapshot/`, or package-local when single-package |
| **Regression** | One fixed bug stays fixed; named for its issue; never deleted | `tests/regression/` |
| **Benchmark** | A complexity class or budget (budgets owned by the future Performance.md) | `tests/benchmarks/` |

Two further lanes are **deferred until Phase 10** brings the first browser
application, per the deferral registered in MEMORY.md: `tests/e2e/`
(Playwright) and `tests/visual-regression/` (screenshot diffs). Their
directories exist as scaffolds and are deliberately not wired into
`vitest.config.ts` — an empty scaffold must never be able to fail CI. A
suite's glob is added to the config **in the same pull request as its first
real test**.

### 2.1 The environment rule

Package-local tests run with **no DOM, no network, no real renderer, and no
real clock**. This is not a preference; it is how Package-Structure.md §8's
"universal" claim is checked. A package whose tests need a DOM is either
mis-ringed or reaching for a platform API it is forbidden to touch
(Invariant 10).

Browser-dependent packages (`presentation-renderer-dom`,
`presentation-react`) test their DOM-facing surface in the e2e lane once it
exists, and everything else headlessly against injected capabilities.

## 3. Fixtures and Test Doubles

Governed by **ADR-0012**. In summary, and normatively for test authors:

- Fixtures live at `@morpha/<name>/testing`, published by the package that
  owns the contract being fixtured.
- A test imports a `/testing` subpath only along an import edge already legal
  for its package under Package-Structure.md §3. The subpath adds no edge.
- `presentation-testing` is the **engine-level** surface —
  `createTestEngine()`, mock renderer/plugin implementations, and the
  conformance suites — and is importable only by Ring 2–3 packages and
  `tests/*`. Rings 0–1 sit inside its dependency closure and use the
  `/testing` subpaths instead.
- `src/` never imports a `/testing` subpath.

### 3.1 Injection over module mocking

**Module-level mocking of first-party code is forbidden.** No `vi.mock()` of
any `@morpha/*` module. If a test needs to substitute engine behavior and
cannot, the seam is missing — and a missing seam is an architecture finding
that goes to governance (Index §11), not a mocking workaround.

`vi.mock()` is permitted only at a genuine third-party or platform boundary
(a file-system module, a network client) and only in Ring 2–3 packages that
are allowed to touch that boundary at all.

### 3.2 Fakes, not mocks, for injected capabilities

The injected capabilities get **fakes with real behavior**, not assertion
spies:

| Capability | Test implementation | Behavior |
| --- | --- | --- |
| `IdGenerator` | sequential | `id1`, `id2`, … (prefix configurable) — stable, readable in failure output |
| `Rng` | seeded | Deterministic sequence from a literal seed committed in the test |
| `Clock` | fixed / advanceable | Starts at a fixed instant; advances only when the test advances it |
| `TextMeasurer` | recording stub | Returns a caller-supplied `TextLayout` and records every call, so a test can assert the measurer was consulted (Invariant 11). No font, no canvas, no platform text stack (ADR-0006). **Becomes table-driven once Text-System.md fixes `TextLayout`** — a metric-producing implementation is impossible while that type is opaque, and inventing one would design Text-System.md by implementation |

Seeds and fixed instants are **literal constants written in the test**. A
test that derives its seed from the ambient clock is not reproducible and is
treated as a failing test.

## 4. Determinism Rules for Tests

These apply to every test in the repository, including tests of packages that
are themselves allowed to be effectful:

1. No `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`, or
   `performance.now()` in test code. Time and randomness arrive through
   injected capabilities. (`performance.now()` is permitted inside
   `tests/benchmarks/` only.)
2. No dependence on test execution order, and no shared mutable module state
   between test files. Every test constructs its own engine/session.
3. No wall-clock waiting. Asynchronous behavior is driven by advancing the
   injected `Clock` and draining the Scheduler
   (Engine-Lifecycle.md §10.3), never by sleeping.
4. Every test disposes what it creates. Leak assertions belong in the tests
   that own the lifecycle (Engine-Lifecycle.md §4.7), but no test may leave a
   session or subscription alive for the next one to inherit.
5. Mutation in a test happens by dispatching a Command. Tests have no
   privileged write path — ADR-0007 has no test exemption, and
   `applyTransaction` is not reachable from a test for the same reason it is
   not public API.

## 5. Required Property Tests

PLANS.md §6 gate 3 requires property tests "for every determinism/algebraic
invariant the owning handbook document states for the layer." This table is
that list, and it is the checklist a phase is measured against. A phase's
gate is not met while a row belonging to it is unimplemented.

| # | Invariant | Owning document | Phase | Home |
| --- | --- | --- | --- | --- |
| P1 ✅ | A generated key sorts strictly between its bounds; generation never exhausts the key space; output is a total order under the id tie-break | Ordering-Strategy.md | 1 | `packages/domain` |
| P2 ✅ | Key generation is reproducible under a seeded `Rng` and varies under different seeds (jitter is real but not ambient) | Ordering-Strategy.md; ADR-0005 §3 | 1 | `packages/domain` |
| P3 | `validateDocument` accepts every well-formed generated document and rejects every injected referential-integrity violation | Domain-Model.md §12 | 1 | `packages/domain` |
| P4 | Reference identity changes for an entity **if and only if** that entity was written by the transaction | State-Management.md §2 | 3 | `packages/state` |
| P5 | A committed transaction's ChangeSet names every written entity exactly once and nothing else; derivation cost is O(writes), not O(document) | State-Management.md §5 | 3 | `packages/state` |
| P6 | Incremental validation of a transaction equals whole-document validation restricted to the touched set | ADR-0003 | 3–4 | `packages/state` |
| P7 | Dispatch is FIFO; a nested dispatch is queued rather than interleaved; a dispatch cycle fails loudly at the depth limit instead of recursing | State-Management.md §10 | 3 | `packages/state` |
| P8 | Replaying a serialized Command sequence against a snapshot reproduces an identical document under identical injected capabilities — **Milestone M3** | Command-System.md §17 | 4 | `tests/property` |
| P9 | `undo` after `do` restores the prior document value; `redo` after `undo` restores the post-`do` value; a new command invalidates the redo stack | Command-System.md §11 | 4 | `packages/commands` |
| P10 | A rolled-back transaction leaves the document reference-identical to its pre-transaction value (atomicity) | Command-System.md §8 | 4 | `packages/commands` |
| P11 | Command payload migration from any supported version to current is total and yields a dispatchable command | Command-System.md §16 | 4 | `packages/commands` |
| P12 | `serialize` → `deserialize` is the identity on document state modulo ephemeral fields; derived order caches rebuild equal — **Milestone M5** | Serialization.md §4, §12 | 11 | `tests/property` |
| P13 | The migration chain from any historical `dataVersion` to current is total, composes in order, and produces a document that passes whole-document validation | Serialization.md §15; Widget-System.md §10 | 11 | `tests/property` |
| P14 | A quarantined entity is re-emitted verbatim on the next save (no silent data loss) | Serialization.md §11 | 11 | `packages/serialization` |
| P15 | Plugin dependency resolution yields a topological activation order, or reports a cycle — never a partial activation | Plugin-System.md §8, §15 | 13 | `packages/plugin-api` |

A ✅ marks a row whose property test is implemented and green. Rows are added
here when a document states a new invariant. Removing a row requires an ADR —
it means the invariant itself was withdrawn.

Property tests use **fast-check** with generators that produce documents
resembling real ones (varied page counts, nesting, widget kinds), not
uniform minimal inputs. A generator that only ever emits two-widget
documents makes P4–P7 vacuous.

### 5.1 Failure reproduction

fast-check's counterexample and seed are recorded in the failure output. When
a property test finds a real bug, the shrunk counterexample becomes a
**named regression test** in `tests/regression/` with its issue reference, and
stays there after the property test goes green again.

## 6. Required Conformance Suites

PLANS.md §6 gate 2 requires the layer's conformance suite to exist before the
layer is built upon. A conformance suite is a **function exported from
`presentation-testing`** that takes a factory for the implementation under
test and registers a standard battery against it:

```
describeRendererAdapterConformance(() => createMyRenderer(deps))
describeWidgetDefinitionConformance(() => myWidgetDefinition)
```

This shape is load-bearing: it is what lets a third-party implementation
import the same suite from the published package and self-verify (Principle
6). A conformance suite that can only run inside this repository has failed
at its purpose.

| Contract | Owning document | Phase the suite is due |
| --- | --- | --- |
| `WidgetDefinition` (incl. `hitTest`, data migration) | Widget-System.md §3, §10 | 6 |
| `RendererAdapter` / `RendererHandle` (incl. capability negotiation, unmount vs. dispose) | Rendering-Architecture.md; ADR-0004 | 7 |
| Intent interpreter registration | Selection-and-Interaction.md §15; ADR-0002 | 8 |
| `Command` + command factory / payload migration | Command-System.md §3, §16 | 4 |
| `TextMeasurer` | ADR-0006; Text-System.md *(pending)* | 9 |
| Importer / exporter adapters | Serialization.md §17; Import-Export.md *(pending)* | 12 |
| Plugin manifest + activation lifecycle | Plugin-System.md | 13 |
| `CollabProviderContribution` | Command-System.md §14 *(deferred)* | 17 |

Each suite's battery includes the contract's **boundary rules**, not only its
happy path — a `RendererAdapter` conformance run asserts that the adapter
never dispatches and never mutates (Invariant 3), because a boundary table
enforced only by prose is a boundary that will be crossed.

## 7. Golden Files and Snapshots

- **Semantic, not pixel.** Snapshots capture structured output (`RenderState`
  shape, SSR element tree, serialization envelope), never rendered images.
  Pixel comparison belongs to the deferred `tests/visual-regression/` lane.
- **Committed and reviewed.** A golden file is a reviewed artifact. Its diff
  is read in review like source; a large unexplained golden diff is a review
  blocker.
- **Never auto-updated in CI.** Snapshot update flags are forbidden in CI
  invocations. Regeneration is a deliberate local act, and the regenerated
  file lands in the same pull request as the change that justifies it, with
  the justification in the description.
- **Stable ordering.** Any output feeding a golden file has a defined order
  (fractional keys, id tie-break). A golden file that depends on object
  iteration order is a bug in the output, not a test problem.

## 8. What "Passing" Means

1. **A failing test is reported as failing.** Weakening an assertion,
   loosening a tolerance, or narrowing a generator to reach green is
   prohibited. A red test is information.
2. **`.skip` requires a linked issue** in a comment on the same line. A
   skipped test with no issue is deleted or fixed — never left as ambient
   noise.
3. **A flaky test is a failing test.** There is no quarantine lane. Given §4,
   flakiness in this codebase means real nondeterminism has entered the
   system, which is a P0 finding, not a retry candidate.
4. **Coverage percentage is not a gate.** Line coverage is collected and
   reported because it locates untested regions cheaply, but the gate is
   **invariant coverage**: §5's rows and §6's suites for the phase. A
   subsystem at 95% lines with a missing property row has not met its gate; a
   subsystem at 70% with every row and boundary enforced has.
5. **Every error path in Engine-Lifecycle.md §9's table is exercised** before
   the owning subsystem is called done (PLANS.md §7).

## 9. CI Lanes

| Lane | Command | Blocking | Notes |
| --- | --- | --- | --- |
| Engine gate | `pnpm check` | Yes | Format, markdown lint, spelling, import law, knip, typecheck, tests, build — scoped to `./packages/*` |
| Applications | `pnpm build:apps` | No | Excluded from the engine gate by ADR-0011: engine correctness must never depend on a Vite/Astro build |
| Example validation | `tests/example-validation/` | Yes, from Phase 10 | Proves every `examples/*` compiles against public exports only |
| Benchmarks | `pnpm bench` | Not until Performance.md | Recorded for trend from Phase 3; becomes a regression gate when budgets exist |
| e2e / visual | Playwright | Yes, from Phase 10 | Deferred lane; un-deferred with the first browser application |

The engine gate is the only lane that may block a merge before Phase 10.
This is deliberate: an architecture-first repository must not be able to go
red because a development application's build tool changed.

## 10. Conventions

- Test files are `*.test.ts`; benchmarks are `*.bench.ts`. The
  dependency-cruiser configuration excludes both from import-law scanning, so
  a fixture helper that is *not* named `*.test.ts` **is** scanned and must
  obey the import law like source.
- A `describe` block names the contract or document section under test; a
  test name states the invariant, not the mechanics. `"queues a nested
  dispatch (State-Management.md §10)"` — not `"calls dispatch twice"`.
- Property tests live in `test/property/` within their package so that §5's
  checklist is auditable by directory listing.
- Fixture builders take overrides and return complete valid values, so a test
  states only what it cares about. A fixture that requires the caller to
  assemble a valid document has moved the work back into every test.

## 11. What This Document Explicitly Does NOT Do

- **Does not define any invariant.** Every row in §5 and §6 is a citation.
  Discovering that an invariant is wrong is a governance event against the
  *owning* document, not an edit here.
- **Does not set performance budgets.** Benchmarks have a home (§2) and a
  non-blocking lane (§9); the numbers belong to the future Performance.md.
- **Does not choose the test runner or assertion library.** Vitest and
  fast-check are tooling decisions recorded in ADR-0008; this document would
  survive replacing both.
- **Does not govern the development applications** (`apps/*`). Their purpose
  and their exclusion from the engine gate are ADR-0011's.
- **Does not define the e2e or visual-regression lanes' contents.** They are
  deferred to Phase 10 by explicit decision; this document reserves their
  place and states when they become blocking.

## 12. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.2 | §5 rows carry a ✅ when their property test is implemented; P1 and P2 marked done (T-002) | T-002 |
| 1.0.1 | §3.2 corrected against the implementations delivered by T-005: the sequential `IdGenerator` emits `id1`/`id2` with a configurable prefix, and the `TextMeasurer` double is a recording stub rather than table-driven, because `TextLayout` is opaque until Text-System.md exists | T-005; ADR-0006 |
| 1.0.0 | Initial finalized version: nine test kinds and their homes; the no-DOM environment rule; fixture layering (ADR-0012) and the ban on mocking first-party modules; determinism rules for test code; the required-property-test checklist (P1–P15) and required-conformance-suite table that PLANS.md §6 gates 2–3 are measured against; golden-file policy; the definition of "passing" including invariant coverage over line coverage; CI lanes | Architecture-Index.md §12.4; PLANS.md §6 needed an operational definition before Phase 1 |
