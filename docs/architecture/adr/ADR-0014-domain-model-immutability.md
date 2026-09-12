# ADR-0014 — The Domain Model Is Deeply Readonly in Its Printed Shape

**Status:** Proposed
**Date:** 2026-09-12
**Resolves:** the inter-document drift between State-Management.md §2, which
requires an immutable document value, and Domain-Model.md, which prints mutable
interfaces. Closes the open item on PLANS.md Phase 1 gate 6 (TASKS.md T-050),
which currently blocks Phase 2.

## Context

State-Management.md §2 is unambiguous about what the Store holds:

> The Store holds an **immutable, structurally shared** document value […] *an
> entity's object reference changes if and only if that entity was written in a
> committed transaction.*

Domain-Model.md prints every interface with mutable properties, mutable arrays,
and mutable `Record` maps. `presentation-domain` transcribed them verbatim
(T-001), because CLAUDE.md requires transcription rather than improvement. The
result is that the type system currently permits exactly what the architecture
forbids:

- A renderer can mutate a `WidgetInstance` it received, though Invariant 3 says
  renderers never mutate (Rendering-Architecture.md §4, ADR-0002).
- Any holder of a document value can write to it, though Invariant 2 says
  `applyTransaction` is the only door into the Store
  (State-Management.md §4).
- Mutating a shared substructure silently breaks the reference-identity
  contract §2 states, and every consumer that relies on reference-equality
  change checks (Rendering-Architecture.md §12) then reads stale results with
  no error anywhere.

This is the handbook's own fourth failure mode — inter-document drift
(Architecture-Index.md §2) — and it is not a question of introducing a new
idiom: `readonly` is already how this handbook prints contracts it means to be
immutable, in Command-System.md §3 (`Command`), Event-System.md §6
(`EventSource`), and Plugin-System.md §9 (`PluginContext`). Domain-Model.md is
the outlier.

It also sits against this project's own definition of done (PLANS.md §7): a
boundary table must be "enforced by tests and/or depcruise rules, not just
prose." Immutability is currently prose only.

### Measured, not assumed

Taken against Phase 1's merged code at 163 passing tests, on 2026-09-12:

| Experiment | Result |
| --- | --- |
| Apply deep `readonly` to `PresentationDocument`, `Page`, `WidgetInstance` (properties, arrays, `Record` maps) | **0** typecheck errors; 163 tests still pass |
| Extend it to every remaining domain shape — `Transform`, `Asset`, `Theme`, `DocumentMetadata`, `CanvasConfig` | **1** typecheck error, in a test that deliberately mutates a fixture to assert builders return mutable copies |
| Compile the four write patterns `presentation-state` will need — single-entity spread, incremental multi-entity build, derived-cache array rebuild, and reference-identity preservation for untouched entities — against the readonly types | **0** errors, **0** casts, no draft type required |

The third row is the decisive one. The usual objection to deeply readonly
domain types is that the write path becomes unbearable without Immer-style
drafts. Measured here, it does not: a fresh mutable local spread into a readonly
field is assignable in the safe direction, so the Store writes normally.

The cost of adopting this is therefore **one line of test today**. It is four
packages of retrofit after Phase 2–5 are written against mutable shapes, which
is why this is worth deciding now rather than later.

## Decision

**The domain model's printed shape is deeply readonly.** Every property is
`readonly`, every array is `readonly T[]`, and every map is
`Readonly<Record<K, V>>`. Domain-Model.md prints them that way, and
`presentation-domain` transcribes that.

1. **A new domain shape is born readonly.** `readonly` is part of the
   transcribed shape from now on, not a local embellishment a package may add
   or drop.
2. **No draft or `Mutable<T>` type is introduced.** Measured unnecessary above;
   adding one would be ceremony with a cast surface to audit. Writes use
   spreads.
3. **The `Serialized*` projections inherit it**, since they are `Omit<>`-derived
   from the live shapes.
4. **This is a compile-time guarantee only, and that is stated rather than
   implied.** TypeScript's `readonly` disappears at runtime. A plugin written in
   JavaScript, or anything reaching through a cast, can still mutate. Closing
   that gap is a *runtime* question — see "Not decided here".

## Rejected alternatives

- **Keep the shapes mutable; enforce immutability at the Store boundary** (have
  `DocumentQuery` hand out readonly views). Rejected: it protects the Store's
  own copy and nothing else. A renderer or exporter that received a
  `WidgetInstance` can still mutate it, so Invariant 3 stays prose, and the
  readonly/mutable conversion surface moves into every accessor instead of
  living in the type declaration once.
- **Deeply readonly public shapes plus an internal Immer-style `Mutable<T>`
  draft inside `presentation-state`.** Rejected on evidence: all four write
  patterns compile without it. A second mechanically-derived type family that
  buys nothing is exactly the speculative machinery Design Principle 7 warns
  against.
- **`Object.freeze` at write time.** Rejected *for now*, not dismissed — see
  below. It is the only option that actually binds JavaScript callers, but it
  carries a per-entity cost on the hot write path, and this project has no
  performance budgets yet to judge that against (Performance.md is unwritten).
  Deciding it now would be guessing.
- **Defer until Ring 1 exists.** Rejected: the measurements above put the cost
  at one line today. Every phase that passes multiplies it, and Phase 2 starts
  next.

## Consequences

- **Documents changed on acceptance:** Domain-Model.md → 1.4.0 (every printed
  interface gains `readonly`, plus a short note stating that this makes
  State-Management.md §2's immutability contract type-enforced and that the
  guarantee is compile-time only). Architecture-Index.md updated in the same
  change (§11 rules 4–5).
- **Code affected:** `presentation-domain`'s nine shape modules, and the one
  fixture test whose premise changes — it currently asserts builders return
  *mutable* copies, and will instead assert each call returns a *fresh* value
  (structural equality, not reference identity), which is the property callers
  actually depend on.
- **Unblocks:** PLANS.md Phase 1 gate item 6, and therefore Phase 2.
- **Easier:** three invariants (2, 3, and §2's reference-identity contract) stop
  depending on reviewer vigilance. A renderer that tries to mutate fails to
  compile in the renderer's own package.
- **Harder:** a caller holding a readonly value who genuinely needs a mutable
  copy must spread it explicitly. That is the intended friction.
- **Follow-up:** T-051 — evaluate development-mode deep freezing once
  Performance.md exists and can price it.

## Not decided here

**Runtime enforcement.** Whether the engine deep-freezes document values in
development builds (catching JavaScript callers and cast-escapes at the cost of
per-entity work on the write path) is deliberately left open. It is a
performance trade-off, Performance.md does not exist yet, and `readonly` is
strictly better than nothing in the meantime. T-051 tracks it, and nothing in
this ADR precludes it — freezing a value whose type is already readonly is
purely additive.
