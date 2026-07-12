# PLANS.md — Master Implementation Plan

**Role:** the source of truth for *execution* — phases, milestones, gates.
The [Architecture Handbook](docs/architecture/Architecture-Index.md) remains
the source of truth for *design*; this file never restates specifications,
it references them. Companion files: [MEMORY.md](MEMORY.md) (durable project
knowledge), [TASKS.md](TASKS.md) (active backlog).

**Maintenance:** update this file when a phase starts, completes, or changes
scope — in the same PR as the change that caused it.

---

## 1. Project Vision (implementation goals)

Implement the Presentation Domain Engine exactly as specified by the
handbook: a framework-agnostic, format-agnostic core powering multiple
visual-document products without forks. Engineering translation of
Vision.md §4's five-year success criteria:

- The domain model and public command API survive renderer-technology
  changes without breaking changes (proven by shipping ≥2 renderer families
  against one frozen contract).
- Third-party widgets, tools, importers, and exporters register through the
  same APIs first-party ones use (proven by conformance suites in
  `presentation-testing`).
- Collaboration and AI arrive later as additive layers (proven by keeping
  their seams — ADR-0002/0005, Command-System.md §14 — untouched and
  contract-tested throughout).
- A new engineer reaches productive contribution from documentation alone
  (proven every time onboarding needs no source-code archaeology).

## 2. Guiding Principles

1. **Architecture-first.** Code that contradicts a boundary table is a bug
   even when it works. Blocked by the architecture? Take the governance
   route (Index §11), never a workaround.
2. **Domain-first, inside-out.** Build strictly up the dependency graph
   (ADR-0001's corrected order). A layer starts only when the layer below
   has passed its quality gate.
3. **Thin vertical slices.** Each phase ends with something *demonstrable*
   (a milestone), not a pile of untested horizontal plumbing.
4. **Contracts before consumers.** Before a layer is built *upon*, its
   contract tests live in `presentation-testing` so every future
   implementation (including third-party) can verify conformance.
5. **Determinism from day one.** Injected IDs/RNG/clock/TextMeasurer in
   every line of core code — retrofitting determinism is how replay dies.
6. **Test before feature-complete.** Property tests for every
   handbook-stated invariant land with the feature, not after.
7. **Documentation evolves with implementation.** Discovering that a spec
   is wrong produces a governance artifact and a document version bump in
   the same PR — never a silent divergence between code and handbook.
8. **No heroics.** Small PRs, green `pnpm check`, changesets, honest
   TASKS.md status. Continuity beats velocity on a multi-year project.

## 3. Development Phases

Ordering note: this sequence follows the handbook's dependency graph
(ADR-0001) and therefore deviates from any intuition that "Runtime" comes
early — `presentation-runtime` is the composition root and *depends on*
events/state/commands (Package-Structure.md §3), so it is built after them.
Likewise the rendering core depends on `presentation-widget-api`, so the
widget *contract* precedes rendering while widget *implementations* come
after it.

### Phase 0 — Repository Bootstrap ✅ (done, commit `282831f`)

Workspace, tooling, CI, governance surface, 19 placeholder packages with
enforced import law. Exit criteria met: `pnpm check` green end-to-end.

### Phase 1 — Domain Layer (`presentation-domain`)

- **Objectives:** the complete domain model as pure types + pure functions.
- **Prerequisites:** none (Ring 0).
- **Deliverables:** all Domain-Model.md shapes (incl. `dataVersion`, derived
  caches as runtime-only); fractional-index ordering utility
  (Ordering-Strategy.md, injected-RNG jitter); structural validation
  primitives (Domain-Model.md §12); migration contract shapes
  (Serialization.md §15's chain pattern); injected-capability interfaces
  (`IdGenerator`, `Rng`, `Clock`, `TextMeasurer` shape from ADR-0006);
  shared `ValidationResult`/typed-error types.
- **Exit criteria:** ordering property tests (fast-check: keys always sort
  strictly between bounds, never exhaust, deterministic under seeded RNG);
  `validateDocument` accepts/rejects the handbook's example documents;
  zero platform APIs (compile-enforced); package README real.
- **Risks:** over-modeling beyond the handbook (scope creep into
  Theme/Layout territory that is explicitly deferred).

### Phase 2 — Event System (`presentation-events`)

- **Objectives:** `Emitter`/`Event`/`Disposable`, taxonomy types,
  `EventOrigin`, `EventEnvelope`, versioned payloads.
- **Prerequisites:** Phase 1.
- **Deliverables:** Event-System.md §2/§6/§9/§12 contracts; disposal-safety
  guarantees (§6).
- **Exit criteria:** tests prove registration-order delivery, disposal
  releases all listeners transitively, owner-only emission pattern.
- **Risks:** smallest phase — main risk is gold-plating (priority tiers
  etc. beyond what §10 permits).

### Phase 3 — State Management (`presentation-state`)

- **Objectives:** the Store — the system's heart.
- **Prerequisites:** Phases 1–2.
- **Deliverables:** immutable versioned Store with structural sharing
  (State-Management.md §2 contract: reference change ⟺ entity written);
  derived order-cache maintenance (§3); `DocumentQuery` (§4); write-time
  ChangeSet tracking → `DocumentChangedEvent`/`RenderStateDiff`/
  `IncrementalSaveOp` derivation (§5); dispatch FIFO queue + reentrancy
  rules (§10); invariant trigger index (§11, for ADR-0003).
- **Exit criteria:** property test — random transaction sequences preserve
  structural-sharing contract; reentrancy tests (nested dispatch queued,
  cycle depth-limit fails loudly); ChangeSet-derivation is O(writes)
  (bench baseline recorded).
- **Risks:** highest technical risk of the early phases; structural
  sharing bugs are subtle. Mitigation: exhaustive property tests before
  Phase 4 starts.

### Phase 4 — Command System (`presentation-commands`)

- **Objectives:** the sole mutation pipeline (ADR-0007).
- **Prerequisites:** Phase 3.
- **Deliverables:** `Command` contract, Dispatcher, Transaction Manager
  integration, scoped post-validation (ADR-0003), History Manager (incl.
  redo invalidation, merge/isNoop), Macro/Batch semantics
  (Command-System.md §6), Command Factory Registry + payload migration
  (§16), `CommandObserver` (§18).
- **Exit criteria:** replay property test — serialized command sequences
  against a snapshot reproduce identical end state under seeded injection
  (Command-System.md §17); rollback atomicity tests; undo/redo through the
  full pipeline including undo-fails-validation rollback (§11).
- **Risks:** transaction/rollback edge cases; undo state capture memory.

### Phase 5 — Runtime (`presentation-runtime`)

- **Objectives:** Engine/DocumentSession composition root.
- **Prerequisites:** Phases 1–4.
- **Deliverables:** Engine-Lifecycle.md §4 phases (construction,
  registration, document load sequence §4.3, disposal §4.7); service
  construction order (§5); Scheduler (merge/defer, §10.3); registry
  interfaces for Ring 2 (DIP seam, Package-Structure.md §3); multi-session
  support; `EngineConfig` capability injection.
- **Exit criteria:** **Milestone M1** — headless Node process creates an
  engine, loads the Domain-Model.md §13 example document, dispatches
  commands, undoes them, disposes cleanly (leak-checked). Two concurrent
  sessions proven independent (history/selection isolation).
- **Risks:** disposal ordering and subscription leaks; this is where
  Event-System §6's Disposable discipline gets proven or broken.

### Phase 6 — Widget Contract (`presentation-widget-api`)

- **Objectives:** the extension contract widgets are written against.
- **Prerequisites:** Phase 1 (types); Phase 5 for registry wiring.
- **Deliverables:** `defineWidget()`, `WidgetDefinition` (incl. `hitTest`,
  Widget-System.md §3), Widget Registry (§4 idempotency), `RenderNode`
  (homed here per Package-Structure.md 1.1.0), data-migration flow (§10).
- **Exit criteria:** widget conformance suite in `presentation-testing`
  skeleton form; registration/unregistration mid-session tests
  (Engine-Lifecycle.md §4.6 degraded-but-safe behavior).
- **Risks:** contract churn once real widgets exist — keep 0.x semver
  honesty until Phase 9 hardens it.

### Phase 7 — Rendering Core (`presentation-rendering` + `presentation-renderer-ssr`)

- **Objectives:** renderer-agnostic projection + first (headless) renderer.
- **Prerequisites:** Phases 5–6.
- **Deliverables:** canonical `RendererAdapter`/`RendererHandle`
  (ADR-0004), `RenderState` composition (State-Management.md §6),
  capability negotiation, widget render lifecycle
  (Rendering-Architecture.md §10), virtualization hooks (§11); SSR
  renderer first — headless, deterministic, easiest to test.
- **Exit criteria:** **Milestone M2** — SSR renderer produces a stable
  golden-snapshot output for a fixture document; renderer conformance
  suite exists; unmount/dispose distinction leak-tested.
- **Risks:** RenderState recomposition performance; snapshot-test
  brittleness (mitigate: semantic output snapshots, not pixel).

### Phase 8 — Interaction (`presentation-interaction`)

- **Objectives:** Tools, selection/focus/hover, hit-testing, intents.
- **Prerequisites:** Phase 7.
- **Deliverables:** ToolNode state machine + root-to-leaf dispatch
  (Selection-and-Interaction.md §2), `InteractionState` (incl. viewports +
  preview, §4), Intent Interpreter Registry (§15, ADR-0002), built-in
  SelectTool/PanTool, geometry hit-testing (§10), gesture preview
  mechanics (State-Management.md §9).
- **Exit criteria:** scripted-input tests: pointer sequences → intents →
  commands → store state, fully headless; marquee/drag/resize state
  machines covered; preview never touches the Store (asserted).
- **Risks:** the layer with the most historically contradictory spec —
  re-read ADR-0002 before starting; any ambiguity found goes to
  governance, not improvisation.

### Phase 9 — Widgets Base (`presentation-widgets-base`) — **gated on Text-System.md**

- **Objectives:** first-party reference widgets: `rect`, `image`, `group`,
  then `text`.
- **Prerequisites:** Phases 6–8; **Text-System.md written and accepted
  before the `text` widget starts** (ADR-0006, Index §12 — hard gate).
  `rect`/`group`/`image` may proceed before the gate.
- **Deliverables:** four widgets via public contract only; group semantics
  (Widget-System.md §8); `TextMeasurer` browser + Node implementations.
- **Exit criteria:** every widget passes the conformance suite; the
  Principle-6 compliance test (Widget-System.md §5) — no core code path
  exists that these widgets use and a third party couldn't.
- **Risks:** text is the hardest problem in the project (cross-renderer
  fidelity); the document gate exists precisely to force the design first.

### Phase 10 — Basic Editor (`presentation-renderer-dom` + examples/basic-editor)

- **Objectives:** first interactive product surface.
- **Prerequisites:** Phases 8–9.
- **Deliverables:** DOM renderer family; overlay layer (selection,
  handles, marquee — Rendering-Architecture.md §16); pointer/keyboard
  normalization; examples/basic-editor becomes a working app.
- **Exit criteria:** **Milestone M4** — create/select/move/resize/delete/
  undo/redo interactively in a browser; e2e infrastructure (Playwright)
  un-deferred and first tests added.
- **Risks:** first place real UX meets the architecture; friction found
  here feeds governance, not hacks.

### Phase 11 — Serialization (`presentation-serialization`)

- **Objectives:** canonical persistence.
- **Prerequisites:** Phase 5 (can largely parallel Phases 6–10).
- **Deliverables:** envelope + integrity (Serialization.md §2/§10),
  load sequence with migration chain (§10/§15), quarantine recovery
  (§11), snapshots (§12), incremental save with removal sets (§13),
  autosave subscription point (§14).
- **Exit criteria:** **Milestone M5** — round-trip property test: any
  valid document serializes → deserializes to deep-equal state (minus
  derived caches, rebuilt equal); corruption fixtures recover per §10's
  policy table; migration-chain tests across ≥3 synthetic schema versions.
- **Risks:** silent data loss is the nightmare scenario — quarantine
  tests must include the re-emit-verbatim guarantee (§11).

### Phase 12 — Import/Export (`presentation-{export,import}-pptx`) — **gated on Import-Export.md**

- **Objectives:** first foreign-format adapters.
- **Prerequisites:** Phase 11; **Import-Export.md written and accepted**
  (Index §12 priority 2) — the mapping tables must exist before code.
- **Deliverables:** PPTX exporter (read-only snapshot consumer) and
  importer (produces `PresentationDocument`/Import Commands), registered
  via the Adapter Registry.
- **Exit criteria:** **Milestone M6** — a fixture deck exports to PPTX
  that opens in PowerPoint/LibreOffice; import of known-good PPTX
  fixtures produces valid documents; adapters proven renderer-ignorant
  (depcruise + type-level).
- **Risks:** OOXML fidelity rabbit holes — scope the supported feature
  matrix in Import-Export.md first, extend iteratively.

### Phase 13 — Plugin System (`presentation-plugin-api`)

- **Objectives:** generalized extensibility.
- **Prerequisites:** Phases 6–8, 11 (it re-exposes their registries).
- **Deliverables:** manifest validation, dependency resolution
  (topological, cycle-fail — Plugin-System.md §8), lazy activation (§6),
  permission enforcement (§10), error isolation + rollback of partial
  contributions (§15), `PluginContext`.
- **Exit criteria:** **Milestone M7** — examples/plugin-development loads
  a real plugin contributing a widget + tool + shortcut; activation-event
  laziness proven (module not loaded until triggered); a plugin that
  throws in `activate()` leaves the system clean.
- **Risks:** sandboxed tier stays out of scope (ADR-0005 §1) — resist
  implementing it "while we're here."

### Phase 14 — React Integration (`presentation-react`)

- **Objectives:** first framework binding.
- **Prerequisites:** Phase 10.
- **Deliverables:** session-scoped hooks (ADR-0004), `RenderNode`→React
  reconciler, `<PresentationCanvas>`; react/react-dom become peer deps.
- **Exit criteria:** **Milestone M8** — examples/basic-editor variant
  running on the React binding with identical behavior to the vanilla DOM
  editor (shared e2e suite passes against both).
- **Risks:** the binding staying "thin" (Package-Structure.md §3: no
  independent logic of substance) — reconciler complexity is the watch
  item.

### Phase 15 — DevTools (`presentation-devtools`)

- **Objectives:** the observability surfaces become an inspector.
- **Prerequisites:** Phases 4–5 for observer APIs; Phase 14 for panel UI.
- **Deliverables:** event stream + command log panels, provenance
  filtering ("show me everything plugin X did"), headless observer hooks
  for CI assertions.
- **Exit criteria:** panel runs against the basic editor; read-only
  contract enforced (no dispatch path importable — depcruise rule).
- **Risks:** low; deliberately a community-friendly package.

### Phase 16 — Performance Hardening — **gated on Performance.md**

- **Objectives:** budgets, measurement, regression protection.
- **Prerequisites:** Phases 1–14 in place; **Performance.md written**
  (budgets, methodology, slow-subscriber rule).
- **Deliverables:** benchmark suites in `tests/benchmarks/` against real
  subsystems (transaction throughput, ChangeSet derivation, large-document
  load with partial hydration, renderer diff consumption); CI regression
  tracking; virtualization + `loadPartial` exercised at 100s-of-pages
  scale.
- **Exit criteria:** every budget in Performance.md has a benchmark; no
  per-keystroke path is O(document) (complexity assertions, ADR-0003).
- **Risks:** benchmarks lying (fixture documents too small/uniform).

### Phase 17 — Collaboration Foundation (checkpoint, not implementation)

- **Objectives:** verify the deferred seams still hold before any collab
  work is committed; write Collaboration.md only when the product need
  is real (Index §12 priority 6).
- **Prerequisites:** Phases 1–16.
- **Deliverables:** seam audit (Command-System.md §14, Event-System.md
  §14, Serialization.md §16, Plugin-System.md §9.6 against the real
  codebase); **Milestone M10** — a demo `CollabProviderContribution` that
  replays a recorded op log through `ApplyRemoteOperationCommand` with
  zero engine changes.
- **Risks:** discovering seam drift late — mitigated by keeping the seam
  contract tests green from Phase 4 onward.

## 4. Milestones

| # | Milestone | Phase | Proves |
| --- | --- | --- | --- |
| M1 | Headless engine loads a document, dispatches, undoes, disposes | 5 | The core loop works with zero UI |
| M2 | SSR renderer produces stable output for a fixture document | 7 | Projection pipeline + renderer contract |
| M3 | Commands replay deterministically from a serialized log | 4 | Determinism/replay foundation (collab/AI precondition) |
| M4 | Interactive editing in the browser (basic editor) | 10 | Full input→intent→command→render loop |
| M5 | Save/load round-trip with migration + corruption recovery | 11 | Persistence is trustworthy |
| M6 | PPTX export opens in PowerPoint; PPTX import round-trips fixtures | 12 | The engine meets the outside world |
| M7 | Third-party-style plugin loads lazily and contributes safely | 13 | Open extension is real, not aspirational |
| M8 | React-bound editor passes the shared e2e suite | 14 | Framework-agnosticism proven with a second binding |
| M9 | DevTools inspector traces a user action end-to-end | 15 | Observability contracts pay off |
| M10 | Recorded op log replays through the collab seam, zero engine changes | 17 | Five-year additive-collaboration bet validated |

## 5. Dependency Graph (phases)

```
P0 ✅
 └─ P1 Domain
     └─ P2 Events
         └─ P3 State
             └─ P4 Commands ──────────────► M3
                 └─ P5 Runtime ──────────► M1
                     ├─ P6 Widget API
                     │   └─ P7 Rendering Core + SSR ─► M2
                     │       └─ P8 Interaction
                     │           └─ P9 Widgets Base (gate: Text-System.md)
                     │               └─ P10 Basic Editor ─► M4
                     │                   ├─ P14 React ────► M8
                     │                   └─ P15 DevTools ─► M9
                     └─ P11 Serialization ─► M5        (parallel track from P5)
                         └─ P12 PPTX (gate: Import-Export.md) ─► M6
                     P13 Plugins (after P6-P8, P11) ─► M7
 P16 Performance (gate: Performance.md, after P14)
 P17 Collab checkpoint ─► M10
```

Parallelizable: P11 alongside P6–P10; P13 alongside P10; document-writing
gates (Text-System, Import-Export, Performance) alongside preceding phases.

## 6. Quality Gates (every phase, before the next begins)

1. `pnpm check` green (format, md-lint, spell, import law, knip,
   typecheck, tests, build).
2. The layer's **contract/conformance suite** exists in
   `presentation-testing` and passes.
3. **Property tests** cover every determinism/algebraic invariant the
   owning handbook document states for the layer.
4. No new dependency-cruiser exceptions; package `dependencies` still
   match Package-Structure.md §3 (or the doc was amended in the same PR).
5. Package README updated from placeholder to real; changesets recorded.
6. Zero open governance items against the layer's owning document (no
   "we'll fix the spec later").
7. TASKS.md and this file updated (phase status, discovered follow-ups).

## 7. Definition of Done (per subsystem)

A subsystem is **done** when:

- It implements its owning document's contracts **verbatim** — interface
  shapes transcribed, not improved; any deviation went through governance
  and the document was version-bumped.
- Its boundary table ("what this layer does NOT do") is enforced by tests
  and/or depcruise rules, not just prose.
- A conformance suite exists so third-party implementations of its
  contracts can self-verify.
- All stated invariants have property tests; error paths from
  Engine-Lifecycle.md §9's table are exercised.
- It runs in every environment its Package-Structure.md §8 row claims
  (universal packages CI-tested in Node; browser packages in the e2e lane
  once it exists).
- Its README documents the public surface and links the owning document.
- Its complexity classes match the handbook's performance statements
  (O(touch), never O(document), for hot paths).
