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

*(none — Phase 1 not started)*

## Ready

| ID | Task | Pri | Cx | Depends on | Architecture references |
| --- | --- | --- | --- | --- | --- |
| T-001 | Domain model types: `PresentationDocument`, `Page`, `WidgetInstance` (incl. `dataVersion`), `Transform`, `Theme`, `Asset`, ID types; derived caches typed as runtime-only | P0 | M | — | Domain-Model.md §3–§10 |
| T-002 | Fractional-index ordering utility: `generateKeyBetween`, `generateNKeysBetween`, injected-RNG jitter, id tie-break; property tests (sort-between, never-exhaust, seeded determinism) | P0 | M | T-001 | Ordering-Strategy.md; ADR-0005 §3 |
| T-003 | Structural validation primitives: `validateDocument`, referential-integrity checks, `ValidationResult` + shared typed errors | P0 | M | T-001 | Domain-Model.md §12; Engine-Lifecycle.md §9 |
| T-004 | Migration contract shapes: chained `migrate(doc, fromVersion)`, widget `dataVersion` flow types | P1 | S | T-001 | Serialization.md §15; Widget-System.md §10 |
| T-005 | Injected-capability interfaces: `IdGenerator`, `Rng`, `Clock`, `TextMeasurer` (shape only) + deterministic test implementations | P1 | S | T-001 | ADR-0006; Design-Principles.md P8 |
| T-006 | Author **Text-System.md** (rich-text run model, editing/IME, caret, shaping strategy, font fallback) via governance — unblocks T-030 | P1 | L | — | ADR-0006; Index §12.1 |

## Blocked

| ID | Task | Blocked on | Notes |
| --- | --- | --- | --- |
| T-030 | `text` widget in widgets-base | T-006 (Text-System.md accepted) | Hard gate — ADR-0006; PLANS.md Phase 9 |
| T-040 | PPTX export/import implementation | Import-Export.md authored (T-039) | Mapping tables must exist before code — PLANS.md Phase 12 |
| T-090 | Raise Node baseline to 22 LTS; unpin dependency-cruiser/cspell | CI matrix proving Node 22; team machines updated | ADR-0008; low urgency |

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
- T-039 Author **Import-Export.md** via governance (P1, L — Index §12.2)
- T-041 Plugin system: manifest, dependency resolution, lazy activation, permissions, error isolation → **Milestone M7** (P2, XL: split — Plugin-System.md)

### Phases 14–17 — Integration / Hardening

- T-042 React binding + shared e2e suite → **Milestone M8** (P2, L)
- T-043 DevTools inspector → **Milestone M9** (P2, M)
- T-044 Author **Performance.md**; benchmark suites + CI regression tracking (P2, L — Index §12.3)
- T-045 Author **Testing-Strategy.md** (P2, M — Index §12.4)
- T-046 Collaboration seam audit + op-log replay demo → **Milestone M10** (P3, M — PLANS.md Phase 17)

## Completed

| ID | Task | Done | Ref |
| --- | --- | --- | --- |
| T-000a | Architecture reconciliation: ADR-0001…0007, all docs → 1.1.0, State-Management.md, truthful Index | 2026-07-12 | docs/architecture/adr/ |
| T-000b | Repository bootstrap: workspace, 19 packages, import law, toolchain, CI, governance surface (Phase 0 exit) | 2026-07-13 | commit `282831f` |
| T-000c | Execution planning system: PLANS.md, MEMORY.md, TASKS.md; ROADMAP.md → pointer | 2026-07-13 | this PR |
| T-000d | Development environment: apps/{playground,inspector,docs}, numbered examples ladder (01–17), tests taxonomy, root scripts, DEVELOPMENT.md; ADR-0011 (DP7 scoping) | 2026-07-18 | this PR |
