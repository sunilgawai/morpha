# apps/playground

**The daily engine development environment.** Governed by
[ADR-0011](../../docs/architecture/adr/ADR-0011-development-applications-workspace.md).

Think Flutter Gallery, the Lexical Playground, or the tldraw development app.
This is where almost all Presentation Engine development happens: you build a
feature in the packages, then *see it here*. As the engine grows, this app
naturally evolves into a lightweight presentation editor.

## Run it

```bash
pnpm dev:playground     # from the repo root
```

Opens on <http://localhost:4173>.

## What it shows

Today: an editor-shaped shell of **placeholder panels** (see
`src/shell/panels.ts`). Each panel declares the engine capability it will
visualize and the architecture document that governs it. Displaying very
little right now is expected and intended (ADR-0011) — the value is the
harness, not today's output.

Planned regions, each becoming real as its backing capability lands: Toolbar,
Engine Status, Runtime Status, Package Versions, Feature Flags, Widget Tree,
Canvas, Property Panel, Inspector toggle, Current Selection, History,
Developer Console, Performance Overlay, Plugin Status.

## The one hard rule

**Consume only `@morpha/*` public exports — never package internals**
(ADR-0011 §4). `src/engine/facts.ts` is the single seam where the Playground
reads the engine. If a feature can't be built on public APIs, improve the
package API through governance; do not bypass encapsulation.

This app is excluded from the engine CI gate; it depends on the engine, never
the reverse.
