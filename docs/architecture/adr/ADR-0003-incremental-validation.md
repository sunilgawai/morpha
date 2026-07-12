# ADR-0003 — Incremental Validation Is the Rule; Whole-Document Validation Is Load/Import-Only

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review C5 (Command-System.md §3 step 6 required
whole-document post-validation per command; Engine-Lifecycle.md §12
required incremental validation — O(document) vs O(touch) per keystroke)

## Context

Whole-document validation after every committed command is O(n) in
document size on every keystroke — incompatible with the 5,000-widget
documents Rendering-Architecture.md §12 plans for. But purely per-widget
validation misses cross-entity invariant violations (e.g., a `parentId`
pointing at a widget the same transaction deleted).

## Decision

Validation cost is proportional to what a transaction touches, never to
document size:

1. **Pre-execution, per-widget** — unchanged (Widget-System.md §9).
2. **Post-execution, scoped structural** — after `execute()` runs, the
   Validation Pipeline validates only:
   - every entity created/patched/deleted by the transaction, and
   - every **registered cross-entity invariant whose declared trigger set
     intersects the transaction's changed-entity set.** Core invariants
     (referential integrity of `pageId`/`parentId`, order-key validity)
     declare their triggers (widget create/delete/reparent, page delete);
     plugin validators (Plugin-System.md §9.1) declare theirs via
     `appliesTo`.
3. **Whole-document validation runs in exactly two places:**
   `documents.load()` / import materialization, and explicit
   `validateDocument()` calls (e.g., pre-export sanity checks). Never per
   command.

## Consequences

- Command-System.md §3 step 6 amended from "validated as a whole" to
  scoped validation per this ADR.
- Engine-Lifecycle.md §12 stands as written (it was already correct) and
  now cites this ADR.
- The Validation Pipeline must maintain a trigger index for cross-entity
  invariants — specified in State-Management.md alongside the Store's
  change-tracking, since both consume the same changed-entity sets.
