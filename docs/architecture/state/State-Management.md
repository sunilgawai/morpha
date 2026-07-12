# State-Management.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.0.0
**Depends on:** Domain-Model.md, Widget-System.md, Engine-Lifecycle.md,
Event-System.md, Command-System.md
**Resolves:** the mechanics deferred by Rendering-Architecture.md §19,
Event-System.md §20, Command-System.md §23, and Serialization.md §21;
plus Readiness Review C3, M4 (optimistic preview), M6 (viewport/overlay
ownership), M9 (reentrancy).

---

## 1. Purpose

This document formalizes the Store's public contract: how document
versions are represented, how reads happen (`DocumentQuery`), how a
committed Transaction's change set becomes a `DocumentChangedEvent` and a
`RenderStateDiff`, how `RenderState` is composed, what the reentrancy
rules are, and how optimistic interaction previews work without violating
the one-Store-one-truth rule.

## 2. Store Versioning Model

The Store holds an **immutable, structurally shared** document value:

- Every committed Transaction produces a new `PresentationDocument` value
  and increments an integer `documentVersion` (monotonic per
  `DocumentSession`, carried on `DocumentChangedEvent`,
  Event-System.md §8).
- Entities untouched by a transaction keep **reference identity** across
  versions — this is the structural-sharing guarantee
  Rendering-Architecture.md §12 relies on for reference-equality change
  checks, now stated as a contract: *an entity's object reference changes
  if and only if that entity was written in a committed transaction.*
- The Store retains only the current version. Historical versions exist
  only as (a) captured undo state inside Commands (Command-System.md §11)
  and (b) Snapshots (Serialization.md §12). The Store is not an archive.

## 3. Derived Order Caches

The Store owns and maintains the derived caches Domain-Model.md declares
(`pageOrder`, `Page.widgetOrder`, group member order):

- Recomputed within the committing transaction whenever a relevant
  `order`/`parentId`/`pageId` field changes — subscribers never observe a
  version whose caches are stale.
- `Page.widgetOrder` contains **top-level widgets only**
  (`parentId === null`), sorted by `order`. Each container widget's member
  order is a separate derived cache keyed by container id, sorted by the
  members' `order` fields. Paint order is the depth-first traversal:
  top-level order, descending into containers at the container's position.
- None of these caches appear in the canonical serialized form
  (Serialization.md §4); all are rebuilt during Store hydration.

## 4. DocumentQuery — the Read Model

The single read surface every consumer uses (renderers via `RenderState`,
Tools via `InteractionContext`, AI providers, exporters, intent
interpreters):

```typescript
interface DocumentQuery {
  getDocument(): Readonly<PresentationDocument>;   // current version, immutable
  getWidget(id: WidgetId): Readonly<WidgetInstance> | undefined;
  getPage(id: PageId): Readonly<Page> | undefined;
  getPageWidgets(id: PageId): ReadonlyArray<Readonly<WidgetInstance>>; // paint order
  getChildren(containerId: WidgetId): ReadonlyArray<Readonly<WidgetInstance>>;
  getDocumentVersion(): number;
}
```

`DocumentQuery` is exposed as `session.store` in the SDK
(Developer-SDK.md §3) and as the `query` argument to intent interpreters
(ADR-0002). It has no mutation methods; it is the only sanctioned way to
read domain state outside a `TransactionContext`.

## 5. Change Tracking → DocumentChangedEvent → RenderStateDiff

The Transaction Manager records, per transaction, the sets of
created/patched/deleted entity IDs as a side effect of
`TransactionContext` primitive calls — **no diffing pass ever runs**;
change tracking is write-time bookkeeping, O(writes).

Derivation chain (each step is a projection of the previous, computed
once per commit):

```
TransactionContext write log
   → ChangeSet {added, changed, removed} × {widgets, pages, assets, themes}
      → DocumentChangedEvent            (Event-System.md §8 — ChangeSet + version + origin)
         → RenderStateDiff              (Rendering-Architecture.md §12 — ChangeSet
                                          restricted to render-relevant entities,
                                          plus selectionChanged/viewportChanged flags
                                          contributed by the interaction layer)
         → IncrementalSaveOp            (Serialization.md §13 — ChangeSet plus the
                                          changed entities' new values as the patch,
                                          and removed IDs as explicit removals)
```

`RenderStateDiff` and `IncrementalSaveOp` are therefore restrictions and
enrichments of one ChangeSet, never independently computed — this is the
"one commit, one event" guarantee (Event-System.md §8) extended to every
downstream diff consumer.

## 6. RenderState Composition

`RenderState` (Rendering-Architecture.md §6.1) is composed per attached
renderer handle, on each relevant change, from three independently owned
inputs:

| Slice | Owner | Changes when |
| --- | --- | --- |
| `documentSnapshot` | Store (`DocumentQuery`) | a transaction commits |
| `selection`, `overlayState` | Interaction layer (Selection-and-Interaction.md §4, §5) | interaction state mutates |
| `viewport` | Interaction layer, **per renderer attachment** (Section 7) | pan/zoom |

The runtime recomposes `RenderState` and calls `handle.update(state,
diff)` when any slice changes; unchanged slices keep reference identity so
renderers can skip work per slice.

## 7. Viewport Ownership

The viewport is **interaction state, owned per renderer attachment**:

- Each attached `RendererHandle` has exactly one `Viewport { x, y, zoom }`,
  held in the session's `InteractionState.viewports` map keyed by handle
  id. Two renderers attached to one session (editor + minimap) have
  independent viewports by default; linking them is application logic.
- Tools mutate the *active* viewport via `ToolContext` (pinch-zoom,
  edge-scroll); renderers never mutate viewport — a renderer that wants a
  viewport change (e.g., scroll input) reports normalized input like any
  other input, and a Tool decides.
- The Renderer Event `viewportChanged` (Event-System.md §2) is a
  *notification that a new viewport was painted*, not a mutation channel.
- Non-interactive renderers (SSR, export) receive a caller-supplied fixed
  viewport at attach time.

## 8. Overlay State

`ReadonlyOverlayState` (deferred by Rendering-Architecture.md §19) is
produced by the interaction layer:

```typescript
interface ReadonlyOverlayState {
  marqueeRect: Rect | null;
  snapGuides: ReadonlyArray<SnapGuide>;
  handles: ReadonlyArray<HandleDescriptor>;   // resize/rotate handles for current selection
  editingWidgetId: WidgetId | null;
  presence: ReadonlyArray<PresenceOverlay>;   // remote cursors/selections — fed by a
                                              // collaboration provider, empty otherwise
  preview: PreviewState | null;               // Section 9
}
```

`presence` is the seam Rendering-Architecture.md §13 promised: a
collaboration provider writes presence overlays through a dedicated
interaction-layer API, never through widgets or the Store.

## 9. Interaction Preview State (supersedes "Optimistic Commands")

Command-System.md §10's "speculatively apply `execute()` against a local
disposable preview" is replaced. There is no speculative Command
execution anywhere:

- During a continuous gesture (drag/resize/rotate), the active Tool
  maintains a `PreviewState` in interaction state: the affected widget IDs
  plus a **transform override map** (`Map<WidgetId, Transform>`).
- `PreviewState` rides into `RenderState.overlayState.preview`; renderers
  paint affected widgets at their overridden transforms. The Store is
  untouched; no Command exists yet.
- On gesture end, the Tool emits the final intent; the Interaction Manager
  translates and dispatches the real Command; on commit the preview is
  cleared (the committed state and the preview coincide visually). On
  validation failure the preview is cleared and the renderer naturally
  reverts to confirmed Store state — no rollback machinery needed.
- Continuous mid-gesture intents (Engine-Lifecycle.md §10.3's merged
  commands) remain supported for tools that want live commits instead of
  preview; the two strategies are per-Tool choices, both legal.

This preserves ADR-0007 exactly: the Store has one door, and previews are
ephemeral overlay data, disposable like all interaction state.

## 10. Reentrancy and Dispatch Queueing

Document Events deliver synchronously in the commit call stack
(Event-System.md §7). Rules:

1. **Dispatching from within event delivery is legal but deferred.** A
   `dispatch()` call made while a transaction is committing or while
   Document Event listeners are running is **enqueued FIFO** on the
   Command Dispatcher and executed after the current commit-and-notify
   cycle completes. It is never executed reentrantly and never nested
   into the open transaction.
2. **Writes are impossible outside a transaction** by construction
   (`TransactionContext` is the only write surface), so listener code
   cannot corrupt the Store even in principle — the queue rule exists for
   ordering determinism, not safety.
3. **Queue processing is run-to-empty**: enqueued commands execute in
   order, each producing its own transaction and event, before control
   returns to the original `dispatch()` caller. A cycle (listener A
   dispatches → event → listener A dispatches …) trips a configurable
   depth limit and fails loudly (Engine-Lifecycle.md §9).
4. Event Replay and Web Worker message-driven dispatch use the same queue
   — there is exactly one ordering mechanism.

## 11. Cross-Entity Invariant Trigger Index (ADR-0003 support)

The Validation Pipeline maintains an index from trigger descriptors
(entity kind × operation, e.g., `widget:delete`, `widget:reparent`) to
registered cross-entity invariants (core and plugin-contributed,
Plugin-System.md §9.1). Post-execution validation evaluates only the
invariants whose triggers intersect the transaction's ChangeSet
(Section 5), passing them the ChangeSet and `DocumentQuery`.

## 12. What This Layer Explicitly Does NOT Do

- Does not decide *what* to mutate (Commands) or *when* (Tools/callers).
- Does not render, and holds no renderer-family-specific types —
  `RenderStateDiff` is ID sets and flags, not draw calls.
- Does not persist — it produces the ChangeSet that Serialization.md §13
  consumes; writing bytes is a storage provider's job.
- Does not own selection/hover/focus/viewport *policy* — it composes those
  slices into `RenderState`; the interaction layer owns their values.

## 13. Version Changelog

| Version | Change | Reason |
|---|---|---|
| 1.0.0 | Initial finalized version | Fills the gap flagged Critical by Architecture-Index.md §12 and the Readiness Review (C3) |
