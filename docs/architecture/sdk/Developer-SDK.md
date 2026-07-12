# Developer-SDK.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.1.0
**Depends on:** Every prior architecture document (this document is the
**public-facing surface** over all of them, per Package-Structure.md's
Developer SDK / Ring 3 positioning)

---

## 1. Purpose

Every prior document defined internal architecture — how the engine
behaves, how subsystems communicate, how packages are bounded. This
document defines the **developer experience**: the actual APIs a
third-party company builds a real product against, five or ten years from
now, using only what is documented here. If a capability exists in the
engine but isn't reachable through this SDK's surface, it does not yet
exist from a developer's perspective.

## 2. SDK Design Philosophy

Six principles govern every API decision in this document. Where a
tradeoff arises between them, this priority order breaks the tie.

1. **Discoverability over cleverness.** A developer should be able to
   guess the right API by pattern-matching against one they already know
   from this SDK, without reading documentation first. tldraw's
   consistent `editor.createShapes()` / `editor.updateShape()` /
   `editor.deleteShapes()` naming, all hanging off one central `editor`
   object [web:232][web:229], is the model: one root object, predictable
   verb-noun method names, no hidden second API surface.
2. **Consistency over local optimization.** Every registration API
   (widgets, tools, renderers, importers, exporters, AI providers) follows
   the identical `defineX()` + `engine.x.register()` shape (Section 5),
   even where a slightly terser one-off API might be possible for a
   specific extension point. Predictability across the whole surface beats
   a marginally shorter call for one part of it.
3. **Strong typing as the primary documentation mechanism.** Following
   VS Code's own extension API guideline that the API itself, plus its
   types, should communicate intent without requiring prose
   [web:231][web:225] — every extension point is generic over the
   developer's own data type (`defineWidget<MyWidgetData>()`), so IDE
   autocomplete and compile errors do most of the teaching.
4. **Predictable APIs over flexible ones.** An API that can be used in
   exactly one correct way is preferred over one with five configuration
   options that interact in surprising ways. Where the underlying
   architecture already forces a single correct pattern (e.g., "Commands
   are the only mutation mechanism"), the SDK exposes exactly one call
   shape for it, never an escape hatch.
5. **Long-term stability over short-term convenience.** A method signature,
   once shipped stable, does not change — it is deprecated and superseded,
   never mutated (Section 14).
6. **Progressive disclosure.** The simplest possible task (create an
   engine, load a document, render it) requires touching 3-4 calls total;
   advanced capabilities (custom renderers, AI providers, collaboration)
   are additive, opt-in layers a developer never has to see until they
   need them.

## 3. The Root Object

Every SDK interaction begins with one object, mirroring tldraw's `editor`
as the single "god object" every shape, tool, and UI component
communicates through internally [web:232]:

```typescript
const engine = createEngine(config?: EngineConfig);
```

The SDK has **two scopes** (revised 1.1.0, ADR-0004), matching
Engine-Lifecycle.md §5's split between engine-global services and
per-`DocumentSession` services. The runtime supports multiple concurrent
sessions; anything per-document therefore hangs off the session, never the
engine.

**Engine scope — registries and global services:**

```typescript
engine.documents     // create/load sessions — Serialization.md
engine.widgets       // register widget types — Widget-System.md
engine.tools         // register custom tools — Selection-and-Interaction.md
engine.commands      // register command factories — Command-System.md §16
engine.renderers     // register renderer adapters — Rendering-Architecture.md
engine.adapters      // register importers/exporters — Engine-Lifecycle.md §6.13
engine.plugins       // discover/register plugins — Plugin-System.md
engine.themes        // register themes — Engine-Lifecycle.md
engine.assets        // register asset providers — Engine-Lifecycle.md
engine.ai            // register AI providers — Plugin-System.md 9.5
engine.collaboration // register collaboration providers — Plugin-System.md 9.6
engine.devtools      // diagnostic observers — Plugin-System.md 16
```

**Session scope — everything about one open document:**

```typescript
const session = await engine.documents.load(bytes);

session.dispatch(cmd)         // + session.dispatchBatch(cmds) — Command-System.md
session.history               // undo/redo — Command-System.md §11
session.selection             // read/observe selection — Selection-and-Interaction.md
session.renderers             // attach(adapterId, target) — ADR-0004
session.events                // Document/Interaction event subscription — Event-System.md
session.store                 // read-only DocumentQuery — State-Management.md §4
session.collaboration         // connect a registered provider to THIS session
session.ai                    // run a registered provider against THIS session
```

For the common single-document application, `engine.*` delegates
`dispatch`/`history`/`selection`/`events` to the sole open session as
**documented convenience sugar** — it throws if more than one session is
open, so multi-document code is forced onto the unambiguous `session.*`
surface. No capability exists outside these two trees — there is no
"advanced" undocumented import path a developer needs to discover through
source reading.

## 4. Getting Started — The Minimal Path

The simplest possible product build requires exactly this sequence
(Principle 6, progressive disclosure):

```typescript
const engine = createEngine({ textMeasurer: browserTextMeasurer() }); // ADR-0006
engine.renderers.register(domRenderer);
const session = await engine.documents.load(fileBytes);
session.renderers.attach(domRenderer.id, containerElement);   // RenderTarget required
```

Four calls (corrected 1.1.0 — the previous "three call" example omitted
renderer registration and the render target, and did not typecheck against
the canonical `RendererAdapter` contract). Nothing about widgets, plugins,
AI, or collaboration is required to reach a working, rendering,
interactive document — every other section of this SDK is something a
developer opts into later, never something they must understand up front.

## 5. Registering Widgets

```typescript
const MyWidget = defineWidget<MyWidgetData>({
  type: "my-org.chart",
  defaultData: () => ({ series: [] }),
  validate: (data) => { /* ... */ },
  render: (data, ctx) => { /* returns a RenderNode */ },
});

engine.widgets.register(MyWidget);
```

This is the canonical shape every other registration API in this document
follows: **`defineX()` produces a plain, serializable descriptor object;
`engine.x.register()` is what actually activates it against the engine.**
Splitting definition from registration (rather than one combined call)
means a `defineWidget()` result can be unit-tested, shared across multiple
engine instances, or published as an npm package on its own, entirely
independent of any specific `engine` instance — directly analogous to how
tldraw's `ShapeUtil` classes are defined once and passed into any number of
`<Tldraw>` instances via the `shapeUtils` prop [web:86][web:230].

## 6. Creating Custom Tools

```typescript
const MyTool = defineTool({
  id: "my-org.connector",
  initial: "idle",
  states: {
    idle: { onPointerDown: (ctx, e) => ctx.transitionTo("dragging") },
    dragging: { onPointerMove: (ctx, e) => { /* ... */ },
                onPointerUp: (ctx, e) => ctx.emitIntent({ kind: "createRequested", /* ... */ }) },
  },
});

engine.tools.register(MyTool);
```

This directly exposes Selection-and-Interaction.md's `ToolNode` state
machine as public API, following the exact hierarchical state pattern
tldraw's SDK documents for custom tools [web:229][web:87] — a developer
already familiar with tldraw's tool model transfers that knowledge here
almost directly, which is a deliberate discoverability choice (Principle
1): don't invent new vocabulary where a proven, well-documented pattern
already exists in the wild.

## 7. Registering Plugins

```typescript
export function activate(context: PluginContext) {
  context.registries.widgets.register(MyWidget);
  context.registries.tools.register(MyTool);
  return [/* Disposables for cleanup */];
}

export const manifest: PluginManifest = {
  id: "my-org.my-plugin",
  version: "1.0.0",
  engineVersionRange: "^2.0.0",
  activationEvents: [{ type: "onDocumentLoad" }],
  contributes: { widgets: ["my-org.chart"], tools: ["my-org.connector"] },
};

engine.plugins.register(manifest, { activate });
```

A plugin is not a new mental model on top of Sections 5-6 — it is a
*bundle* of the exact same `register()` calls, deferred until activation
(Plugin-System.md Section 6). This is what keeps the SDK's total surface
area small: learning "how do I register a widget" and "how do I register a
tool" already teaches a developer everything needed to author a plugin
that does both.

## 8. Creating Renderers

```typescript
// The canonical RendererAdapter contract — Rendering-Architecture.md §5,
// exactly (corrected 1.1.0; the previous reconcile-shaped variant is struck):
const MyRenderer: RendererAdapter = {
  id: "my-org.custom-renderer",
  mount(target: RenderTarget, initialState: RenderState): RendererHandle {
    /* ... */
    return {
      update(state, diff) { /* consume RenderStateDiff */ },
      unmount() { /* remove output, may remount later */ },
      dispose() { /* release retained resources permanently */ },
      capabilities: { interactive: true, supportsOverlays: true, supportsAnimation: false },
    };
  },
};

engine.renderers.register(MyRenderer);                     // registry (engine scope)
const handle = session.renderers.attach(MyRenderer.id, containerElement); // instance (session scope)
```

Registering a renderer type and attaching a specific renderer instance to a
session are deliberately two different calls — mirroring
Rendering-Architecture.md's and Engine-Lifecycle.md's own distinction
between "a renderer family exists" and "this session currently has this
renderer attached" (a session may have zero, one, or multiple renderers
attached across its lifetime).

## 9. Creating Importers and Exporters

```typescript
const MyExporter = defineExporter({
  format: "my-format",
  export: async (document, options) => { /* returns bytes */ },
});
engine.adapters.registerExporter(MyExporter);

const MyImporter = defineImporter({
  format: "my-format",
  import: async (bytes) => { /* returns a PresentationDocument or Commands */ },
});
engine.adapters.registerImporter(MyImporter);
```

(Corrected 1.1.0 — the previous `engine.plugins.contributeExporter()` shape
broke this document's own Principle 2: every registration follows
`defineX()` + `engine.x.register…()`. Adapters register against the
Adapter Registry, Engine-Lifecycle.md §6.13; a *plugin* contributes the
same descriptors via its manifest/`activate()`, which calls this same API.)

Both follow the `defineX()` pattern (Section 5) exactly. Neither function
signature exposes a renderer, a Tool, or a DOM/Canvas type anywhere in its
type signature — this is the SDK-level enforcement of Serialization.md
Section 17's rule that importers/exporters never know about rendering; a
developer literally cannot accidentally import rendering code into an
exporter's `export()` function and have it typecheck against a rendering
type it was never given access to in the first place.

## 10. Creating Themes

```typescript
const MyTheme = defineTheme({
  id: "my-org.dark",
  tokens: { "color.background": "#1a1a1a", "color.text": "#f5f5f5", /* ... */ },
});

engine.themes.register(MyTheme);
engine.themes.apply("my-org.dark");
```

## 11. Creating Custom Commands

```typescript
const MyCommand = defineCommand<MyCommandPayload>({
  type: "my-org.customOp",
  schemaVersion: 1,
  execute: (tx, payload) => { /* tx.patchWidget(...), etc. */ },
  undo: (tx, payload) => { /* inverse operation */ },
  migrate: (payload, fromVersion) => payload,   // optional — Command-System.md §16
});

engine.commands.register(MyCommand);   // registers the FACTORY (Command Factory Registry)

// later, against a specific session:
session.dispatch(MyCommand.create({ /* payload */ }));
```

(Clarified 1.1.0: `defineCommand()` produces a **Command factory**;
`MyCommand.create(payload)` captures the payload and returns a `Command`
whose `execute(tx)`/`undo(tx)` close over it — this is how the descriptor
shape above reconciles with Command-System.md §5's
`execute(tx: TransactionContext)` contract. Dispatch is session-scoped,
ADR-0004.)

`execute`/`undo` receive only `TransactionContext` (Command-System.md
Section 5) — the SDK's type signature for `defineCommand()` makes it a
compile error to reference `engine`, a renderer, or a DOM type inside a
Command body, which is the SDK-level enforcement of "Commands know nothing
about rendering or UI."

## 12. Extending Selection Behavior

```typescript
session.selection.onDidChange((selection) => { /* ... */ });
const current = session.selection.get();
```

Custom hit-test geometry is part of the widget's own definition
(`WidgetDefinition.hitTest`, Widget-System.md §3 — patch applied 1.1.0),
not a separate selection-layer registration; the previous
`engine.selection.registerHitTest()` API is struck as a duplicate
registration path for the same capability.

Selection is primarily an **observation** surface for most developers
(read current selection, subscribe to changes) — actually *driving*
selection programmatically (`session.selection.set(ids)`) is supported but
intentionally less prominent in the API surface than observation, since
most products read selection far more often than they need to
programmatically force it.

## 13. Listening to Engine Events

```typescript
session.events.on("documentChanged", (event) => { /* ... */ });   // per-session categories
engine.plugins.events.on("pluginRegistered", (e) => { /* ... */ }); // engine-global categories
engine.devtools.observeEvents((envelope) => { /* diagnostic-only, Event-System.md §16 */ });
```

(Scoped 1.1.0 per ADR-0004: Document/Interaction/Renderer events are
per-session; Engine/Lifecycle/Plugin events are engine-global; the
diagnostic firehose lives under `devtools`.)

One consistent `on(eventType, handler): Disposable` shape covers every
event category from Event-System.md's taxonomy — a developer never needs
to learn a category-specific subscription API; the type of `eventType`
alone determines the payload's shape via TypeScript overloads, keeping
discoverability high (typing `engine.events.on("` and reading autocomplete
reveals every event type that exists in the system).

## 14. Integrating AI

```typescript
engine.ai.registerProvider({
  id: "my-org.gpt-layout",
  generate: async (request) => {
    // returns Command[] — e.g. a single Macro Command
    return [InsertGeneratedSlidesCommand.create({ /* ... */ })];
  },
  // optional streaming variant (ADR-0005 §2) — each yielded batch is one
  // Macro Command, enabling progressive slide-by-slide generation:
  generateStream: async function* (request) { /* yield Command[] batches */ },
});

const commands = await session.ai.generate({ prompt: "Add a summary slide" });
session.dispatchBatch(commands);
```

The AI provider's `generate()` signature returns `Command[]` and nothing
else — there is no `render`, `ui`, or `document` mutation method exposed to
it, enforcing Engine-Lifecycle.md Section 8's rule at the type level: AI
can only ever produce Commands.

## 15. Integrating Collaboration

```typescript
engine.collaboration.registerProvider({
  id: "my-org.sync-server",
  connect: (session) => { /* returns a CollabConnection */ },
});

session.collaboration.connect("my-org.sync-server", { roomId: "abc123" });
```

Collaboration is opt-in per `DocumentSession`, never engine-global —
consistent with Selection-and-Interaction.md's session-scoping decisions
and Engine-Lifecycle.md's per-session service model.

## 16. Testing

```typescript
import { createTestEngine, fixtureDocument, mockRenderer } from "presentation-testing";

const engine = createTestEngine();   // injects deterministic clock, IDs, RNG, text measurer
const session = await engine.documents.load(fixtureDocument("basic-deck"));
session.renderers.attach(mockRenderer().id, mockTarget());

session.dispatch(MoveWidgetCommand.create({ widgetId, delta: { x: 10, y: 0 } }));
expect(session.store.getWidget(widgetId).transform.x).toBe(110);
```

`presentation-testing` (Package-Structure.md) is a first-class, documented
part of the SDK, not an internal tool — every extension point (widgets,
tools, commands, renderers) is designed to be testable in complete
isolation, with no DOM, no real renderer, no network, because
`TransactionContext`/`ToolContext`/`RenderContext` are all plain
interfaces a test can trivially mock, following the same principle behind
tldraw's dedicated Driver package for simulating user behavior in tests
[web:228].

## 17. Debugging

```typescript
const observer = engine.devtools.observeCommands((cmd, result) => { /* ... */ });
const eventObserver = engine.devtools.observeEvents((envelope) => { /* ... */ });
```

`engine.devtools` is the one namespace explicitly documented as read-only —
its methods return data and Disposables, never anything that mutates state,
making it safe to wire into arbitrary production telemetry without risk of
accidentally introducing a second control-flow path (Event-System.md
Section 16, Command-System.md Section 18).

## 18. Versioning and Backward Compatibility

The SDK's own public API follows semver, independent of every other
versioning axis already established (document schema, widget data, plugin
config, envelope) — this is officially the **fifth** distinct versioning
axis in the platform, and it is scoped exclusively to method/type
signatures in this document's namespace tree.

**Compatibility commitments:**

- A method present in a given major version never has its signature
  changed within that major version — only additive optional parameters.
- A deprecated method remains functional for at least one full major
  version cycle after deprecation, with a compile-time (`@deprecated`
  JSDoc, surfaced by every major IDE) and runtime console warning.
- Breaking changes are batched into major version bumps only, accompanied
  by a migration guide — never introduced piecemeal across minor versions.
- `EngineConfig`/`PluginManifest.engineVersionRange` (Plugin-System.md
  Section 3) is how a plugin declares which major SDK version(s) it
  targets — the SDK's own versioning is what that range checks against.

This mirrors VS Code's own extension API stability commitment, where the
published `vscode.d.ts` API surface for a given VS Code version is treated
as a durable contract extension authors can build against for years
without breakage [web:231][web:225].

## 19. What This SDK Explicitly Does NOT Expose

- No direct Store *write* access — `session.store` is the read-only
  `DocumentQuery` surface (State-Management.md §4) and nothing more; the
  only write surface anywhere is `TransactionContext` inside a Command
  (ADR-0007, enforced at the SDK surface). `engine.store` does not exist.
- No way to dispatch a Command that skips validation — `dispatch()` and
  `dispatchBatch()` are the only mutation entry points, and both always run
  the full pipeline (Command-System.md Section 3).
- No renderer-specific types leak into widget/command/importer/exporter
  definitions — `RenderNode` is the only rendering-adjacent type any of
  them ever see, and only where the architecture already permits it
  (widgets, not commands).
- No "internal" or "advanced" undocumented API tier — if it's not in this
  document's namespace tree, it is not supported public surface, even if
  technically reachable through a deep import; using it voids the
  compatibility guarantees in Section 18.

## 20. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | Root object split into engine scope (registries) and session scope (dispatch/history/selection/events/renderer attachment/store query) per ADR-0004; renderer example corrected to the canonical `RendererAdapter` contract; `contributeExporter/Importer` → `engine.adapters.register…`; `defineCommand` factory semantics and payload migration clarified; `registerHitTest` struck (duplicate of `WidgetDefinition.hitTest`); AI streaming variant added; minimal path corrected (registration + render target + text measurer) | ADR-0004, ADR-0005, ADR-0006; Readiness Review C4/C7 and SDK convention breaks |
