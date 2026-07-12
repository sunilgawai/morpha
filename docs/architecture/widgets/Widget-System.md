# Widget-System.md

**Status:** Core — changes require an ADR
**Version:** 1.1.0
**Depends on:** Domain-Model.md, Design-Principles.md

---

## 1. Purpose

This document defines the plugin contract through which every widget type —
text, image, chart, connector, a future third-party signature field — is
registered, validated, rendered, and mutated, without the core engine ever
having built-in knowledge of any specific widget type. This resolves the
open question deferred by Domain-Model.md Section 14.

## 2. Core Insight: Separate Data From Behavior

Following the pattern proven at scale by tldraw's `ShapeUtil` system, a
widget type is split into two things that never merge:

1. **Data** — the plain, serializable `data: unknown` payload stored inside
   a `WidgetInstance` (Domain-Model.md Section 5). This is what persists,
   syncs, and serializes.
2. **Behavior** — a `WidgetDefinition` object registered with the engine at
   runtime, which defines how that data is validated, rendered, edited, and
   migrated. Behavior is never persisted — it is code, supplied by whichever
   package (core, first-party, or third-party) registers it [web:92].

This split is what lets the core validate document structure generically
(Domain-Model.md Section 12) while remaining completely ignorant of what
"chart data" or "sticky note data" actually contains.

## 3. The WidgetDefinition Contract

```typescript
interface WidgetDefinition<TData = unknown> {
  type: WidgetTypeId;                 // unique registration key, e.g. "text"
  version: number;                    // widget's OWN data-shape version, independent of document schemaVersion

  // ---- Data lifecycle ----
  createDefaultData(): TData;
  validate(data: unknown): ValidationResult;
  migrate?(data: unknown, fromVersion: number): TData;

  // ---- Geometry defaults ----
  getDefaultSize(): { width: number; height: number };
  getMinSize?(): { width: number; height: number };
  getAspectRatioLock?(): boolean;

  // ---- Hit testing (follow-up patch applied in 1.1.0, flagged by
  //      Selection-and-Interaction.md Section 10) ----
  hitTest?(point: Point, transform: Transform, data: TData): boolean;
  // Optional custom hit-test geometry (e.g., a star's concave region).
  // Geometry-only, engine units, renderer-agnostic. Default: bounding box.

  // ---- Behavior flags ----
  canEdit?(data: TData): boolean;      // does double-click enter an edit mode?
  canResize?: boolean;
  canRotate?: boolean;
  isContainer?: boolean;               // can other widgets be parented under this one?

  // ---- Rendering & interaction handoff (adapter-facing, NOT core-facing) ----
  // The core NEVER calls rendering methods directly — see Section 6.
  render?: WidgetRenderer<TData>;      // supplied per rendering adapter, optional at registration

  // ---- Export/import hints (optional, format adapters may consult) ----
  exportHints?: Record<string, unknown>;
}
```

### Why `version` is separate from `PresentationDocument.schemaVersion`

A widget's internal data shape evolves independently of the document
envelope. Adding a `letterSpacing` field to the Text widget's data is a
Text-widget-version bump, not a document schema bump — the document
structure (pages, widgets map, ordering) hasn't changed at all. Conflating
these two version numbers would force every widget author to coordinate
releases with the core, which violates Principle 6 (closed core, open
extension).

## 4. The Widget Registry

```typescript
interface WidgetRegistry {
  register<TData>(definition: WidgetDefinition<TData>): void;
  unregister(type: WidgetTypeId): void;
  get(type: WidgetTypeId): WidgetDefinition | undefined;
  has(type: WidgetTypeId): boolean;
  list(): WidgetDefinition[];
}
```

The registry is a plain object owned by an `Engine` instance, not a global
singleton — this is deliberate. Multiple engine instances (e.g., server-side
export worker and browser editor session) must be able to register
different widget sets without interfering with each other, and tests must be
able to construct a registry with only the widgets under test.

**Registration is idempotent-checked, not silent-overwrite.** Registering a
`type` that already exists throws by default (`registry.register(def, {
override: true })` opts into replacement). This prevents a subtle
class of bugs where two plugins accidentally claim the same type key and one
silently shadows the other.

## 5. First-Party Widgets Are Not Privileged

The engine ships a small set of reference widgets (`text`, `image`, `rect`,
`group`) implemented via this exact same `WidgetDefinition` contract, with
no special-cased core logic. This is the compliance test for Principle 6: if
the shipped Text widget requires even one core code path that a third-party
widget couldn't also use, the contract is incomplete and must be fixed
before shipping.

First-party widgets live in `@engine/widgets-base` (see
Package-Structure.md), a package the core does not depend on — an
application can use `@engine/core` with zero built-in widgets and register
only its own.

## 6. Rendering Is Explicitly Out of the Core's Call Path

The core's job is limited to: storing `WidgetInstance` records, running
`validate()`, calling `migrate()`, and exposing widgets to whatever reads the
store. The core **never calls** `render()` itself. Rendering adapters
(`@engine/renderer-dom`, `@engine/renderer-canvas`) own the responsibility of
looking up a widget's definition and invoking its renderer.

```
Core:      WidgetInstance { type: "chart", data: {...} }  ─── stored, validated
                        │
                        ▼ (read-only subscription)
Renderer Adapter:  registry.get("chart").render(data, transform, context)
```

This mirrors tldraw's separation where `ShapeUtil` classes are consulted by
the React-based renderer, not by the underlying record store itself
[web:92][web:85] — the store doesn't know rendering exists.

### Renderer Interface (owned by Rendering-Architecture.md, sketched here for contract completeness)

```typescript
interface WidgetRenderer<TData> {
  render(ctx: RenderContext<TData>): RenderOutput;   // shape TBD in Rendering-Architecture.md
  onEditStart?(ctx: RenderContext<TData>): void;
  onEditEnd?(ctx: RenderContext<TData>): void;
}
```

This interface is intentionally left underspecified here — full definition
belongs in Rendering-Architecture.md, once we've validated it against at
least the Text widget's real editing lifecycle (Principle 7 — earn
abstractions).

## 7. Widget Creation Flow

```
1. Application calls engine.createWidget({ type: "chart", pageId, transform? })
2. Core looks up WidgetDefinition for "chart" in the registry
   → not found: throws UnknownWidgetTypeError (fail loud, never silently no-op)
3. Core calls definition.createDefaultData() if no `data` override supplied
4. Core calls definition.getDefaultSize() if no `transform` override supplied
5. Core validates the assembled data via definition.validate()
   → invalid: throws InvalidWidgetDataError; no Command is ever constructed
   (pre-validation before execution — Command-System.md Section 3 step 3,
   ordering corrected in 1.1.0; validation never runs after commit)
6. Core wraps this in a CreateWidgetCommand (see Command-System.md)
   and dispatches it — widget is added to `widgets` map with an `order`
   key from generateKeyBetween(lastKey, null); the Store recomputes the
   derived `page.widgetOrder` cache within the same transaction
```

Every widget enters the document through this exact same path — there is no
special-cased "insert text" vs. "insert chart" logic in the core; the only
difference is which `WidgetDefinition` is looked up.

**Clarification (1.1.0):** widget definitions never construct or dispatch
Commands themselves — a `WidgetDefinition` is data-lifecycle hooks plus
render/hit-test functions only. Mutations affecting a widget originate from
Tools/intents (Selection-and-Interaction.md) or application code, never
from inside the widget contract. (This also removes the unsanctioned
`presentation-widget-api → presentation-commands` package dependency —
Package-Structure.md 1.1.0.)

## 8. Groups Are Widgets, Not a Separate Concept

A "group" is simply a `WidgetInstance` whose `type` is the first-party
`"group"` widget, with `isContainer: true`. Other widgets become members by
setting their `parentId` to the group's `id` (Domain-Model.md Section 5).

**Deferred question resolved:** does a group have its own `transform`, or is
it computed from children? — **Decision:** a group has a real, stored
`transform`, computed once at group-creation time as the bounding box of its
members, and thereafter treated as authoritative like any other widget's
transform. Moving/resizing the group applies a derived delta to each
member's transform via a dedicated `TransformGroupCommand` (Command-System.md),
rather than the group's bounds being recomputed live from children on every
read. This avoids a chicken-and-egg problem where a group with zero children
(transiently, mid-edit) would have an undefined transform, and it keeps
"read a widget's transform" a uniform O(1) operation for every widget type
including groups.

## 9. Widget Data Validation Boundary — Concretely

```typescript
function createWidget(input: CreateWidgetInput, registry: WidgetRegistry): WidgetInstance {
  const def = registry.get(input.type);
  if (!def) throw new UnknownWidgetTypeError(input.type);

  const data = input.data ?? def.createDefaultData();
  const result = def.validate(data);
  if (!result.valid) throw new InvalidWidgetDataError(input.type, result.errors);

  return { /* ...assembled WidgetInstance... */ data, };
}
```

The core's generic `validateDocument()` (Domain-Model.md Section 12) calls
`def.validate(widget.data)` for every widget during full-document validation
(e.g., after import), but has no conditional logic based on `type` beyond
"look up the definition and delegate."

## 10. Migration Flow for Widget Data

When a document with an older widget `version` is loaded:

```
For each WidgetInstance:
  def = registry.get(widget.type)
  if widget.dataVersion < def.version:
    widget.data = def.migrate(widget.data, widget.dataVersion)
    widget.dataVersion = def.version
```

Each `WidgetInstance` carries a `dataVersion: number` field (the follow-up
patch to Domain-Model.md Section 5 flagged here was **applied** in
Domain-Model.md 1.1.0) so the engine knows which migration step to invoke
per widget, independent of every other widget's version.

## 11. Third-Party Widget Registration Example (Illustrative, Not Prescriptive Code)

A hypothetical resume-builder product could register a `"skill-bar"` widget
without ever touching `@engine/core` source:

```typescript
import { engine } from "@engine/core";

engine.widgets.register({
  type: "skill-bar",
  version: 1,
  createDefaultData: () => ({ label: "New Skill", level: 3, maxLevel: 5 }),
  validate: (data) => skillBarSchema.safeParse(data),
  getDefaultSize: () => ({ width: 240, height: 32 }),
  canResize: true,
  canRotate: false,
});
```

This is deliberately mundane — the entire point of Principle 6 is that this
code path is exactly as capable as whatever registers the first-party Text
widget, with no core changes required.

## 12. Open Questions Deferred to Later Documents

- Exact `RenderContext`/`RenderOutput` shapes — Rendering-Architecture.md.
- How widget-level commands (e.g., `UpdateWidgetDataCommand`) interact with
  plugin-owned validation on every keystroke vs. only on commit — Command-System.md.
- Whether widget definitions can declare dependencies on other widget types
  (e.g., a "chart legend" widget requiring a paired "chart" widget) — deferred
  entirely until a real use case demands it, per Principle 7.
- Plugin lifecycle beyond registration (hot-unregister while widgets of that
  type exist in an open document) — Plugin-System.md.

## 13. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial version | N/A |
| 1.1.0 | Applied tracked `hitTest()` follow-up patch (§3); corrected creation-flow validation ordering to pre-execution (§7); clarified widgets never construct/dispatch Commands; `dataVersion` patch marked applied | Selection-and-Interaction.md §10; ADR-0003 consistency; Readiness Review M1/M3 |
