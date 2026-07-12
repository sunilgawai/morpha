# ADR-0008 — Workspace Tooling for the Implementation Monorepo

**Status:** Accepted
**Date:** 2026-07-13
**Resolves:** repository bootstrap — tool selection for the next several
years of development, chosen for long-term maintainability over popularity.

## Context

Implementation is starting against the reconciled handbook (v1.1.0). The
workspace must mechanically enforce what the handbook specifies (import
law, universal-package purity, Conventional Commits, per-package
versioning) rather than relying on convention, and must remain maintainable
across hundreds of contributors.

## Decision

| Concern | Tool | Rationale |
| --- | --- | --- |
| Package manager | **pnpm** (workspaces) | Mandated. Strict node_modules isolation makes undeclared cross-package imports unresolvable — the import law's first line of defense, verified during bootstrap. |
| Task orchestration | **Turborepo** | Graph-aware caching with a one-file config. Nx's tag-based boundary rules are not needed because boundary enforcement lives in dependency-cruiser (Package-Structure.md §6 is tool-agnostic by design). |
| Bundler | **tsdown** | Rolldown-based successor to tsup (which is in maintenance); fast ESM+CJS+dts dual builds per package, matching Package-Structure.md §8's build-target table. |
| Type checking | **tsc `--build`** with project references | The bundler emits; the compiler checks. References give incremental cross-package checking over 19 composite projects. TypeScript 7 (native) is used and verified working. |
| Format + lint + import sort | **Biome** | One fast tool replaces ESLint+Prettier+import-order plugins — the smallest maintenance surface over a five-year horizon. Architectural rules are explicitly NOT its job. |
| Import-law enforcement | **dependency-cruiser** (pinned ^16 for Node 20) | `configs/dependency-cruiser.cjs` encodes ring ordering, the named forbidden pairs, and a no-unresolvable rule. Negative-tested during bootstrap: an illegally declared `domain → events` edge fails CI with `ring0-imports-nothing`. |
| Unused deps / dead code / unused exports | **knip** | Monorepo-aware; three requested checks in one tool. |
| Spell check | **cspell** (pinned ^9 for Node 20) | Project dictionary at `configs/cspell-project-words.json`, seeded from the handbook's vocabulary. |
| Markdown lint | **markdownlint-cli2** | The handbook is load-bearing prose. Handbook conventions (compact table pipes, `[web:N]` citations) are configured as exceptions, not fought. |
| Commit lint | **commitlint** + config-conventional | Conventional Commits on every commit (lefthook) and PR title (CI), with scope-enum = package short-names. |
| Git hooks | **lefthook** | Single binary, YAML config, parallel jobs — simpler than husky+lint-staged. |
| Versioning/release | **Changesets** | Independent semver per package matches Package-Structure.md §9's ownership model. Publishing infrastructure exists but is gated off (all packages `private: true`) pending a publishing ADR. |
| Tests | **Vitest** + **fast-check** | One runner for unit/integration/contract/snapshot/bench. Property-based tests reserved for handbook-stated determinism invariants. Playwright deferred until a browser app exists (Principle 7). |
| Dependency updates | **Renovate** | Config-in-repo, grouped non-major dev-tooling updates. |

**Node baseline:** `>=20.19` (matches the development machine;
dependency-cruiser and cspell are pinned to their last Node-20-compatible
majors). Raising the baseline to Node 22 LTS is a follow-up that unpins
both — tracked, not urgent.

**npm naming:** bare names exactly as Package-Structure.md records
(`presentation-domain`, …). Name availability on the public registry is
resolved at publish time via a dedicated ADR if conflicts exist.

## Consequences

- Package-Structure.md §6's "executable gates" requirement is fulfilled by
  dependency-cruiser in CI rather than Nx tags — consistent with that
  document's tool-agnostic wording; no amendment needed.
- Two tools are version-pinned below latest for Node 20 compatibility;
  Renovate will propose majors that must wait for the baseline bump.
- tsdown requires `unrun` at the workspace root to load TS configs — a
  root devDependency, documented here because it is non-obvious.
