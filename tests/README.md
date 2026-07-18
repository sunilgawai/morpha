# tests/

**Cross-package test workspaces.** Governed by the testing philosophy in
[CLAUDE.md](../CLAUDE.md) and the taxonomy established by
[ADR-0011](../docs/architecture/adr/ADR-0011-development-applications-workspace.md).
The future `Testing-Strategy.md` (Index §12.4) will own the full doctrine;
this tree implements its structure ahead of that document.

## The dividing line

**Single-package tests live in each package's own `test/` directory** — unit,
package-local contract, package-local property, and package-local snapshot
tests run there with no DOM, no network, no real renderer (everything
injectable is injected). **This `tests/` tree is only for suites that cross
package boundaries.**

## The taxonomy

| Directory | Scope | Runner | Status |
| --- | --- | --- | --- |
| [`integration/`](integration/) | Multiple packages exercised together | Vitest (`pnpm test`) | active |
| [`contract/`](contract/) | Shared conformance suites every implementation of a handbook contract must pass (RendererAdapter, WidgetDefinition, importers/exporters) | Vitest | scaffold |
| [`property/`](property/) | Cross-package algebraic/determinism invariants (Command replay, migration chains) | Vitest + fast-check | scaffold |
| [`golden/`](golden/) | Golden-file tests: serialization round-trips and exporter byte output vs. committed fixtures | Vitest | scaffold |
| [`snapshot/`](snapshot/) | Cross-package render/serialization snapshots (SSR output, RenderState shape) | Vitest | scaffold |
| [`regression/`](regression/) | One test per fixed cross-package bug, named for its issue, kept forever | Vitest | scaffold |
| [`example-validation/`](example-validation/) | Proves every `examples/*` builds and runs on public APIs only | Vitest / build | scaffold |
| [`benchmarks/`](benchmarks/) | Performance benchmarks; budgets owned by the future `Performance.md` | `pnpm bench` | active |
| [`visual-regression/`](visual-regression/) | Screenshot-diff tests (future; arrives with a browser app) | Playwright | deferred |
| [`e2e/`](e2e/) | End-to-end tests (future; arrives with a browser app) | Playwright | deferred |

## Wiring

`vitest.config.ts` currently includes `packages/*/test` and
`tests/integration`. As each cross-package suite above gains real tests, add
its glob to the config in the same PR — deliberately empty scaffolds are not
wired in, so an empty directory never fails CI. Property-based suites are
**required** where the handbook states a determinism invariant; golden and
contract suites are **required** for every implementation of a handbook
contract (CLAUDE.md testing philosophy).
