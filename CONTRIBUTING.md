# Contributing

Thanks for contributing. This project is **architecture-first**: the
[Architecture Handbook](docs/architecture/Architecture-Index.md) is the
source of truth, and code that contradicts it is a bug even if it works.
Read the Index's reading path (§9) that matches your task before writing
code.

## Prerequisites

- Node `>=20.19` (see `.nvmrc`)
- pnpm 10 (`corepack enable` respects the pinned `packageManager`)

## Getting started

```sh
pnpm bootstrap   # install + build everything
pnpm check       # the full local CI gauntlet
```

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm bootstrap` | `pnpm install` + full build — a fresh clone to working state |
| `pnpm dev` | `turbo watch build` — rebuild packages on change |
| `pnpm build` | Build all packages (tsdown, ESM+CJS+dts), turbo-cached |
| `pnpm clean` | Remove all build output and caches |
| `pnpm typecheck` | `tsc --build` across the project-references graph |
| `pnpm lint` | Biome (code) + markdownlint (docs) |
| `pnpm lint:deps` | dependency-cruiser — the Package-Structure.md §6 import law |
| `pnpm lint:knip` | Unused dependencies, dead code, unused exports |
| `pnpm format` / `format:check` | Biome write / CI mode |
| `pnpm spell` | cspell over code and docs |
| `pnpm test` / `test:watch` | Vitest (package unit tests + cross-package integration) |
| `pnpm bench` | Vitest benchmarks (`tests/benchmarks/`) |
| `pnpm check` | Everything CI runs, locally, in order |
| `pnpm docs` | Markdown lint + spell check over `docs/` |
| `pnpm changeset` | Record a changeset for your change |
| `pnpm version-packages` | Apply changesets to package versions (release PR) |
| `pnpm release` | Build + `changeset publish` (inert while packages are private) |

## Branch strategy

Trunk-based: `main` is protected; work happens on short-lived branches
(`feat/...`, `fix/...`, `docs/...`) merged by **squash-merge**. The PR title
becomes the commit message, so PR titles must be valid Conventional Commits
(CI enforces this).

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/) with scopes
enforced by commitlint (`commitlint.config.mjs`): package short-names
(`domain`, `state`, `commands`, `renderer-dom`, …) plus `docs`, `repo`,
`ci`, `examples`, `deps`, `release`.

```
feat(state): implement ChangeSet write-time tracking
fix(commands): reject nested transactions per State-Management.md §10
docs(repo): clarify ADR workflow
```

## Changesets

Every PR that changes a package needs a changeset (`pnpm changeset`) unless
it carries the `no-changeset` label (docs/CI-only changes). Versioning is
independent semver per package (Package-Structure.md §9's ownership model).

## Architecture governance

The process is defined in
[Architecture-Index.md §11](docs/architecture/Architecture-Index.md). In
short:

- **Reversing an accepted decision** → new ADR in `docs/architecture/adr/`
  (use `TEMPLATE.md`), accepted before the affected document changes.
- **Adding to/changing a finalized document** → Amendment Proposal (an
  issue using the *Architecture proposal* template), then the document edit
  with a Version Changelog entry.
- **Small, previously-flagged addition** → Follow-up Patch, same changelog
  requirement.
- **Changing any package's dependencies** → update
  `Architecture-Index.md` and `Package-Structure.md` **in the same PR**.

## Testing expectations

- **Unit / contract / snapshot tests** live in the owning package's
  `test/` directory and must run with no DOM, no network, no real renderer
  (inject fakes via `presentation-testing` once it exists).
- **Cross-package integration tests** live in `tests/integration/`.
- **Property-based tests** (fast-check) are expected wherever the handbook
  states a determinism or algebraic invariant — fractional-index ordering,
  command replay, migration chains.
- **Benchmarks** live in `tests/benchmarks/`; budgets arrive with
  Performance.md.

## Review expectations

- Ring 0/1 packages and `docs/architecture/` require core-team review
  (CODEOWNERS).
- Reviewers check the PR against the governance checklist in the PR
  template — "works but violates a boundary table" is a rejection.
