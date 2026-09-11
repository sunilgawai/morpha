# TASKS.md — Active Implementation Backlog

**Role:** the live execution board. [PLANS.md](PLANS.md) owns phases and
gates; this file owns the individual units of work. Design questions belong
in the [handbook](docs/architecture/Architecture-Index.md), never here.

**How to use**

- Task IDs `T-###` are permanent — never reuse or renumber.
- **Priority:** P0 (blocks the current phase) → P3 (someday within scope).
- **Complexity:** S (≤half-day) · M (1–3 days) · L (∼a week) · XL (split it).
- Statuses: `Backlog → Ready → In Progress → (Blocked) → Completed`.
  A task is *Ready* only when its dependencies are Completed and its
  architecture references are finalized documents.
- WIP limit: keep **In Progress ≤ 3**. Move tasks in the same PR as the
  work; a completed task records its PR/commit.
- Backlog items are coarse; refine them (split, size, add references)
  when promoting to Ready — not before.

---

## In Progress

*(none — Phase 1 is code-complete: T-001, T-002, T-003, T-004, T-005 all done.
**Do not start Phase 2 yet.** PLANS.md Phase 1 gate item 6 is open: the
`readonly`/immutability question needs an ADR, and Ring 1 will be written
against whichever shape wins. T-050 tracks it.)*

## Ready

Sequenced: **T-001 → T-005 → {T-002, T-003} → T-004.** T-005 moved ahead of
T-002/T-003 on 2026-09-12 — jitter needs the `Rng` interface
(Ordering-Strategy.md; ADR-0005 §3) and both tasks' property tests need the
deterministic capability implementations, so T-005 is a prerequisite, not a
P1 follow-on.

| ID | Task | Pri | Cx | Depends on | Architecture references |
| --- | --- | --- | --- | --- | --- |

### Document track (WIP 1 — does not count against code WIP)

PLANS.md §3.1 runs handbook authoring on its own track so a gated document
never competes with code for the WIP ≤ 3 limit.

| ID | Task | Pri | Cx | Authored during | Must land before |
| --- | --- | --- | --- | --- | --- |
| T-006 | Author **Text-System.md** (rich-text run model, editing/IME, caret, shaping strategy, font fallback) via governance — unblocks T-030 | P1 | L | Phases 2–8 | Phase 9 (hard gate, ADR-0006) |
| T-039 | Author **Import-Export.md** via governance — unblocks T-040 | P1 | L | Phases 10–11 | Phase 12 |
| T-044a | Author **Performance.md** (budgets, methodology, slow-subscriber rule) | P2 | M | Phases 13–14 | Phase 16 |

## Blocked

| ID | Task | Blocked on | Notes |
| --- | --- | --- | --- |
| T-030 | `text` widget in widgets-base | T-006 (Text-System.md accepted) | Hard gate — ADR-0006; PLANS.md Phase 9 |
| T-040 | PPTX export/import implementation | Import-Export.md authored (T-039) | Mapping tables must exist before code — PLANS.md Phase 12 |
| T-049 | Assert `WidgetRegistry satisfies WidgetTypeLookup` in widget-api | T-029 (ADR-0013 now accepted) | Compile-time conformance so a drifting signature fails in the package that caused it (ADR-0013 rule 2) |
| T-090 | Raise Node baseline to 22 LTS; unpin dependency-cruiser/cspell | CI matrix proving Node 22; team machines updated | ADR-0008; low urgency |

## Ready — next

| ID | Task | Pri | Cx | Depends on | Architecture references |
| --- | --- | --- | --- | --- | --- |
| T-050 | **Author an ADR on domain-model mutability**: should the transcribed interfaces be deeply `readonly`? Blocks Phase 2 (PLANS.md Phase 1 gate item 6) | P0 | S | — | State-Management.md §2; Domain-Model.md; Design Principle 8 |

## Backlog (coarse — refine when promoting)

### Phase 2 — Events

- T-010 `Emitter`/`Event`/`Disposable` + transitive disposal guarantees (P1, M — Event-System.md §6)
- T-011 Event taxonomy types, `EventOrigin`, `EventEnvelope`, versioned payloads (P1, S — Event-System.md §2, §9, §12)

### Phase 3 — State

- T-015 Immutable versioned Store with structural-sharing contract + property tests (P0, L — State-Management.md §2)
- T-016 Derived order-cache maintenance incl. per-container member order (P1, M — §3)
- T-017 `DocumentQuery` read model (P1, S — §4)
- T-018 Write-time ChangeSet tracking → event/diff/save-op derivation (P0, L — §5)
- T-019 Dispatch FIFO queue, reentrancy rules, cycle depth limit (P1, M — §10)
- T-020 Cross-entity invariant trigger index (P1, M — §11; ADR-0003)

### Phase 4 — Commands

- T-021 `Command` contract + Dispatcher + Transaction integration (P0, L — Command-System.md §3–§5, §8)
- T-022 History Manager: undo/redo through the pipeline, merge, isNoop, redo invalidation, bounded stack (P1, M — §11)
- T-023 Macro/Batch/Nested semantics (P1, M — §6)
- T-024 Command Factory Registry + serialization + payload migration (P1, M — §16; ADR-0005 §3)
- T-025 Replay determinism property suite → **Milestone M3** (P0, M — §17)
- T-026 `CommandObserver` diagnostics (P2, S — §18)

### Phase 5 — Runtime

- T-027 Engine/DocumentSession composition root, service order, disposal, multi-session isolation → **Milestone M1** (P0, XL: split at promotion — Engine-Lifecycle.md §4–§6)
- T-028 Scheduler: merge/defer paths (P1, M — §6.16, §10.3)

### Phases 6–10 — Widgets / Rendering / Interaction / Editor

- T-029 `presentation-widget-api`: defineWidget, registry, RenderNode, conformance-suite skeleton (P1, L — Widget-System.md)
- T-031 Rendering core + `RenderState` composition + capability negotiation (P1, L — Rendering-Architecture.md; ADR-0004)
- T-032 SSR renderer + golden snapshots → **Milestone M2** (P1, M — Rendering-Architecture.md §17)
- T-033 Interaction: ToolNode dispatch, InteractionState, Intent Interpreter Registry, built-in tools (P1, XL: split — S&I; ADR-0002)
- T-034 `rect`/`group`/`image` widgets via public contract (P1, M — Widget-System.md §5, §8)
- T-035 DOM renderer + overlay pass + input normalization (P1, L — Rendering-Architecture.md §16, §7.2)
- T-036 examples/basic-editor working app + Playwright lane → **Milestone M4** (P1, M)

### Phases 11–13 — Persistence / Adapters / Plugins

- T-037 Serialization: envelope, integrity, migration chain, quarantine, snapshots, incremental save → **Milestone M5** (P1, XL: split — Serialization.md)
- T-041 Plugin system: manifest, dependency resolution, lazy activation, permissions, error isolation → **Milestone M7** (P2, XL: split — Plugin-System.md)

### Phases 14–17 — Integration / Hardening

- T-042 React binding + shared e2e suite → **Milestone M8** (P2, L)
- T-043 DevTools inspector → **Milestone M9** (P2, M)
- T-044b Benchmark suites + CI regression tracking against Performance.md's budgets (P2, M — Index §12.3; Testing-Strategy.md §9)
- T-046 Collaboration seam audit + op-log replay demo → **Milestone M10** (P3, M — PLANS.md Phase 17)

## Completed

| ID | Task | Done | Ref |
| --- | --- | --- | --- |
| T-000a | Architecture reconciliation: ADR-0001…0007, all docs → 1.1.0, State-Management.md, truthful Index | 2026-07-12 | docs/architecture/adr/ |
| T-000b | Repository bootstrap: workspace, 19 packages, import law, toolchain, CI, governance surface (Phase 0 exit) | 2026-07-13 | commit `282831f` |
| T-000c | Execution planning system: PLANS.md, MEMORY.md, TASKS.md; ROADMAP.md → pointer | 2026-07-13 | this PR |
| T-000d | Development environment: apps/{playground,inspector,docs}, numbered examples ladder (01–17), tests taxonomy, root scripts, DEVELOPMENT.md; ADR-0011 (DP7 scoping) | 2026-07-18 | commit `e24263f` |
| T-045 | Author **Testing-Strategy.md** 1.0.0 (test kinds, fixture rules, property-row checklist P1–P15, conformance-suite table, CI lanes); ADR-0012 (fixtures published by the contract-owning package via `./testing` subpaths); Package-Structure.md → 1.4.0; Index → 1.2.0. Promoted ahead of Phase 1 because PLANS.md §6 gate 2 was unsatisfiable for Rings 0–1 | 2026-09-12 | this PR |
| T-003 | Structural validation: `validateDocument` with referential integrity, parent-cycle detection, theme/asset reference checks and optional derived-cache checking; `ValidationResult`/`ValidationIssue` shapes (undefined by any document until Domain-Model.md 1.3.0); `WidgetTypeLookup`/`WidgetDataValidator` ports per ADR-0013; registry stubs on the `./testing` subpath; property row **P3**, mutation-tested | 2026-09-12 | this PR |
| T-004 | Migration contract shapes: `CURRENT_SCHEMA_VERSION`, `UnknownDocument`, `DocumentMigration` (single-version steps), `MigrateDocument`, `MigrateWidgetData`, the `WidgetDataMigrator` narrow port, `needsWidgetDataMigration`, and typed `UnsupportedSchemaVersionError`/`UnsupportedWidgetDataVersionError` | 2026-09-12 | this PR |
| T-002 | Fractional-index ordering: `generateKeyBetween`, `generateNKeysBetween`, injected-RNG jitter with an overshoot guard, `compareOrdered` id tie-break; property rows **P1 and P2**; base-62 reference algorithm vendored (domain has zero dependencies) and pinned by a published-values table | 2026-09-12 | this PR |
| T-005 | Injected-capability interfaces (`IdGenerator`, `Rng`, `Clock`, `TextMeasurer`) + deterministic implementations and pure fixtures on the `@morpha/domain/testing` subpath; ADR-0012 proven end to end by a Ring 1 (`state`) test consuming the subpath across its existing `domain` edge | 2026-09-12 | this PR |
| T-047 | dependency-cruiser rule `no-testing-subpath-from-src`, negative-tested (fires by name on an `src/` → `src/testing/` edge) | 2026-09-12 | this PR |
| T-048 | Multi-entry build for the `./testing` subpath: tsdown entries, `exports` + `publishConfig` mapping | 2026-09-12 | this PR |
| T-001 | Domain model types transcribed: `PresentationDocument`, `DocumentMetadata`, `CanvasConfig`, `Page`, `Background`, `WidgetInstance`, `Transform`, `ColorValue`, `Asset`, `Theme`, ID types; `Serialized*` projections making derived caches unrepresentable in the persisted shape. Found two handbook gaps → Domain-Model.md 1.2.0 follow-up patch (`LayoutId` unregistered, `LayoutConstraints` shapeless); corrected PLANS.md's Phase 1 `Theme`/`Asset` narrowing, which did not compile | 2026-09-12 | this PR |
| T-000e | Execution re-plan: PLANS.md gains Phase 0.5/0.75 records, narrowed Phase 1 scope, two execution tracks (§3.1), release cuts v0.1–v0.3 (§4.1), corrected gates 2–3, new gate 8 (handbook contact report) | 2026-09-12 | this PR |
