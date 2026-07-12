# Event-System.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11; Section 0 below is the historical first statement of that process)
**Version:** 1.1.0
**Depends on:** Engine-Lifecycle.md, Selection-and-Interaction.md, Domain-Model.md

---

## 0. Governance Notice (applies to ALL architecture documents from this point forward)

Starting with this document, every architecture document is **versioned and
frozen upon finalization**. No document may be silently edited after it is
finalized. Any required change must take one of four forms:

1. **ADR** — a new Architecture Decision Record when a decision is reversed
   or superseded.
2. **Amendment Proposal** — a proposed addition/change to a finalized
   document, reviewed before acceptance.
3. **Follow-up Patch** — a small, explicitly tracked addition previously
   flagged by another document (e.g., Widget-System.md's deferred
   `hitTest()` hook, flagged in Selection-and-Interaction.md Section 10).
4. **Version Changelog entry** — recorded against the document once an
   Amendment Proposal or Follow-up Patch is accepted, bumping its version
   number.

A document is only changed after its corresponding Amendment/Patch is
**explicitly accepted** — this document itself will follow that process
going forward. (Amended 1.1.0: the **canonical** statement of this process
now lives in Architecture-Index.md §11, with ADRs stored in
`docs/architecture/adr/`; this section is preserved as the historically
primary statement and is no longer the reference target for new documents.)

---

## 1. Purpose

This document defines the **semantic event architecture** of the
Presentation Engine — how meaningfully-typed events are transported safely,
predictably, and extensibly across every runtime service defined in
Engine-Lifecycle.md. It is explicitly **not** a pub/sub API specification;
the transport mechanism (an `Emitter`/`Disposable` pattern, Section 6) is
almost incidental compared to the taxonomy, ownership, and guarantees this
document establishes.

**This layer never interprets intent, never mutates document state, and
never renders UI.** Those responsibilities belong to Selection-and-Interaction.md,
Command-System.md, and Rendering-Architecture.md respectively (Selection-and-
Interaction.md Section 1 already establishes this exact division). The Event
System's sole job is safe, ordered, observable transport.

## 2. Event Taxonomy

Every event in the system belongs to exactly one of the following
categories. Category membership determines ownership, propagation rules,
and who is permitted to emit into it.

| Category | Origin | Example | Who May Emit |
| --- | --- | --- | --- |
| **Native Platform Events** | OS/browser, captured by a renderer | raw `pointerdown`, `keydown`, `wheel`, `touchstart` | Renderer adapters only — never reach the Event System directly (Section 3) |
| **Interaction Events** | Selection-and-Interaction.md's Tool state machines | `selectionChanged`, `moveRequested`, `editStart` | Interaction Manager only, via `ToolContext.emitIntent()` |
| **Engine Events** | Core runtime services (Engine-Lifecycle.md Section 6) | `sessionCreated`, `pluginRegistered`, `rendererAttached` | The owning service only (e.g., Plugin Registry emits `pluginRegistered`) |
| **Document Events** | Transaction Manager, after a committed mutation | `documentChanged`, `widgetAdded`, `widgetRemoved`, `pageReordered` | Transaction Manager exclusively — this is the ONE category that may never be emitted by anything else, since it represents committed domain truth |
| **Renderer Events** | A specific attached renderer instance | `renderComplete`, `renderError`, `viewportChanged` | The emitting renderer's own handle only |
| **Plugin Events** | Plugin-defined, namespaced | `myPlugin:exportStarted` | Any registered plugin, strictly within its own declared namespace |
| **Lifecycle Events** | Engine/DocumentSession construction and disposal | `engineDisposing`, `sessionDisposed` | Lifecycle Manager only |
| **Collaboration Events** *(future)* | `@engine/collab` | `remoteOperationApplied`, `peerJoined` | The collaboration adapter only — see Section 14 |
| **AI-Generated Events** *(future)* | External AI pipeline, via Command Dispatcher | `aiGenerationCommitted` | Emitted only as a Document Event consequence — AI has no separate event category of its own; see Section 15 |

**Critical structural rule:** a category is not a permission grant, it is a
liability boundary. If an event does not fit one of these categories
precisely, it is a design smell in whatever is trying to emit it, not a gap
in this taxonomy to be patched with a new catch-all category.

## 3. Native Platform Events Never Enter the Event System

This is the most important boundary in this document. Raw pointer/keyboard/
wheel/touch events are captured and normalized entirely within
Rendering-Architecture.md's renderer boundary and Selection-and-Interaction.md's
Tool layer (`PointerInputEvent`, `KeyInputEvent` — Selection-and-Interaction.md
Section 16). **They never appear on the Event Bus.** Only the *semantic
outcome* of processing them — an `InteractionIntent`, subsequently an Engine
or Document event — is transported here. This is what prevents the Event
System from becoming, as you put it, "a traditional pub/sub bus" that
degenerates into carrying raw DOM events with no semantic meaning.

## 4. Event Ownership

Every event type has exactly one owning service, determined by its category
(Section 2's rightmost column). Ownership means:

- Only the owner may construct and emit that event type.
- Only the owner defines that event type's payload shape and any future
  versioning of it (Section 12).
- Subscribers never assume they can emit an event of a type they don't own,
  even for testing convenience — test doubles substitute the owning
  service, they do not fake emission from arbitrary call sites.

This mirrors VS Code's pattern where an `Emitter<T>` is a private field
owned by exactly one class, which exposes only the read-only `Event<T>`
subscription surface publicly — external code can listen but never fire the
event itself [web:149][web:150].

## 5. Event Propagation Model

There is **no bubbling or capturing** in the DOM sense anywhere in this
system, by design. DOM-style bubbling implies events traverse a containment
hierarchy, which conflicts directly with Domain-Model.md Principle 3
(normalize, never nest — there is no containment hierarchy to bubble
through). Instead:

- **Engine/Document/Lifecycle/Renderer/Plugin events propagate by flat
  fan-out**: every event is emitted once, to a single named channel, and
  every subscriber of that channel receives it directly — no
  parent/child traversal, no `stopPropagation()` semantics.
- **Interaction Events already resolved their "bubbling" equivalent inside
  the Tool state machine** (Selection-and-Interaction.md Section 2's
  root-to-leaf dispatch) *before* they ever reach the Event System — by the
  time an Interaction Event is emitted here, propagation is already
  finished, not in progress.

This flat model is deliberately simpler than DOM propagation because the
domain model it serves has no nesting to justify the complexity.

## 6. Transport Mechanism: Emitter + Disposable

The transport primitive is a typed `Emitter<T>` paired with a `Disposable`
subscription handle, following VS Code's proven pattern for resource-safe
event management [web:147][web:149][web:150]:

```typescript
interface Emitter<T> {
  readonly event: Event<T>;             // public, listen-only surface
  fire(payload: T): void;               // private to the owning service
  dispose(): void;
}

type Event<T> = (listener: (payload: T) => void) => Disposable;

interface Disposable {
  dispose(): void;
}
```

Every subscription returns a `Disposable`. Every service that subscribes to
events internally aggregates its own subscriptions' `Disposable`s and
releases them all during its own disposal (Engine-Lifecycle.md Section 4.7)
— this is what prevents the single most common event-system bug class: a
disposed service whose stale listeners keep firing against a Store that no
longer exists. A `DocumentSession.dispose()` call, concretely, disposes
every Emitter subscription that session's internal services created,
transitively.

## 7. Synchronous vs. Asynchronous Events

| Category | Delivery | Why |
| --- | --- | --- |
| Document Events | **Synchronous**, within the same call stack as the Transaction commit | Renderers must never observe a Store in a state between "committed" and "notified" — a subscriber reacting to `documentChanged` must see the exact Store version the event describes, guaranteed (Engine-Lifecycle.md Section 3's closed loop depends on this) |
| Interaction Events | **Synchronous** | Selection/hover must feel instantaneous; async delivery here would reintroduce the exact input-lag problem retained-mode rendering is designed to avoid |
| Engine/Lifecycle Events | **Synchronous** | Construction/disposal ordering guarantees (Engine-Lifecycle.md Section 5) require deterministic, immediate delivery |
| Renderer Events | **Synchronous, per-renderer** | A `renderComplete` event must correspond exactly to the render pass that just finished |
| Plugin Events | **Synchronous by default**, may declare `async: true` | A plugin may legitimately want to notify listeners after an async operation (e.g., "asset upload finished") — this is opt-in per event type, never a system-wide default |
| Collaboration Events *(future)* | **Asynchronous**, always | Inherently network-bound; explicitly the one category permitted to be async from day one |
| AI-Generated Events | **N/A — not a distinct category** | See Section 15; surfaces only as a synchronous Document Event once committed |

**Rule:** synchronous is the default and must be justified to deviate from
— asynchronous delivery is an explicit, documented exception per event type,
never an implementation convenience.

## 8. Event Batching and Transaction Boundaries

This section directly extends Engine-Lifecycle.md Section 10.2 (batched
updates). A `dispatchBatch()` call that runs N Commands through one
Transaction produces **exactly one `documentChanged` Document Event**, not
N — the Transaction Manager is the sole point where the "one commit, one
event" guarantee is enforced, carrying a diff describing everything that
changed (Rendering-Architecture.md Section 12's `RenderStateDiff` is derived
directly from this single event's payload, never from N separate events).

```typescript
interface DocumentChangedEvent {
  transactionId: string;
  changedWidgetIds: ReadonlySet<WidgetId>;
  addedWidgetIds: ReadonlySet<WidgetId>;
  removedWidgetIds: ReadonlySet<WidgetId>;
  changedPageIds: ReadonlySet<PageId>;
  causedBy: EventOrigin;   // Section 9
  documentVersion: number;
}
```

**Transaction boundary rule:** no Document Event of any kind may be emitted
*during* a Transaction's execution — only after it commits (success) or not
at all (rollback, Engine-Lifecycle.md Section 9). This guarantees a
subscriber never observes a partially-applied batch.

**Reentrancy rule (added 1.1.0):** a listener reacting to a synchronous
Document Event may call `dispatch()`, but the dispatched Command is
**enqueued FIFO and executed after the current commit-and-notify cycle
completes** — never reentrantly, never nested into the open transaction.
Full semantics (run-to-empty processing, cycle depth limit) in
State-Management.md §10.

## 9. Event Ordering Guarantees

- **Within one Emitter/channel**, listeners are invoked in registration
  order — deterministic, never re-ordered by priority unless the channel
  explicitly supports priority tiers (Section 10).
- **Across channels**, the only ordering guarantee is causal: if event B was
  caused by event A (e.g., a `documentChanged` caused by a `moveRequested`
  Interaction Event), A is fully delivered to all its listeners before B is
  emitted. This causal chain is tracked via an `EventOrigin`:

```typescript
interface EventOrigin {
  triggeringEventId?: string;    // links back to the causing event, if any
  source: "interaction" | "command" | "plugin" | "import" | "ai" | "collab" | "system";
  sessionId: string;
}
```

`EventOrigin` is what makes Event Replay (Section 13) and Observability
(Section 16) possible — every event carries enough provenance to reconstruct
*why* it happened, not just *that* it happened.

## 10. Event Cancellation and Priority

Only **Interaction Events**, while still inside the Tool state machine
(i.e., before `emitIntent()` is called), support cancellation — this is
Selection-and-Interaction.md's domain (a Tool can decide not to emit an
intent at all). Once an event is emitted onto the Event System proper, **it
is not cancellable** — the Event System transports facts, and a fact that
already happened (a Transaction committed, a plugin registered) cannot be
retracted by a listener.

This is a deliberate rejection of DOM-style `preventDefault()`/
`stopPropagation()` semantics at this layer: allowing arbitrary listeners to
cancel a `documentChanged` event after the Transaction already committed
would violate the atomicity guarantee Engine-Lifecycle.md Section 6.4
establishes as non-negotiable.

**Priority** exists only as an optional tier for **Plugin Events** and
**Renderer Events**, where multiple independent listeners may need
deterministic ordering among themselves (e.g., a logging plugin wanting to
observe an event before a UI-updating plugin does):

```typescript
interface SubscribeOptions {
  priority?: "high" | "normal" | "low";   // default "normal"; ties broken by registration order
}
```

Document/Engine/Lifecycle events have no priority concept — their listener
order is registration order, period, because introducing priority there
would make core runtime behavior implicitly reorderable by consumers, which
this architecture treats as a correctness risk, not a feature.

## 11. Plugin Interception

Plugins may **observe** any event category they have visibility into
(Document, Engine, Renderer, Lifecycle — never raw Native Platform Events,
per Section 3), but may **never intercept-and-suppress** a core event the
way a DOM event listener can call `stopPropagation()`. A plugin that wants
to influence outcome, not just observe, must do so **upstream** — e.g., by
contributing a widget validator (Widget-System.md) that rejects invalid
data before a Transaction ever commits, or a custom Tool
(Selection-and-Interaction.md Section 15) that chooses not to emit an
intent. This is a deliberate architectural constraint: **plugins affect the
future by participating earlier in the pipeline, never the past by
intercepting an event already in flight** — a rule that keeps plugin
behavior predictable regardless of plugin load order.

## 12. Event Versioning

Every event payload type declares a `schemaVersion` independent of
`PresentationDocument.schemaVersion` (Domain-Model.md Section 9) and
independent of any widget's `dataVersion` (Widget-System.md Section 10) —
this is a third, deliberately separate versioning axis, because event
payload shapes evolve on their own timeline (e.g., adding a field to
`DocumentChangedEvent` doesn't require a document migration).

```typescript
interface VersionedEvent<T> {
  schemaVersion: number;
  payload: T;
}
```

Consumers (notably Event Replay and Collaboration, once built) are expected
to handle multiple `schemaVersion`s of the same event type gracefully —
event schema changes are additive-by-default (Design-Principles.md
Principle 12) and breaking changes require an ADR exactly like any other
core contract.

## 13. Event Replay

Because every Document Event carries `EventOrigin` and a `documentVersion`
(Section 8, Section 9), the engine can support **replaying** a sequence of
Document Events against a known starting document snapshot to reconstruct
any intermediate state — the same principle underlying event-sourced
systems and CRDT operation logs, where the event/operation log itself
becomes a durable, replayable asset independent of the current-state
snapshot [web:148][web:154][web:155].

This is not implemented as a persistent requirement in the MVP (persisting
every event indefinitely is a hosting-application decision, not a core
obligation — Principle 11), but the **shape** of every Document Event is
designed to be replay-safe from day one:

- Deterministic given the pre-event Store state (no hidden randomness — ties
  back to Principle 8).
- Self-contained enough that replaying `[event1, event2, ..., eventN]` in
  order against snapshot S produces the identical Store state as the live
  system did.

Replay is what will later power: session-recording/debugging, undo/redo
across a restart (if ever needed beyond in-memory History Manager), and
audit trails for AI-generated changes (Section 15).

## 14. Collaboration Events — Designed Now, Built Later

Per Design-Principles.md Principle 13 and Engine-Lifecycle.md Section 10.6,
collaboration must slot into this event architecture without changing it.
Concretely:

- A remote peer's operation arrives via the (future) `@engine/collab`
  adapter, gets validated and applied through the **same** Transaction
  Manager path any local edit uses (Engine-Lifecycle.md Section 3's closed
  loop), and therefore produces an ordinary `DocumentChangedEvent` with
  `EventOrigin.source: "collab"` — indistinguishable in shape from a local
  edit's event, differing only in provenance.
- `peerJoined`/`peerLeft`/remote cursor presence are modeled as their own
  **Collaboration Events** category (Section 2), explicitly *not* as
  Document Events — presence is not domain state (this echoes
  Rendering-Architecture.md Section 13's decision that remote cursors are
  overlay state, never `WidgetInstance`s).
- Collaboration Events are the one category architecturally permitted to be
  asynchronous by default (Section 7), since they are inherently
  network-bound — this is declared now so no future ADR is needed simply to
  permit async delivery for this category.

## 15. AI-Generated Events — Not a Separate Pipeline

AI has no privileged event category. Per Engine-Lifecycle.md Section 8, an
AI pipeline is just another Command Dispatcher caller. Consequently, its
effects surface purely as ordinary `DocumentChangedEvent`s with
`EventOrigin.source: "ai"` — this is the only AI-specific hook this entire
Event System needs, and it exists solely so downstream consumers (an
activity log UI, an audit trail) can filter/label AI-caused changes,
never so AI gets a different mutation or notification pathway than a human
editing directly.

## 16. Event Logging and Observability

The Event System exposes a **read-only diagnostic subscription** — distinct
from ordinary application subscriptions — that receives every event across
every category, tagged with `EventOrigin` and timestamp, for:

- **Debugging** — a development-mode overlay that visualizes the live event
  stream (which Document Events fired, from which Interaction Event, from
  which Tool state).
- **Observability** — production telemetry hooks (e.g., counting
  `documentChanged` frequency, detecting abnormal event storms from a
  misbehaving plugin).

```typescript
interface EventObserver {
  onAnyEvent(handler: (envelope: EventEnvelope) => void): Disposable;
}

interface EventEnvelope {
  category: EventCategory;          // Section 2
  type: string;
  schemaVersion: number;
  origin: EventOrigin;
  timestamp: number;
  payload: unknown;
}
```

This diagnostic path is strictly **read-only and side-effect-free by
contract** — an `EventObserver` handler that attempts to mutate the Store or
re-emit events is a misuse of the API, not a supported pattern; observability
must never become a second control-flow mechanism.

## 17. What This Layer Explicitly Does NOT Do

- Does not interpret what a `moveRequested` Interaction Event *means* for
  the document — translation is the Interaction Manager's job via the
  Intent Interpreter Registry (ADR-0002, Selection-and-Interaction.md §15),
  and it happens **before** anything reaches this layer. Interaction Events
  on the bus are *notifications for observers* (property panels,
  telemetry); the Event System is never part of the mutation path.
  (Corrected 1.1.0 — the previous wording implied delivery to the Command
  Dispatcher, contradicting Section 2's rule that the bus never carries
  mutation requests.)
- Does not decide validation outcomes, does not touch the Store, does not
  render anything (restated from Section 1 — non-negotiable).
- Does not provide a generic "send arbitrary data between any two services"
  escape hatch — every event must belong to one of Section 2's taxonomy
  categories with a single, documented owner. An event that doesn't fit is
  a signal to revisit the taxonomy via an Amendment Proposal (Section 0),
  not to add an ungoverned side channel.

## 18. Updated Architecture Dependency Graph

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
             Event System   ◄── this document
                   │
            Command System
                   │
           State Management
                   │
   Serialization / Import / Export
                   │
             Collaboration
```

No change to the graph shape — Event System's position is confirmed exactly
where Selection-and-Interaction.md Section 19 placed it.

## 19. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | Governance canonical statement relocated to Architecture-Index.md §11 (header citation of nonexistent "Document-Governance.md" fixed); §8 reentrancy rule added; §17 corrected — the bus is never part of the mutation path (intent translation belongs to the Interaction Manager, ADR-0002) | ADR-0002; Readiness Review C1/M9/M10 |

## 20. Open Questions — Resolution Status (updated 1.1.0)

- Command Dispatcher subscription to Interaction Events — **resolved,
  dissolved**: there is no such subscription; the mutation path is direct
  (Interaction Manager → Dispatcher, ADR-0002).
- `RenderStateDiff` construction from `DocumentChangedEvent` payload detail
  — **resolved**: State-Management.md §5.
- Persistent event log storage strategy (if/when replay becomes a shipped
  feature, not just an architectural capability) — deferred entirely per
  Principle 7, no document currently owns this.
