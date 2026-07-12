# Command-System.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.1.0
**Depends on:** Engine-Lifecycle.md, Domain-Model.md, Widget-System.md,
Selection-and-Interaction.md, Event-System.md

---

## 0. Platform Layering — Superseding the "Single Core Package" Mental Model

Before defining Commands, this document formally adopts and records the
layered platform model proposed for the project, superseding the earlier
informal "core + adapters" framing used loosely in prior documents:

```
Presentation Platform
├── Runtime          — orchestrates every other layer (Engine-Lifecycle.md)
├── Domain           — Presentation Domain Model (Domain-Model.md)
├── Commands         — THIS DOCUMENT — the sole mutation mechanism
├── Events           — semantic transport (Event-System.md)
├── Rendering         — projection adapters (Rendering-Architecture.md)
├── Interaction       — tools, selection, hit-testing (Selection-and-Interaction.md)
├── Widgets           — plugin content types (Widget-System.md)
├── Importers          — format → Domain Model adapters (future)
├── Exporters          — Domain Model → format adapters (future)
├── Collaboration       — remote operation integration (future)
├── AI                 — generation pipelines (future)
└── Developer SDK        — public-facing ergonomic surface over all of the above (future)
```

**Why this reframing matters:** treating "Runtime" as the orchestrator and
everything else as modular subsystems it coordinates — rather than treating
everything as parts of one monolithic "core" — is what allows Commands,
Domain, Rendering, and Interaction to each version, test, and evolve
independently while the Runtime (Engine-Lifecycle.md) remains the one place
that understands how they all fit together. This document's Command layer
sits directly beside Domain and Events, both consumed by and consuming the
Runtime's services (Command Dispatcher, Transaction Manager, History
Manager — Engine-Lifecycle.md Section 6), but it has no dependency on
Rendering, Interaction, Widgets-the-plugin-mechanism, or any adapter layer.

## 1. Purpose

This document defines the **mutation architecture** of the Presentation
Engine. It generalizes far beyond "undo/redo" — Commands are the *only*
legal mechanism through which the Presentation Domain Model changes, full
stop. Dragging a widget one pixel and committing a 200-slide AI-generated
presentation are both, structurally, "one or more Commands executing
through the same pipeline." This document defines that pipeline
completely.

## 2. ADR-0007: Commands Are the Only Mutation Mechanism

**The full decision record now lives at `adr/ADR-0007-commands-only-mutation.md`**
(relocated 1.1.0 when the ADR repository was created; substance unchanged).
Summary: direct Store mutation is prohibited; `applyTransaction` is
callable only by the Transaction Manager in response to a dispatched
Command's `execute()`. Rationale: observability/auditability first, a
single deterministic choke point, identical guarantees for every mutation
source (UI, AI, importer, collaboration), and the completeness-of-record
precondition for replay and collaboration. The original text follows for
continuity:

> **Status:** Accepted (relocated to ADR-0007)
> **Context:** The Store (Domain-Model.md, held per Engine-Lifecycle.md
> Section 6.2) could theoretically be mutated directly by any caller with a
> reference to it — this would be the fastest path to "just change a
> widget's x position."
>
> **Decision:** Direct Store mutation is prohibited. The Store's write path
> (`applyTransaction`) is not part of the Engine's public API surface —
> only the Transaction Manager may call it, and only in response to a
> Command's `execute()` being invoked by the Command Dispatcher
> (Engine-Lifecycle.md Section 6.4, 6.5).
>
> **Why:**
>
> 1. **Undo/redo is not the primary justification — observability and
>    auditability are.** A direct mutation has no natural inverse, no
>    natural log entry, and no natural validation checkpoint. Commands give
>    all three for free, uniformly, regardless of mutation size
>    (Design-Principles.md Principle 4).
> 2. **Every non-interactive mutation source needs the exact same
>    guarantees interactive editing needs.** An AI pipeline inserting forty
>    widgets, a collaboration peer applying a remote edit, and an importer
>    materializing a parsed PPTX file all need validation, atomicity, and a
>    change notification — if direct mutation were allowed as a "fast path"
>    for any one of these, that source would silently bypass validation and
>    corrupt the "one Store, one truth" guarantee (Design-Principles.md
>    Principle 1).
> 3. **Determinism requires a single, closed choke point.** Engine-Lifecycle.md
>    Section 3's closed loop diagram only holds if there is exactly one door
>    into the Store. Two doors — Commands for "normal" edits and direct
>    mutation for "special" cases — inevitably diverges into two sets of
>    guarantees, and history shows (see reasoning in Widget-System.md
>    Section 5 on privileging first-party code) that "special case" access
>    paths accumulate special-cased bugs.
> 4. **Collaboration and replay become architecturally impossible to retrofit
>    without this constraint.** Both require a complete, ordered record of
>    every state change — a system with a direct-mutation escape hatch has,
>    by definition, an incomplete record.
>
> **Consequences:** Every mutation — including ones that feel trivial, like
> toggling a `hidden` flag — must be expressed as a Command. This creates
> minor ceremony for tiny changes but is the single decision that keeps
> undo/redo, validation, replay, collaboration, and AI integration all
> structurally free consequences of one pipeline, rather than five separate
> systems that must be kept in sync by hand.

## 3. Command Lifecycle

```
1. Construction    — a Command object is built (by UI code, AI pipeline,
                      importer, collaboration adapter — anyone)
2. Submission       — Command Dispatcher.dispatch(command) is called
3. Pre-validation    — structural/widget validation runs BEFORE execute()
                      (Domain-Model.md Section 12, Widget-System.md Section 9)
4. Transaction open  — Transaction Manager opens an atomic scope
5. Execution         — command.execute(tx) runs, producing Store writes
                      scoped to this transaction only (not yet visible
                      outside it)
6. Post-validation   — SCOPED structural validation (ADR-0003, revised
                      1.1.0): entities touched by the transaction, plus
                      registered cross-entity invariants whose declared
                      triggers intersect the change set (State-Management.md
                      §11) — catches violations like a parentId pointing at
                      a widget this transaction deleted. Whole-document
                      validation runs ONLY on load/import, never per
                      command — validation cost is proportional to what a
                      command touches, never to document size.
7. Commit OR Rollback
     - Commit: transaction's writes become the new Store version;
       exactly one DocumentChangedEvent fires (Event-System.md Section 8)
     - Rollback: no Store change occurs; command's execute() effects are
       discarded entirely; a CommandFailedEvent-shaped rejection is
       returned to the dispatch() caller (Engine-Lifecycle.md Section 9)
8. History registration — on successful commit, if the command is
                      undoable, it's pushed onto the History Manager's
                      stack (Section 11)
9. Disposal          — command may hold references (e.g., captured
                      "before" state for undo) that are released when the
                      History Manager evicts it (Section 11's stack limits)
```

This lifecycle applies **identically** regardless of Command Taxonomy
category (Section 4) — a User Command and an AI Command differ only in
*who constructed them and why*, never in how they move through steps 2–9.

## 4. Command Taxonomy

| Category | Constructed By | Example | Undoable by Default? |
| --- | --- | --- | --- |
| **User Commands** | Interaction layer, translating an `InteractionIntent` (Selection-and-Interaction.md Section 9) | `MoveWidgetCommand`, `ResizeWidgetCommand` | Yes |
| **System Commands** | Runtime services themselves (e.g., schema migration on load) | `MigrateDocumentCommand` | Usually no — these are infrastructure, not user-authored edits |
| **Plugin Commands** | A registered plugin's own logic | A diagramming plugin's `AutoLayoutConnectorsCommand` | Yes, unless explicitly declared as a System-Command-like infrastructure operation |
| **AI Commands** | An external AI pipeline, via the Command Dispatcher (Engine-Lifecycle.md Section 8) | `InsertGeneratedSlidesCommand` (itself a Macro Command, Section 6) | Yes — a user must be able to undo an entire AI generation as one step |
| **Collaboration Commands** | The (future) `@engine/collab` adapter, translating a validated remote operation | `ApplyRemoteOperationCommand` | Locally undoable by the receiving peer only; never "undo" for the originating remote peer — see Section 14 |
| **Import Commands** | An import adapter, materializing parsed external content | `InsertImportedDocumentCommand` | Yes, treated as a single atomic insert |

**Structural guarantee:** every row in this table produces objects
implementing the exact same `Command` contract (Section 5) and flows
through the exact same lifecycle (Section 3). The taxonomy exists for
*policy* decisions (default undoability, who's allowed to construct which
category, what `EventOrigin.source` gets stamped — Event-System.md Section
9) — never for pipeline forking. There is one pipeline.

## 5. The Command Contract

```typescript
interface Command<TResult = void> {
  readonly id: string;
  readonly type: string;                 // e.g. "widget.move"
  readonly origin: EventOrigin;          // Event-System.md Section 9 — stamped at construction

  execute(tx: TransactionContext): TResult;
  undo(tx: TransactionContext): void;

  merge?(next: Command): Command | null; // Section 9 — coalescing
  isNoop?(): boolean;                    // e.g., a move with zero delta
  describe?(): string;                   // human-readable, for history UI / logs
}

interface TransactionContext {
  getWidget(id: WidgetId): Readonly<WidgetInstance> | undefined;
  patchWidget(id: WidgetId, patch: Partial<WidgetInstance>): void;
  createWidget(input: CreateWidgetInput): WidgetId;
  deleteWidget(id: WidgetId): void;
  getPage(id: PageId): Readonly<Page> | undefined;
  patchPage(id: PageId, patch: Partial<Page>): void;
  // ...symmetric primitives for pages, assets, themes
}
```

**Critical design point:** `Command.execute()` receives only a
`TransactionContext` — never a reference to the Engine, a renderer, a Tool,
or any UI concept. This is the mechanism that structurally enforces "the
Command System knows nothing about React, pointer events, or tools" — it is
not a convention Commands are asked to follow, it is a type-level
impossibility for a Command to reach rendering or interaction code, because
nothing in its execution scope exposes a reference to either.

`undo()` receives the same narrow `TransactionContext` — a Command must be
able to fully reverse its own effect using only domain-model-shaped
operations, never by "asking the UI to remember what it looked like before."

## 6. Composite, Nested, Macro, and Batch Commands

These four terms are precisely distinguished, not used interchangeably:

- **Composite Command** — a Command whose `execute()` internally calls
  `tx` primitives multiple times to accomplish one logically-atomic
  operation (e.g., `AlignWidgetsCommand` patches N widgets' transforms in
  one `execute()`). From the History Manager's perspective, it is **one**
  undo step. This is the base case — most non-trivial Commands are
  composite in this sense.
- **Nested Command** — a Composite Command that internally constructs and
  runs *other* Command objects' `execute()` logic (not just raw `tx` calls)
  as part of its own `execute()`, for reuse (e.g., `DuplicatePageCommand`
  internally reuses `CreateWidgetCommand` logic for each copied widget).
  Nested commands share the *same* transaction scope as their parent — they
  never open their own nested Transaction.
- **Macro Command** — an explicit **sequence of independently-meaningful
  Commands** bundled so they execute as one atomic transaction and appear
  as one undo step, while each constituent Command retains its own
  identity for logging/replay purposes (e.g., `InsertGeneratedSlidesCommand`
  wraps a `CreatePageCommand` + N `CreateWidgetCommand`s from an AI
  pipeline). This is the standard Gang-of-Four MacroCommand composition,
  applied here specifically because it lets an AI-generated 40-widget
  insert undo as one keystroke while still logging 41 distinct,
  individually-replayable operations [web:176][web:166].
- **Batch Command** — not a Command type at all, but a **Dispatcher-level
  operation**: `dispatchBatch(commands: Command[])` runs multiple
  *independently constructed* Commands through one Transaction
  (Engine-Lifecycle.md Section 10.2). The distinction from Macro Command:
  a Batch is assembled by the *caller* at dispatch time (e.g., "align
  these 5 already-existing Commands together"); a Macro Command is a
  single Command *type*, authored in advance, that always bundles a fixed
  internal recipe.

## 7. Validation Pipeline Integration

Per Engine-Lifecycle.md Section 6.3 and Domain-Model.md Section 12,
validation runs at two points relative to a Command:

1. **Pre-execution, per-widget** — if a Command's payload includes new/changed
   widget `data`, the owning `WidgetDefinition.validate()` runs before
   `execute()` is even called, rejecting malformed input at the cheapest
   possible point (Widget-System.md Section 9).
2. **Post-execution, structural (scoped — ADR-0003, revised 1.1.0)** —
   after `execute()` runs inside the open Transaction, structural
   validation runs over the transaction's changed entities plus the
   cross-entity invariants whose triggers intersect the change set — this
   catches invariant violations that only manifest across multiple widgets
   (e.g., a `parentId` now pointing at a widget the same transaction just
   deleted) at O(touch) cost. Full-document `validateDocument` runs only
   at load/import (Domain-Model.md Section 12).

A Command that fails either check causes a full rollback (Section 3, step
7) — there is no partial-application, no "best effort" application of a
Command that fails validation.

## 8. Transactions

The Transaction Manager (Engine-Lifecycle.md Section 6.4) provides the
atomic scope every Command executes within. Key properties, restated and
extended here specifically for Commands:

- **One Command, one Transaction, by default.** Batch/Macro Commands are
  the explicit exceptions (Section 6) where multiple Commands share one
  Transaction intentionally.
- **A Transaction cannot observe intermediate state from a sibling Command
  within the same batch** unless it's specifically designed to (e.g., a
  Macro Command's second constituent Command may legitimately need to read
  a widget ID the first one just created — this is why Nested Commands
  share `tx` directly, while independently-dispatched Batch Commands must
  not assume ordering-dependent side effects on each other unless the
  caller explicitly sequences them).
- **Transactions never span an async boundary.** Any async preparation
  (resolving an asset, awaiting an AI response) happens *before*
  `dispatch()` is called, never inside `execute()` — restated from
  Engine-Lifecycle.md Section 10.4, enforced here by `execute()`'s type
  signature being synchronous, not `Promise`-returning.

## 9. Async Commands — Precisely Defined

There is no such thing as a Command whose `execute()` is asynchronous
(Section 8). "Async Command" instead refers to a **two-phase construction
pattern**:

```typescript
async function createInsertImageCommand(source: AssetSource): Promise<Command> {
  const dimensions = await resolveAssetDimensions(source);  // async, pre-dispatch
  return new InsertImageCommand({ source, dimensions });     // sync from here on
}
```

The async work produces the *inputs* a synchronous Command needs; the
Command itself, once constructed, executes synchronously and atomically
like any other. This preserves Design-Principles.md Principle 8
(deterministic core) while still accommodating real-world async data
gathering.

## 10. Gesture Previews (supersedes "Optimistic Commands" — revised 1.1.0)

There is **no speculative Command execution anywhere** — the previous
version of this section permitted applying `execute()` against "a local,
disposable preview," which contradicted ADR-0007's single-door rule and
named no mechanism. The replacement is **interaction preview state**
(State-Management.md §9): during a continuous gesture, the active Tool
maintains ephemeral transform overrides in `InteractionState.preview`,
which renderers paint via `overlayState` — the Store is untouched and no
Command exists until the gesture ends, at which point one real Command is
dispatched through the ordinary pipeline. On validation failure the
preview is simply cleared and rendering reverts to confirmed Store state;
no rollback machinery is required. The Command System's only involvement
remains unchanged: every preview must correspond to a Command that is
eventually really dispatched — there is no preview-only Command type.

## 11. History Integration

The History Manager (Engine-Lifecycle.md Section 6.6) maintains an
undo/redo stack of **committed** Commands, per `DocumentSession`:

```typescript
interface HistoryManager {
  undo(): void;   // pops last command, calls its undo(tx) in a new transaction
  redo(): void;   // re-executes the next redo-stack command's execute(tx)
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

- Only commands where `isNoop?.() !== true` and which are marked undoable
  per their taxonomy category default (Section 4) are pushed.
- `undo()` and `redo()` themselves run through the identical
  Transaction/Validation pipeline (Section 3) — undoing a Command is not a
  special bypass path; it is "execute this Command's `undo()` function
  inside a normal transaction," which is why undo can itself fail
  validation in pathological cases (e.g., undoing a delete when something
  else now legitimately occupies that state) and must roll back safely
  exactly like a forward Command would.
- History stack size is bounded (a configurable limit) — eviction releases
  the oldest Commands' captured state, per Section 3 step 9.
- **Redo-stack invalidation:** dispatching any new Command while the redo
  stack is non-empty clears the redo stack — the standard, expected
  behavior from every mainstream undo/redo implementation
  [web:164][web:172][web:169].

## 12. Rollback and Retry Semantics

- **Rollback** is automatic and total on any validation failure within a
  Transaction (Section 7) — there is no manual rollback API because there
  is never a state where a rollback decision is deferred to a caller.
- **Retry** is explicitly **not** an engine-owned concept. If a Command
  fails, the Command Dispatcher returns a typed failure result
  (Engine-Lifecycle.md Section 9's error table) to the caller; deciding
  whether to reconstruct and re-dispatch a corrected Command is entirely
  the caller's responsibility (e.g., an AI pipeline might retry with
  adjusted parameters; a UI might show an error toast and do nothing).
  This keeps retry *policy* — which varies enormously by Command source —
  out of the one place (the engine core) that must stay policy-agnostic
  (Design-Principles.md Principle 11).

## 13. Conflict Handling

Single-session conflict (two Commands racing for the same widget) cannot
occur within one `DocumentSession`, because the Transaction Manager
serializes all Commands through one dispatch queue (Section 8) — there is
no concurrent execution to conflict.

**Cross-session conflict** (future collaboration) is explicitly out of this
document's scope to *resolve* — this document only fixes the seam:
`ApplyRemoteOperationCommand` (Section 14) is where conflict resolution
logic (last-writer-wins at the property level, CRDT merge, or operational
transform) will live, decided in a future Collaboration.md, without
changing anything in Sections 3–12 here. The Command contract's atomicity
and validation guarantees apply identically whether the "conflict
resolution" already happened upstream (in the collab adapter, before
constructing the Command) or not at all (single-user case).

## 14. Collaboration-Generated Commands — the Seam, Fixed Now

```typescript
class ApplyRemoteOperationCommand implements Command {
  readonly origin: EventOrigin; // source: "collab"
  execute(tx: TransactionContext): void {
    // applies an already-conflict-resolved operation from the collab layer
  }
  undo(tx: TransactionContext): void {
    // reverses ONLY on the local peer's own history stack;
    // never propagated as a "collaborative undo" to other peers
    // (that would require a separate, future collaboration-aware
    // undo protocol, explicitly out of scope here)
  }
}
```

This satisfies Design-Principles.md Principle 13 at the Command layer
specifically: collaboration integrates as one more Command Taxonomy row
(Section 4), with zero change to the dispatch/validate/commit pipeline.

## 15. Idempotency and Determinism

- **`execute()` must be deterministic** given the same pre-state and the
  same Command payload — no `Math.random()`, no ambient clock reads inside
  `execute()` itself (any needed "current time" is captured as part of the
  Command's payload at construction time, via an injected clock per
  Design-Principles.md Principle 8). This is what makes Replay (Section 17)
  meaningful at all.
- **Commands are not required to be idempotent under repeated dispatch**
  (dispatching `MoveWidgetCommand(delta: {x: 10, y: 0})` twice moves the
  widget 20px total, correctly) — idempotency is a property some Commands
  may need (e.g., a Collaboration Command applying a remote operation that
  might be redelivered) and is achieved by that specific Command checking
  an included operation ID against already-applied state, not by a
  system-wide idempotency guarantee. This mirrors how idempotency keys are
  used selectively in mutation systems, not applied blanket to every
  mutation [web:171].

## 16. Serialization

Every Command's payload (not its behavior — `execute`/`undo` are code) must
be serializable to plain JSON, because:

- History entries surviving a session (if ever persisted) require it.
- Replay (Section 17) requires it.
- Cross-process dispatch (a Web Worker-hosted Engine, Engine-Lifecycle.md
  Section 11) requires it — a Command constructed on the main thread and
  dispatched into a worker-hosted Engine crosses a serialization boundary.

```typescript
interface SerializedCommand {
  type: string;              // maps back to a registered Command factory
  schemaVersion: number;     // independent versioning axis, like Event-System.md Section 12
  payload: unknown;          // plain JSON
  origin: EventOrigin;
}
```

A **Command Factory Registry** (parallel in spirit to the Widget Registry)
maps `type` strings back to constructors, so a `SerializedCommand` can be
rehydrated into a live `Command` object for replay or worker dispatch.

**Payload migration (added 1.1.0, ADR-0005 §3):** a Command Factory may
register `migrate?(payload: unknown, fromVersion: number): unknown`,
mirroring widget-data migration (Widget-System.md §10). Rehydrating a
`SerializedCommand` whose `schemaVersion` is older than the registered
factory's current version runs the migration chain first — without this,
replaying a persisted command log across engine versions was impossible.

## 17. Replay

Building directly on Event-System.md Section 13: because every committed
Command produces exactly one `DocumentChangedEvent` and Commands are
deterministic (Section 15) and serializable (Section 16), replaying
`[SerializedCommand_1, ..., SerializedCommand_N]` against a known starting
document snapshot deterministically reconstructs the same end state. This
is the same principle underlying command-sourcing/event-sourcing systems
generally [web:148][web:154] — here anchored specifically to Commands
rather than lower-level Store ops, since Commands are the semantically
meaningful unit (a replay debugger shows "user moved widget X," not "field
`transform.x` changed from 10 to 20").

## 18. Command Logging and Observability

The Command Dispatcher exposes a diagnostic stream (mirroring
Event-System.md Section 16's `EventObserver`, but Command-specific and
firing *before* Section 3's validation/commit steps resolve, so failed
Commands are observable too, not just successful ones):

```typescript
interface CommandObserver {
  onDispatched(handler: (cmd: Command) => void): Disposable;
  onCommitted(handler: (cmd: Command, result: unknown) => void): Disposable;
  onFailed(handler: (cmd: Command, error: ValidationError) => void): Disposable;
}
```

This is what powers a development-mode "command log" panel, production
telemetry (e.g., "which Command types are most frequently rejected"), and
debugging AI-generated edits by inspecting exactly which Commands an AI
pipeline produced, in order, with full `EventOrigin` provenance.

## 19. Performance Considerations

- **Merging (`merge()`, Section 5)** is the primary defense against
  history-stack bloat and redundant Transaction/validation cycles during
  high-frequency interactive edits (continuous drag) — this is the same
  mechanism flagged in Engine-Lifecycle.md Section 10.3, owned concretely
  here at the Command contract level.
- **`isNoop()`** lets a Command short-circuit before even entering a
  Transaction (e.g., a resize that ends at the same size it started) —
  cheaper than running full validation on a mutation that changes nothing.
- **Structural sharing** (Domain-Model.md Principle 3) means a Command
  that only touches 2 widgets out of 5,000 produces a cheap, small
  `DocumentChangedEvent` diff regardless of total document size — Command
  cost is proportional to what it touches, not to document size.
- **Macro Commands over many individual dispatches**: an AI pipeline
  inserting 40 widgets should construct one Macro Command, not call
  `dispatch()` 40 times — each `dispatch()` incurs one full validation +
  transaction + event cycle; batching this into one Macro Command
  (Section 6) reduces 40 cycles to 1.

## 20. What This Layer Explicitly Does NOT Do

- Does not know what a `RenderState`, `RenderContext`, DOM element, or
  Canvas is — `TransactionContext` (Section 5) exposes no such types.
- Does not know what a pointer event, keyboard event, or Tool is — it
  receives only already-constructed Command objects; how those objects got
  constructed (from an `InteractionIntent`, from AI, from an importer) is
  entirely upstream of this document's concern.
- Does not decide *when* something should happen from a UI/UX perspective
  — Selection-and-Interaction.md's Tools decide "the user wants to move
  this widget now"; this document only guarantees that once such a
  decision produces a Command, it is applied safely, atomically, and
  observably.
- Does not resolve collaboration conflicts (Section 13) — only fixes the
  seam for where that resolution will plug in.

## 21. Updated Architecture Dependency Graph

```
Vision
    │
Design Principles
    │
Architecture
    │
Engine Lifecycle
    │
    ├─────────────────────────────┐
    │                             │
Domain Model              Rendering Architecture
    │                             │
Widget System          Selection & Interaction
    │                             │
    └─────────────┬───────────────┘
                   │
             Event System
                   │
            Command System   ◄── this document
                   │
           State Management
                   │
   Serialization / Import / Export
                   │
             Collaboration
```

Layer mapping (Section 0) for clarity: this document is the **Commands**
layer, positioned directly beside **Domain** and **Events** as a modular
subsystem the **Runtime** orchestrates — not "inside" any of them.

## 22. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | §2 ADR relocated to adr/ADR-0007; §3/§7 post-validation scoped per ADR-0003; §10 rewritten — gesture previews replace speculative execution; §16 gains command payload migration | ADR-0003, ADR-0005, ADR-0007; Readiness Review C5/M4/M12 |

## 23. Open Questions — Resolution Status (updated 1.1.0)

- `RenderStateDiff` derivation from `DocumentChangedEvent` — **resolved**:
  State-Management.md §5.
- Conflict resolution algorithm inside `ApplyRemoteOperationCommand` —
  still deferred to Collaboration.md (future).
- Persistent Command log storage — still deferred per Principle 7.
- Command Factory Registry registration mechanics — **resolved**:
  registered via `engine.commands` (Developer-SDK.md §11) and exposed to
  plugins as the Commands Extension Point (Plugin-System.md §9); payload
  migration per §16 above.
