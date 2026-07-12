# Plugin-System.md

**Status:** Core — changes require an ADR (governed by Architecture-Index.md §11)
**Version:** 1.1.0
**Depends on:** Engine-Lifecycle.md, Widget-System.md, Command-System.md,
Event-System.md, Selection-and-Interaction.md, Serialization.md

---

## 1. Purpose and Relationship to Widget-System.md

Widget-System.md defines **one specific extension point** — how content
types (text, image, chart) plug into the Domain Model. This document
defines the **general extensibility architecture of the entire engine** —
how *any* subsystem (Tools, Commands, Renderers, Importers, Exporters,
Asset Providers, Themes, Validators, AI Providers, Collaboration Providers,
and yes, Widgets too) becomes something a third party can contribute
without forking the engine. Widget-System.md's registry is, in the
vocabulary this document establishes, one **Extension Point** among many —
this document is the general mechanism; Widget-System.md is its first,
most detailed instance.

The governing constraint, borrowed deliberately from VS Code's model: the
core engine is **closed for modification, open for extension**
[web:194][web:125]. A plugin author never patches engine source; they
register contributions against declared Extension Points, exactly the way
a VS Code extension declares `contributes.commands` in a manifest rather
than editing VS Code itself [web:195][web:196].

## 2. Plugin Architecture Overview

```
Plugin Manifest (declarative)
    │
    ▼
Plugin Registry (Engine-Lifecycle.md Section 6.11) — validates manifest,
    │                                                  resolves dependencies
    ▼
Activation (lazy, event-driven — Section 6)
    │
    ▼
Plugin Module (imperative `activate()` function runs)
    │
    ▼
Contributions registered against Extension Points (Section 9) —
    via the SAME public registries the engine's own first-party
    contributions use (Widget Registry, Tool Registry, Command Factory
    Registry, Adapter Registry, etc.)
    │
    ▼
Runtime participation (plugin code now runs alongside first-party code,
    indistinguishable in privilege — Design-Principles.md Principle 6)
    │
    ▼
Deactivation / Disposal (Section 11)
```

A plugin is **not** a special runtime concept with elevated access — it is
an application-supplied bundle of registration calls against public APIs,
loaded at a time and in an order this document makes precise and
predictable.

## 3. The Plugin Manifest

Every plugin declares itself **declaratively** before any of its code runs,
mirroring VS Code's `package.json` manifest split between static
declaration and imperative activation logic [web:194][web:196]:

```typescript
interface PluginManifest {
  id: string;                      // globally unique, namespaced (e.g. "acme.chart-widgets")
  version: string;                 // semver
  engineVersionRange: string;      // semver range this plugin declares compatibility with
  dependencies?: PluginDependency[];       // Section 8
  activationEvents: ActivationEvent[];     // Section 6
  contributes: ContributionDeclaration;    // Section 9 — declarative, no code runs yet
  permissions?: PluginPermission[];        // Section 10
}

interface PluginDependency {
  pluginId: string;
  versionRange: string;
  optional?: boolean;
}
```

**Why declarative-first matters:** the Plugin Registry can validate an
entire plugin ecosystem's compatibility, resolve activation order (Section
8), and know what a plugin *will* contribute before running a single line
of that plugin's code — this is what makes a plugin marketplace/directory
possible later (listing what a plugin does without executing it) and what
makes error isolation (Section 15) tractable, since a manifest parse
failure never touches runtime state at all.

## 4. Plugin Lifecycle

```
1. Discovery         (Section 5)
2. Manifest validation   (schema check, engineVersionRange check —
                          Section 12)
3. Dependency resolution  (Section 8 — topological sort, cycle detection)
4. Registration       (plugin recorded in Plugin Registry, INACTIVE state —
                       Engine-Lifecycle.md Section 4.2 — no code has run yet)
5. Activation         (Section 6 — triggered by a declared activation event;
                       plugin's `activate(context)` function runs)
6. Active             (contributions are live; plugin participates in the
                       runtime pipeline like first-party code)
7. Deactivation       (Section 11 — `deactivate()` runs; contributions
                       withdrawn)
8. Disposal           (Plugin Registry entry removed, or kept as INACTIVE
                       for potential re-activation)
```

This lifecycle is a refinement of Engine-Lifecycle.md Section 4.6's
"dynamic reconfiguration" — every stage here can occur at Engine
construction time *or* mid-session, identically.

## 5. Plugin Discovery

Discovery is explicitly **out of this document's architectural concern in
terms of mechanism** (Principle 11 — the engine has no opinion on npm vs. a
marketplace API vs. a local folder scan) but **in scope for contract**: the
Engine exposes exactly one ingestion point —

```typescript
engine.plugins.discover(source: PluginSource): Promise<PluginManifest[]>;
```

where `PluginSource` is an adapter (`{ type: "npm-package", name }`,
`{ type: "url", manifestUrl }`, `{ type: "local", path }`) supplied by the
host application. The engine never crawls a filesystem or network itself —
discovery *sources* are pluggable in exactly the same open-extension spirit
as everything else in this document (a `PluginSource` resolver is itself
registered, not hardcoded).

## 6. Activation — Lazy by Default

Directly adopting VS Code's activation event model [web:198][web:202],
because eager-loading every registered plugin at Engine construction is
what causes large plugin ecosystems to degrade startup performance over
time:

```typescript
type ActivationEvent =
  | { type: "onEngineStart" }                        // eager — use sparingly
  | { type: "onWidgetTypeUsed"; widgetType: WidgetTypeId }
  | { type: "onCommandDispatched"; commandType: string }
  | { type: "onDocumentLoad" }
  | { type: "onExportRequested"; format: string }
  | { type: "onImportRequested"; format: string }
  | { type: "onToolActivated"; toolId: string };
```

A plugin declaring only `{ type: "onExportRequested", format: "pptx" }`
never loads its module code until an export to that specific format is
actually requested — this is the direct mechanism that lets an Engine host
hundreds of registered-but-dormant plugins with near-zero runtime cost for
the ones not currently needed, matching VS Code's stated rationale for lazy
extension loading [web:125].

## 7. The Plugin Context — What `activate()` Receives

```typescript
function activate(context: PluginContext): void | Disposable[];

interface PluginContext {
  readonly pluginId: string;
  readonly registries: {
    widgets: WidgetRegistry;              // Widget-System.md Section 4
    tools: ToolRegistry;                  // Selection-and-Interaction.md Section 15
    commands: CommandFactoryRegistry;     // Command-System.md Section 16
    renderers: RendererRegistry;          // Rendering-Architecture.md Section 5
    adapters: AdapterRegistry;            // Serialization.md Section 17 / import-export
    assetProviders: AssetProviderRegistry;
    themeProviders: ThemeProviderRegistry;
    validators: ValidatorRegistry;        // Section 9's new extension point
    contextMenus: ContextMenuRegistry;
    keyboardShortcuts: ShortcutRegistry;
    aiProviders: AIProviderRegistry;
    collabProviders: CollabProviderRegistry;
  };
  readonly config: PluginConfig;          // Section 13
  readonly logger: PluginLogger;          // namespaced, Section 16
  subscribe<T>(event: Event<T>, handler: (payload: T) => void): Disposable;
}
```

**Critical constraint, restated from every prior document's boundary
tables:** `PluginContext` exposes *only* the same public registries an
application itself would use — there is no `context.store` (direct Store
access), no `context.dispatchWithoutValidation()`, no privileged bypass of
any kind. A plugin has exactly the capabilities Design-Principles.md
Principle 6 promises: identical standing to first-party code, never more.

## 8. Dependency Graph and Initialization Order

Plugin dependencies (`PluginManifest.dependencies`, Section 3) form a
directed graph, resolved via topological sort before any activation occurs
— directly analogous to how Unreal Engine plugins declare dependencies on
other plugins in their `.uplugin` file, which the engine uses to
auto-resolve load order and ensure a dependency is available before the
dependent plugin's module code runs [web:200][web:205].

```
Resolution rules:
1. Build a dependency graph from all discovered manifests.
2. Detect cycles → registration fails for the entire cycle, loudly,
   before any plugin in the cycle activates (Engine-Lifecycle.md
   Section 9's fail-loud principle).
3. Missing required (non-optional) dependency → the dependent plugin
   fails registration; other, unrelated plugins are unaffected
   (Section 15 — error isolation).
4. Activation order respects the graph: a plugin's declared dependencies
   are guaranteed already ACTIVE before its own `activate()` runs, but
   only if both share an overlapping activation trigger — lazy activation
   (Section 6) means "dependency resolved" is a partial order constraint,
   not a guarantee that a dependency activates eagerly just because
   something depends on it.
```

This is why Section 4 lists "Registration" (dependency-graph-aware) as a
distinct stage from "Activation" (lazily triggered) — the graph is fully
known and validated at registration time, long before most plugins
actually run any code.

## 9. Extension Points — Complete Catalogue

Each row below is a registry (Section 7) a plugin contributes to
declaratively (`manifest.contributes`) and/or imperatively (inside
`activate()`), with its own owning service already defined by a prior
document, or newly introduced here:

| Extension Point | Owning Registry | Defined In |
| --- | --- | --- |
| Widgets | Widget Registry | Widget-System.md |
| Tools | Tool Registry | Selection-and-Interaction.md Section 15 |
| Commands | Command Factory Registry | Command-System.md Section 16 |
| Renderers | Renderer Registry | Rendering-Architecture.md Section 5 |
| Importers | Adapter Registry | Serialization.md Section 17 |
| Exporters | Adapter Registry | Serialization.md Section 17 |
| Asset Providers | Asset Provider Registry | Engine-Lifecycle.md Section 6.9 |
| Themes | Theme Manager | Engine-Lifecycle.md Section 6.10 |
| Validators | Validator Registry | **new, this document** — see below |
| Property Panels | Property Panel Registry | **new, this document** — see below |
| Context Menus | Context Menu Registry | **new, this document** — see below |
| Keyboard Shortcuts | Shortcut Registry | **new, this document** — see below |
| AI Providers | AI Provider Registry | **new, this document** — see below |
| Collaboration Providers | Collab Provider Registry | **new, this document** — see below |
| Intent Interpreters | Intent Interpreter Registry | Selection-and-Interaction.md §15 (added 1.1.0, ADR-0002) |

### 9.1 Validators (new)

```typescript
interface ValidatorContribution {
  appliesTo: "document" | WidgetTypeId;
  validate(target: unknown): ValidationResult;
}
```

Supplements (never replaces) the mandatory structural/per-widget validation
already specified in Domain-Model.md Section 12 — e.g., a compliance
plugin adding "no widget may use disallowed brand colors" as an additional
document-wide check. Registered validators run **after** core validation,
additively; a plugin validator can reject a Command's result but can never
loosen or bypass a core validation rule.

### 9.2 Property Panels (new)

```typescript
interface PropertyPanelContribution {
  appliesTo: WidgetTypeId;
  render(ctx: PropertyPanelContext): RenderNode;   // reuses Rendering-Architecture.md's RenderNode
}
```

A UI-layer extension point — deliberately built on the same `RenderNode`
contract Rendering-Architecture.md already defines, so a property panel
contribution is renderer-family-aware in exactly the same way widget
rendering is, rather than inventing a second UI contribution mechanism.

### 9.3 Context Menus (new)

```typescript
interface ContextMenuContribution {
  when(ctx: InteractionContext): boolean;   // reuses Selection-and-Interaction.md's InteractionContext
  items: ContextMenuItem[];
}
```

### 9.4 Keyboard Shortcuts (new)

```typescript
interface ShortcutContribution {
  keys: string;               // e.g. "Cmd+Shift+G"
  commandType: string;        // maps to a registered Command Factory
  when?(ctx: InteractionContext): boolean;
}
```

Shortcuts never execute a Command directly — they resolve to a Command
type and construction payload, dispatched through the ordinary Command
Dispatcher (Command-System.md), keeping this extension point fully
consistent with "Commands are the only mutation mechanism" (Command-System.md
Section 2's ADR).

### 9.5 AI Providers (new)

```typescript
interface AIProviderContribution {
  id: string;
  generate(request: AIGenerationRequest): Promise<Command[]>;
  generateStream?(request: AIGenerationRequest): AsyncIterable<Command[]>;
  // added 1.1.0 (ADR-0005 §2): each yielded batch is dispatched as one
  // Macro Command, enabling progressive slide-by-slide generation UX;
  // undo-grouping across batches is a tracked open question for AI.md.
}
```

Directly implements Engine-Lifecycle.md Section 8's rule: an AI Provider's
entire contract surface is "produce Commands," nothing else — it receives
no renderer reference, no UI type, consistent with every prior document's
AI boundary. It may read current document state between batches via the
`DocumentQuery` surface (State-Management.md §4); stale Commands from a
long-running generation racing live edits fail validation per batch, and
rebase/retry policy is the provider's responsibility (Command-System.md
§12).

### 9.6 Collaboration Providers (new)

```typescript
interface CollabProviderContribution {
  id: string;
  connect(session: DocumentSession): CollabConnection;
}
```

Fixes the registration seam Command-System.md Section 14 and
Serialization.md Section 16 both deferred — the *mechanics* of a specific
collaboration backend (a particular sync server, a particular CRDT library)
are a provider's own implementation, pluggable without engine changes.

## 10. Plugin Permissions

Not every plugin needs every capability. A manifest declares which
Extension Points it intends to use:

```typescript
type PluginPermission =
  | "widgets:register" | "tools:register" | "commands:register"
  | "renderers:register" | "adapters:register" | "assets:read"
  | "assets:write" | "network:fetch" | "storage:local";
```

The Plugin Registry enforces that a plugin's `PluginContext.registries`
(Section 7) only exposes registries the plugin has declared permission for
— attempting to call `context.registries.commands.register(...)` without
having declared `"commands:register"` throws at call time, not silently
no-ops. This is a **declared-intent** permission model (closer to a
manifest-based capability declaration than a runtime sandbox, Section 11
covers the isolation boundary itself) — its purpose is making a plugin's
footprint auditable and reviewable before installation, similar in spirit
to why Figma's plugin manifest declares required API scopes upfront rather
than requesting access ad hoc at runtime.

## 11. Plugin Isolation and Sandboxing

Isolation strength is **tiered**, because "every plugin runs fully sandboxed
in a separate process" is the correct default for untrusted third-party
code but excessive overhead for a first-party bundled widget pack:

| Tier | Isolation Mechanism | Use Case |
| --- | --- | --- |
| **Trusted (in-process)** | Runs in the same JS realm as the Engine; relies entirely on the permission model (Section 10) and TypeScript contract discipline, no runtime enforcement | First-party bundled plugins, internal company plugins |
| **Sandboxed (Worker/iframe)** | Runs in a Web Worker or sandboxed iframe; communicates with the Engine exclusively via serialized message-passing over the same `Command`/Extension Point contracts (Section 7), never a direct object reference | Third-party marketplace plugins, untrusted user-installed extensions |

The sandboxed tier's message-passing boundary is the same pattern Figma
uses for its plugin API — plugin code executes in an isolated context and
can only affect the document through an explicit, serializable API surface,
never through direct object/DOM access to the host application.

**Sandboxed-tier scope (corrected 1.1.0, ADR-0005 §1):** the earlier claim
that sandboxing "requires no special-cased contract" was wrong for
function-bearing contributions. The sandboxed tier supports **data-shaped
contributions** whose invocation is coarse-grained and naturally async —
Importers, Exporters, AI Providers, Collaboration Providers, and
PluginSource resolvers (their payloads are serializable and cross the
channel per invocation, not per frame). **Function-bearing contributions**
— Widgets, Tools, Renderers, Property Panels, Validators, Intent
Interpreters — are **trusted-tier-only** in this architecture version:
proxying per-frame `render()` or per-keystroke `validate()` across a
message channel is not viable and would break the synchronous validation
pipeline. Opening these to untrusted authors requires a dedicated future
ADR (candidates: declarative widget templates, a compiled-sandbox plugin
VM) and is deliberately not designed speculatively (Principle 7).

## 12. Plugin Versioning and Compatibility

- `PluginManifest.engineVersionRange` (Section 3) is checked at
  registration (Section 4, stage 2) against the running Engine's own
  version — an incompatible plugin fails registration with a clear error,
  never activates partially.
- `PluginManifest.version` (the plugin's own semver) is what
  `PluginDependency.versionRange` entries (Section 8) resolve against —
  standard semver dependency resolution, not a novel scheme.
- A plugin bumping its own major version is expected to ship a **plugin
  migration** (Section 13) for any persisted `PluginConfig` or
  plugin-owned document data (e.g., a widget's `data` — already covered by
  Widget-System.md's own `migrate()` hook, Section 10 of that document;
  this document's migration concern is scoped to plugin-level
  configuration state, not widget data, which stays owned there).

## 13. Plugin Configuration

```typescript
interface PluginConfig {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  onDidChange<T>(key: string, handler: (value: T) => void): Disposable;
  migrate?(fromVersion: string, config: unknown): unknown;
}
```

Plugin configuration is namespaced per `pluginId`, persisted by the host
application (Principle 11 — the engine doesn't own a settings database,
only the contract), and versioned independently via the plugin's own
`migrate()` hook (Section 12) — a fourth, deliberately separate versioning
axis alongside envelope/document-schema/widget-data versioning
(Serialization.md Section 15).

## 14. Plugin Communication

Plugins never call each other directly by reference. All inter-plugin
communication happens through:

1. **The Event Bus** (Event-System.md) — a plugin emits a namespaced
   Plugin Event (`myPlugin:somethingHappened`, Event-System.md Section 2's
   taxonomy row), and another plugin subscribes to it, with zero compile-time
   or runtime coupling between the two plugin packages.
2. **Declared dependencies** (Section 8) — if Plugin B *explicitly*
   depends on Plugin A, Plugin B's `activate()` may call a capability
   Plugin A registered (e.g., Plugin A registers a Command type, Plugin B
   dispatches it) — but this is still mediated through a public registry
   (Command Factory Registry), never a direct import of Plugin A's
   internal module.

There is no "plugin-to-plugin direct API call" mechanism, deliberately —
this is what keeps the dependency graph (Section 8) an accurate reflection
of actual coupling, rather than an easily-violated formality.

## 15. Error Isolation

Directly extending Engine-Lifecycle.md Section 9's error table with
plugin-specific rows:

| Failure | Contained At | Effect on Other Plugins |
| --- | --- | --- |
| Manifest validation failure | Registration (Section 4, stage 2) | None — only this plugin fails to register |
| Dependency cycle | Registration (Section 8) | Only plugins in the cycle fail; unrelated plugins register normally |
| `activate()` throws | Activation (Section 4, stage 5) | This plugin transitions to a `FAILED` state, its partial contributions are rolled back (any registry calls it already made are unregistered); other already-active plugins are unaffected |
| A contributed Widget/Tool/Command throws at runtime | Contained at the same per-widget/per-command boundary already specified (Engine-Lifecycle.md Section 9's renderer-failure row; Command-System.md Section 3's rollback) | The failure never propagates to the Plugin Registry itself — a bad widget render doesn't deactivate the plugin that registered it |
| Sandboxed plugin crashes entirely (Section 11) | The message-passing boundary itself | Contained to that Worker/iframe; the host Engine observes only "this plugin's channel closed unexpectedly" and marks it `FAILED`, with zero impact on in-process plugins or the Store |

**General rule, consistent with every prior document:** a plugin failing
must never corrupt Store state, must never crash unrelated plugins, and
must always leave the system in an inspectable `FAILED` state rather than
an ambiguous one.

## 16. Plugin Logging and Observability

```typescript
interface PluginLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
```

Every log entry is automatically tagged with `pluginId`, feeding the same
diagnostic observability surface Event-System.md Section 16 and
Command-System.md Section 18 already establish — a development-mode panel
can filter "show me everything Plugin X did," across its Events, Commands,
and log lines uniformly, because all three carry consistent provenance
tagging by design.

## 17. Performance Considerations

- **Lazy activation (Section 6) is the primary lever** — the number of
  *registered* plugins has near-zero cost; the number of *active* plugins
  is what matters, and activation events keep that number small at any
  given moment.
- **Manifest validation is cheap and upfront** — expensive work (actual
  plugin module parsing/execution) never happens during discovery/registration,
  only at activation, so a host application can register hundreds of
  plugins at startup without a startup-time cost spike.
- **Sandboxed-tier plugins (Section 11) incur message-passing serialization
  overhead** — this is an explicit, accepted cost of the trust boundary,
  not a bug; performance-sensitive first-party plugins choose the trusted
  tier precisely to avoid it.
- **Dependency graph resolution (Section 8) is O(plugins + edges)**,
  computed once at registration, not re-computed per activation.

## 18. What This Layer Explicitly Does NOT Do

- Does not grant any plugin capability beyond what a first-party
  contribution could also do through the same public registries
  (Design-Principles.md Principle 6, restated one more time because it is
  the load-bearing guarantee of this entire document).
- Does not implement plugin discovery mechanisms itself (npm registry
  access, marketplace hosting) — only the `PluginSource` contract
  (Section 5).
- Does not decide sandboxing policy for a given plugin (trusted vs.
  sandboxed tier assignment, Section 11) — that is a host-application
  deployment decision, informed by the plugin's declared permissions
  (Section 10), not an engine-enforced rule.
- Does not replace Widget-System.md's widget-specific contract — it
  generalizes the *pattern* Widget-System.md already established to every
  other subsystem.

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
             Serialization
                   │
   Import / Export ─────┐
                          │
                   Plugin System   ◄── this document
                   (cross-cutting: depends on and extends
                    every layer above it)
                          │
                    Collaboration
```

**Note on graph shape:** Plugin System is deliberately drawn as
**cross-cutting** rather than a single sequential node — it depends on
Widget System, Command System, Event System, Rendering Architecture,
Selection-and-Interaction, and Serialization simultaneously, since its
entire purpose is generalizing extension points already defined by each of
them. It does not introduce new domain concepts of its own; it is the
registration/lifecycle mechanism layered over all the others.

## 20. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | §11 sandboxed tier honestly scoped to data-shaped contributions (function-bearing contributions trusted-tier-only); §9.5 AI provider gains streaming seam; §9 gains Intent Interpreters extension point | ADR-0002, ADR-0005; Readiness Review M5/M11 |

## 21. Open Questions Deferred to Later Documents

- Exact sandboxed-tier message-passing protocol/schema — deferred as an
  implementation detail once a real third-party plugin scenario exists,
  per Principle 7.
- Plugin marketplace/directory metadata format — out of scope for the
  engine entirely; a product-layer concern, not this package's.
- AI Provider request/response schema detail — future AI.md, if the
  platform layering (Section 0 of Command-System.md) grows a dedicated
  document for that layer.
