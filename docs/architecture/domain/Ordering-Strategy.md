# Ordering-Strategy.md

**Status:** Foundational — Principle 13 compliance. A standalone, tracked
document (registered in Architecture-Index.md per ADR-0001; no longer an
"excerpt to be merged").
**Version:** 1.1.0
**Depends on:** Design-Principles.md

---

## Decision: String-Based Fractional Indexing for All Ordered Collections

Every ordered collection in the domain model — widgets on a page, pages in a
document, layers within a group — uses a **string-based fractional index**
as its `order` field, not an integer position and not a floating-point
fraction.

This directly implements Design-Principles.md Principle 13
("Collaboration-Ready Data Shapes, Even Before Collaboration Ships").

## Why String, Not Float

Figma's original 2017 implementation used a float between 0 and 1
exclusive [web:67], but floats exhaust precision after roughly fifty
successive midpoint insertions in the same gap — averaging two 64-bit floats
converges to equality and insertion silently breaks [web:80]. The
industry-standard fix, used by Figma's later implementation, Linear, and
Excalidraw, is to represent the index as an **arbitrary-length string**
sorted lexicographically, which never runs out of precision because you can
always insert another character [web:74][web:78].

## Algorithm

- Alphabet: base-62 (`0-9A-Za-z`), following the common open
  implementation [web:69][web:81].
- `generateKeyBetween(a, b)` returns a new key that sorts strictly between
  `a` and `b`. Passing `null` for `a` means "insert at the start"; `null` for
  `b` means "insert at the end."
- Midpoint computation trims to the shortest string that still sorts
  correctly — inserting between `"a0"` and `"a1"` yields `"a0V"`-style short
  keys, not ever-lengthening decimals, keeping keys compact under repeated
  insertion in the same gap [web:74].
- `generateNKeysBetween(a, b, n)` batch-generates N evenly spaced keys in one
  call — used when an AI pipeline inserts twenty widgets at once, avoiding N
  sequential single-key computations [web:81].

## Collision Handling (Multi-User Insert)

When two collaborators insert at the same gap simultaneously, both may
independently generate the same or overlapping key. Mitigation is two-layered:

1. **Client-side jitter** — append a short random suffix on generation so
   independent clients inserting into the same gap produce different keys
   with very high probability (~1 in tens of thousands per collision, at the
   cost of marginally longer keys) [web:81]. The suffix is drawn from the
   engine's **injected RNG source** (the same injection mechanism as ID
   generation, Design-Principles.md Principle 8 / ADR-0005 §3), never
   `Math.random()` — replay contexts inject a seeded source, preserving
   deterministic replay (Command-System.md §17).
2. **Server/document tie-break** — in the rare exact collision, sort by
   widget/page `id` (already globally unique) as the deterministic
   tie-breaker, exactly as Figma's algorithm falls back to object ID when
   fractional positions are equal [web:80].

This means the ordering system needs **no central sequence counter and no
full-list rewrite** on insert, move, or delete — the two operations that are
catastrophic for real-time collaboration under integer indexing.

## Domain Model Field Changes

Every entity that participates in an ordered collection carries:

```
interface Ordered {
  order: string;   // fractional index key, e.g. "a0", "a0V", "b3Zk1"
}
```

Applies to:

- `Page.order` (ordering pages within a `PresentationDocument`)
- `WidgetInstance.order` (ordering widgets within a page's z-stack / paint order)
- Any future ordered child list (e.g., grouped widget members, if groups
  later need explicit internal ordering beyond `parentId` reference)

## What This Costs Us Now (Single-Player, No Collaboration Yet)

- Slightly more complex "move widget forward/backward" logic than a plain
  array splice — we implement `moveBetween(id, beforeId, afterId)` as a core
  command from day one rather than array index manipulation.
- Keys are marginally longer strings than integers, negligible storage cost
  at presentation-document scale (dozens to low hundreds of widgets per
  page).

## What This Buys Us Later (When @engine/collab Ships)

- Reordering becomes a single atomic property update (`order` field change)
  instead of a list-rewrite operation touching every sibling — directly
  matching the pattern Figma and Linear rely on for conflict-free reordering
  under concurrent edits [web:60][web:78].
- No migration is required when collaboration is introduced — the ordering
  representation is already collaboration-shaped from the very first schema
  version, per Design-Principles.md Principle 13.

## Reference Implementation Note

We do not write our own fractional indexing algorithm from scratch. We adopt
the well-tested open algorithm (Figma-derived, base-62, jitter-supporting)
as a small internal utility module (`@engine/core/ordering`), vendored or
adapted from established reference implementations rather than reinventing
edge-case handling (equal-prefix keys, null boundary handling, trim-shortest
midpoint) that already has known-correct solutions [web:69][web:74][web:81].

## Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial version (as unmerged excerpt) | N/A |
| 1.1.0 | Promoted to standalone tracked document; jitter suffix required to use the injected RNG source | ADR-0001, ADR-0005 §3 |
