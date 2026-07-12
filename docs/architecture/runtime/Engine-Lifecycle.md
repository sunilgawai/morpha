# Engine-Lifecycle.md

**Status:** Foundational — the canonical runtime reference. Every other
runtime-touching document (Rendering-Architecture.md, Command-System.md,
Event-System.md, State-Management.md, Plugin-System.md, Collaboration,
Import-Export.md) MUST reference this document's definitions rather than
redefine runtime behavior locally.
**Version:** 1.1.0
**Depends on:** Vision.md, Design-Principles.md, Domain-Model.md,
Widget-System.md, Rendering-Architecture.md

---

## 1. Purpose

This document answers exactly one question: **what happens, in order, from
the moment an application creates an Engine instance until it is destroyed?**
Every runtime concept introduced by any other document — a Command
executing, a Renderer painting, a Plugin registering a widget, an AI
pipeline generating slides — is a named stage or service *within* the
pipeline defined here. No other document is permitted to invent a
competing notion of "when things happen."

This is the same category of document as React's render/commit model, VS
Code's extension activation lifecycle, and Unity's execution order manual —
a single, referenceable source of truth for sequencing, so that ten years of
accumulated features don't each carry their own private assumption about
ordering [web:116][web:125][web:126].

## 2. The Engine Is a Runtime, Not a Library Call

The Presentation Engine is a **long-lived runtime instance**, not a
stateless function library. Creating an `Engine` stands up a running system
with internal services, subscriptions, and a scheduler — closer to
instantiating a game engine's world or a VS Code extension host than to
calling a utility function. This framing matters because it justifies why
the Engine has an explicit lifecycle with ordered phases, rather than being
"just an object with methods."

## 3. High-Level Runtime Pipeline

```
Application
    │  creates
    ▼
Engine Instance  ────────────────────────────────────────────┐
    │  owns                                                   │
    ▼                                                          │
Store (retained domain state — Domain-Model.md)                │
    │                                                          │
    │◄──────────────── Commands mutate ONLY through here ─────┤
    ▼                                                          │
Validation Pipeline (per-widget + structural — Widget-System.md)│
    │                                                          │
    ▼                                                          │
Transaction Manager (atomic batches of mutations)               │
    │                                                          │
    ▼                                                          │
Store Mutation (applied, versioned)                             │
    │                                                          │
    ▼                                                          │
Event Bus (change notifications, domain + lifecycle events)     │
    │                                                          │
    ├──────────────► Renderer(s) (Rendering-Architecture.md)    │
    │                     │                                    │
    │                     ▼                                    │
    │              Interaction Manager                          │
    │                     │  reports InteractionIntent           │
    │                     ▼                                    │
    │              Event Bus (interaction events)               │
    │                     │                                    │
    │                     ▼                                    │
    └──────────────  Command Dispatcher  ◄──── loops back ──────┘
                     (AI, Plugins, Import adapters also enter here)
```

This is a **closed loop**: the only legitimate entry point for changing
domain state, regardless of source (a mouse drag, an AI generation call, a
collaboration remote op, an importer), is the Command Dispatcher submitting
to the Transaction Manager. Every other arrow in this diagram is read-only
or notification-only.

## 4. Engine Lifecycle Phases

### 4.1 Construction

```typescript
const engine = createEngine(config: EngineConfig);
```

At construction, the Engine:

1. Instantiates all **core runtime services** (Section 6) in a fixed,
   documented dependency order (Section 5) — services that depend on others
   are constructed after their dependencies, never lazily discovered.
2. Does **not** yet load a document. Construction produces an Engine capable
   of loading/creating documents — it is not yet "showing" anything.
3. Does **not** yet know about any renderer. Renderer attachment is a
   separate, later phase (Section 4.4) — an Engine can exist, load a
   document, run commands, and export, entirely headlessly (e.g., in a
   Node.js export worker), with zero renderer ever attached.

### 4.2 Registration Phase

Before or shortly after construction, the application registers:

- **Widgets** — via `engine.widgets.register(definition)` (Widget-System.md).
- **Plugins** — via `engine.plugins.register(plugin)` (Plugin-System.md,
  future doc) — plugins may themselves register widgets, exporters,
  importers, or event listeners, but only through the same public APIs the
  application itself would use. No plugin has a private back door.
- **Asset providers** — resolvers that turn an `AssetSource` reference
  (Domain-Model.md Section 8) into actual bytes on demand.
- **Theme providers** — sources of `Theme` objects (Domain-Model.md Section 9).
- **Import/export adapters** — registered against the Adapter Registry
  (Section 6.13), but never invoked until explicitly called.
- **Text measurer** — the injected `TextMeasurer` capability (ADR-0006),
  supplied via `EngineConfig` at construction like the ID generator; the
  single authoritative source of text metrics for widgets, renderers, and
  exporters alike.

Registration is **idempotent-checked** (Widget-System.md Section 4) and can
happen incrementally throughout the Engine's life — this is not a one-time
boot step. A plugin can be registered, and later unregistered, while the
Engine is running (Section 4.6).

**Ownership rule:** registration APIs are the *only* way any capability
enters the Engine. There is no mechanism for a widget, exporter, or plugin
to exist without having gone through registration — this is what keeps the
Adapter Registry authoritative and inspectable at all times.

### 4.3 Document Lifecycle (Load / Create)

```typescript
engine.documents.create(): DocumentSession
engine.documents.load(serialized: SerializedDocument): DocumentSession
```

Loading a document runs, in order:

1. **Schema version check** (Domain-Model.md Principle 9) — if
   `schemaVersion` is older than current, the Migration pipeline
   (Migration-and-Versioning.md, future doc) runs before anything else
   touches the document.
2. **Widget data migration** — per Widget-System.md Section 10, each
   widget's `dataVersion` is checked and migrated independently of document
   schema migration.
3. **Structural validation** (Domain-Model.md Section 12) — runs once,
   fully, before the document is considered "live." A document that fails
   structural validation never enters the Store; `load()` rejects instead.
4. **Store hydration** — the validated document becomes the Store's
   contents. This is the moment `DocumentSession` becomes active.
5. **Initial `RenderState` becomes computable** — but nothing renders yet
   unless a renderer is already attached (Section 4.4).

A `DocumentSession` (Section 6.14) is the runtime handle for one open
document — an Engine can, in principle, hold multiple concurrent
`DocumentSession`s (e.g., a server export worker processing several
documents), each with its own Store, History Manager, and Selection
Manager, but sharing the same Widget Registry, Plugin Registry, and Asset
Providers at the Engine level.

### 4.4 Renderer Attachment

```typescript
engine.renderers.register(adapter: RendererAdapter);          // engine-scoped registry
const handle = session.renderers.attach(adapterId: string, target: RenderTarget);
```

(Amended 1.1.0 per ADR-0004: *registration* is engine-scoped;
*attachment* is session-scoped, since a renderer instance renders exactly
one session's document and the runtime supports multiple concurrent
sessions.) Renderer attachment is **always optional and always late** — it
happens after a `DocumentSession` exists, never before. Attaching a renderer:

1. Computes an initial `RenderState` from the current Store contents
   (Rendering-Architecture.md Section 6.1).
2. Calls the adapter's `mount()` with that state.
3. Subscribes the renderer to future Store change notifications via the
   Event Bus (never via direct polling of the Store).

Multiple renderers may be attached to the same `DocumentSession`
simultaneously (Rendering-Architecture.md Section 9) — the Engine does not
enforce a one-renderer-per-document limit. Detaching a renderer
(`handle.detach()`) unsubscribes it and calls `unmount()`/`dispose()`
(Rendering-Architecture.md Section 10) but never touches the Store.

### 4.5 Steady-State Runtime Loop

Once a document is loaded and (optionally) a renderer is attached, the
Engine spends most of its life in the steady-state loop described in
Section 3's diagram, repeating indefinitely:

```
Interaction/AI/Import/Collab event occurs
    → Command Dispatcher receives a Command
    → Validation Pipeline checks it
    → Transaction Manager applies it atomically
    → Store mutates
    → Event Bus notifies subscribers
    → Renderer(s) re-render (if attached)
    → (loop continues on next input)
```

This loop has no engine-owned "tick" or frame clock by default — it is
**event-driven**, not polled, unless a specific service (e.g., a future
Animation-System.md timeline) explicitly introduces a scheduled tick
(Section 10.5).

### 4.6 Dynamic Reconfiguration

The following are explicitly supported *during* steady-state, not only at
startup, because a decade-long-lived runtime cannot assume its
configuration is fixed at boot:

- Registering a new widget type mid-session (e.g., a plugin loaded lazily
  on first use, mirroring VS Code's activation-event-driven lazy plugin
  loading [web:125]).
- Unregistering a widget type — existing `WidgetInstance` records of that
  type remain in the Store (data is never silently deleted by
  unregistration) but become **unrenderable/uneditable** until
  re-registered; the Engine surfaces this as a degraded-but-safe state, not
  a crash.
- Attaching/detaching renderers.
- Swapping a Theme Provider or Asset Provider.

### 4.7 Disposal

```typescript
documentSession.dispose();
engine.dispose();
```

Disposal is explicit and ordered — never garbage-collection-implicit:

1. All attached renderers are detached (`unmount()` + `dispose()` per
   Rendering-Architecture.md Section 10).
2. The History Manager's undo stack is cleared and released.
3. Any in-flight Transactions are rejected (Section 9 — error handling).
4. The Event Bus unsubscribes all listeners belonging to this session.
5. The Store's contents are released.
6. `engine.dispose()` additionally tears down the Plugin Registry (calling
   each plugin's own teardown hook, if declared) and any Asset/Theme
   Provider connections.

**Ownership rule:** nothing outside the Engine is responsible for cleaning
up Engine-owned resources. An application that forgets to call `dispose()`
has a leak the Engine cannot prevent, but the Engine guarantees that
calling `dispose()` fully releases everything it owns, deterministically,
synchronously where possible.

## 5. Initialization Dependency Order

Core services must construct in this order because each depends only on
services already constructed before it — this ordering is itself part of
the public contract of this document, not an implementation detail, because
plugins and future services must know what they can rely on already
existing when *they* initialize:

```
1. Event Bus                  (depends on nothing)
2. Widget Registry             (depends on: Event Bus)
3. Plugin Registry              (depends on: Widget Registry, Event Bus)
4. Asset Provider Registry      (depends on: Event Bus)
5. Theme Manager                (depends on: Event Bus)
6. Adapter Registry (import/export) (depends on: Event Bus)
7. [ Per DocumentSession, created later: ]
   7a. Store                    (depends on: Widget Registry, for validation delegation)
   7b. Validation Pipeline      (depends on: Widget Registry)
   7c. Transaction Manager      (depends on: Store, Validation Pipeline, Event Bus)
   7d. Command Dispatcher       (depends on: Transaction Manager, Event Bus)
   7e. History Manager          (depends on: Command Dispatcher, Event Bus)
   7f. Selection Manager         (depends on: Store, Event Bus)
   7g. Interaction Manager       (depends on: Selection Manager, Command Dispatcher, Event Bus)
   7h. Clipboard Manager         (depends on: Store, Selection Manager,
                                  Command Dispatcher — paste() mutates and
                                  therefore dispatches Commands; corrected 1.1.0)
8. [ Attached on demand: ]
   Renderer Registry / active renderer handles (depends on: Store, Event Bus, DocumentSession)
```

Services in group 7 are **per-`DocumentSession`**, not Engine-global —
this is why an Engine can host multiple concurrently open documents (a
server batch-export scenario) without their History/Selection state
bleeding into each other, while still sharing the Engine-global services in
groups 1–6.

## 6. Runtime Services — Responsibility Ledger

For each service: responsibility, public API shape, lifecycle, dependencies,
extension points, and explicit non-responsibilities.

### 6.1 Engine

- **Responsibility:** top-level runtime container; owns Engine-global
  services (Section 5, groups 1–6) and manages `DocumentSession` instances.
- **Public API:** `widgets`, `plugins`, `assets`, `themes`, `adapters`,
  `documents`, `renderers`, `dispose()`.
- **Lifecycle:** constructed once per runtime (per browser tab, per worker
  process); disposed explicitly.
- **Must NOT:** hold document-specific state directly (that's
  `DocumentSession`'s job); know about any specific rendering technology;
  know about HTTP, auth, or any host application concern (Principle 11).

### 6.2 Store

- **Responsibility:** the sole holder of the live `PresentationDocument`
  (Domain-Model.md). Provides read access and exactly one write path:
  applying an already-validated Transaction.
- **Public API:** `getDocument()` (read-only snapshot), `applyTransaction()`
  (internal — called only by Transaction Manager, never public to
  application code).
- **Lifecycle:** one per `DocumentSession`; created on document load,
  destroyed on session disposal.
- **Extension points:** none directly — the Store is intentionally the most
  closed service in the system.
- **Must NOT:** know about rendering, validation rules' *content* (it
  delegates to Validation Pipeline), commands, or events beyond emitting a
  single generic "changed" notification. **The Store must never know about
  rendering.**

### 6.3 Validation Pipeline

- **Responsibility:** structural validation (Domain-Model.md Section 12)
  plus delegated per-widget validation (Widget-System.md Section 9).
- **Public API:** `validate(document)`, `validateWidget(instance)` — called
  by Transaction Manager before commit, and by `documents.load()`.
- **Lifecycle:** stateless service, lives for the `DocumentSession`.
- **Extension points:** widget-specific validators are supplied via the
  Widget Registry, not registered directly here.
- **Must NOT:** mutate anything; render anything; know what a Command is.

### 6.4 Transaction Manager

- **Responsibility:** applies one or more Store mutations **atomically** —
  either all succeed and commit as one Store version, or none apply.
- **Public API:** `run(fn: (tx: TransactionContext) => void)` — internal,
  invoked by Command Dispatcher, not directly by application code.
- **Lifecycle:** stateless service, lives for the `DocumentSession`.
- **Extension points:** none — atomicity guarantees must not be
  bypassable by a plugin.
- **Must NOT:** decide *what* to mutate (that's the Command's job); know
  about rendering; retry automatically on validation failure (failures
  propagate to the caller — Section 9).

### 6.5 Command Dispatcher

- **Responsibility:** the single public entry point for all domain
  mutation, regardless of source (UI, AI, plugin, importer, collaboration).
- **Public API:** `dispatch(command: Command)`, `dispatchBatch(commands: Command[])`.
- **Lifecycle:** one per `DocumentSession`.
- **Extension points:** new Command *types* are added by any consumer
  (Command-System.md defines the Command contract) — the Dispatcher itself
  has no closed enum of command types, matching the Widget Registry's
  open-extension pattern (Design-Principles.md Principle 6).
- **Must NOT:** render UI; know about DOM, Canvas, or any renderer;
  know about HTTP or AI prompts (Principle 11) — it only knows "a Command
  object with `execute`/`undo` arrived."

### 6.6 History Manager (Undo/Redo)

- **Responsibility:** maintains the undo/redo stack of executed Commands
  for one `DocumentSession`.
- **Public API:** `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clear()`.
- **Lifecycle:** one per `DocumentSession` — **explicitly not shared
  across sessions**, so two people (or two tabs) editing the same document
  never share an undo stack.
- **Must NOT:** persist across a `dispose()`; be consulted by any renderer
  directly (renderers observe resulting Store state, never the history
  stack itself).

### 6.7 Selection Manager

- **Responsibility:** holds the session's entire **`InteractionState`**
  (Selection-and-Interaction.md Section 4 — selection, hover, focus,
  editing mode, active tool path, drag/marquee state, per-attachment
  viewports) in an **ephemeral, non-persisted** store separate from the
  domain Store (Domain-Model.md Section 11). (Contract widened from
  selection-only in 1.1.0, aligning with Selection-and-Interaction.md.)
- **Public API:** `select(ids)`, `deselect(ids)`, `getSelection()`,
  `clear()`; the remaining interaction state is mutated only via
  `ToolContext` (Selection-and-Interaction.md Section 3).
- **Lifecycle:** one per `DocumentSession`.
- **Must NOT:** write to the domain Store; be serialized as part of the
  document; be assumed identical across two renderers attached to the same
  session (each renderer reads the same Selection Manager, but a future
  multi-viewport scenario may require per-viewport selection — deferred
  until needed, Principle 7).

### 6.8 Clipboard Manager

- **Responsibility:** holds copy/cut buffer contents (serialized widget
  fragments), independent of the OS clipboard (which is a renderer/host
  concern for actually reading/writing system clipboard bytes).
- **Public API:** `copy(ids)`, `cut(ids)`, `paste(atPoint?)`.
- **Must NOT:** touch the OS clipboard directly — that integration, if
  needed, is a renderer-layer or host-application responsibility that calls
  into this manager, not the reverse.

### 6.9 Asset Manager / Asset Provider Registry

- **Responsibility:** resolves `AssetSource` references (Domain-Model.md
  Section 8) into usable bytes/URLs on demand, via registered providers.
- **Public API:** `resolve(assetId)`, `registerProvider(kind, resolverFn)`.
- **Must NOT:** perform uploads or persist assets — it resolves references
  supplied by the host application's own storage; the Engine never owns
  asset storage (Principle 11).

### 6.10 Theme Manager

- **Responsibility:** resolves `ThemeId` references into full `Theme`
  objects (Domain-Model.md Section 9), for use by `RenderContext`
  (Rendering-Architecture.md Section 6.2).
- **Public API:** `getTheme(id)`, `registerProvider(resolverFn)`,
  `setActiveTheme(id)` (per `DocumentSession`).
- **Must NOT:** dictate visual rendering itself — it supplies resolved data;
  applying it visually is the renderer's job.

### 6.11 Plugin Registry

- **Responsibility:** tracks registered plugins and their declared
  contributions (widgets, exporters, importers, event listeners).
- **Public API:** `register(plugin)`, `unregister(pluginId)`, `list()`.
- **Extension points:** this *is* the extension point — plugins are the
  mechanism, not a thing with its own sub-extension-points at this layer.
- **Must NOT:** grant a plugin any capability the public Engine API doesn't
  also expose to application code directly. **Plugins must never bypass
  validation** — a plugin-contributed widget's data still passes through
  the same Validation Pipeline as any other.

### 6.12 Event Bus

- **Responsibility:** the sole channel for notifications flowing outward
  from any service to any subscriber — Store changes, lifecycle events
  (session created/disposed), interaction intents, command
  executed/undone, validation failures.
- **Public API:** `on(eventType, handler)`, `off(...)`, `emit(...)`
  (emit is internal-only — application code subscribes, it does not emit
  core lifecycle events itself).
- **Must NOT:** carry mutation requests — the Event Bus is strictly
  notification (fan-out), never a mutation transport. A Command is never
  "emitted" as an event; it is `dispatch()`ed directly to the Command
  Dispatcher (see Section 3 — these are drawn as separate arrows
  deliberately).

### 6.13 Adapter Registry (Import/Export)

- **Responsibility:** tracks registered `ExporterAdapter`/`ImporterAdapter`
  implementations (Import-Export.md, future doc) by format key (e.g.,
  `"pptx"`, `"pdf"`).
- **Public API:** `registerExporter(format, adapter)`,
  `registerImporter(format, adapter)`, `export(format, document)`,
  `import(format, bytes)`.
- **Must NOT:** be invoked automatically by any other service — export/import
  only happen when explicitly called by application code. **Exporters must
  never modify documents** (they receive a read-only snapshot); **importers
  must never know about rendering** (they produce a `PresentationDocument`,
  nothing else, and never touch the Store directly — the application feeds
  the result into `engine.documents.load()`).

### 6.14 Document Session

- **Responsibility:** the runtime handle grouping all per-document services
  (Section 5, group 7) for one open document.
- **Public API:** `getStore()` (read-only), `dispatch()`, `undo()/redo()`,
  `getSelection()`, `dispose()`.
- **Lifecycle:** created by `engine.documents.create()/load()`, disposed
  explicitly or when the Engine itself disposes.

### 6.15 Interaction Manager

- **Responsibility (revised 1.1.0, ADR-0002):** hosts the Tool state
  machines (Selection-and-Interaction.md Section 2). Receives **normalized
  input events** (`PointerInputEvent`/`KeyInputEvent`,
  Rendering-Architecture.md Section 7.2) from attached renderers and routes
  them through the active Tool; Tools emit `InteractionIntent`s via
  `ToolContext.emitIntent()`; the Interaction Manager then translates each
  intent into zero or more Commands via the **Intent Interpreter Registry**
  (Selection-and-Interaction.md Section 15) and dispatches them. This is
  the ONLY intent→Command translation point in the system.
- **Public API:** `handleInput(event: PointerInputEvent | KeyInputEvent)` —
  called by renderer adapters, not application code directly.
- **Must NOT:** render anything; mutate the Store directly (it dispatches
  Commands like any other caller); know about DOM/Canvas specifics (intents
  are already renderer-normalized by the time they reach here).

### 6.16 Scheduler

- **Responsibility:** coordinates *when* deferred/batched/async work runs
  (Section 10) — batching rapid Command submissions (e.g., continuous drag
  events) into merged Commands before commit, and deferring non-urgent work
  (thumbnail regeneration) to idle time.
- **Public API:** internal — consumed by Transaction Manager and renderers,
  not a primary application-facing surface.
- **Must NOT:** decide *what* work means, only *when* it runs.

## 7. Runtime Boundaries — Ownership Table

| Rule | Enforced By |
| --- | --- |
| The Renderer must never mutate state | Renderers only receive `RenderState` (read-only) and report `InteractionIntent` (Rendering-Architecture.md §4, §7) |
| The Renderer must never execute Commands | Renderers have no reference to the Command Dispatcher; only the Interaction Manager does |
| The Store must never know about rendering | Store's public API has no renderer-shaped types; it only exposes document state and a generic change notification |
| Commands must never render UI | `Command.execute()`/`undo()` operate only on Store/Transaction primitives (Command-System.md, forthcoming) |
| Widgets must never directly modify the Store | Widget plugins interact only through `WidgetDefinition` hooks (Widget-System.md); no plugin holds a Store reference |
| Plugins must never bypass validation | Plugin Registry §6.11 — every plugin-contributed widget/data still passes the shared Validation Pipeline |
| Exporters must never modify documents | Adapter contract (Section 6.13) passes a read-only document snapshot |
| Importers must never know about rendering | Importers produce a `PresentationDocument` value only; they never receive a `RenderState` or renderer reference |
| AI generators must never know about UI | AI integrates exclusively via Command Dispatcher / document-mutation APIs (Section 8) — no UI types are reachable from that surface |

## 8. AI Integration Point

AI generation (an outline-to-slides pipeline, a "remix this slide" feature)
is architecturally just another **Command Dispatcher caller**, with zero
special-cased runtime path:

```
AI Pipeline (external to the engine, e.g., a BullMQ worker)
    → produces a batch of Commands (CreateWidgetCommand, CreatePageCommand, ...)
      OR produces a full PresentationDocument fragment via the same
         construction helpers application code would use
    → calls engine.documents.dispatchBatch(commands)
    → same Validation Pipeline, same Transaction Manager, same Event Bus
      notifications as any manual edit
```

**AI never receives a renderer reference, a `RenderState`, or any UI type.**
Its entire surface area is the Command Dispatcher and read-only document
query APIs (e.g., "what widgets currently exist on page X" to decide what to
generate next). This guarantees an AI pipeline can run in a headless Node
worker with an Engine instance that has no renderer attached at all —
directly enabled by Section 4.1's rule that renderer attachment is optional
and late.

## 9. Error Handling and Propagation

| Failure Type | Where Caught | Propagation |
| --- | --- | --- |
| Command validation failure | Validation Pipeline, before Transaction commit | Rejected synchronously back to the `dispatch()` caller; Store is untouched; no partial state (Domain-Model.md Section 12, Widget-System.md Section 7 step 6) |
| Transaction failure (mid-batch error) | Transaction Manager | Entire transaction rolled back; Store remains at pre-transaction version — atomicity is non-negotiable |
| Plugin registration failure (duplicate type) | Plugin/Widget Registry | Throws synchronously at `register()` call site (Widget-System.md Section 4) — fails loud, never silently ignored |
| Renderer failure (e.g., a widget's `render()` throws) | Renderer adapter, per-widget boundary | Contained to that widget — adapter renders a fallback/error placeholder for that widget only; one widget's render failure must never crash the whole render pass or corrupt the Store |
| Importer failure (malformed input) | Import adapter | Returns a typed error result (`ImportResult` — never throws for expected malformed-input cases); document is never partially loaded into the Store on failure |
| Exporter failure | Export adapter | Returns a typed error result; the source document is never mutated regardless of export outcome |
| Async/background job failure (AI generation, collaboration sync) | The calling adapter/worker itself | Reported via that subsystem's own error channel (e.g., a job queue's failure event) — the Engine's Command Dispatcher only ever sees a well-formed Command or nothing; it is never exposed to "the AI call timed out," only to "here are the Commands that resulted, if any" |

**General principle:** failures are contained as close to their origin as
possible and never allowed to leave the Store in an inconsistent state — an
error anywhere in the pipeline must be recoverable to a known-good Store
version, never a half-applied one.

## 10. Update Pipeline Variants

### 10.1 Synchronous Updates

The default path (Section 3's loop) — a Command dispatches, validates,
commits, and notifies subscribers, all within a single synchronous call
stack. This is the correct default for direct user interaction (typing,
clicking) where latency must be imperceptible.

### 10.2 Batched Updates

Multiple related Commands (e.g., "align 5 selected widgets") are submitted
via `dispatchBatch()`, running through one Transaction, one validation
pass, and — critically — **one Event Bus notification**, not five. This
prevents redundant renderer work when many widgets change together
(Rendering-Architecture.md Section 12's `RenderStateDiff` is computed once
per transaction, not once per individual Command).

### 10.3 Deferred/Merged Updates

High-frequency interactions (continuous drag, typing) produce a rapid
sequence of Commands that the Scheduler (Section 6.16) merges via each
Command's own `merge()` hook (mirroring the merge capability already
identified in the existing SaaS's Command pattern) before they ever reach
the Transaction Manager — so a 200-event drag becomes one merged
`MoveWidgetCommand` in the undo stack and one Store version, not 200.

### 10.4 Asynchronous Updates

Some Command *preparation* is async (e.g., an image widget's creation
needs to first resolve an uploaded asset's dimensions via the Asset
Manager), but Command *execution* against the Store is always synchronous.
The async work happens before `dispatch()` is called, never inside
`Command.execute()` — this keeps the Transaction Manager's atomicity
guarantee simple (Principle 8 — deterministic core).

### 10.5 Animation Updates (Forward-Looking, Not Implemented Yet)

When Animation-System.md introduces a timeline, it will require the
Scheduler to gain an actual tick source (e.g., `requestAnimationFrame`-driven
in a browser renderer, or a virtual clock in SSR/export contexts) — this is
flagged here as the seam where a future scheduled/ticked update mode enters
the system, additively, without changing the event-driven default described
in Section 4.5.

### 10.6 Collaborative Updates (Forward-Looking, Not Implemented Yet)

A future `@engine/collab` package participates in the exact same loop as
any other Command source: remote operations arrive, get translated into
Commands (or a specialized `RemoteTransaction` variant of the Transaction
Manager that applies pre-validated remote state deltas), and flow through
the identical Validation → Transaction → Store → Event Bus path local edits
use. **Collaboration is a Command Dispatcher participant, never a parallel
mutation path** — this is what fulfills Design-Principles.md Principle 13
at the runtime level: the pipeline was shaped for this from day one, so
adding `@engine/collab` later requires no change to Sections 3–7 of this
document, only a new caller into Section 6.5.

## 11. Threading and Execution Context Portability

Nothing in this pipeline assumes a specific JavaScript execution context.
This is achieved by construction, not by special-casing:

- The Store, Validation Pipeline, Transaction Manager, and Command
  Dispatcher have zero dependency on `window`, `document` (the DOM global),
  or any browser API — they are plain data-processing services, valid in a
  browser main thread, a Web Worker, or a Node.js process identically.
- A **Web Worker** deployment moves the entire per-`DocumentSession` service
  group (Section 5.7) off the main thread; only the attached renderer
  (which necessarily needs DOM/Canvas access) stays on the main thread,
  communicating with the worker-hosted Engine via a message-passing
  transport that carries serialized Commands and `RenderState` diffs — a
  transport that is itself just another `RendererAdapter`-compatible
  boundary (Rendering-Architecture.md Section 5), not a special
  architecture.
- A **Node.js export worker** runs an Engine with no renderer attached at
  all (Section 4.1) — it loads a document, and calls an export adapter,
  never touching any UI-shaped concept.
- **Server-side rendering** for thumbnails runs an Engine plus exactly one
  attached renderer from the `@engine/renderer-ssr` family, in Node,
  producing a static image — architecturally identical to the interactive
  case, just headless (Rendering-Architecture.md Section 17).

This portability is a direct consequence of Design-Principles.md Principle
8 (deterministic core, effectful edges) and Principle 11 (no application
concerns in the core) — a pipeline with no hidden I/O and no hidden global
state has no reason to care which JS execution context it runs in.

## 12. Performance: Where Caching and Dirty-Checking Belong

| Concern | Owned By | Mechanism |
| --- | --- | --- |
| Dirty checking (what changed since last render) | Event Bus + Store, surfaced as `RenderStateDiff` | Structural sharing (Domain-Model.md's normalized store) gives cheap reference-equality checks "for free"; the Store additionally tracks a changed-ID set per transaction (Rendering-Architecture.md Section 12) |
| Incremental rendering | Renderer (per adapter) | Consumes `RenderStateDiff` to skip unchanged widgets — an Engine-provided input, renderer-owned decision |
| Incremental validation | Validation Pipeline | Only entities touched by a given Transaction, plus cross-entity invariants whose declared triggers intersect the change set, are re-validated (ADR-0003; trigger index in State-Management.md §11) — whole-document validation runs only on load/import |
| Incremental layout | Deferred entirely to Layout-System.md | Not implemented in this version; flagged as a future seam per Principle 7 |
| Memoization | Each service, locally | E.g., Theme Manager memoizes resolved `Theme` objects by ID; this is an internal implementation detail, not a public contract |
| Scheduling / batching | Scheduler (Section 6.16) | Merges high-frequency Commands before they reach the Transaction Manager (Section 10.3) |

**General rule:** the Store and Transaction Manager are optimized for
*correctness and atomicity*, not raw throughput — performance-sensitive
batching happens *before* a Transaction is submitted (Scheduler-side), never
by relaxing the Transaction Manager's atomicity guarantee.

## 13. Summary Table — Who Owns What

| Stage | Owner Service | May Mutate Store? | May Render? | May Be Bypassed By Plugins? |
| --- | --- | --- | --- | --- |
| Command submission | Command Dispatcher | No (delegates) | No | No |
| Validation | Validation Pipeline | No | No | No |
| Atomic apply | Transaction Manager | Yes (only path) | No | No |
| Change notification | Event Bus | No | No | No |
| Visual output | Renderer Adapter | No | Yes | N/A (renderers are adapters, not plugins in the mutation sense) |
| Interaction interpretation | Interaction Manager | No (dispatches Commands) | No | No |
| Undo/redo | History Manager | No (invokes committed Commands' `undo()` inside a new transaction — Command-System.md §11; wording corrected 1.1.0) | No | No |

## 14. Open Questions — Resolution Status (updated 1.1.0)

- Exact `Command` interface shape — **resolved**: Command-System.md.
- `InteractionIntent` → tool-state → Command interpretation rules —
  **resolved**: Selection-and-Interaction.md + ADR-0002.
- `RenderStateDiff` computation detail — **resolved**: State-Management.md §5.
- Reentrancy of `dispatch()` during event delivery — **resolved**:
  State-Management.md §10 (FIFO queue, run-to-empty, depth limit).
- `RemoteTransaction` shape for collaboration — still deferred until
  the collaboration package is actually built, per Principle 7; Section
  10.6 only fixes the seam, not the implementation.

## 15. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | §4.2 adds injected `TextMeasurer`; §4.4 attachment moved to session scope; §5 Clipboard dependency corrected; §6.7 Selection Manager contract widened to full `InteractionState`; §6.15 Interaction Manager rewritten (hosts Tools, receives normalized input, owns intent→Command translation); §12/§13 wording aligned with ADR-0003 and Command-System.md §11 | ADR-0002, ADR-0003, ADR-0004, ADR-0006 |
