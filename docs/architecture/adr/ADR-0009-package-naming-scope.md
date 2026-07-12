# ADR-0009 — Package Naming: Short Directories, @presentation npm Scope

**Status:** Accepted (supersedes ADR-0008's "bare npm names" paragraph)
**Date:** 2026-07-13
**Resolves:** owner feedback that the `presentation-*` prefix repeated in
every directory and import is redundant noise inside the monorepo.

## Context

ADR-0008 adopted bare npm names exactly as Package-Structure.md records
(`presentation-domain`, …), giving verbose directory names
(`packages/presentation-commands`) and imports. The owner requested short
names (`commands`, `devtools`, …). Literal bare short names are not
viable: `react` would collide with the actual React package in every
import, and `events` shadows the Node.js builtin module.

## Decision

Three name forms, mapped 1:1, each used where it belongs:

| Form | Pattern | Used in |
| --- | --- | --- |
| **Logical name** | `presentation-<short>` | The Architecture Handbook's prose and catalogues — unchanged |
| **npm name** | `@presentation/<short>` | package.json, imports, dependency declarations |
| **Directory** | `packages/<short>` | The filesystem |

Example: the handbook's `presentation-commands` is npm package
`@presentation/commands` in directory `packages/commands`.

The scope avoids the `react`/`events` collisions, guarantees registry
availability under one org scope at publish time (retiring ADR-0008's
"resolve name conflicts later" risk), and keeps handbook prose untouched —
no handbook-wide rename, only Package-Structure.md's naming section changes.

## Consequences

- Package-Structure.md bumped to 1.2.0 (naming section + changelog).
- All 19 packages renamed (directories, npm names, imports, tsconfig
  references); dependency-cruiser patterns updated for the scoped
  `node_modules/@presentation/` path and re-negative-tested.
- Commit scopes (commitlint) were already the short names — unchanged.
- MEMORY.md decision record and naming conventions updated.
