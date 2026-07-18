# DEVELOPMENT.md — The Development Environment

How the Playground, Inspector, Docs, Examples, and Tests work **together** as
the environment every engine feature is built within. Established by
[ADR-0011](docs/architecture/adr/ADR-0011-development-applications-workspace.md).
The handbook (`docs/architecture/`) remains the source of truth; this file
describes the *workflow*, not the architecture.

## The workspace at a glance

```
morpha/
  packages/     the engine (Rings 0–3) — the only thing that ships
  apps/         development applications (dev infrastructure, not products)
    playground/   daily development environment → :4173
    inspector/    runtime debugger (read-only)  → :4174
    docs/         documentation website          → :4175
  examples/     numbered educational ladder (01…17), one concept each
  tests/        cross-package suites (package-local tests live in packages/*/test)
```

Everything under `apps/`, `examples/`, and `tests/` consumes the engine
through **public `@morpha/*` exports only** — never package internals. If a
feature can't be built that way, the fix is to improve the package's public
API through governance, never to bypass encapsulation (ADR-0011 §4).

## The per-feature workflow

Each of these five surfaces has a job in the loop the repository is designed
to encourage:

```
Architecture  →  RFC/ADR  →  Tests  →  Implementation
      →  Playground verification  →  Inspector validation
      →  Docs update  →  Examples update  →  Commit  →  CI
```

1. **Architecture.** Read the Index and the reading path for your task
   (Index §9). If the change needs a new decision or reverses one, write an
   ADR / Amendment / Follow-up Patch *first* (Index §11). No code contradicts
   a finalized boundary table.
2. **Tests.** Add the cross-package suite (`tests/contract`, `tests/property`,
   `tests/golden`, …) or the package-local test that encodes the invariant
   before or alongside the implementation. Property/golden/contract suites are
   required where the handbook states an invariant or a contract.
3. **Implementation.** Build the narrowest thing in the owning package. Keep
   per-keystroke paths O(touch) (ADR-0003, State-Management.md §5).
4. **Playground verification.** Wire the new capability into a
   `apps/playground` panel (`src/shell/panels.ts`) and *see it work*. The
   Playground grows one real panel at a time; "it renders in the Playground"
   is the first proof a feature is usable through the public API.
5. **Inspector validation.** Confirm the runtime behaves — command log,
   event stream, state tree, dirty nodes — through `apps/inspector`
   (`src/inspector/probes.ts`). The Inspector only observes; if you need it to
   mutate to test something, the test is wrong.
6. **Docs update.** Update `apps/docs` (and the handbook, through governance,
   when a contract changed). Interactive snippets and, later, an embedded
   Playground live here.
7. **Examples update.** If the feature completes a teachable concept, fill in
   the matching numbered example. One concept per example — resist bundling.
8. **Commit → CI.** Conventional Commits; `pnpm check` (package-scoped gate)
   must be green before pushing.

## What each surface is *for* (and is not)

| Surface | Is | Is not |
| --- | --- | --- |
| **Playground** | The daily driver; a growing lightweight editor; where you *build and see* features | A product; a place to reach into internals |
| **Inspector** | A read-only runtime debugger (DevTools-class) | A second editor; a mutation surface |
| **Docs** | The public site; renders/links the handbook | A fork of the handbook (it must never diverge) |
| **Examples** | Educational reference apps, one concept each | Tests; demos; feature dumps |
| **Tests** | Cross-package correctness (contract/property/golden/…) | The home for single-package unit tests (those live in `packages/*/test`) |

## Running things

```bash
pnpm dev              # watch-build the engine packages (turbo)
pnpm dev:playground   # the daily driver
pnpm dev:inspector    # runtime debugger (independent)
pnpm dev:docs         # documentation site (independent)
pnpm dev:apps         # all three apps in parallel

pnpm test             # package tests + cross-package integration
pnpm bench            # benchmarks
pnpm check            # the full package-scoped CI gate

pnpm --filter example-01-hello-presentation dev   # run one example
```

**Apps and examples are excluded from the engine CI gate on purpose.**
`pnpm build`, `pnpm typecheck`, and `pnpm check` stay package-scoped so the
engine's correctness never depends on a Vite or Astro app building. Apps are
downstream consumers; they depend on the engine, never the reverse.
