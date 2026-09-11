# ADR-0012 — Test Fixtures Are Published by the Package That Owns the Contract

**Status:** Accepted
**Date:** 2026-09-12
**Resolves:** PLANS.md §6 quality gate 2 being mechanically unsatisfiable for
every Ring 0–1 package, and the resulting inaccuracy in
Package-Structure.md §3's `presentation-testing` entry, which claims that
package's "whole purpose is to be imported by every other package's test
suite."

## Context

PLANS.md §6 makes the same demand of every phase before the next may begin:

> The layer's **contract/conformance suite** exists in
> `presentation-testing` and passes.

Phase 1 is `presentation-domain` (Ring 0); Phases 2–5 are the Ring 1
packages. `presentation-testing` is Ring 3 and depends on
`presentation-domain`, `presentation-runtime`, and `presentation-commands`
(Package-Structure.md §3), and `presentation-runtime` in turn depends on
`presentation-events`, `presentation-state`, `presentation-commands`, and
`presentation-domain`. Its transitive dependency closure therefore contains
**every package built in Phases 1–5**.

A package cannot be consumed by its own dependency closure. Two independent
mechanisms in this repository reject it, and `devDependencies` status does
not exempt it from either — both tools take the union of `dependencies` and
`devDependencies`:

- **TypeScript project references.** Every `packages/*/tsconfig.json` sets
  `"include": ["src", "test"]`, so a test-only import of a workspace package
  requires a project reference from the importer. `packages/testing/
  tsconfig.json` already references `../domain`, so a reference back from
  `packages/domain` is a circular project reference and `tsc --build` fails.
- **Turborepo's topological task graph.** Measured on 2026-09-12: adding
  `@morpha/testing` as a `devDependency` of `@morpha/domain` and running
  `turbo run build --filter=@morpha/domain` produces

  ```
  Cyclic dependency detected:
    @morpha/events#build, @morpha/state#build, @morpha/commands#build,
    @morpha/runtime#build, @morpha/testing#build, @morpha/domain#build
  ```

  Turbo refuses to run *any* task while the cycle exists, so the failure is
  not scoped to the offending package.

The workspace package graph must therefore stay acyclic, and no build
configuration change makes gate 2 satisfiable as written.

The forces this decision has to balance:

- **Rings 0–1 are exactly where determinism fixtures matter most.** The
  injected `IdGenerator`/`Rng`/`Clock`/`TextMeasurer` capabilities
  (ADR-0005 §3, ADR-0006) and the replay guarantee that depends on them
  (Command-System.md §17) are built in Phases 1–5. Deferring shared
  fixtures past them retrofits determinism, which Guiding Principle 5
  forbids.
- **Fixtures must be shareable across packages.** `presentation-state`'s
  tests need document fixtures owned by `presentation-domain`;
  `presentation-commands`' replay tests need the same seeded `Rng`
  implementation that `presentation-domain`'s ordering tests use. If the two
  diverge, the property tests that assume identical seeding silently stop
  proving anything.
- **Design Principle 6 — no privileged path.** A third party implementing
  `WidgetDefinition` or `RendererAdapter` needs the same fixtures
  first-party tests use. Fixtures reachable only from inside this repository
  would make the conformance suites first-party-only.

## Decision

**Test doubles and fixture builders are published by the package that owns
the contract they fixture, through a dedicated `./testing` subpath export.**

1. Each package that owns a contract exposes its fixtures at
   `@morpha/<name>/testing` — `@morpha/domain/testing`,
   `@morpha/commands/testing`, and so on. The subpath is public, documented,
   and versioned with the package.
2. **A `/testing` subpath introduces no new edge in the package graph.** It
   may be imported only along an edge already legal under
   Package-Structure.md §3, and only by test code. `presentation-state`'s
   tests import `@morpha/domain/testing` across the `state → domain` edge
   that already exists; nothing is added to any package's `dependencies`.
3. **`presentation-domain` owns the deterministic capability
   implementations** — seeded `Rng`, fixed/advanceable `Clock`, sequential
   `IdGenerator`, and a table-driven `TextMeasurer` stub — because their
   interfaces live there (ADR-0006; TASKS.md T-005) and the implementations
   are pure functions over those interfaces. They are not merely mocks: they
   are the deterministic implementations the replay guarantee
   (Command-System.md §17) is defined against.
4. **`presentation-testing` stays Ring 3 with its purpose intact but its
   scope stated accurately:** the engine-level harness (`createTestEngine()`),
   mock `RendererAdapter`/plugin implementations, and the conformance suites
   for Ring 2–3 contracts. It **re-exports** the per-package `/testing`
   surfaces, so Ring 2–3 consumers still have the single import the original
   entry promised.
5. **Ring 0 cannot be served by any package.** `presentation-domain`'s own
   tests consume its own `./testing` subpath. This is a property of being
   the graph root, not a defect to engineer around.
6. **`src/` never imports a `/testing` subpath.** Enforced by a
   dependency-cruiser rule added when the first subpath exists (TASKS.md
   T-047), not by prose.

### Rejected alternatives

- **A new Ring 0 `presentation-testing-core` package.** Rejected: building
  document fixtures requires the Domain Model types, so the package would
  depend on `presentation-domain` and remain unusable by
  `presentation-domain`'s own tests — the identical cycle, one package
  later, at the cost of a 20th package and a new intra-ring edge to
  enumerate.
- **Test-only tsconfig projects** (drop `test` from each package's
  referenced project; typecheck tests via one solution project that
  references every package and is referenced by none). Rejected: it fixes
  `tsc --build` and leaves Turborepo broken, which fails before any task
  runs (measured above).
- **Exempt Rings 0–1 from gate 2.** Rejected: it would leave the five
  phases that establish determinism without shared fixtures, and give
  third-party implementers nothing to verify against (Principle 6).
- **Duplicate fixtures per package.** Rejected: divergent seeded-RNG or
  document fixtures across packages weaken exactly the property tests
  (ordering determinism, command replay) that assume they are identical.

## Consequences

- **Documents changed:** Package-Structure.md → 1.4.0 (the
  `presentation-domain` and `presentation-testing` catalogue entries, and a
  new §6 subpath rule). Testing-Strategy.md 1.0.0 is written in the same
  change and codifies the convention operationally.
  Architecture-Index.md updated in the same change (Index §11 rules 4–5).
- **Packages affected:** no package gains a dependency. A package gains a
  second `exports` entry and a second tsdown entry point at the moment it
  first publishes fixtures — not before.
- **Easier:** Phases 1–5 can satisfy gate 2; a contract and its fixture
  change in one diff; fixtures land on the public surface where third
  parties can reach them.
- **Harder:** two build entry points per fixture-publishing package, both
  kept tree-shakeable; `knip` must be taught the second entry; test doubles
  become published API and are covered by the package's versioning
  commitments.
- **Follow-ups:** T-047 (dependency-cruiser `no-testing-subpath-from-src`
  rule) and T-048 (tsdown/knip multi-entry configuration), both due with the
  first `/testing` subpath — which is T-005, in Phase 1.
