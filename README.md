# slide-core

> **Status: architecture finalized · implementation starting.** The
> [Architecture Handbook](docs/architecture/Architecture-Index.md) is
> complete and reconciled (v1.1.0, ADR-0001…0007); packages are placeholders
> awaiting Phase 1 (see [ROADMAP.md](ROADMAP.md)).

**slide-core** is a Presentation Domain Engine — a framework-agnostic,
format-agnostic core for creating, editing, rendering, importing, and
exporting visual documents composed of positioned widgets on pages. It is
the substrate that slide editors, pitch-deck builders, whiteboards,
infographic tools, and resume builders can all be built on — the way React
is not HTML and Figma is not PDF, this engine is not OOXML: external
formats are translation targets, never the model.

Start with the handbook: **[docs/architecture/Architecture-Index.md](docs/architecture/Architecture-Index.md)**.

## Monorepo map

```
docs/architecture/   The Architecture Handbook — the source of truth (+ adr/)
packages/            19 packages projected 1:1 from Package-Structure.md 1.1.0
examples/            Structure-only example workspaces (editor, viewer, plugins, …)
apps/                Future deployable apps (playground, docs site)
tests/               Cross-package integration tests, benchmarks, future e2e
tools/               Repo-local tooling packages (empty until needed)
scripts/             Plain maintenance scripts (incl. the package scaffolder)
configs/             Shared tsconfig presets, dependency-cruiser import law
```

Packages by ring (Clean Architecture Dependency Rule, mechanically enforced
by `pnpm lint:deps`):

- **Ring 0:** `presentation-domain`
- **Ring 1:** `presentation-events`, `presentation-state`,
  `presentation-commands`, `presentation-runtime`
- **Ring 2:** `presentation-widget-api`, `presentation-rendering`,
  `presentation-interaction`, `presentation-plugin-api`,
  `presentation-serialization`, `presentation-widgets-base`,
  `presentation-renderer-{dom,canvas,ssr}`,
  `presentation-{export,import}-pptx`
- **Ring 3:** `presentation-react`, `presentation-devtools`,
  `presentation-testing`

`presentation-ai` and `presentation-collaboration` are catalogued by the
handbook but deliberately **not** scaffolded — those features are deferred
by explicit decision (Design Principle 7), and their seams are already
fixed by the architecture.

## Quickstart

```sh
corepack enable          # respects the pinned pnpm version
pnpm bootstrap           # install + build all packages
pnpm check               # format, lint, spell, import law, dead code,
                         # typecheck, test, build — the full CI gauntlet
```

## Tooling (each choice recorded in [ADR-0008](docs/architecture/adr/ADR-0008-workspace-tooling.md))

| Concern | Tool | Why |
| --- | --- | --- |
| Package manager | pnpm | Strict node_modules isolation makes undeclared cross-package imports fail at resolution time — the import law's first line of defense |
| Task orchestration | Turborepo | Graph-aware caching with minimal config surface |
| Bundler | tsdown | Rolldown-based successor to tsup; fast ESM+CJS+dts dual builds |
| Type checking | tsc `--build` + project references | Types are checked by the compiler, emitted by the bundler |
| Format + lint | Biome | One fast tool instead of ESLint+Prettier+import-order |
| Import law | dependency-cruiser | Package-Structure.md §6 as an executable, CI-gated config |
| Dead code / unused deps | knip | Monorepo-aware, three checks in one tool |
| Spelling / Markdown | cspell, markdownlint-cli2 | The handbook is load-bearing prose — protect it |
| Commits / hooks | commitlint + lefthook | Conventional Commits on commits and PR titles |
| Versioning | Changesets | Independent semver per package; publishing prepared, gated off |
| Tests | Vitest + fast-check | One runner for unit/integration/snapshot/bench; property tests for determinism invariants |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The one rule above all others: the
handbook wins. Code that contradicts a finalized architecture document's
boundary tables is a bug even when it works — change the architecture first
(via the [governance process](docs/architecture/Architecture-Index.md#11-architecture-governance-canonical-statement))
or change the code.

## License

[MIT](LICENSE)
