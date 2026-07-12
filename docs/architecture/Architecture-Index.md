# Architecture-Index.md

**Status:** Core — changes require an ADR (governed by Section 11, this
document's canonical governance statement)
**Version:** 1.1.0
**Depends on:** None (this is the root entry point)
**This document is the canonical entry point to the entire Architecture Handbook.**

---

## 1. What This Handbook Is

This is the Presentation Engine Architecture Handbook — the complete,
versioned record of every structural decision governing how the engine is
built, extended, and evolved. It is not a specification for one release;
it is designed to remain the authoritative reference for the platform's
architecture for years, across teams, across contributors who were not
present for the original decisions.

**If you are a new Staff Engineer joining this project, or an AI assistant
beginning work on this codebase: read this document first, in full, before
opening any individual architecture document.** Everything below tells you
where to go next depending on what you're trying to accomplish.

## 2. Why This Handbook Exists

Three failure modes this handbook is designed to prevent:

1. **Architectural drift** — individual contributors making locally
   reasonable decisions that collectively erode a system's coherence,
   because no single document captured the *why* behind earlier decisions.
2. **Re-litigation** — the same architectural debate (e.g., "should
   Commands be the only mutation path?") happening repeatedly because the
   original reasoning was never written down durably.
3. **Onboarding cost** — a new contributor needing weeks of source-code
   archaeology to understand why the system is shaped the way it is,
   rather than hours of reading.

The 2026-07 Architecture Readiness Review demonstrated a fourth failure
mode this handbook must also prevent: **inter-document drift** — finalized
documents contradicting each other. The reconciliation pass recorded in
ADR-0001 through ADR-0007 (see `adr/`) resolved those contradictions;
governance rule 4 (Section 11) exists to keep them resolved.

## 3. How This Handbook Should Be Read

- **Never read a document in isolation on your first pass.** Every
  document declares its dependencies; read those first, or at minimum
  read this index's summary of them.
- **Documents are layered, not flat.** A document low in the dependency
  graph (e.g., Domain-Model.md) is stable and rarely changes; a document
  high in the graph is more likely to still be evolving. Calibrate how
  much you trust a detail's permanence accordingly.
- **Boundary tables and "what this layer does NOT do" sections are load-
  bearing.** They are not filler — most cross-document architectural
  bugs originate from someone missing a boundary rule stated in exactly
  one of these sections.
- **ADRs (in `adr/`) are not historical trivia.** They are the
  justification you must engage with before proposing to reverse a
  decision (Section 11).

## 4. Complete Dependency Graph

Corrected in 1.1.0 per ADR-0001 — the Domain Model is the root of content;
the Engine Lifecycle (runtime) orchestrates and therefore depends on
Domain, Widgets, and Rendering, exactly mirroring the package topology
(`presentation-runtime` depends inward on domain/state/commands).

```
Vision
   │
Design Principles
   │
   ├─ Ordering-Strategy
   │        │
   └────► Domain Model
             │
        Widget System
             │
     Rendering Architecture
             │
       Engine Lifecycle        (runtime orchestration over all of the above)
             │
    Selection & Interaction
             │
        Event System
             │
       Command System
             │
      State Management
             │
       Serialization
             │
       Plugin System
             │
     Package Structure
             │
       Developer SDK
             │
   ┌─────────┼──────────────────┐
   │         │                  │
Import/Export*  Performance*  Testing Strategy*  Text System*
   │         │                  │
   └─────────┴──────────────────┘
             │
         Roadmap*
             │
   ┌─────────┴─────────┐
   │                   │
Collaboration*        AI*

  (* = not yet written; positioned here per Section 12's roadmap)
```

**Reading the graph:** an arrow means "the lower document depends on and
must not contradict the upper document." The previously listed standalone
"Architecture" document never existed and is struck from the record
(ADR-0001); its intended content — naming the major subsystems — is
fulfilled by this index plus Command-System.md Section 0's platform
layering.

## 5. Foundational vs. Dependent Documents

**Foundational** (changing these has the widest blast radius):

- Vision, Design Principles, Ordering-Strategy, Domain Model

**Structural** (define a major subsystem's contract):

- Widget System, Rendering Architecture, Engine Lifecycle,
  Selection & Interaction, Event System, Command System,
  State Management, Serialization, Plugin System

**Applied** (translate the architecture into concrete developer- or
operations-facing form; narrowest blast radius):

- Package Structure, Developer SDK, and every future Import/Export,
  Performance, Testing Strategy, and Text System document

## 6. Current Status of Every Document

| Document | Status | Version | Importance |
| --- | --- | --- | --- |
| Vision | Finalized | 1.0.0 | Core |
| Design-Principles.md | Finalized | 1.0.0 | Core |
| Ordering-Strategy.md | Finalized | 1.1.0 | Core |
| Domain-Model.md | Finalized | 1.1.0 | Core |
| Widget-System.md | Finalized | 1.1.0 | Core |
| Rendering-Architecture.md | Finalized | 1.1.0 | Core |
| Engine-Lifecycle.md | Finalized | 1.1.0 | Core |
| Selection-and-Interaction.md | Finalized | 1.1.0 | Core |
| Event-System.md | Finalized | 1.1.0 | Core |
| Command-System.md | Finalized | 1.1.0 | Core |
| State-Management.md | Finalized | 1.0.0 | Core |
| Serialization.md | Finalized | 1.1.0 | Core |
| Plugin-System.md | Finalized | 1.1.0 | Core |
| Package-Structure.md | Finalized | 1.1.0 | Major |
| Developer-SDK.md | Finalized | 1.1.0 | Major |
| Text-System.md | **Not yet written — required before the Text widget is implemented** (seam fixed by ADR-0006) | — | Core |
| Import-Export.md | Not yet written | — | Major |
| Performance.md | Not yet written | — | Major |
| Testing-Strategy.md | Not yet written | — | Major |
| Theme-System.md | Not yet written (referenced by Domain-Model.md §9) | — | Major |
| Asset-System.md | Not yet written (referenced by Domain-Model.md §8) | — | Major |
| Layout-System.md | Not yet written (referenced by Domain-Model.md §14) | — | Supporting |
| Animation-System.md | Not yet written (seam fixed by Engine-Lifecycle.md §10.5) | — | Supporting |
| Collaboration.md | Not yet written, deliberately deferred | — | Supporting (Core once collaboration ships) |
| AI.md | Not yet written, deliberately deferred | — | Supporting |
| Roadmap.md | Not yet written | — | Supporting |

All previously "Assumed finalized" documents were brought under formal
version control during the 1.1.0 reconciliation pass — the "assumed"
status no longer exists. Every document referenced anywhere in the corpus
now appears in this table (governance rule 4); the former
Migration-and-Versioning.md reference is resolved — migration is owned by
Serialization.md §15 (document schema), Widget-System.md §10 (widget
data), and Command-System.md §16 (command payloads); no separate document
is planned.

## 7. Document Catalogue

### Vision

- **Purpose:** States what the Presentation Engine is for and who it serves.
- **Depends On:** Nothing. **Referenced By:** everything.

### Design-Principles.md

- **Purpose:** The numbered principles every later document cites.
- **Depends On:** Vision. **Referenced By:** every subsequent document.

### Ordering-Strategy.md

- **Purpose:** String-based fractional indexing for all ordered
  collections; collision handling; deterministic jitter (ADR-0005 §3).
- **Depends On:** Design-Principles.md. **Referenced By:** Domain-Model.md,
  State-Management.md, (future) Collaboration.md.

### Domain-Model.md

- **Purpose:** Defines `PresentationDocument`, `WidgetInstance` (including
  `dataVersion`), `Transform`, derived order caches, validation, versioning.
- **Depends On:** Vision, Design-Principles.md, Ordering-Strategy.md.
- **Referenced By:** everything below it.

### Widget-System.md

- **Purpose:** The `WidgetDefinition` plugin contract (including
  `hitTest`), Widget Registry, validation/migration hooks.
- **Depends On:** Domain-Model.md, Design-Principles.md.
- **Referenced By:** Rendering-Architecture.md, Engine-Lifecycle.md,
  Selection-and-Interaction.md, Plugin-System.md, Package-Structure.md,
  Developer-SDK.md.

### Rendering-Architecture.md

- **Purpose:** The renderer-agnostic projection layer — the canonical
  `RendererAdapter` contract (ADR-0004), `RenderState`/`RenderContext`/
  `RenderNode`, normalized input events (ADR-0002), virtualization.
- **Depends On:** Domain-Model.md, Widget-System.md, Design-Principles.md.
- **Referenced By:** Engine-Lifecycle.md, Selection-and-Interaction.md,
  State-Management.md, Plugin-System.md, Package-Structure.md,
  Developer-SDK.md.

### Engine-Lifecycle.md

- **Purpose:** Runtime orchestration — construction to disposal, the
  closed mutation loop, every runtime service's contract, threading model,
  error propagation, injected capabilities (IDs, RNG, `TextMeasurer`).
- **Depends On:** Vision, Design-Principles.md, Domain-Model.md,
  Widget-System.md, Rendering-Architecture.md (per ADR-0001, this header
  was always correct; the previous index graph was wrong).
- **Referenced By:** every document below it.

### Selection-and-Interaction.md

- **Purpose:** Tools as hierarchical state machines, selection/focus/hover
  models, hit-testing, `InteractionIntent`, and the **Intent Interpreter
  Registry** — the system's only intent→Command translation mechanism
  (ADR-0002).
- **Depends On:** Engine-Lifecycle.md, Rendering-Architecture.md,
  Widget-System.md.
- **Referenced By:** Event-System.md, Command-System.md,
  State-Management.md, Plugin-System.md, Package-Structure.md,
  Developer-SDK.md.

### Event-System.md

- **Purpose:** Semantic event taxonomy, ownership, propagation, transport
  guarantees. Notification-only — never in the mutation path.
- **Depends On:** Engine-Lifecycle.md, Selection-and-Interaction.md,
  Domain-Model.md.
- **Referenced By:** Command-System.md, State-Management.md,
  Serialization.md, Plugin-System.md, Package-Structure.md, Developer-SDK.md.

### Command-System.md

- **Purpose:** The mutation architecture — Commands as the sole legal
  mutation mechanism (ADR-0007), lifecycle, taxonomy, transactions, scoped
  validation (ADR-0003), history, gesture previews, serialization/replay
  with payload migration.
- **Depends On:** Engine-Lifecycle.md, Domain-Model.md, Widget-System.md,
  Selection-and-Interaction.md, Event-System.md.
- **Referenced By:** State-Management.md, Serialization.md,
  Plugin-System.md, Package-Structure.md, Developer-SDK.md.

### State-Management.md

- **Purpose:** Store versioning, the `DocumentQuery` read model, ChangeSet
  → `DocumentChangedEvent` → `RenderStateDiff`/`IncrementalSaveOp`
  derivation, reentrancy/dispatch queueing, preview state, viewport and
  overlay ownership.
- **Depends On:** Domain-Model.md, Widget-System.md, Engine-Lifecycle.md,
  Event-System.md, Command-System.md.
- **Referenced By:** Serialization.md, Plugin-System.md,
  Package-Structure.md, Developer-SDK.md.

### Serialization.md

- **Purpose:** Canonical persistence — envelope format, assets, snapshots,
  incremental saving (with explicit removal sets), migration, recovery.
- **Depends On:** Domain-Model.md, Widget-System.md, Engine-Lifecycle.md,
  Command-System.md.
- **Referenced By:** Plugin-System.md, Package-Structure.md,
  Developer-SDK.md, (future) Import-Export.md, Collaboration.md.

### Plugin-System.md

- **Purpose:** General extensibility — plugin lifecycle, manifest, lazy
  activation, extension point catalogue, honestly-scoped sandbox tiers
  (ADR-0005 §1), AI/collab provider seams (including streaming, ADR-0005 §2).
- **Depends On:** Engine-Lifecycle.md, Widget-System.md, Command-System.md,
  Event-System.md, Selection-and-Interaction.md, Serialization.md.
- **Referenced By:** Package-Structure.md, Developer-SDK.md.

### Package-Structure.md

- **Purpose:** Monorepo/package topology (canonical `presentation-*`
  naming) using the Dependency Rule with enumerated intra-ring edges.
- **Depends On:** every prior document (a projection, not a new decision
  layer). **Referenced By:** Developer-SDK.md.

### Developer-SDK.md

- **Purpose:** The public developer experience — engine-scoped registries
  and session-scoped document operations (ADR-0004), every registration
  API, versioning commitments.
- **Depends On:** every prior document.
- **Referenced By:** (future) all format-adapter, AI, and collaboration
  documents.

*(Future documents' purposes are recorded in Section 12.)*

## 8. Architectural Layers

| Layer | Documents |
| --- | --- |
| **Vision** | Vision |
| **Principles** | Design Principles |
| **Domain** | Ordering-Strategy.md, Domain-Model.md |
| **Widgets** | Widget-System.md |
| **Rendering** | Rendering-Architecture.md |
| **Runtime** | Engine-Lifecycle.md |
| **Interaction** | Selection-and-Interaction.md |
| **Events** | Event-System.md |
| **Commands** | Command-System.md |
| **State** | State-Management.md |
| **Persistence** | Serialization.md |
| **Plugins** | Plugin-System.md |
| **Packaging** | Package-Structure.md |
| **SDK** | Developer-SDK.md |
| **Text** | Text-System.md *(pending — required before Text widget)* |
| **Adapters** | Import-Export.md *(pending)* |
| **Performance** | Performance.md *(pending)* |
| **Quality** | Testing-Strategy.md *(pending)* |
| **Collaboration** | Collaboration.md *(deferred)* |
| **AI** | AI.md *(deferred)* |

## 9. Recommended Reading Paths

### New contributors (general onboarding)

Vision → Design Principles → Domain-Model.md (with Ordering-Strategy.md) →
Widget-System.md → Rendering-Architecture.md → Engine-Lifecycle.md

### Core engine developers

Every document, in full dependency-graph order (Section 4), no exceptions.

### Renderer developers

Domain-Model.md → Widget-System.md → Rendering-Architecture.md →
Engine-Lifecycle.md → Selection-and-Interaction.md (input-shape contracts)
→ State-Management.md §§5-8 → Package-Structure.md → Developer-SDK.md §8

### Interaction / tools developers

Domain-Model.md → Engine-Lifecycle.md → Selection-and-Interaction.md →
Event-System.md → Command-System.md §§1-5 → State-Management.md §§7-10 →
Developer-SDK.md §6

### Plugin developers

Widget-System.md → Selection-and-Interaction.md §15 →
Command-System.md §4 → Plugin-System.md (in full) → Developer-SDK.md §7

### Import/Export developers

Domain-Model.md → Command-System.md §4 → Serialization.md (in full,
especially §17) → Package-Structure.md → Developer-SDK.md §9

### AI integration developers

Engine-Lifecycle.md §8 → Command-System.md §§1-6, 14-17 →
Event-System.md §15 → State-Management.md §4 → Plugin-System.md §9.5 →
Developer-SDK.md §14

### Collaboration developers

Command-System.md §14 → Event-System.md §14 → Serialization.md §16 →
Plugin-System.md §9.6 → Developer-SDK.md §15

## 10. How to Use This Index Alongside an AI Assistant

If you are an AI assistant beginning work on this codebase: read this
document first, identify which reading path (Section 9) matches the
requested task, read only those documents in full, and treat every other
document as reachable-by-reference. Never propose a change that
contradicts a finalized document's stated boundary without first raising
an Amendment Proposal (Section 11) — do not "helpfully" work around a
boundary by writing code that technically bypasses it.

## 11. Architecture Governance (canonical statement)

This section is the **canonical** statement of the governance process
(relocated from Event-System.md Section 0 in 1.1.0; that section is
preserved as the historically primary statement):

1. **Every document is versioned.** A version bump requires a
   corresponding Version Changelog entry within that document.
2. **Finalized documents are never silently modified.** A change requires
   one of: an ADR (decision reversal), an Amendment Proposal
   (addition/change), or a Follow-up Patch (a small, previously-flagged
   addition). **ADRs live in `docs/architecture/adr/`**, numbered
   sequentially (ADR-0001 …).
3. **Any breaking architectural change requires an ADR**, reviewed and
   accepted before the affected document is modified.
4. **Both sides of the dependency graph must stay accurate.** Every
   document declares its dependencies ("Depends on:" in its header); this
   index declares the graph and status of every document referenced
   anywhere in the corpus. A pull request changing a document's
   dependencies, or adding a reference to a new (even future) document,
   must update this index in the same change. **A document referenced
   nowhere in this index may not be cited by any document.**
5. **Major architectural changes must update this index** — a new
   document, a status change, or a dependency graph shift.
6. **Deferred documents are deferred by explicit decision, not neglect** —
   they are written once real product need materializes, with their seams
   already fixed by existing documents. Exception: Text-System.md is
   *scheduled, not optional* — it must exist before the Text widget is
   implemented (ADR-0006).

## 12. Future Roadmap — Documents Still Needed

Ordered by recommended priority:

### 1. Text-System.md — Priority: Critical (before the Text widget)

- **Why needed:** ADR-0006 fixed text-measurement ownership (the injected
  `TextMeasurer`) but deferred the full design: rich-text run model,
  editing/IME/composition, caret/selection-within-text, bidi, shaping
  strategy, font fallback. Cross-renderer/export fidelity — the product's
  core promise — depends on it.
- **Depends on:** Domain-Model.md, Widget-System.md,
  Rendering-Architecture.md, ADR-0006.

### 2. Import-Export.md — Priority: High

- **Why needed:** Serialization.md §17 fixed the contract; the actual
  format-mapping tables (PPTX shape → widget, PDF page → export target)
  remain undefined. The most product-visible gap.
- **Depends on:** Serialization.md, Domain-Model.md, Command-System.md §4,
  Package-Structure.md.

### 3. Performance.md — Priority: High

- **Why needed:** No single place states performance budgets (frame,
  load-time, memory) or measurement methodology. Should also codify the
  slow-subscriber rule for the synchronous commit→notify→render chain.
- **Depends on:** nearly every prior document.

### 4. Testing-Strategy.md — Priority: Medium-High

- **Why needed:** `presentation-testing` exists as a package but no
  document defines the testing philosophy (unit vs. integration vs.
  golden-snapshot vs. plugin-conformance) across the codebase.
- **Depends on:** Command-System.md, Plugin-System.md, Developer-SDK.md.

### 5. Theme-System.md / Asset-System.md — Priority: Medium

- **Why needed:** Domain-Model.md fixes only the `Theme`/`Asset` shapes;
  cascading/inheritance rules and asset-provider mechanics are deferred to
  these documents by name. Needed before theming/asset features ship.

### 6. Collaboration.md — Priority: Scheduled (not urgent)

- **Why needed:** Every seam is fixed (Command-System.md §14,
  Event-System.md §14, Serialization.md §16, Plugin-System.md §9.6); the
  mechanics (conflict resolution, presence protocol, sync transport,
  **offline queue + rebase-on-reconnect, local-undo-vs-remote-overwrite**)
  are not. The bolded items were flagged by the Readiness Review as
  currently unowned and belong in this document's scope.

### 7. AI.md — Priority: Scheduled (not urgent)

- **Why needed:** The Command-producing seam (including streaming,
  ADR-0005 §2) is fixed; prompt architecture, request/response schema,
  and **undo-grouping across streamed batches** are not.

### 8. Layout-System.md / Animation-System.md / Roadmap.md — Priority: Low

- Deferred until real product need; seams already flagged in
  Domain-Model.md §14 and Engine-Lifecycle.md §10.5.

## 13. Version Changelog

| Version | Change | Reason |
| --- | --- | --- |
| 1.0.0 | Initial finalized version | N/A |
| 1.1.0 | Reconciliation pass: dependency graph corrected (ADR-0001 — Domain root, runtime orchestrates); nonexistent "Architecture" document struck; Ordering-Strategy.md registered; State-Management.md written and tracked; governance canonical statement moved here with `adr/` repository created; all "Assumed finalized" statuses resolved; every referenced future document now tracked; Text-System.md added as required-before-Text-widget (ADR-0006) | Architecture Readiness Review (2026-07-12); ADR-0001…0007 |
