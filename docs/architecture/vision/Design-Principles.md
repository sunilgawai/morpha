# Design-Principles.md

**Status:** Foundational — rarely changes
**Version:** 1.0.0
**Supersedes:** API-Philosophy (merged into this document — philosophy and
principles are one concern; splitting them causes duplication and drift)

---

## How To Use This Document

Every architectural decision in every other document (Domain-Model.md,
Command-System.md, Rendering-Architecture.md, etc.) must be traceable to one
or more of the principles below. If a proposed design cannot be justified by
these principles, either the design is wrong or the principles are
incomplete — and the principles win by default until deliberately revised
via an ADR.

---

## Principle 1 — Domain Model Is the Single Source of Truth

The Presentation Domain Model owns all state. Renderers, exporters,
importers, and UI frameworks never hold authoritative state of their own —
they hold *derived, disposable* state (e.g., a DOM node cache, a Canvas
draw-call list) that can be thrown away and rebuilt from the domain model at
any time without data loss.

**Test for compliance:** If you deleted every renderer, exporter, and UI
binding, the domain model plus its serialized document would still contain
100% of the user's work. If any information would be lost, that information
is misplaced and belongs in the domain model.

## Principle 2 — Everything Non-Core Is an Adapter

Rendering, export, import, and AI generation are all adapters that translate
*to* or *from* the domain model. None of them are permitted to become a
second source of truth or to require the domain model to know about their
existence.

```
AI Generator  ──┐
PPTX Importer ──┤
SVG Importer  ──┼──►  Presentation Domain Model  ──┬──► DOM Renderer
JSON Importer ──┘            (core)                 ├──► Canvas Renderer
                                                      ├──► PPTX Exporter
                                                      ├──► PDF Exporter
                                                      └──► SVG Exporter
```

Adapters depend on the core. The core never depends on any adapter. This
dependency direction is enforced at the package level (see
Package-Structure.md) — the core package literally cannot import an adapter
package; the reverse is always true.

## Principle 3 — Normalize, Never Nest

Domain state is stored as flat, ID-keyed maps (documents → pages → widgets),
never as deeply nested trees. Relationships (a widget belongs to a page, a
widget is grouped under another widget) are expressed via reference fields,
not object containment. This is the same normalized-store pattern used by
tldraw's record store and Excalidraw's flat element array, and it exists
because nested trees make three things exponentially harder: partial
updates, undo/redo diffing, and collaborative merging. A flat store makes all
three O(1) per change instead of O(depth) or O(n).

## Principle 4 — Mutations Are Commands, Never Direct Writes

No caller — not the UI, not an AI pipeline, not an importer — mutates domain
state directly. Every mutation is expressed as a Command object with
`execute()` and `undo()`. This is not primarily an undo/redo feature; it is
the mechanism that makes state changes observable, batchable, serializable,
collaboratively mergeable, and auditable, all through one abstraction instead
of five bolted-on side systems.

## Principle 5 — Units Are Engine-Native, Never Format-Native

The engine defines its own coordinate space, unit of measure, and color
model. It does not use EMU (OOXML), points (PDF), or CSS pixels as its
internal representation. Conversion to and from those units happens
exclusively at adapter boundaries. A widget's `x`, `y`, `width`, `height`
mean the same thing regardless of whether the document will ever be exported
to PPTX or never touches an exporter at all.

## Principle 6 — Closed Core, Open Extension

The set of widget types, export formats, import formats, and themes is never
a closed enum baked into the core. The core defines *contracts*
(`WidgetDefinition`, `ExporterAdapter`, `ImporterAdapter`) and a *registry*.
Concrete implementations — including the ones we ship ourselves, like a Text
widget or a PPTX exporter — are plugins registered against those contracts,
indistinguishable in privilege from a third party's plugin. If the "official"
Text widget and a hypothetical community-built Sticky-Note widget don't use
the exact same registration API, the API is broken.

## Principle 7 — Earn Abstractions, Don't Predict Them

We do not build a general animation system, layout engine, or plugin
lifecycle to their theoretical maximum extent speculatively. An abstraction
is only introduced after it is needed by at least two concrete, real
consumers. Before that point, we build the narrowest thing that solves the
one problem in front of us, and we explicitly document the seam where
generalization will later be introduced (see Roadmap.md phasing). This is
the direct antidote to the biggest risk in a 5-year greenfield architecture
project: designing elaborate systems for hypothetical future needs that never
materialize in the predicted shape.

## Principle 8 — Deterministic Core, Effectful Edges

Domain model operations (applying a command, computing derived state,
validating a widget's data against its schema) are pure and deterministic —
same input, same output, no I/O, no randomness except through injected
dependencies (e.g., ID generation is injectable for testability). Anything
with side effects — network calls, file system access, asset uploads — lives
in adapters, never in the core. This is what makes the core exhaustively unit
testable without mocks, and it is a prerequisite for reliable collaborative
merging and replay.

## Principle 9 — Explicit Versioning From Day One

Every persisted document declares a `schemaVersion`. The engine ships a
migration pipeline (`migrate(doc) -> doc'`) from the very first schema, even
when there is only one version to migrate to. Retrofitting versioning after
real user documents exist is far more expensive than starting with an
version field nobody needs yet.

## Principle 10 — API Ergonomics Are a Design Constraint, Not a Nice-to-Have

A public API that is technically correct but awkward to use will be worked
around, wrapped, or abandoned by consumers — including our own future
product teams. Every public method on the engine's primary surface (the
`Editor`/`Engine` object, following tldraw's precedent of a single large,
discoverable surface rather than scattered utility imports) must be:

- **Discoverable** — named so that autocomplete alone teaches the API
  (`engine.createWidget`, `engine.deleteWidget`, `engine.getSelectedWidgets`).
- **Symmetric** — every mutation exposed as a command has a naturally paired
  inverse, even if the inverse is rarely called directly by consumers.
- **Composable** — small operations combine into larger ones (a "duplicate
  slide" feature is built from primitives already exposed, not a special
  case with its own hidden logic).

## Principle 11 — No Application Concerns in the Core

The engine has zero knowledge of authentication, billing, organizations, AI
prompts, HTTP, or databases. It receives a document (or a request to create
one) and returns updated state or exported bytes. If a feature request
requires the core to know what a "user" or a "subscription" is, that feature
does not belong in the core — it belongs in the consuming application, built
on top of core primitives (e.g., permission gating is the application's job;
the engine just exposes fine-grained enough commands that the application
*can* gate them).

## Principle 12 — Backwards Compatibility Is a Feature, Breaking Changes Are a Last Resort

Once the engine has a 1.0 public API, breaking changes require an ADR
explicitly justifying why additive extension (new optional fields, new
adapter types, new command variants) could not achieve the same goal. Every
SDK that survives five years of active development (React, PostgreSQL
client libraries, tldraw) treats deprecation cycles and codemods as first-class
engineering work, not an afterthought.

## Principle 13 — Collaboration-Ready Data Shapes, Even Before Collaboration Ships

Even in the initial single-user version, state mutations are structured the
way Figma's multiplayer architecture requires: atomic property-level updates,
compound attributes grouped so they update together, and ordering handled via
fractional indexing rather than array-index reinsertion. This costs nothing
in the single-player case and avoids a full data-model rewrite when
`@engine/collab` is introduced later.

## Principle 14 — Every Design Decision Is Written Down

Significant decisions — especially ones that reject a seemingly obvious
alternative (e.g., ADR-008-equivalent: "why not just use Fabric.js") — are
recorded as ADRs with context, decision, and consequences, following the
format already established in the existing SaaS's ARCHITECTURE.md. An
undocumented architectural decision is a decision the next engineer (or the
same engineer in eight months) will silently reverse by accident.
