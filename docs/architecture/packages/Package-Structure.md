# Package-Structure.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.3.0

**Naming (unified 1.1.0, revised 1.2.0/1.3.0 per ADR-0009/ADR-0010):** `presentation-*`
is the canonical **logical** naming scheme used throughout this handbook.
Each logical name maps 1:1 to an npm package `@morpha/<short>` in
directory `packages/<short>` — e.g. `presentation-commands` ↔
`@morpha/commands` ↔ `packages/commands`. (Bare short npm names were
rejected: `react` and `events` collide with the React package and the Node
builtin.) Older documents' `@engine/*` names also map 1:1 and are read as
aliases: `@engine/core` → the Ring 0/1 packages collectively,
`@engine/renderer-dom` → `presentation-renderer-dom`, `@engine/renderer-ssr`
→ `presentation-renderer-ssr`, `@engine/widgets-base` →
`presentation-widgets-base`, `@engine/collab` → `presentation-collaboration`,
`@engine/core/ordering` → the ordering utility inside `presentation-domain`.
**Depends on:** Every prior architecture document (this document is a
**projection** of the architecture onto a monorepo, not a new architectural
decision layer)

---

## 1. Purpose

This document translates the architecture defined across Engine-Lifecycle.md,
Domain-Model.md, Widget-System.md, Rendering-Architecture.md,
Selection-and-Interaction.md, Event-System.md, Command-System.md,
Serialization.md, and Plugin-System.md into a **package topology**. Package
boundaries are derived from Clean Architecture's Dependency Rule — source
code dependencies point only inward, toward domain, never outward toward
infrastructure or frameworks [web:217][web:219][web:223] — combined with
Domain-Driven Design's principle that a package boundary should correspond
to a bounded context with one clear responsibility, not an arbitrary folder
split.

**This is not a new architecture.** Every package below maps to a
responsibility already fully specified in a prior document; this document's
job is exclusively to decide *packaging*, *import legality*, and
*publishability* — not to redefine behavior.

## 2. Layering Principle

Packages are organized into four concentric rings, following the Dependency
Rule strictly: an inner ring never imports from an outer ring, under any
circumstance, enforced mechanically (Section 9) rather than left to
convention [web:217][web:223].

```
Ring 0 — Domain        (zero runtime dependencies, framework-agnostic)
Ring 1 — Application   (orchestrates Ring 0; still framework-agnostic)
Ring 2 — Adapters       (renderers, importers/exporters, storage)
Ring 3 — Integration    (React bindings, devtools, AI, collaboration —
                          consumes Ring 0-2 publicly, never reaches into
                          their internals)
```

**Intra-ring dependencies (corrected 1.1.0):** the original "never on
sibling adapters" rule was contradicted by this document's own catalogue
(rendering → widget-api, interaction → rendering, plugin-api → four
siblings). The actual rule: **within a ring, dependencies are legal only
along the explicitly enumerated directed edges in Section 5's diagram, and
the intra-ring graph must stay acyclic.** The lint enforcement (Section 6)
therefore uses per-package allowlists, not ring tags alone.

## 3. Package Catalogue

### Ring 0 — Domain

#### `presentation-domain`

| Aspect | Definition |
| --- | --- |
| Responsibility | The Presentation Domain Model: `PresentationDocument`, `Page`, `WidgetInstance`, `Transform`, `Theme`, `Asset` (Domain-Model.md); validation primitives (Section 12 of that document); versioning/migration contracts |
| Public API | All Domain Model types; `validateDocument()`; `migrate()` contract shape; `WidgetDefinition` interface (type only, not a registry) |
| Internal API | Internal normalization helpers, structural-sharing utilities |
| Dependencies | **None** (zero runtime dependencies — pure data types and pure functions only) |
| Allowed imports | Nothing from any other `presentation-*` package |
| Forbidden imports | Everything — this is the innermost ring |
| Build targets | ESM + CJS dual build; type declarations; runs unmodified in browser, Node, and Web Worker |
| Runtime environment | Universal (no `window`, no `document`, no Node-specific API) |
| Ownership | Core architecture team; changes require an ADR always, no exceptions |

### Ring 1 — Application

#### `presentation-events`

| Aspect | Definition |
| --- | --- |
| Responsibility | The semantic Event System (Event-System.md): `Emitter`/`Event`/`Disposable`, event taxonomy types, `EventOrigin`, `EventEnvelope` |
| Public API | `Emitter<T>`, `Event<T>`, `Disposable`, all event category payload interfaces |
| Internal API | Internal listener-storage data structures |
| Dependencies | `presentation-domain` (for event payloads referencing domain types like `WidgetId`) |
| Allowed imports | `presentation-domain` only |
| Forbidden imports | `presentation-rendering`, `presentation-commands`, any Ring 2/3 package |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal |
| Ownership | Core architecture team |

#### `presentation-state`

| Aspect | Definition |
| --- | --- |
| Responsibility | The Store (Engine-Lifecycle.md Section 6.2): transaction application, structural sharing, `RenderStateDiff` derivation, snapshot/incremental-save primitives (Serialization.md Sections 12-13) |
| Public API | `Store` read accessor, `TransactionContext` (Command-System.md Section 5), `Snapshot`, `IncrementalSaveOp` |
| Internal API | Internal versioned-tree structural sharing implementation |
| Dependencies | `presentation-domain`, `presentation-events` |
| Allowed imports | `presentation-domain`, `presentation-events` |
| Forbidden imports | `presentation-commands` (dependency runs the OTHER way — Commands depend on State, not vice versa), `presentation-rendering` |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal, including Web Worker (Engine-Lifecycle.md Section 11) |
| Ownership | Core architecture team |

#### `presentation-commands`

| Aspect | Definition |
| --- | --- |
| Responsibility | The mutation architecture (Command-System.md): `Command` contract, Command Dispatcher, Transaction Manager integration, History Manager, validation pipeline orchestration |
| Public API | `Command<T>`, `CommandDispatcher`, `HistoryManager`, `CommandFactoryRegistry`, `TransactionContext` (re-exported from `presentation-state`) |
| Internal API | Merge/coalescing internals, rollback machinery |
| Dependencies | `presentation-domain`, `presentation-events`, `presentation-state` |
| Allowed imports | The three packages above only |
| Forbidden imports | `presentation-rendering`, `presentation-widget-api`, any Ring 2/3 package — Commands must never know about rendering or specific widget implementations |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal |
| Ownership | Core architecture team |

#### `presentation-runtime`

| Aspect | Definition |
| --- | --- |
| Responsibility | The Engine itself (Engine-Lifecycle.md): `Engine`, `DocumentSession`, Lifecycle Manager, Scheduler, service composition root — the ORCHESTRATOR that wires every other Ring 0/1 package together |
| Public API | `Engine`, `EngineConfig`, `DocumentSession`, engine construction/disposal API |
| Internal API | Internal service-wiring/dependency-injection container |
| Dependencies | `presentation-domain`, `presentation-events`, `presentation-state`, `presentation-commands` |
| Allowed imports | All Ring 0/1 packages; interacts with Ring 2 packages **only through registries/interfaces**, never concrete imports (e.g., `presentation-runtime` defines `RendererRegistry` as an interface; it does not import `presentation-rendering` directly) |
| Forbidden imports | Any concrete Ring 2/3 package — this is the critical Dependency Rule enforcement point: the orchestrator depends on abstractions, adapters depend on the orchestrator's abstractions, never the reverse |
| Build targets | ESM + CJS; universal (though a specific `EngineConfig` may select Node- or browser-specific adapters at the application's composition point, not inside this package) |
| Runtime environment | Universal |
| Ownership | Core architecture team |

### Ring 2 — Adapters

#### `presentation-widget-api`

| Aspect | Definition |
| --- | --- |
| Responsibility | Widget-System.md's public contract: `WidgetDefinition`, `WidgetRenderer` interface, Widget Registry, validation/migration hooks — the SDK surface third-party widget authors build against. **`RenderNode` is defined here** (decided 1.1.0): it is the contract between widget authors and renderer families, produced by widgets and consumed by `presentation-rendering`, which already depends on this package |
| Public API | `defineWidget()`, `WidgetDefinition<T>`, `WidgetRegistry`, `RenderNode` |
| Internal API | Registry storage internals |
| Dependencies | `presentation-domain` only (corrected 1.1.0 — widgets never construct or dispatch Commands, Widget-System.md §7; the previous `presentation-commands` dependency was unsanctioned by any boundary table) |
| Allowed imports | `presentation-domain` |
| Forbidden imports | `presentation-commands`, `presentation-rendering`, `presentation-react` |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal |
| Ownership | Core team owns the contract; widget authors own their own separate packages (e.g., a hypothetical `acme-chart-widget` depending on this package) |

#### `presentation-rendering`

| Aspect | Definition |
| --- | --- |
| Responsibility | Rendering-Architecture.md's renderer-agnostic core: `RenderNode`, `RenderContext`, Renderer Registry, retained/immediate reconciliation logic, virtualization |
| Public API | `RenderNode`, `RenderContext`, `RendererAdapter` interface, reconciliation utilities |
| Internal API | Diffing/reconciliation algorithm internals |
| Dependencies | `presentation-domain`, `presentation-state` (reads `RenderStateDiff`), `presentation-widget-api` (invokes `WidgetRenderer.render()`) |
| Allowed imports | The three above |
| Forbidden imports | `presentation-commands` (Renderer must never dispatch Commands, per Engine-Lifecycle.md's boundary table), `presentation-react`, any DOM-specific or Canvas-specific package |
| Build targets | ESM + CJS; universal — a genuinely renderer-**family**-agnostic core; DOM/Canvas specifics live in their OWN downstream packages (`presentation-renderer-dom`, `presentation-renderer-canvas`, not enumerated in the original list but a necessary consequence of the architecture — see Section 5) |
| Runtime environment | Universal |
| Ownership | Core architecture team |

#### `presentation-interaction`

| Aspect | Definition |
| --- | --- |
| Responsibility | Selection-and-Interaction.md: Tool state machine, Selection/Focus/Hover models, hit-testing, `InteractionIntent` |
| Public API | `ToolNode`, `ToolContext`, `InteractionIntent`, `SelectionState`, Tool Registry |
| Internal API | State-machine dispatch internals |
| Dependencies | `presentation-domain`, `presentation-events`, `presentation-rendering` (consumes normalized input event shapes Rendering-Architecture.md's renderer boundary produces) |
| Allowed imports | The three above |
| Forbidden imports | `presentation-commands` directly for mutation (Tools only ever call `emitIntent()`; they may import `presentation-commands`' TYPES for reference but never construct/dispatch a Command directly from within a Tool — this is enforced by lint rule, Section 9, not just convention) |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal (though practically always used alongside a browser-based renderer) |
| Ownership | Core architecture team |

#### `presentation-plugin-api`

| Aspect | Definition |
| --- | --- |
| Responsibility | Plugin-System.md: Plugin Manifest types, `PluginContext`, all Extension Point registry interfaces, activation event types |
| Public API | `PluginManifest`, `PluginContext`, `defineActivationEvents()`, every Extension Point registry interface |
| Internal API | Dependency-graph resolution, activation scheduling |
| Dependencies | `presentation-domain`, `presentation-commands`, `presentation-widget-api`, `presentation-rendering`, `presentation-interaction` (it generalizes and re-exposes all of their registries) |
| Allowed imports | All packages listed above |
| Forbidden imports | `presentation-react`, `presentation-export-*`, `presentation-import-*`, `presentation-ai`, `presentation-collaboration` — the plugin API defines the SHAPE these fit into; it never depends on any specific plugin implementation |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal |
| Ownership | Core architecture team |

#### `presentation-serialization`

| Aspect | Definition |
| --- | --- |
| Responsibility | Serialization.md: `CanonicalDocumentEnvelope`, `AssetManifestEntry`, integrity checking, schema migration orchestration, snapshot/incremental-save contracts |
| Public API | `serialize()`, `deserialize()`, `CanonicalDocumentEnvelope`, `AssetStorageRef`, migration registration API |
| Internal API | Checksum computation, envelope parsing internals |
| Dependencies | `presentation-domain`, `presentation-state` |
| Allowed imports | The two above |
| Forbidden imports | `presentation-commands`, `presentation-rendering`, any `presentation-export-*`/`presentation-import-*` package (dependency runs the other way — exporters/importers depend on this package's contract, Serialization.md Section 17) |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal, including Node (for server-side/CLI persistence tooling) |
| Ownership | Core architecture team |

#### `presentation-widgets-base` *(added 1.1.0 — was `@engine/widgets-base`, referenced by Widget-System.md §5 but missing from this catalogue)*

| Aspect | Definition |
| --- | --- |
| Responsibility | The first-party reference widgets (`text`, `image`, `rect`, `group`), implemented via the exact same `WidgetDefinition` contract any third party uses (Widget-System.md §5's compliance test) |
| Public API | One exported `WidgetDefinition` per widget, plus a convenience `registerBaseWidgets(engine)` |
| Dependencies | `presentation-domain`, `presentation-widget-api` |
| Forbidden imports | Everything else — if a base widget needs an import beyond the widget contract, the contract is incomplete (Principle 6) |
| Build targets | ESM + CJS; universal |
| Runtime environment | Universal |
| Ownership | Core team, but structurally an ordinary widget package — the living proof that first-party widgets are not privileged |

#### `presentation-renderer-dom`, `presentation-renderer-canvas`, `presentation-renderer-ssr` *(ssr added 1.1.0 — promised by Engine-Lifecycle.md §11 and Rendering-Architecture.md §17 but previously uncatalogued)*

| Aspect | Definition |
| --- | --- |
| Responsibility | Concrete renderer families implementing `RendererAdapter` (Rendering-Architecture.md §5): DOM (interactive editing), Canvas (presentation/perf mode), SSR (headless Node thumbnail/preview rendering) |
| Dependencies | `presentation-rendering`, `presentation-widget-api`, `presentation-domain` |
| Forbidden imports | `presentation-commands` (renderers never dispatch), format adapters, `presentation-react` |
| Runtime environment | dom/canvas: browser only; **ssr: Node only** |
| Ownership | Rendering team; each family independently versioned |

### Ring 2 — Format Adapters (Import/Export)

#### `presentation-export-pptx`, `presentation-export-pdf`, `presentation-export-svg`,

| Aspect | Definition |
| --- | --- |
| Responsibility | Translate a live/snapshotted `PresentationDocument` into one specific foreign binary/text format |
| Public API | A single `export(document, options): Promise<Uint8Array>`-shaped function per package |
| Internal API | Format-specific encoding logic (OOXML XML generation, PDF object graph, etc.) |
| Dependencies | `presentation-domain`, `presentation-serialization` (reads via its contract), `presentation-plugin-api` (registers itself as a Plugin Exporter contribution) |
| Allowed imports | The three above, plus any third-party format-encoding library (e.g., a PDF-writing library) — this is the one package tier permitted broad external dependencies, since format encoding is inherently dependency-heavy |
| Forbidden imports | `presentation-rendering`, `presentation-interaction`, `presentation-commands` — an exporter never renders UI and never mutates the document (Serialization.md Section 17's rule, restated as a package-level import prohibition) |
| Build targets | ESM + CJS; Node-primary (large format-encoding libraries are frequently Node-oriented), browser build optional per format |
| Runtime environment | Node primary; browser where the specific format library supports it; strong candidate for a background worker/export-service deployment (Engine-Lifecycle.md Section 11) |
| Ownership | Format specialists — each export package can be independently owned, versioned, and released, including by external contributors, without touching the core |

#### `presentation-import-pptx`, `presentation-import-svg`,

| Aspect | Definition |
| --- | --- |
| Responsibility | Parse one specific foreign format into a `PresentationDocument` value or a set of Import Commands |
| Public API | `import(bytes): Promise<PresentationDocument>` (or Command array) |
| Internal API | Format-specific parsing logic |
| Dependencies | `presentation-domain`, `presentation-commands` (constructs Import Commands, Command-System.md Section 4), `presentation-plugin-api` |
| Allowed imports | The three above, plus format-parsing third-party libraries |
| Forbidden imports | `presentation-rendering` (Serialization.md Section 17: "importers never know about rendering," restated as import law) |
| Build targets | ESM + CJS; Node-primary, browser-capable where parsing libraries allow |
| Runtime environment | Node primary; browser secondary |
| Ownership | Format specialists, independently versioned |

### Ring 3 — Integration

#### `presentation-react`

| Aspect | Definition |
| --- | --- |
| Responsibility | React bindings: hooks (`useEngine`, `useSelection`, `useWidget`), a `RenderNode`-to-React-element reconciler, a `<PresentationCanvas>` component |
| Public API | Hooks, components — a thin ergonomic layer, no independent logic of substance |
| Internal API | React-specific memoization internals |
| Dependencies | `presentation-runtime`, `presentation-rendering`, `presentation-interaction`, plus `react`/`react-dom` as peer dependencies |
| Allowed imports | The three `presentation-*` packages above |
| Forbidden imports | `presentation-export-*`, `presentation-import-*`, `presentation-ai`, `presentation-collaboration` — React bindings are a rendering-integration concern only, never a business-logic concern |
| Build targets | ESM + CJS; browser only |
| Runtime environment | Browser (React DOM) — this is the one package explicitly NOT universal, by nature of its dependency |
| Ownership | Integration team; can be community-maintained long-term since it has no access to anything privileged beyond the public `presentation-runtime`/`presentation-rendering` APIs |

#### `presentation-ai`

| Aspect | Definition |
| --- | --- |
| Responsibility | AI Provider contributions (Plugin-System.md Section 9.5): translates a generation request into Commands via `presentation-commands`, never touching rendering |
| Public API | `AIProviderContribution`, provider registration helpers |
| Internal API | Prompt construction, model-response parsing |
| Dependencies | `presentation-domain`, `presentation-commands`, `presentation-plugin-api` |
| Allowed imports | The three above, plus any third-party AI SDK |
| Forbidden imports | `presentation-rendering`, `presentation-react`, `presentation-interaction` — enforced exactly per Engine-Lifecycle.md Section 8 and Event-System.md Section 15's rule that AI has no privileged or UI-aware pathway |
| Build targets | ESM + CJS; universal, though typically deployed server-side or in a background worker given model-inference latency |
| Runtime environment | Node primary (server-side AI calls), browser secondary |
| Ownership | AI/ML team, independently versioned |

#### `presentation-collaboration`

| Aspect | Definition |
| --- | --- |
| Responsibility | Collaboration Provider contributions (Plugin-System.md Section 9.6): `ApplyRemoteOperationCommand` construction (Command-System.md Section 14), presence/Collaboration Events (Event-System.md Section 14), collaborative persistence log integration (Serialization.md Section 16) |
| Public API | `CollabProviderContribution`, `CollabConnection`, presence types |
| Internal API | Specific sync-protocol/CRDT implementation details |
| Dependencies | `presentation-domain`, `presentation-commands`, `presentation-events`, `presentation-serialization`, `presentation-plugin-api` |
| Allowed imports | The five above, plus a networking/CRDT third-party library |
| Forbidden imports | `presentation-rendering`, `presentation-react` — remote presence surfaces as overlay state through the Renderer Registry's public contract, never through a direct rendering import from this package |
| Build targets | ESM + CJS; universal, network-dependent |
| Runtime environment | Universal — must work in browser (peer client) and Node (a sync server component, if self-hosted) |
| Ownership | Collaboration team, independently versioned, deliberately deferred (not required for MVP, Engine-Lifecycle.md Section 10.6) |

#### `presentation-devtools`

| Aspect | Definition |
| --- | --- |
| Responsibility | The diagnostic/observability surfaces already defined across prior documents: Event-System.md Section 16's `EventObserver`, Command-System.md Section 18's `CommandObserver`, Plugin-System.md Section 16's logging — assembled into an actual inspector UI/panel |
| Public API | A devtools panel component/standalone app; programmatic observer hooks for headless use (e.g., CI test assertions on command logs) |
| Internal API | Panel-specific rendering internals |
| Dependencies | `presentation-runtime`, `presentation-events`, `presentation-commands`, `presentation-plugin-api`; optionally `presentation-react` for the panel UI itself |
| Allowed imports | The packages above only — devtools **observes**, per the read-only contract already established, and therefore never imports `presentation-commands` for the purpose of dispatching, only observing |
| Forbidden imports | Any format adapter, `presentation-ai`, `presentation-collaboration` — devtools is generic across all of them via the observability contract, never format/provider-specific |
| Build targets | ESM + CJS; browser primary (panel UI), Node-capable for CI/headless observer use |
| Runtime environment | Browser primary, Node secondary |
| Ownership | Developer experience team; excellent candidate for community contribution since it only ever consumes public observability APIs |

#### `presentation-testing`

| Aspect | Definition |
| --- | --- |
| Responsibility | Shared test utilities: Engine test harness/fixture builders, deterministic clock injection (Command-System.md Section 15), snapshot-based assertion helpers, mock Renderer/Plugin implementations for testing Ring 1/2 packages in isolation |
| Public API | `createTestEngine()`, `mockRenderer()`, `fixtureDocument()`, assertion helpers |
| Internal API | None of note — this package is almost entirely public surface, by design, since its whole purpose is to be imported by every other package's test suite |
| Dependencies | `presentation-domain`, `presentation-runtime`, `presentation-commands` |
| Allowed imports | The three above |
| Forbidden imports | None strictly forbidden, but any additional dependency here becomes a transitive DEV dependency of every package that uses it for testing — kept deliberately minimal |
| Build targets | ESM + CJS; universal; **devDependency only** — never a runtime dependency of any shipped package |
| Runtime environment | Universal (test runner environment — Node/jsdom/browser test runners alike) |
| Ownership | Core architecture team, but structured to be the easiest package for external contributors to extend (adding a new mock/fixture rarely touches core logic) |

## 4. Correction to the Originally Proposed List

The originally proposed list is largely correct and is preserved almost
entirely. Three refinements:

1. **`presentation-rendering` splits into a renderer-agnostic core plus
   per-family adapter packages** (`presentation-renderer-dom`,
   `presentation-renderer-canvas`, not in the original list) — this follows
   directly from Rendering-Architecture.md's own insistence that DOM/Canvas
   specifics stay isolated behind a `RendererAdapter` contract; bundling
   them into one `presentation-rendering` package would violate that
   document's own boundary.
2. **`presentation-interaction` is added** (not in the original list) —
   Selection-and-Interaction.md is a full architecture document with its
   own contract (`InteractionIntent`, Tool state machine) and deserves its
   own package rather than being folded into `presentation-commands` or
   `presentation-rendering`; folding it into either would blur exactly the
   boundary that document was written to establish.
3. **`presentation-state` is split out from `presentation-runtime`** — the
   Store/Transaction Manager has a materially different testing and
   versioning cadence than the Engine's lifecycle-orchestration logic;
   keeping them separate lets `presentation-state` be consumed by
   `presentation-commands` without pulling in the entire Engine
   construction/disposal machinery.

## 5. Package Dependency Diagram

```
                         ┌─────────────────────┐
                         │  presentation-domain │  (Ring 0 — no deps)
                         └───────────┬──────────┘
                                     │
                 ┌───────────────────┼────────────────────┐
                 ▼                   ▼                    ▼
   presentation-events   presentation-state (+events)   presentation-serialization (+state)
                 │                   │
                 └─────────┬─────────┘
                            ▼
                 presentation-commands
                            │
                            ▼
                 presentation-runtime  (composition root; depends on
                            │            abstractions only for Ring 2)
        ┌───────────┬───────┴────────┬────────────────┐
        ▼           ▼                ▼                ▼
presentation-  presentation-  presentation-    presentation-
widget-api     rendering      interaction      plugin-api
        │           │                │                │
        └─────┬──────┴────────┬───────┴────────────────┘
              │                │
              ▼                ▼
   presentation-widgets-base   presentation-renderer-{dom,canvas,ssr}
              (widget-api)         (rendering + widget-api)

   presentation-export-*  ──►  presentation-domain, presentation-serialization,
   presentation-import-*  ──►  presentation-plugin-api (+ presentation-commands
                                for Import Commands) — NEVER any renderer package
                                (diagram corrected 1.1.0; the previous version
                                 wrongly drew format adapters under renderer-dom,
                                 contradicting Section 6's forbidden pairs)

        presentation-react · presentation-ai ·
        presentation-collaboration · presentation-devtools
              (Ring 3 — consume Ring 0-2 public surfaces)
                      │
              presentation-testing
              (consumed by ALL packages' test suites,
               never by shipped runtime code)
```

## 6. Import Rules — Mechanically Enforced

Following the tag-based dependency-constraint pattern proven at scale by Nx
[web:209][web:212][web:222] and the layer-based import-allowlist pattern
used by tools like `fresh-onion` for Clean/Onion Architecture enforcement
[web:223], every package is tagged by ring and the monorepo's lint
configuration enforces:

```
Ring 0 packages: onlyDependOnLibsWithTags: []               (nothing)
Ring 1 packages: onlyDependOnLibsWithTags: ["ring:0", "ring:1"]   (acyclic within ring)
Ring 2 packages: onlyDependOnLibsWithTags: ["ring:0", "ring:1", "ring:2"] (acyclic within ring)
Ring 3 packages: onlyDependOnLibsWithTags: ["ring:0", "ring:1", "ring:2"]
```

(Corrected 1.1.0 — ring tags are the coarse gate; the fine gate is each
package's own allowlist from Section 3's catalogue, which is what actually
prevents illegal sibling imports. Intra-ring edges are legal only if
enumerated there, and the intra-ring graph must remain acyclic.)

Additionally, **named forbidden-import pairs** are enforced beyond the ring
rule, because ring membership alone doesn't capture every architectural
boundary (e.g., `presentation-interaction` and `presentation-commands` are
both Ring 1/2-adjacent but must not import each other directly for
mutation):

```
presentation-rendering    ⊗  presentation-commands
presentation-interaction  ⊗  presentation-commands  (types only, no dispatch)
presentation-export-*     ⊗  presentation-rendering
presentation-import-*     ⊗  presentation-rendering
presentation-ai           ⊗  presentation-rendering, presentation-react
presentation-collaboration ⊗ presentation-rendering, presentation-react
presentation-devtools     ⊗  any format adapter, ai, collaboration package
```

A CI-enforced lint rule (an Nx-style `enforce-module-boundaries` ESLint
rule, or equivalent for whatever build tool is chosen) fails the build on
any violation — these rules are not documentation-only conventions, they
are executable gates, matching how Nx enforces constraints declaratively
via project tags [web:209][web:212].

## 7. Why This Topology Maximizes the Stated Goals

- **Modularity:** every package maps to exactly one architecture document's
  responsibility — there is no package whose purpose requires reading two
  different architecture documents to understand.
- **Independent testing:** Ring 0/1 packages have zero runtime dependency on
  anything renderer- or format-specific, so their test suites run in
  milliseconds with no DOM, no format-parsing library, no network — this is
  a direct consequence of the Dependency Rule, not an accident.
- **Independent publishing:** `presentation-export-pptx` can ship a patch
  release without coordinating with `presentation-collaboration` — their
  only shared dependency is the stable, versioned Ring 0/1 surface.
- **Future open-source adoption:** `presentation-devtools`,
  `presentation-testing`, and individual `presentation-export-*`/
  `presentation-import-*` packages are structurally the easiest for
  external contributors to work on, since each has a narrow, well-typed
  public API and cannot accidentally reach into core internals — the
  import rules (Section 6) make this a compiler/lint-enforced guarantee,
  not a code-review-enforced convention.
- **Long-term maintainability:** because Ring 0/1 packages are what change
  least often (they encode architecture, not format-specific or
  UI-framework-specific detail), and Ring 2/3 packages are what change
  most often (new formats, new AI providers, framework version bumps), the
  topology naturally isolates churn to the outer rings — exactly where
  Clean Architecture's Dependency Rule predicts churn should be isolated
  [web:217][web:219].

## 8. Build Targets and Runtime Environment Summary

| Package | ESM | CJS | Browser | Node | Worker | React peer dep |
| --- | --- | --- | --- | --- | --- | --- |
| presentation-domain | Y | Y | Y | Y | Y | N |
| presentation-events | Y | Y | Y | Y | Y | N |
| presentation-state | Y | Y | Y | Y | Y | N |
| presentation-commands | Y | Y | Y | Y | Y | N |
| presentation-runtime | Y | Y | Y | Y | Y | N |
| presentation-widget-api | Y | Y | Y | Y | Y | N |
| presentation-rendering | Y | Y | Y | Y | Y | N |
| presentation-renderer-dom | Y | Y | Y | N | N | N |
| presentation-renderer-canvas | Y | Y | Y | N | N | N |
| presentation-interaction | Y | Y | Y | Y | Y | N |
| presentation-plugin-api | Y | Y | Y | Y | Y | N |
| presentation-serialization | Y | Y | Y | Y | Y | N |
| presentation-export-* | Y | Y | partial | Y (primary) | Y (candidate) | N |
| presentation-import-* | Y | Y | partial | Y (primary) | N | N |
| presentation-react | Y | Y | Y | N | N | Y |
| presentation-ai | Y | Y | partial | Y (primary) | Y (candidate) | N |
| presentation-collaboration | Y | Y | Y | Y | N | N |
| presentation-devtools | Y | Y | Y (primary) | partial | N | optional |
| presentation-testing | Y | Y | Y | Y | Y | N (devDependency only) |

## 9. Ownership Model

- **Ring 0/1 packages** (`domain`, `events`, `state`, `commands`,
  `runtime`) are owned exclusively by the core architecture team; every
  change requires an ADR per Event-System.md Section 0's governance
  process — no exceptions, since these packages are what every other
  package's stability guarantee ultimately rests on.
- **Ring 2 packages** are owned by domain specialists (rendering team,
  format specialists, plugin-api maintainers) with lighter review
  requirements — a Follow-up Patch or Amendment Proposal suffices for most
  changes, an ADR only for changes to the public contract types.
- **Ring 3 packages** are the intended long-term **community ownership**
  surface — `presentation-react`, individual `presentation-export-*`/
  `presentation-import-*` packages, and `presentation-devtools` are
  designed so an external contributor can own, version, and release them
  independently, constrained entirely by the import rules (Section 6)
  rather than by trust in the contributor.

## 10. What This Document Explicitly Does NOT Do

- Does not introduce any new runtime behavior — every capability referenced
  here is fully specified in its owning architecture document; this
  document only assigns it a package address.
- Does not mandate a specific monorepo tool (Nx, Turborepo, pnpm
  workspaces) — Section 6's import-rule enforcement pattern is tool-agnostic
  in principle, though Nx's tag-based constraint model is used here as the
  illustrative mechanism given its proven track record [web:209][web:222].
- Does not decide versioning/release cadence policy (independent semver
  per package vs. lockstep) — that is a project-governance decision outside
  this document's scope.

## 11. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.2.0 | Naming revised: logical `presentation-*` names map to `@morpha/<short>` npm packages in `packages/<short>` directories | ADR-0009 |
| 1.1.0 | Ring rule corrected to enumerated-directed-edges (the strict sibling ban contradicted this document's own catalogue); `presentation-*` declared canonical naming with `@engine/*` alias map; added `presentation-widgets-base` and `presentation-renderer-ssr`; `RenderNode` homed in `presentation-widget-api`; removed unsanctioned `widget-api → commands` dependency; §5 diagram corrected (format adapters never depend on renderers) | Readiness Review M3; Widget-System.md 1.1.0 alignment |
