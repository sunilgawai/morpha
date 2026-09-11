# ADR-0013 — Inner Rings Declare Structural Ports for Contracts They Consume

**Status:** Proposed
**Date:** 2026-09-12
**Resolves:** Domain-Model.md §12's `validateDocument` signature being
unimplementable as printed, which blocks TASKS.md T-003 and with it Phase 1's
quality gate.

## Context

Domain-Model.md §12 prints the core's single generic validation entry point:

```typescript
function validateDocument(doc: PresentationDocument, registry: WidgetRegistry): ValidationResult
```

`WidgetRegistry` is defined by Widget-System.md §4 and lives in
`presentation-widget-api` — **Ring 2**. `presentation-domain` is **Ring 0** and
imports nothing at all (Package-Structure.md §3: "Forbidden imports:
Everything — this is the innermost ring"). The signature as printed therefore
cannot be written in the package that owns it.

This is not a naming slip. §12 is load-bearing: it delegates `data` validation
to each widget's plugin-supplied validator "without ever inspecting `data`
contents itself", which is the boundary that lets the core stay ignorant of
widget internals while the document as a whole is still fully validated. The
core genuinely needs something from Ring 2 at validation time.

Two further observations, found while implementing T-001 and T-004:

- **`WidgetDefinition` cannot live in Ring 0 either**, though
  Package-Structure.md's `presentation-domain` row lists "`WidgetDefinition`
  interface (type only, not a registry)" in its public API. Widget-System.md
  §3's shape carries `render?: WidgetRenderer<TData>` — adapter-facing by that
  document's own statement — and `hitTest?(point: Point, …)`, where `Point` is
  referenced but defined nowhere in the corpus. Ring 0 cannot hold it.
- **T-004 already had this problem and solved it.** Widget-System.md §10's
  widget-data migration flow needs `def.version` and `def.migrate` from a
  definition it cannot import. Rather than reach across the ring,
  `presentation-domain` declares `WidgetDataMigrator` — the minimum surface
  that flow consumes — and the real `WidgetDefinition` satisfies it
  structurally. That code is merged and the pattern works.

The forces:

- **Ring 0 importing nothing is not negotiable.** It is what makes the domain
  model universal (Package-Structure.md §8), independently testable, and the
  root of the graph (ADR-0001).
- **The dependency direction is already inverted elsewhere by plan.** PLANS.md
  Phase 5 lists "registry interfaces for Ring 2 (DIP seam)" as a runtime
  deliverable, so dependency inversion for registries is the intended
  mechanism, not a new idea.
- **Duplicating the contract is worse than either.** Two independent
  definitions of "widget registry" that must be kept in sync by hand is the
  drift this handbook exists to prevent.

## Decision

**When a contract owned by an inner ring needs behavior owned by an outer ring,
the inner ring declares the minimum structural surface it consumes. The outer
ring's richer type satisfies that surface structurally, with no import in the
inner direction and no duplicated contract.**

Concretely, `presentation-domain` gains:

```typescript
/** What document validation consumes from a widget definition. */
export interface WidgetDataValidator {
  validate(data: unknown): ValidationResult;
}

/** What document validation consumes from the widget registry. */
export interface WidgetTypeLookup {
  get(type: WidgetTypeId): WidgetDataValidator | undefined;
}
```

and Domain-Model.md §12's signature is amended to:

```typescript
function validateDocument(doc: PresentationDocument, registry: WidgetTypeLookup): ValidationResult
```

The parameter keeps the name `registry`, because the real `WidgetRegistry` is
what callers pass. `WidgetRegistry` satisfies `WidgetTypeLookup` structurally:
its `get` returns `WidgetDefinition | undefined`, and `WidgetDefinition` has a
`validate(data: unknown): ValidationResult` member (Widget-System.md §3).
Nothing about Widget-System.md changes.

Three rules make the pattern predictable rather than ad hoc:

1. **A port states a requirement, never a capability.** It contains only what
   the consuming code calls — not a trimmed-down copy of the outer contract
   kept "in case".
2. **The outer ring proves conformance at compile time.** The package owning
   the real contract asserts `satisfies` against the port, so a drifting
   signature fails typecheck in the package that caused the drift rather than
   silently at a call site.
3. **A port is named for what it does, not for what satisfies it.**
   `WidgetTypeLookup`, not `WidgetRegistryLike` — the second name invites the
   port to grow toward the thing it mimics.

### Rejected alternatives

- **Move `WidgetRegistry` (and `WidgetDefinition`) into Ring 0.** Rejected: it
  drags renderer-facing members into the universal package, breaking Invariant
  10, and makes the core know what a widget *is* rather than only that it has a
  validator — against Design Principle 6.
- **Move `validateDocument` to `presentation-widget-api`.** Rejected:
  Domain-Model.md §12 makes it the core's one generic validation entry point,
  and the structural invariants it checks (`pageId`/`parentId`/`widgetOrder`
  resolution, orphaned widgets, known `schemaVersion`) are Ring 0's own. Moving
  it would split validation across two rings and leave the domain unable to
  validate itself.
- **Pass a bare callback, `(type: WidgetTypeId) => WidgetDataValidator | undefined`.**
  Rejected as the primary form: it works, but it discards the documented
  `registry.get()` shape, so callers must adapt the registry at every call site
  and the relationship to Widget-System.md §4 becomes implicit.
- **Make `validateDocument` generic over the registry type.** Rejected: it adds
  no safety, because the core must not know widget data shapes, and it pushes a
  type parameter into every downstream signature for nothing.

## Consequences

- **Documents changed on acceptance:** Domain-Model.md → 1.3.0 (§12's signature
  and a note on why the port exists). Package-Structure.md → 1.4.2 (the
  `presentation-domain` row's "`WidgetDefinition` interface (type only)" claim
  is corrected — Ring 0 owns *ports*, not outer-ring contracts).
  Architecture-Index.md updated in the same change (§11 rules 4–5).
- **Packages affected:** `presentation-domain` gains two exported interfaces and
  no dependency. `presentation-widget-api` gains a compile-time conformance
  assertion when it is built (T-029).
- **Unblocks:** T-003, and with it Phase 1's quality gate.
- **Easier:** every future Ring 0/1 contract that needs outer-ring behavior has
  a named pattern and two precedents instead of a fresh argument.
- **Harder:** one concept carries two names — the port and the real contract.
  Mitigated by rule 3's naming discipline and rule 2's compile-time assertion,
  which is what keeps them from drifting apart.
- **Follow-up:** T-049 — assert `WidgetRegistry satisfies WidgetTypeLookup` in
  `presentation-widget-api`, due with T-029.

## Not decided here

Whether the domain model's interfaces should be deeply `readonly`
(State-Management.md §2 requires an immutable, structurally shared value, while
the transcribed interfaces are mutable because that is what the handbook
prints). That is a separate question with a separate blast radius and wants its
own ADR before Ring 1 builds against the current shapes.
