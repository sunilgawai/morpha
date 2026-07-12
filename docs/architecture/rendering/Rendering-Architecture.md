# Rendering-Architecture.md

**Status:** Core — changes require an ADR
**Version:** 1.1.0
**Depends on:** Domain-Model.md, Widget-System.md, Design-Principles.md

---

## 1. Purpose

This document defines the complete rendering pipeline and draws the hard
architectural boundary between the Presentation Domain (retained, stateful,
authoritative) and every renderer (projected, disposable, stateless with
respect to business logic). It defines interfaces and responsibilities, not
implementations — concrete renderers (`@engine/renderer-dom`, etc.) are
separate packages that conform to the contracts here.

## 2. The Governing Model: Retained Scene, Immediate Projection

The engine is a **retained-mode system**: the Presentation Domain Model
(Domain-Model.md) is the persistent scene graph, held in memory (or storage)
independent of whether anything is currently rendering it. Renderers are
**projectors** — on each render pass, a renderer reads the current domain
state and produces a visual output, then may discard everything it built
[web:111][web:100].

This is the same relationship a retained-mode graphics API has to its
immediate-mode drawing calls: the library keeps the model; the draw layer
regenerates output from that model on demand and never becomes a second
place where "what does this widget look like" is decided
[web:111][web:105]. Concretely:

- If every renderer were destroyed and rebuilt from scratch this millisecond,
  the domain model would still contain 100% of the user's work (this is
  Design-Principles.md Principle 1, restated for rendering specifically).
- A renderer is permitted to cache derived visual artifacts (a rasterized
  bitmap, a DOM node, a WebGL vertex buffer) purely as a performance
  optimization, never as a place where domain truth is decided or where
  state that outlives the render pass is authoritative.

## 3. What a Renderer Is

A **Renderer** is an adapter that:

1. Subscribes to read-only projections of domain state (a `RenderState`,
   defined in Section 6).
2. Translates each visible `WidgetInstance` into concrete visual output
   using that widget's `WidgetDefinition.render()` (Widget-System.md
   Section 6).
3. Reports interaction intent (pointer events, resize drags) upward through
   the Event System (Event-System.md) — a renderer never resolves what an
   interaction *means* for the domain, only that an interaction occurred at
   a point in space.
4. Owns its own internal, disposable state (DOM nodes, canvas draw calls,
   WebGL buffers, PDF page content) with no lifetime obligations to the
   engine.

A renderer is not a single monolithic thing — "the React DOM renderer," "the
Canvas renderer," and "the PDF export renderer" are three independent
implementations of the same `RendererAdapter` contract (Section 5), coexisting
without the core knowing how many renderers exist or which ones are active.

## 4. Explicit Responsibility Boundary

| Belongs to the Renderer | Explicitly Does NOT Belong to the Renderer |
| --- | --- |
| Converting engine units to target units (px, EMU, points) | Deciding what a widget's data means |
| Painting pixels / DOM nodes / vector output | Validating widget data (Widget-System.md owns this) |
| Hit-testing for its own visual representation | Deciding what happens when a widget is clicked (Event-System.md decides) |
| Reporting raw interaction events upward | Mutating domain state directly (Command-System.md owns all mutation) |
| Caching/memoizing its own visual artifacts | Persisting anything that survives a page reload |
| Rendering overlays (selection, guides) as a separate visual layer | Deciding *which* widgets are selected (Selection-and-Interaction.md owns this) |
| Virtualizing what it chooses to paint | Deciding business rules about what's "visible" in a business sense (e.g., hidden vs. locked semantics live in the domain model) |
| Providing accessibility tree hints for its own output | Defining what accessible label a widget should present (widget plugin's job) |

The single sentence version: **a renderer answers "how does this look,"
never "what does this mean" or "what should happen next."**

## 5. The RendererAdapter Contract

This is the **single canonical `RendererAdapter` contract** (ADR-0004) —
the Developer SDK exposes exactly this shape, never a variant.

```typescript
interface RendererAdapter {
  id: string;   // registry key, e.g. "presentation.renderer-dom" (added 1.1.0, ADR-0004)
  mount(target: RenderTarget, initialState: RenderState): RendererHandle;
}

interface RendererHandle {
  update(state: RenderState, diff: RenderStateDiff): void;
  unmount(): void;
  dispose(): void;
  // Adapter-specific capability negotiation — see Section 13
  capabilities: RendererCapabilities;
}
```

`RenderTarget` is intentionally opaque at this contract level — a DOM
element for `@engine/renderer-dom`, a `CanvasRenderingContext2D` for
`@engine/renderer-canvas`, a headless buffer for `@engine/renderer-ssr`, or
nothing at all for a pure PDF-generation adapter that writes directly to a
file stream. The core and the Event/Command layers never inspect
`RenderTarget` — only the specific renderer package that owns a given
target type does.

## 6. RenderState, RenderContext, and RenderNode

These three concepts have distinct, non-overlapping responsibilities and
must not be conflated.

### 6.1 RenderState — "what should currently be shown"

```typescript
interface RenderState {
  documentSnapshot: ReadonlyDocumentView;   // read-only projection of PresentationDocument
  visiblePageId: PageId;                    // or multiple, for scroll-stacked layouts
  viewport: { x: number; y: number; zoom: number };
  selection: ReadonlySelectionState;        // from Selection-and-Interaction.md — read-only here
  overlayState: ReadonlyOverlayState;       // guides, snap lines, marquee — also read-only here
}
```

`RenderState` is the **single input** a renderer receives per frame/update.
It is a pure, immutable snapshot — the renderer never mutates it, never
holds a reference to live engine internals, and cannot distinguish "this
came from a live editing session" from "this came from a static exported
document being previewed." This uniformity is what allows the same
`RendererAdapter` contract to serve live editing and static server-side
rendering identically.

### 6.2 RenderContext — "what a single widget's render call receives"

```typescript
interface RenderContext<TData> {
  widget: Readonly<WidgetInstance & { data: TData }>;
  transform: Readonly<Transform>;           // already resolved, engine units
  theme: Readonly<Theme>;                   // resolved, not a ThemeId reference
  viewportZoom: number;                     // for LOD decisions (Section 11)
  isEditing: boolean;                       // from Selection-and-Interaction.md, read-only
  reportInput: (event: PointerInputEvent | KeyInputEvent) => void;
  // outbound-only normalized input scoped to this widget (renamed from
  // reportInteraction in 1.1.0, ADR-0002) — a widget's render output never
  // produces InteractionIntents; it forwards normalized input, and the
  // active Tool decides what it means.
}
```

This fulfills the contract Widget-System.md Section 6 deferred. Notice it
contains no method for the widget's render function to mutate anything —
`reportInput` is fire-and-forget outward communication, not a callback
that returns a mutation result.

### 6.3 RenderNode — "what a widget's render call produces"

```typescript
type RenderNode =
  | { kind: "dom"; element: unknown }         // renderer-specific (e.g., React element, HTMLElement)
  | { kind: "canvas-draw"; paint: (ctx: unknown) => void }
  | { kind: "svg"; markup: string }
  | { kind: "composite"; children: RenderNode[] };
```

`RenderNode` is intentionally a loose union rather than one concrete type,
because different renderer families produce fundamentally different output
shapes. A `WidgetDefinition.render()` implementation is typically written
**per renderer family** (a widget author ships a DOM render function and,
optionally, a Canvas render function) — the core widget contract
(Widget-System.md) only requires that *at least one* renderer family is
supported; graceful fallback (e.g., render a static thumbnail) is expected
for renderer families a widget hasn't implemented.

## 7. Information Flow

### 7.1 Downward (Engine → Renderer)

```
PresentationDocument (domain, retained)
        │
        ▼  (read-only projection, computed by core on each relevant change)
   RenderState
        │
        ▼  (renderer decomposes into per-widget calls)
   RenderContext<TData>  (one per visible widget)
        │
        ▼  (widget's own render function, via WidgetDefinition)
   RenderNode
        │
        ▼  (renderer-specific composition into actual output)
   Painted pixels / DOM tree / SVG string / PDF bytes
```

### 7.2 Upward (Renderer → Engine)

Renderers never call engine mutation methods directly. All upward
communication is **normalized raw input**, not an interpreted action
(revised in 1.1.0 per ADR-0002 — renderers do NOT produce
`InteractionIntent`s; that type is owned by Selection-and-Interaction.md
Section 9 and produced only by Tools):

```typescript
type PointerInputEvent =
  | { kind: "pointerDown"; point: Point; pointerId: number; modifiers: Modifiers }
  | { kind: "pointerMove"; point: Point; pointerId: number; modifiers: Modifiers }
  | { kind: "pointerUp"; point: Point; pointerId: number; modifiers: Modifiers }
  | { kind: "doubleClick"; point: Point; modifiers: Modifiers };

type KeyInputEvent = { kind: "keyDown" | "keyUp"; key: string; modifiers: Modifiers };
```

Points are already converted to engine units by the renderer (the one
unit conversion renderers own, Section 4). These events flow to the
Interaction Manager, which routes them through the active Tool state
machine (Selection-and-Interaction.md Section 2); Tools emit semantic
`InteractionIntent`s, and the Interaction Manager translates those into
Commands via the Intent Interpreter Registry (ADR-0002). A renderer
reporting a `pointerDown` has no idea whether that will result in a
selection change, a drag-start, or nothing at all — that interpretation is
explicitly not the renderer's job, per Section 4's boundary table. The
Event System transports only *notifications* of interaction events for
observers; it is never in the mutation path and never interprets
(Event-System.md Section 1).

## 8. Statelessness With Respect to Business Logic

A renderer may hold implementation-private state (a memoized DOM node, a
cached glyph atlas, a dirty-rectangle list) but must satisfy this invariant:

> **No business-meaningful fact can be reconstructed only from renderer
> state.** If a fact (widget position, selection, document content) matters
> to anything other than "how do I redraw efficiently," it must be readable
> from `RenderState`/the domain model, never solely from a renderer's
> internal cache.

This is what allows a renderer to be swapped, restarted, or run twice in
parallel (e.g., a visible editor render plus a hidden thumbnail render) with
no coordination between the two instances beyond both reading the same
domain state.

## 9. Multiple Renderers Coexisting Without Core Changes

Because every renderer implements the identical `RendererAdapter` contract
and receives the identical `RenderState` shape, the following all work
without any change to `@engine/core`:

- A live browser session running `@engine/renderer-dom` for interactive
  editing.
- The same document simultaneously rendered by `@engine/renderer-canvas` in
  a "presentation mode" view for performance.
- A server process running `@engine/renderer-ssr` to generate a thumbnail
  PNG for a dashboard listing, with zero DOM, zero browser.
- A `@engine/export-pdf` adapter that is architecturally a renderer (it
  turns `RenderState` into `RenderNode`s) composed with a PDF-writing target
  instead of a screen target.

Adding a WebGL renderer later for a whiteboard product with thousands of
freehand strokes requires only a new package implementing
`RendererAdapter` — no change to Domain-Model.md, Widget-System.md, or the
core's render-state projection logic.

## 10. Widget Rendering Lifecycle

```
mount    — widget enters the visible set (scrolled into view, or document just loaded)
update   — widget's data, transform, or theme resolution changed since last render
unmount  — widget leaves the visible set (scrolled out, virtualized away)
dispose  — widget is deleted from the document entirely
```

```typescript
interface WidgetRenderer<TData> {
  mount(ctx: RenderContext<TData>): RenderNode;
  update(ctx: RenderContext<TData>, prevData: TData): RenderNode;
  unmount(ctx: RenderContext<TData>): void;   // renderer cleans up its own cached artifacts
  dispose?(ctx: RenderContext<TData>): void;  // widget-specific teardown, e.g. revoke a blob URL
  onEditStart?(ctx: RenderContext<TData>): void;  // editing-mode hooks (merged in 1.1.0 from
  onEditEnd?(ctx: RenderContext<TData>): void;    // Widget-System.md §6's sketch — this is now
                                                  // the single canonical WidgetRenderer shape,
                                                  // called per Selection-and-Interaction.md §8)
}
```

`unmount` and `dispose` are distinct: a widget virtualized out of view
unmounts (its DOM node is removed, but it may return) while a widget the
user actually deleted disposes (any retained resources like object URLs or
GPU textures are released permanently). Conflating these two causes memory
leaks in exactly the virtualization scenario Section 11 describes.

## 11. Virtualization for Large Presentations

Virtualization is a **renderer-owned optimization**, not a domain concept.
The domain model has no notion of "which pages are currently rendered" —
that would violate Principle 1 (no renderer-only fact should have
business meaning) in reverse: rendering facts must not leak into the domain
either.

Recommended (renderer-internal) strategy, consistent with the existing
SaaS's already-validated approach:

- Renderer maintains its own "active render window" (e.g., current page ±1)
  based on `RenderState.viewport` and `visiblePageId`.
- Pages/widgets outside the window are either unmounted entirely or
  represented by a cached static snapshot (a previously rendered
  thumbnail/bitmap) that the renderer generated and owns.
- The engine's job is limited to making `RenderState` cheap to compute
  incrementally (via `RenderStateDiff`, Section 12) so a renderer *can*
  cheaply decide "nothing in my window changed, skip repaint" — the engine
  does not decide virtualization policy itself.

## 12. Optimizing for Thousands of Widgets

Two engine-level guarantees make renderer-side optimization possible without
engine changes:

1. **`RenderStateDiff`** — the engine computes and passes a diff (which
   widget IDs changed, which are unchanged) alongside full `RenderState`, so
   a renderer never has to deep-compare thousands of widgets itself to find
   what changed.

```typescript
interface RenderStateDiff {
  changedWidgetIds: ReadonlySet<WidgetId>;
  addedWidgetIds: ReadonlySet<WidgetId>;
  removedWidgetIds: ReadonlySet<WidgetId>;
  selectionChanged: boolean;
  viewportChanged: boolean;
}
```

1. **Structural sharing** — because the domain model is normalized
  (Domain-Model.md Principle 3), an unchanged widget's object reference is
  literally identical across two document versions. Renderers can use
  reference equality as a cheap "did this widget change" check without the
  engine computing a diff at all, as a fallback for renderer families that
  don't consume `RenderStateDiff`.

Beyond this, level-of-detail decisions (e.g., "don't render a chart's
internal data points below a certain zoom, show a placeholder instead") are
entirely a widget-render-function decision, informed by `viewportZoom` in
`RenderContext` (Section 6.2) — the core has no opinion on LOD thresholds.

## 13. Rendering and Collaboration — Without Becoming Collaboration-Aware

Rendering has zero knowledge of whether a document is being edited by one
person or fifty. This works because:

- `RenderState.documentSnapshot` is already a point-in-time read-only
  projection, regardless of *why* it changed (local edit, remote peer's
  edit, or command replay during undo).
- Collaboration (a future `@engine/collab` package) is responsible for
  merging remote operations into the same domain model local edits go
  through — by the time a renderer sees `RenderState`, there is no
  distinction between "this widget moved because I dragged it" and "this
  widget moved because a collaborator dragged it."
- Remote presence (cursors, selection highlights of other users) is modeled
  as `overlayState` (Section 6.1), not as a special case of widget
  rendering — a remote cursor is an overlay, never a `WidgetInstance`.

This is the direct payoff of Design-Principles.md Principle 13: because
ordering and mutation were already collaboration-shaped in the domain model,
the renderer never needed a "collaboration mode."

## 14. Forward Compatibility With Animation/Timeline Systems

`RenderState` and `RenderContext` are deliberately silent about time and
animation in this version — no `currentTime` or `timeline` field exists yet
(Principle 7: earn abstractions). The seam is documented so
Animation-System.md, when written, can extend `RenderState` additively
(e.g., an optional `playbackTime` field) without redefining the pipeline
described here. A widget render function that wants to support animation in
the future will consume that additive field the same way it consumes
`viewportZoom` today.

## 15. Accessibility

Accessibility is a **renderer-family-specific responsibility**, because the
correct technique differs entirely by output target:

- `@engine/renderer-dom` can render real semantic DOM elements or ARIA
  attributes directly, since DOM is natively accessible to screen readers.
- `@engine/renderer-canvas` must maintain a **parallel accessibility tree**
  — an off-screen DOM structure kept in sync with canvas painting purely for
  assistive technology, since a `<canvas>` bitmap exposes nothing to screen
  readers on its own [web:113][web:112].
- Static export renderers (PDF, SSR thumbnails) are not interactive and so
  accessibility there means correct document structure/tagging in the
  output format itself (e.g., tagged PDF), not runtime ARIA.

The engine's only obligation is that `WidgetDefinition` allows a widget
author to supply an accessible label/role hint (Widget-System.md,
`exportHints` or a dedicated `a11y` field, to be finalized when this is
actually implemented) — the core does not implement any accessibility
technique itself, per Principle 6.

## 16. Overlays Are a Separate Render Pass From Content

Selection boxes, resize handles, alignment guides, snap indicators, and
in-progress connector-drawing previews are never mixed into a widget's own
`RenderNode`. They are rendered as a distinct **overlay layer**, composited
on top of content, driven by `RenderState.overlayState` and
`RenderState.selection` — both explicitly read-only inputs a renderer
consumes, never something a widget's own render function produces.

```
Render pass order (every renderer family):
  1. Background (Page.background)
  2. Content layer  — all visible WidgetInstances, in widgetOrder
  3. Overlay layer  — selection, handles, guides, remote cursors, marquee
```

This separation is why deleting every overlay-related renderer feature
(e.g., temporarily disabling selection UI for a read-only viewer mode) never
touches widget content rendering logic — they are architecturally
independent passes, not intertwined conditionals inside widget rendering.

## 17. Server-Side / Export Renderers Are Renderers, Not a Special Case

A server-side thumbnail generator and a PDF exporter both implement
`RendererAdapter` exactly like the interactive DOM renderer — the only
differences are: no interaction intents are ever reported upward (there is
no pointer), and `RenderTarget` is a buffer/file stream instead of a
viewport. This is deliberate: it means export/SSR renderers automatically
benefit from every widget's existing `render()` implementation and every
future optimization to `RenderState` computation, rather than requiring a
parallel "export-only" rendering code path that can drift out of sync with
the interactive one.

## 18. Renderer Capability Negotiation

Not every renderer family supports every feature (a static SSR renderer
has no concept of "resize handles"; a PDF exporter has no concept of
"hover state"). Rather than the core assuming feature parity:

```typescript
interface RendererCapabilities {
  interactive: boolean;       // can report InteractionIntents at all
  supportsOverlays: boolean;
  supportsAnimation: boolean; // reserved, unused until Animation-System.md
}
```

Consumers of a renderer (e.g., an editor shell deciding whether to show a
"resize" cursor) check capabilities rather than assuming every
`RendererAdapter` behaves identically — this is what lets a lightweight
preview renderer exist alongside a full interactive one without either
implementing dead code paths for features they'll never support.

## 19. Open Questions — Resolution Status (updated 1.1.0)

- Exact shape of `overlayState` — **resolved**: State-Management.md §8.
  `selection` — **resolved**: Selection-and-Interaction.md §5.
- How normalized input gets interpreted into tool-specific behavior —
  **resolved**: Selection-and-Interaction.md §2 + ADR-0002.
- How `RenderStateDiff` is efficiently computed without a full document
  diff — **resolved**: State-Management.md §5 (write-time change tracking).
- Concrete `a11y` field on `WidgetDefinition` — still deferred until a real
  widget needs it, per Principle 7.
- Text metrics for widget rendering — governed by ADR-0006: renderers paint
  text but never measure it authoritatively; the injected `TextMeasurer` is
  the single metrics source across renderer families and exporters.

## 20. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial version | N/A |
| 1.1.0 | `RendererAdapter` gains `id` and is declared the single canonical contract; §7.2 corrected — renderers emit normalized input, not intents, and the Event System is not in the mutation path; `RenderContext.reportInteraction` → `reportInput`; `WidgetRenderer` merged with edit hooks; §19 updated | ADR-0002, ADR-0004, ADR-0006; Readiness Review C1/C4/M8 |
