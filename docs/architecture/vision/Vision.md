# Vision.md

**Status:** Foundational — rarely changes
**Version:** 1.0.0

---

## 1. What We Are Building

We are building a **Presentation Domain Engine** — a framework-agnostic,
format-agnostic, application-agnostic core for creating, editing, rendering,
importing, and exporting visual documents composed of positioned widgets on
pages.

It is not a slide editor. It is not a PowerPoint clone. It is not a React
component library. It is the substrate that slide editors, pitch deck
builders, whiteboards, infographic tools, report builders, and resume
builders can all be built on top of, the same way:

- **React** is not HTML — it is a model for UI that happens to compile to HTML, DOM, or native views.
- **Prisma** is not PostgreSQL — it is a data access abstraction that happens to target PostgreSQL, MySQL, or SQLite.
- **Flutter** is not Android — it is a rendering and app model that happens to compile to Android, iOS, or Web.
- **Excalidraw** is not SVG — it is a scene graph that happens to export to SVG, PNG, or its own JSON format.
- **Figma** is not PDF — it is a design tool with its own vector scene model that happens to export to PDF among other formats.

Likewise: **this engine is not OOXML, not PDF, not HTML.** Those are output
targets our exporters produce. The engine's own model — the Presentation
Domain Model — is the single source of truth, and it owes no allegiance to
any external file format's constraints, quirks, or history.

## 2. Why This Needs To Exist

Every visual editing product — a presentation maker, a whiteboard, a resume
builder — independently reinvents the same hard problems: a positioned-object
data model, undo/redo, selection and hit-testing, serialization, multi-format
export, and a plugin system for custom content types. Teams either:

1. Build a bespoke editor tightly coupled to one product, which becomes
   unmaintainable and unextendable as the product grows (this is the trap
   most SaaS presentation tools fall into around their first 50,000 lines of
   editor code), or
2. Adopt a canvas library (Fabric.js, Konva.js) that solves *rendering* but
   provides no opinion on document model, versioning, collaboration, or
   export — leaving the hardest architectural problems unsolved, or
3. Adopt a closed commercial SDK (e.g., Polotno) that solves the product
   problem but locks the domain model to the vendor's schema and pricing.

We are building the fourth option: an **open, owned, domain-first engine**
that any of our future products can adopt, and that could in principle be
open-sourced and adopted by others, the way tldraw's editor package powers
products far beyond tldraw.com itself.

## 3. Who This Is For

- **Primary (near-term):** Our own family of products — AI Presentation SaaS,
  Pitch Deck Builder, Whiteboard, Infographic Builder, Report Builder,
  Document Builder, Resume Builder.
- **Secondary (long-term):** Any third-party application or developer that
  needs programmatic or interactive visual document editing, if and when the
  package is opened beyond internal use.

The engine must never be designed with implicit knowledge of *which* product
is consuming it. A resume builder and a pitch deck tool have different
widgets and different default layouts, but they share the same underlying
document model, command system, and rendering contract.

## 4. What Success Looks Like

Five years from now, this package should:

- Power multiple shipped products without any of them forking the core.
- Have absorbed at least one major rendering technology shift (e.g., DOM →
  Canvas → WebGL, or React → framework-agnostic) without a breaking change to
  the domain model or the public command API.
- Have a plugin ecosystem where third-party widgets, exporters, and importers
  can be added without modifying core package code.
- Support real-time collaborative editing as an additive layer, not a
  rewrite — because the domain model was designed for structural sharing and
  atomic, mergeable operations from day one, following the pattern Figma
  established: server-authoritative state, atomic property-level updates, and
  a durable operation log that also feeds AI/ML tooling as a side effect (see
  Figma's multiplayer architecture; the operation log became more valuable
  than undo/redo alone).
- Still "feel well-designed" to a new engineer joining the team — meaning
  the abstractions from year one are still the abstractions in year five, not
  patched around.

## 5. What We Explicitly Reject

- **Rejecting format-first design.** We do not model widgets, geometry, or
  styling after OOXML, PDF, or any other export target. Format-first design
  is the single most common trap in this space and the reason PowerPoint's
  and Word's internal object models are, forty years later, nearly impossible
  to evolve without breaking millions of documents.
- **Rejecting premature generality.** We do not build a plugin system,
  animation system, or layout engine to their theoretical full extent before
  a real widget and a real product need them. Abstractions are earned through
  at least two to three concrete use cases, not designed speculatively.
- **Rejecting framework lock-in.** The core package has zero dependency on
  React, Vue, or any specific rendering technology. Framework bindings are
  adapters, always optional, always replaceable.
- **Rejecting application concerns leaking into the engine.** The engine has
  no concept of users, organizations, billing, AI prompts, or persistence
  backends. Its lifecycle begins when a caller hands it a document (or asks
  it to create one) and ends when it returns updated state or exported bytes.

## 6. Relationship To Our Existing SaaS

Our current presentation SaaS (~50% complete) is not refactored to use this
engine. It continues to evolve independently on its existing widget model,
editor, and `pptxgenjs`-based export pipeline. This engine is a greenfield,
separately versioned package. Migration is a deliberate future decision made
only after the engine is mature and battle-tested against at least one other
real product surface — not a foregone conclusion and not a current-sprint
goal.

## 7. Guiding Metaphor

> The Presentation Domain Model is the *truth*. Every renderer, exporter,
> importer, AI generator, and UI framework is a *translator* that speaks to
> that truth and back. None of them get to bend the truth to their own
> convenience.
