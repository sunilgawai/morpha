# ADR-0007 — Commands Are the Only Mutation Mechanism

**Status:** Accepted (relocated from Command-System.md §2, verbatim in
substance; that section now carries a summary and a pointer here)
**Date:** originally accepted with Command-System.md 1.0.0; relocated 2026-07-12

## Context

The Store (Domain-Model.md, held per Engine-Lifecycle.md §6.2) could
theoretically be mutated directly by any caller with a reference to it —
the fastest path to "just change a widget's x position."

## Decision

Direct Store mutation is prohibited. The Store's write path
(`applyTransaction`) is not part of the Engine's public API surface — only
the Transaction Manager may call it, and only in response to a Command's
`execute()` being invoked by the Command Dispatcher.

## Why

1. **Undo/redo is not the primary justification — observability and
   auditability are.** A direct mutation has no natural inverse, no
   natural log entry, and no natural validation checkpoint. Commands give
   all three for free, uniformly (Design-Principles.md Principle 4).
2. **Every non-interactive mutation source needs the same guarantees
   interactive editing needs.** AI pipelines, collaboration peers, and
   importers all need validation, atomicity, and change notification — a
   direct-mutation "fast path" for any one of them silently bypasses
   validation and corrupts the one-Store-one-truth guarantee.
3. **Determinism requires a single, closed choke point.**
   Engine-Lifecycle.md §3's closed loop only holds with exactly one door
   into the Store.
4. **Collaboration and replay are impossible to retrofit without this** —
   both require a complete, ordered record of every state change.

## Consequences

Every mutation — including trivial ones like toggling `hidden` — is a
Command. Minor ceremony for tiny changes; in exchange, undo/redo,
validation, replay, collaboration, and AI integration are structural
consequences of one pipeline rather than five hand-synchronized systems.
