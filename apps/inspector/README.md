# apps/inspector

**DevTools-class runtime debugger for the engine.** Governed by
[ADR-0011](../../docs/architecture/adr/ADR-0011-development-applications-workspace.md).

Think React DevTools, Redux DevTools, Chrome DevTools, Unreal Insights. Its
job is to inspect the engine *while it runs* — and only to inspect. An
inspector **observes; it never mutates and never dispatches** (Rendering-
Architecture.md §4 / ADR-0002 discipline applies to tooling too).

## Run it

```bash
pnpm dev:inspector      # from the repo root
```

Opens on <http://localhost:4174>, independently of the Playground.

## What it shows

Today: a grid of read-only **probes** (`src/inspector/probes.ts`) grouped by
concern — Structure, Runtime, Events, Rendering, Metrics, Future. Each probe
declares what it observes and which document governs that data. Some probes
(Timeline, Animation State, AI Activity, Collaboration State) are explicitly
marked *future*, tracking seams the handbook has fixed but not yet built.

Placeholder probes are the intended state until a running engine can be
attached (ADR-0011).

## The one hard rule

**Consume only `@morpha/*` public exports — never package internals**
(ADR-0011 §4). `src/inspector/target.ts` is the single seam where the
Inspector reads the engine, and it stays read-only by construction.

This app is excluded from the engine CI gate; it depends on the engine, never
the reverse.
