# Domain-Model.md

**Status:** Core — changes require an ADR
**Version:** 1.1.0
**Depends on:** Vision.md, Design-Principles.md, Ordering-Strategy.md

---

## 1. Purpose

This document defines the authoritative data model for the Presentation
Domain Engine. Every renderer, exporter, importer, AI generator, and
collaboration layer reads and writes exclusively through the shapes defined
here. No other document may introduce a competing representation of
document state.

## 2. Design Constraints Recap

From Design-Principles.md, this model must be:

- **Normalized** (Principle 3) — flat, ID-keyed maps, never nested trees.
- **Engine-native units** (Principle 5) — no EMU, no CSS px, no PDF points.
- **Collaboration-shaped** (Principle 13) — fractional-index ordering
  (Ordering-Strategy.md), atomic compound attributes.
- **Deterministic** (Principle 8) — no embedded timestamps-as-truth, no
  implicit randomness; IDs are injected, not `Math.random()`-generated
  inline.
- **Versioned** (Principle 9) — every document declares `schemaVersion`.

## 3. Top-Level Structure

```typescript
interface PresentationDocument {
  id: EntityId;
  schemaVersion: number;                    // Principle 9 — starts at 1
  metadata: DocumentMetadata;
  canvas: CanvasConfig;                     // logical size, unit, default page size
  assets: Record<AssetId, Asset>;           // content-addressed, flat map
  themes: Record<ThemeId, Theme>;
  widgetDefinitionRefs: WidgetTypeId[];     // which plugins this doc depends on
  pages: Record<PageId, Page>;              // flat map, NOT an array
  pageOrder: string[];                      // DERIVED cache — see below; never serialized
  widgets: Record<WidgetId, WidgetInstance>; // flat map, ALL widgets, ALL pages
}

interface DocumentMetadata {
  title: string;
  createdAt: string;   // ISO 8601 — informational only, never used for ordering/logic
  updatedAt: string;
  locale?: string;
  custom?: Record<string, unknown>;   // escape hatch for consuming app metadata
}

interface CanvasConfig {
  unit: "engine-unit";        // Principle 5 — always this, adapters convert
  defaultPageSize: { width: number; height: number };
  defaultPageOrientation: "landscape" | "portrait";
}
```

### Why `pageOrder` is a separate array of IDs, not derived from `Page.order`

We store both `Page.order` (fractional index string, for O(1) insert/move)
*and* maintain `pageOrder` as a cached, sorted array of IDs for O(1) read
access in the hot path (rendering, iteration). `pageOrder` is a **derived
cache**, not a second source of truth — it is recomputed by the core
whenever any `Page.order` changes, via a single internal `resortPages()`
call, and is never mutated directly by any adapter or command. This mirrors
how normalized stores commonly pair a fractional-index field with a
maintained sort cache to avoid re-sorting on every render.

**Derived caches are runtime-only** (amended 1.1.0, aligning with
Serialization.md §4): `pageOrder` and `Page.widgetOrder` are excluded from
the canonical serialized form and rebuilt by the Store during hydration
(State-Management.md §3). The interfaces here describe the *live in-memory*
shape; the persisted shape is these interfaces minus the derived caches.

## 4. Page

```typescript
interface Page {
  id: PageId;
  order: string;                 // fractional index — see Ordering-Strategy.md
  name: string;
  size: { width: number; height: number };   // overrides CanvasConfig default
  background: Background;
  widgetOrder: string[];         // DERIVED cache: TOP-LEVEL widgets only (parentId === null),
                                 // sorted by order. Container members are a separate derived
                                 // cache per container (State-Management.md §3). Never serialized.
  layoutRef?: LayoutId;          // optional — see Layout-System.md (future doc)
  notes?: string;
  hidden?: boolean;
}

type Background =
  | { type: "color"; color: ColorValue }
  | { type: "gradient"; stops: { offset: number; color: ColorValue }[]; angle: number }
  | { type: "asset"; assetId: AssetId; fit: "cover" | "contain" | "tile" }
  | { type: "none" };
```

`Page` is deliberately generic — not `Slide`. A whiteboard product's "page"
is an infinite-canvas viewport bookmark; a resume builder's "page" is a
printable sheet. The name reflects the engine's product-agnostic vocabulary
per Vision.md.

## 5. Widget — The Core Extensibility Point

```typescript
interface WidgetInstance {
  id: WidgetId;
  pageId: PageId;                // which page this widget lives on
  parentId: WidgetId | null;     // for grouping — flat reference, never nested containment
  order: string;                 // fractional index within its page (or within parent group)
  type: WidgetTypeId;            // registered plugin key, e.g. "text", "image", "chart"
  dataVersion: number;           // the widget plugin's own data-shape version at write time
                                 // (Widget-System.md §3/§10 — follow-up patch applied in 1.1.0)
  transform: Transform;
  data: unknown;                 // shape owned entirely by the widget plugin, NOT the core
  constraints?: LayoutConstraints;
  locked?: boolean;
  hidden?: boolean;
  name?: string;                 // user-facing label, distinct from type
}
```

### Why `data: unknown`

The core engine has zero knowledge of what a "chart" or "sticky note" is
(Design-Principles.md Principle 6). The widget plugin that registers type
`"chart"` owns:

- The TypeScript type of `data` (the plugin exports its own typed accessor).
- A JSON Schema (or equivalent runtime validator) the core uses generically
  to validate `data` on write, without understanding its contents.
- Migration functions for its own `data` shape across the widget's own
  internal versions (independent of `schemaVersion` on the document).

This is the mechanism that lets a text widget, a chart widget, and a future
third-party "signature-field" widget (for a document-builder product) all be
first-class, with the core never special-casing any of them.

### Why `parentId` instead of nested `children`

Grouping ("these three widgets move together") is expressed as a flat
parent reference, exactly like pages reference no container and widgets
reference their page. A group is simply a `WidgetInstance` whose `type` is
the built-in `"group"` type, and its members are ordinary widgets whose
`parentId` points to the group's `id`. This keeps every widget, grouped or
not, in the exact same flat `widgets` map with the exact same access pattern
— no separate tree-walking logic for grouped vs. ungrouped widgets anywhere
in the core.

## 6. Transform — Engine-Native Geometry

```typescript
interface Transform {
  x: number;          // engine units, top-left origin of the page
  y: number;
  width: number;
  height: number;
  rotation: number;   // degrees, clockwise, NOT OOXML's 60,000ths-of-a-degree
  scaleX?: number;    // default 1 — independent of width/height for stroke-preserving scale
  scaleY?: number;
  opacity: number;    // 0–1, NOT OOXML's 0–100000
}
```

Engine units are an abstract number line — not pixels, not EMU, not points.
Adapters own the conversion: the DOM renderer picks a px-per-unit scale
factor for the viewport; the PPTX exporter multiplies by the EMU
conversion constant; the PDF exporter converts to points. The core never
performs a unit conversion internally — if a core function needs to compare
or combine transforms, it operates purely in engine units.

## 7. Color and Style Primitives

```typescript
type ColorValue =
  | { type: "static"; value: string }        // engine-native color string (hex/rgba), resolved
  | { type: "theme"; token: ThemeColorToken }; // indirection through the active Theme

type ThemeColorToken = string;   // theme-defined, not a closed enum (Theme-System.md owns this)
```

Colors are never hardcoded as a single flat hex type at the widget-data
level for anything that should respond to theme switching — the same
lesson OOXML's `schemeClr` indirection teaches, applied without adopting
OOXML's structure. Widget plugins choose per-field whether a given style
property accepts a `ColorValue` (theme-aware) or a plain resolved string
(intentionally theme-independent, e.g., a brand logo's fixed color).

## 8. Asset

```typescript
interface Asset {
  id: AssetId;
  kind: "image" | "video" | "audio" | "font" | "other";
  source: AssetSource;
  metadata: {
    width?: number; height?: number;
    durationMs?: number;
    mimeType: string;
    sizeBytes?: number;
    checksum?: string;      // content-addressing — enables dedup across documents
  };
}

type AssetSource =
  | { type: "url"; url: string }              // externally hosted, engine does not fetch
  | { type: "dataUri"; data: string }         // small inline assets (icons, tiny images)
  | { type: "reference"; providerKey: string; providerId: string };
    // opaque handle into a host application's asset store — see Asset-System.md
```

The engine never uploads, downloads, or transforms binary asset data itself
(Design-Principles.md Principle 11 — no I/O in the core). It stores
*references* to assets. The host application (or an adapter) resolves an
`AssetSource` into actual bytes when rendering or exporting. This is what
keeps the core deployable in a Node worker, a browser tab, or a CLI tool
identically.

## 9. Theme

```typescript
interface Theme {
  id: ThemeId;
  name: string;
  colorTokens: Record<ThemeColorToken, string>;   // token name -> resolved color
  typography: {
    fontFamilies: Record<string, string>;          // token -> font family string
    scale: Record<string, number>;                 // e.g. "heading-1" -> 32
  };
  spacingUnit: number;   // base spacing unit in engine units, widgets reference multiples
}
```

Full theme cascading/inheritance rules belong in Theme-System.md (a later
document) — this section only fixes the *shape* referenced by
`ColorValue.theme` and by any widget's typography fields, so that document
is not designing against a moving target.

## 10. Entity ID Strategy

```typescript
type EntityId = string;   // opaque; format is an implementation detail
type PageId = EntityId;
type WidgetId = EntityId;
type AssetId = EntityId;
type ThemeId = EntityId;
type WidgetTypeId = string;   // plugin-registered key, e.g. "text" — NOT a UUID
```

IDs are generated via an **injected ID generator function**, never a direct
`crypto.randomUUID()` call scattered through core logic (Principle 8 —
determinism and testability: tests inject a sequential/mock generator; a
future collaborative backend can inject a coordinated ID scheme without
touching call sites).

## 11. What Is Deliberately Absent From This Model

- **No z-index integer field.** Paint order is derived entirely from
  `widgetOrder` (fractional-index-sorted). A separate z-index would be a
  second, potentially contradictory source of truth for stacking order.
- **No `selected` or `isEditing` flags on entities.** Selection and
  transient UI/editing state are session-local, never persisted domain
  state — they live in a separate ephemeral store (see
  Selection-and-Interaction.md), because persisting "what's selected" into
  the document that's exported to PPTX or shared with a collaborator makes
  no sense.
- **No `history` or `undoStack` field.** Undo/redo state is a property of an
  editing *session*, not of the document (see Command-System.md). Two
  different sessions editing the same document do not share undo stacks.
- **No layout/flex/grid computed positions cached on the widget.** If a
  future Layout-System.md introduces constraint-based or flow layout, the
  *computed* transform is always derived fresh from constraints, never
  persisted as if it were an independent source of truth alongside
  `transform`.

## 12. Validation Boundary

The core provides one generic validation entry point:

```typescript
function validateDocument(doc: PresentationDocument, registry: WidgetRegistry): ValidationResult
```

This function checks *structural* invariants the core owns (all
`pageId`/`parentId`/`widgetOrder` references resolve to real entities, no
orphaned widgets, `schemaVersion` is known) and delegates `data` validation
to each widget's plugin-supplied validator via the registry, without ever
inspecting `data` contents itself. A malformed chart's internal data shape
is a widget-plugin validation failure, not a core validation failure — this
boundary is what lets the core stay genuinely ignorant of widget internals
while the document as a whole is still fully validated.

## 13. Example: Minimal Valid Document (canonical serialized form —

derived caches `pageOrder`/`widgetOrder` are absent, rebuilt on load)

```json
{
  "id": "doc_1",
  "schemaVersion": 1,
  "metadata": { "title": "Untitled", "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z" },
  "canvas": { "unit": "engine-unit", "defaultPageSize": { "width": 1280, "height": 720 }, "defaultPageOrientation": "landscape" },
  "assets": {},
  "themes": {},
  "widgetDefinitionRefs": ["text"],
  "pages": {
    "page_1": {
      "id": "page_1",
      "order": "a0",
      "name": "Page 1",
      "size": { "width": 1280, "height": 720 },
      "background": { "type": "color", "color": { "type": "static", "value": "#ffffff" } }
    }
  },
  "widgets": {
    "widget_1": {
      "id": "widget_1",
      "pageId": "page_1",
      "parentId": null,
      "order": "a0",
      "type": "text",
      "dataVersion": 1,
      "transform": { "x": 100, "y": 100, "width": 400, "height": 80, "rotation": 0, "opacity": 1 },
      "data": { "runs": [{ "text": "Hello, Presentation Engine.", "bold": false }] }
    }
  }
}
```

## 14. Open Questions Deferred to Later Documents

- Exact plugin registration API for `WidgetTypeId` → validator/renderer
  binding — Widget-System.md.
- Group widget semantics (does a group have its own `transform`, or is it
  purely computed from children's bounds?) — Widget-System.md.
- Layout constraint resolution order when both `constraints` and an explicit
  `transform` are present — Layout-System.md.
- Theme inheritance/override cascading — Theme-System.md.
- Exact command shapes that mutate this model — Command-System.md.

## 15. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial version | N/A |
| 1.1.0 | Added `WidgetInstance.dataVersion` (applying Widget-System.md §10's tracked follow-up patch); declared `pageOrder`/`Page.widgetOrder` runtime-only derived caches excluded from serialization; scoped `widgetOrder` to top-level widgets; example updated accordingly | Readiness Review M1/M2; Serialization.md §4 alignment |
