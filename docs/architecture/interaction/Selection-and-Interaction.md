# Selection-and-Interaction.md

**Status:** Core — changes require an ADR
**Version:** 1.1.0
**Depends on:** Engine-Lifecycle.md, Rendering-Architecture.md, Widget-System.md
**Precedes (produces the input contract for):** Event-System.md, Command-System.md

---

## 1. Purpose and Placement in the Pipeline

This document defines everything that happens **between raw input arriving
at a renderer and a well-formed `InteractionIntent` being reported to the
Interaction Manager** (Engine-Lifecycle.md Section 6.15). It owns tool
architecture, selection, focus, hover, editing mode, hit-testing, pointer
capture, keyboard interaction, gesture recognition, and the semantics of
drag/resize/rotate/marquee/snap operations.

Revised pipeline (supersedes the simplified version in earlier documents):

```
Raw Input (pointer/keyboard, renderer-captured)
    │
    ▼
Selection & Interaction Layer   ◄── THIS DOCUMENT
    │  (tool state machine, hit-testing, selection/focus/hover models)
    ▼
InteractionIntent (well-formed, semantic)
    │
    ▼
Event System (propagation, subscription, fan-out)
    │
    ▼
Command System (translates intent into mutating Commands)
    │
    ▼
Store → Rendering
```

**Why this layer must exist separately from Event-System.md:** raw pointer
events are not self-describing. A `pointerDown` at coordinate (120, 240)
means "start a marquee selection," "grab a resize handle," "begin drawing a
new shape," or "do nothing (missed everything)" — entirely depending on
which Tool is active, what's currently selected, and what's under the
cursor. This interpretation requires stateful, sequential reasoning (a state
machine), which is a fundamentally different responsibility from
Event-System.md's job of fan-out notification. Collapsing them would force
the generic Event Bus to become tool-aware, which breaks its reusability for
every non-interaction notification (document loaded, transaction committed,
plugin registered) it must also carry.

## 2. Core Architectural Choice: Tools Are Hierarchical State Machines

Following the pattern validated at scale by tldraw's `StateNode` system
[web:138][web:132][web:135], a **Tool** is a state machine node. The active
Tool receives raw input first; nested child states (Idle, Pointing,
Dragging, Resizing) handle progressively more specific stages of an
interaction. This is not an arbitrary implementation choice — it is the
only structure that cleanly answers "what does this pointerDown mean" for
multi-step interactions (drag, resize, marquee) without a tangle of boolean
flags (`isDragging`, `isResizing`, `justClickedHandle`) scattered through a
flat event handler.

```typescript
interface ToolNode {
  id: string;
  initial?: string;                       // required if this node has children
  children?(): ToolNodeConstructor[];
  onEnter?(ctx: ToolContext, info?: unknown): void;
  onExit?(ctx: ToolContext): void;
  onPointerDown?(ctx: ToolContext, e: PointerInputEvent): void;
  onPointerMove?(ctx: ToolContext, e: PointerInputEvent): void;
  onPointerUp?(ctx: ToolContext, e: PointerInputEvent): void;
  onKeyDown?(ctx: ToolContext, e: KeyInputEvent): void;
  onTick?(ctx: ToolContext, e: TickInfo): void;   // for edge-scroll, drag inertia
}
```

Event dispatch walks the active state path root-to-leaf: the top-level Tool
handles the event first, then delegates to its current active child, and so
on, stopping at the first node that produces a transition or explicitly
consumes the event [web:138]. This lets a Tool define shared behavior at a
parent level (e.g., "Escape always returns to Idle") while leaf states
define only what's specific to them.

### Built-in Tools (shipped, not privileged)

`SelectTool`, `PanTool`, `TextEditTool` are shipped as ordinary Tool
implementations using the exact same `ToolNode` contract a third-party
plugin would use to add, e.g., a `ConnectorDrawTool` — consistent with
Design-Principles.md Principle 6 (closed core, open extension).

## 3. InteractionContext and ToolContext

Two distinct context objects are passed into interaction code, with
different scopes:

```typescript
interface InteractionContext {
  // Read-only queries into current state — no mutation methods
  getHitWidgetAt(point: Point): WidgetId | null;
  getWidgetsInRect(rect: Rect): WidgetId[];
  getSelection(): ReadonlySelectionState;
  getHoveredWidget(): WidgetId | null;
  getFocusedWidget(): WidgetId | null;
  getActiveTool(): ToolId;
  getViewport(): { x: number; y: number; zoom: number };
  getSnapCandidates(movingIds: WidgetId[]): SnapGuide[];
}

interface ToolContext extends InteractionContext {
  // Mutation methods scoped to INTERACTION state only — never domain state
  setSelection(ids: WidgetId[]): void;
  setHover(id: WidgetId | null): void;
  setFocus(id: WidgetId | null): void;
  enterEditingMode(id: WidgetId): void;
  exitEditingMode(): void;
  transitionTo(childStateId: string, info?: unknown): void;
  emitIntent(intent: InteractionIntent): void;   // the ONLY way this layer talks to what's downstream
}
```

**Critical boundary:** `ToolContext` can mutate *interaction* state
(selection, hover, focus, active tool) directly and synchronously — none of
that is domain state (Domain-Model.md Section 11 already excludes
selection/focus from the persisted document). It has **no method that
touches the Store**. The only way anything in this layer affects the
document is by calling `emitIntent()`, which hands off to the Interaction
Manager (Engine-Lifecycle.md Section 6.15) — a Tool never dispatches a
Command directly.

## 4. InteractionState — What Persists Across Input Events

```typescript
interface InteractionState {
  activeToolPath: string[];          // e.g. ["select", "dragging"]
  selection: SelectionState;
  hover: WidgetId | null;
  focus: WidgetId | null;
  editingWidgetId: WidgetId | null;
  pointerCapture: { widgetId: WidgetId | null; pointerId: number } | null;
  dragState: DragState | null;       // origin point, current delta, affected widget IDs
  marqueeRect: Rect | null;
  viewports: ReadonlyMap<RendererHandleId, Viewport>;  // added 1.1.0 — the viewport is
                                     // interaction state owned per renderer attachment;
                                     // ownership rules in State-Management.md §7
  preview: PreviewState | null;      // added 1.1.0 — gesture preview overrides,
                                     // State-Management.md §9 (supersedes "optimistic commands")
}
```

`InteractionState` is held by the Selection Manager (Engine-Lifecycle.md
Section 6.7), scoped per `DocumentSession`, and is **entirely ephemeral** —
never serialized, never part of `PresentationDocument`, and reset to
defaults on session disposal. This is a direct continuation of
Domain-Model.md Section 11's decision to exclude this exact information
from the domain model.

## 5. Selection Model

```typescript
interface SelectionState {
  selectedIds: ReadonlySet<WidgetId>;
  primaryId: WidgetId | null;         // the "anchor" of a multi-select, for shift-click extension
  boundingBox: Rect | null;           // derived, cached; recomputed on selection or transform change
}
```

Rules:

- Selection is **session-local** (Section 4) — never shared across two
  renderers attached to the same session unless a future multi-viewport
  design explicitly links them (deferred, Principle 7).
- Selecting a group widget (Widget-System.md Section 8) selects the group
  as one unit by default; entering the group (double-click, or an explicit
  "enter group" gesture) changes `focus` context so subsequent clicks target
  members — this is a `ToolContext.setFocus()` operation, not a special
  Store concept.
- Selection changes are themselves reported as `InteractionIntent` events
  (Section 9) so the Event System can notify UI chrome (e.g., a properties
  panel) without that chrome needing to know about Tools at all.

## 6. Focus Model

`focus` represents "which widget/group is the current context for
interpreting subsequent input" — distinct from `selection` ("what's
highlighted/will be acted on") and from `hover` ("what's under the
pointer right now, acted on for visual feedback only"). A single click
inside an already-selected group changes `focus` to that group without
necessarily changing `selection`. This three-way distinction is what
correctly resolves the common editor ambiguity of "click once to select the
group, click again to select a member inside it."

## 7. Hover Model

`hover` is the cheapest, highest-frequency piece of interaction state
(updates on every `pointerMove`). It is deliberately isolated from
`selection`/`focus` because hover has zero effect on the domain and zero
effect on undo/redo — it exists purely to drive renderer visual feedback
(highlight outlines) via `overlayState` (Rendering-Architecture.md Section
6.1), and is intentionally excluded from `InteractionIntent` reporting
except as a low-priority, coalescable notification (Section 9 —
hover-change intents are the one intent type the Scheduler is explicitly
permitted to drop under load, since missing one hover frame is
imperceptible and never affects correctness).

## 8. Editing Mode

Entering editing mode (double-click into a text widget, pressing Enter on a
focused widget) transitions `editingWidgetId` and calls the widget's own
`WidgetRenderer.onEditStart()` hook (Rendering-Architecture.md Section 10) —
**editing mode is widget-type-specific behavior surfaced through the exact
same plugin contract as rendering**, not a second parallel plugin system.
While in editing mode:

- The active Tool becomes (or delegates to) a mode dedicated to that
  widget's editing needs — e.g., text editing intercepts keyboard input
  differently than the default Select tool would.
- Exiting editing mode (Escape, click elsewhere, blur) calls
  `onEditEnd()` and returns `editingWidgetId` to `null`.
- Any domain mutation that happens *during* editing (each keystroke
  changing text content) still flows through `emitIntent()` →
  Command System, exactly like any other mutation — editing mode changes
  *how intents are generated*, never how they're applied.

## 9. InteractionIntent — The Contract This Document Produces

This finalizes and supersedes the placeholder sketch in
Rendering-Architecture.md Section 7.2 — this document is now the
authoritative owner of this type.

```typescript
type InteractionIntent =
  | { kind: "selectionChanged"; selectedIds: WidgetId[]; primaryId: WidgetId | null }
  | { kind: "hoverChanged"; widgetId: WidgetId | null }              // coalescable, droppable
  | { kind: "focusChanged"; widgetId: WidgetId | null }
  | { kind: "editStart"; widgetId: WidgetId }
  | { kind: "editEnd"; widgetId: WidgetId }
  | { kind: "moveRequested"; widgetIds: WidgetId[]; delta: Vector2 }
  | { kind: "resizeRequested"; widgetId: WidgetId; newTransform: Transform }
  | { kind: "rotateRequested"; widgetId: WidgetId; newRotationDeg: number }
  | { kind: "createRequested"; type: WidgetTypeId; transform: Transform }
  | { kind: "deleteRequested"; widgetIds: WidgetId[] }
  | { kind: "groupRequested"; widgetIds: WidgetId[] }
  | { kind: "textInputRequested"; widgetId: WidgetId; patch: unknown };  // widget-plugin-shaped payload
```

Every intent that names a `*Requested` variant is a **candidate** mutation,
not an executed one — the **Interaction Manager** (Engine-Lifecycle.md
Section 6.15) translates it into zero or more Commands via the Intent
Interpreter Registry (Section 15) and dispatches them; validation and
commit/rollback then belong to the Command pipeline (Command-System.md),
which receives only constructed Commands and never interprets intents
(revised 1.1.0 per ADR-0002 — translation responsibility previously
misattributed to the Command System here). A Tool's responsibility ends at
producing a semantically clear, renderer-agnostic intent; it has no veto
power once it emits, and no knowledge of whether its intent will succeed.
Snapping remains applied by the emitting Tool before emission (Section 12),
never downstream.

## 10. Hit Testing

```typescript
interface HitTestService {
  hitTestPoint(point: Point, pageId: PageId): WidgetId | null;
  hitTestRect(rect: Rect, pageId: PageId): WidgetId[];
}
```

Hit testing is **geometry-only and renderer-agnostic** — it operates purely
on each widget's `Transform` (Domain-Model.md Section 6) in engine units,
never on pixels, DOM nodes, or Canvas draw calls. This is what makes the
same `HitTestService` usable whether the active renderer is DOM, Canvas, or
SSR (which has no pointer input at all, and simply never calls it). A
widget type that needs custom hit-test geometry (e.g., a star shape's
concave hit region) supplies an optional `hitTest(point, transform, data)`
function on its `WidgetDefinition` (amending Widget-System.md as a tracked
follow-up patch); the default is bounding-box hit-testing.

## 11. Pointer Capture

```typescript
interface PointerCaptureService {
  capture(pointerId: number, widgetId: WidgetId | null): void;
  release(pointerId: number): void;
  getCapturedWidget(pointerId: number): WidgetId | null;
}
```

Pointer capture ensures a drag/resize operation continues to receive
`pointerMove`/`pointerUp` events even if the cursor leaves the original
widget's hit region mid-drag — this is a renderer-boundary concern
(actual OS/DOM pointer capture APIs differ per renderer family) but the
*semantic* concept (which logical operation currently owns this pointer
stream) is tracked here, at the interaction layer, so Tool state machines
reason about it uniformly regardless of which renderer is attached.

## 12. Drag / Resize / Rotate / Marquee / Snapping

These are all **Tool-level state machines**, not special engine concepts:

- **Drag (move):** `SelectTool` child states `Idle → PointingWidget →
  Dragging`. `Dragging.onPointerMove` computes a delta, calls
  `ctx.getSnapCandidates()` to adjust the delta against guides, and emits
  `moveRequested` intents continuously (coalesced by the Scheduler,
  Engine-Lifecycle.md Section 10.3) rather than once per pixel.
- **Resize:** a distinct child state entered by pointing at a selection's
  resize handle (itself an overlay-layer hit target, Rendering-Architecture.md
  Section 16 — handles are never part of widget content hit-testing).
- **Rotate:** analogous, entered via a rotate handle.
- **Marquee selection:** `SelectTool` child state entered when
  `pointerDown` misses every widget; accumulates a `marqueeRect` in
  `InteractionState`, calls `getWidgetsInRect()` each move, and emits
  `selectionChanged` continuously for live visual feedback, finalized on
  `pointerUp`.
- **Snapping:** computed by a dedicated `SnappingService` queried via
  `ctx.getSnapCandidates()` — snapping is a **suggestion the active
  drag/resize state may choose to apply to its own delta before emitting an
  intent**; it is never applied downstream by the Command System, keeping
  snapping renderer/interaction-layer logic entirely, not a domain concern.

## 13. Gesture Recognition

Multi-touch/trackpad gestures (pinch-zoom, two-finger pan) are normalized by
the renderer into the same `PointerInputEvent`/dedicated
`GestureInputEvent` shapes before reaching this layer — gesture
*recognition* (distinguishing a pinch from two independent pointers) is a
renderer-family-specific concern (Rendering-Architecture.md Section 4's
boundary table: "how" belongs to the renderer), while gesture
*interpretation* (pinch-zoom changes viewport zoom, which is interaction
state, not domain state) belongs here.

## 14. Keyboard Interaction

Keyboard events reach the currently active Tool state (for
shortcuts/mode-specific keys, e.g., Escape canceling a drag) and,
independently, the currently focused/editing widget (for text input,
routed via `editStart`'s widget-specific handling, Section 8). Global
keyboard shortcuts (Ctrl+C, Ctrl+Z) are registered against the Tool
hierarchy's root state so they're available regardless of active tool,
following the same root-to-leaf dispatch order as pointer events
[web:138].

## 15. How Plugins Participate

A plugin can register a **custom Tool** (e.g., a `ConnectorDrawTool` for a
diagramming product) through the same registration path as a custom widget
(Widget-System.md Section 4's registry pattern, mirrored here as a Tool
Registry). A plugin's Tool:

- Receives the identical `ToolContext` any built-in Tool receives — no
  privileged API exists for first-party tools (Principle 6).
- Can only affect the document by calling `emitIntent()`, exactly like
  `SelectTool` — a plugin Tool has no back door to the Store or Command
  Dispatcher.
- Can introduce new `InteractionIntent` variants (the union in Section 9 is
  open/extensible, not closed) as long as an interpreter for that intent
  kind is registered in the **Intent Interpreter Registry** (below) — an
  unrecognized intent kind is a plugin wiring bug, surfaced loudly
  (Engine-Lifecycle.md Section 9's fail-loud principle), never silently
  dropped.

### The Intent Interpreter Registry (added 1.1.0, ADR-0002)

Owned by the Interaction layer, consumed by the Interaction Manager —
the single intent→Command translation mechanism in the system:

```typescript
interface IntentInterpreterRegistry {
  register(kind: InteractionIntent["kind"],
           interpret: (intent: InteractionIntent, query: DocumentQuery) => Command[]): void;
  unregister(kind: string): void;
  has(kind: string): boolean;
}
```

- Built-in intent kinds (Section 9) ship with built-in interpreters
  registered through this exact API — no privileged path (Principle 6).
- Interpreters are pure: they read current state via `DocumentQuery`
  (State-Management.md §4) and return Commands; they never dispatch,
  never mutate interaction state, never render.
- Registered as a plugin Extension Point (Plugin-System.md Section 9).

## 16. Renderer-Agnosticism

This entire layer depends on renderers only through the normalized input
shapes (`PointerInputEvent`, `KeyInputEvent`, `TickInfo`) that
Rendering-Architecture.md Section 7.2 defines as the renderer's outbound
contract. Nothing in this document references DOM events, Canvas
coordinates, or any renderer-specific type — a `SelectTool` written against
`ToolContext` works identically whether the attached renderer is
`@engine/renderer-dom` or a future `@engine/renderer-canvas`, because both
normalize their native input events into the same shapes before this layer
ever sees them.

## 17. Ticks — Continuous, Non-Input-Driven Updates

Some interaction behavior must update every frame regardless of whether new
input arrived — edge-scrolling the viewport during a drag near the canvas
boundary, or drag-inertia easing. Following the tick pattern already proven
by tldraw (a `tick`/`frame` event fired every `requestAnimationFrame`,
routed through the active state path exactly like pointer events)
[web:145], the Scheduler (Engine-Lifecycle.md Section 6.16) provides an
optional tick source that active Tool states may subscribe to via
`onTick()`. This is the seam Engine-Lifecycle.md Section 10.5 flagged as
forward-looking for animation — ticks are introduced here, now, scoped
strictly to interaction concerns (edge-scroll, drag easing), while a full
timeline/animation *domain* concept remains deferred to Animation-System.md
per Principle 7.

## 18. What This Layer Explicitly Does NOT Do

- Does not mutate the Store, ever, under any circumstance.
- Does not decide validation outcomes (a `moveRequested` intent may be
  rejected downstream by the Command System's validation step — this layer
  has no veto power once it emits an intent, and no knowledge of whether its
  intent will succeed).
- Does not persist anything — `InteractionState` in its entirety is
  disposable and reconstructible from nothing (unlike domain state, there is
  no "recovering" interaction state after a crash; it simply resets, which
  is correct and expected).
- Does not know about export, import, AI, or collaboration — a remote
  collaborator's cursor is rendered as overlay state fed by a *different*
  path entirely (a presence channel, Rendering-Architecture.md Section 13),
  never as this session's own `InteractionState`.

## 19. Updated Architecture Dependency Graph

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
            Command System
                   │
           State Management
                   │
   Serialization / Import / Export
                   │
             Collaboration
```

Selection-and-Interaction.md depends on **both** Domain Model (via Widget
System, for hit-testing/editing-mode plugin hooks) and Rendering
Architecture (for normalized input event shapes) — it is correctly
positioned as a join point before Event System, matching the corrected
pipeline in Section 1.

## 20. Open Questions Deferred to Later Documents

- Exact `SnappingService` guide-computation algorithm — deferred as an
  implementation detail, not architecture, per Principle 7.
- How `InteractionIntent` notifications are transported to observers —
  Event-System.md (transport only; interpretation resolved by ADR-0002).
- How `moveRequested`/`resizeRequested` etc. become concrete Commands —
  **resolved 1.1.0**: the Intent Interpreter Registry (Section 15).
- Multi-cursor-per-session selection semantics — deferred until a real
  product need (e.g., split-screen editing) demands it. (Per-attachment
  viewports are now resolved — State-Management.md §7.)

## 21. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | Intent→Command translation reassigned from "Command System" to the Interaction Manager via the new Intent Interpreter Registry (§9, §15); `InteractionState` gains `viewports` and `preview`; `ReadonlyOverlayState` shape delivered via State-Management.md §8 | ADR-0002; Readiness Review C1/M4/M6 |
