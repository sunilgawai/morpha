# ADR-0001 — Dependency Graph Direction: Domain Is the Root, Runtime Orchestrates

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review C2 (circular dependency between Architecture-Index.md and document headers)

## Context

Architecture-Index.md placed Engine-Lifecycle.md *above* Domain-Model.md
(Domain depends on Lifecycle), while Engine-Lifecycle.md's own header
declared the opposite (Lifecycle depends on Domain-Model, Widget-System,
Rendering-Architecture). Package-Structure.md independently resolved the
question correctly at the code level: `presentation-runtime` depends inward
on domain/state/commands, never the reverse (Clean Architecture Dependency
Rule).

## Decision

The **document headers win; the index was wrong.** The canonical conceptual
layering is:

```
Vision → Design Principles → Ordering-Strategy → Domain Model →
Widget System → Rendering Architecture → Engine Lifecycle →
Selection & Interaction → Event System → Command System →
State Management → Serialization → Plugin System →
Package Structure → Developer SDK
```

Engine-Lifecycle.md is the **runtime orchestration contract over** Domain,
Widgets, and Rendering — it depends on them, exactly as its header always
declared and exactly as `presentation-runtime`'s package dependencies
mirror. The standalone "Architecture" document listed in the index never
existed and is struck from the record; its intended content (naming the
major subsystems) is fulfilled by the index itself plus
Command-System.md Section 0's platform layering. Ordering-Strategy.md is
registered as a tracked, first-class document.

## Consequences

- Architecture-Index.md §4/§6/§7 corrected; reading paths updated.
- No content changes to Domain-Model, Widget-System, or
  Rendering-Architecture were needed — their headers were already
  consistent with this decision.
- Blast-radius reasoning is now valid: a Domain-Model change affects
  everything; an Engine-Lifecycle change affects only runtime-and-below.
