# Roadmap

Two tracks: **documents still needed** (owned by
[Architecture-Index.md §12](docs/architecture/Architecture-Index.md)) and
**implementation phases** (this file). The handbook is always authoritative;
this file only sequences the build.

## Architecture documents (from Index §12, in priority order)

1. **Text-System.md** — Critical; required before the Text widget (ADR-0006)
2. **Import-Export.md** — High; blocks real PPTX adapters
3. **Performance.md** — High; budgets and the slow-subscriber rule
4. **Testing-Strategy.md** — Medium-high
5. Theme-System.md / Asset-System.md — Medium
6. Collaboration.md, AI.md — deferred until committed product features
7. Layout-System.md, Animation-System.md — deferred

## Implementation phases

Phases follow the dependency graph — a phase begins only when the layer
below it is implemented and its contract tests pass.

- **Phase 0 — Bootstrap (done):** workspace, tooling, CI, placeholder
  packages projected from Package-Structure.md 1.1.0.
- **Phase 1 — Domain:** `presentation-domain` (types, validation, ordering
  utility, migration contracts). Property-based tests for fractional
  indexing.
- **Phase 2 — Events + State:** `presentation-events` (Emitter/Disposable,
  taxonomy), `presentation-state` (Store, DocumentQuery, ChangeSet
  derivation, reentrancy queue).
- **Phase 3 — Commands:** dispatcher, transactions, history, factory
  registry. Replay determinism tests.
- **Phase 4 — Runtime:** Engine/DocumentSession composition root, injected
  capabilities, headless operation proven in Node.
- **Phase 5 — Widgets + Rendering:** widget-api, rendering core,
  widgets-base (after Text-System.md for the Text widget), renderer-ssr
  first (headless, easiest to test), then renderer-dom.
- **Phase 6 — Interaction:** tools, selection, intent interpreters;
  examples/basic-editor becomes real.
- **Phase 7 — Persistence + Adapters:** serialization, then
  import/export-pptx (after Import-Export.md).
- **Phase 8 — SDK surface + React bindings + devtools.**
- **Later:** collaboration, AI providers — seams already fixed by the
  handbook; deliberately unscheduled (Design Principle 7).
