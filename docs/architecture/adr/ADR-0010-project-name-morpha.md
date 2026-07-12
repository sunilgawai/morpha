# ADR-0010 — Project Name: morpha; npm Scope @morpha/*

**Status:** Accepted (supersedes ADR-0009's `@presentation` scope name;
the three-form mapping structure from ADR-0009 is unchanged)
**Date:** 2026-07-13
**Resolves:** owner decision to name the project **morpha**.

## Context

ADR-0009 established short directories + a scoped npm namespace, using the
placeholder-ish scope `@presentation`. The owner has named the project
"morpha" and wants the namespace to carry the brand
(`@morpha/runtime`, `@morpha/react`, …).

## Decision

- Project name: **morpha** (root package `morpha`; repository directory
  remains `slide-core` on disk — a filesystem rename is a host-side action
  outside this repo's control).
- npm scope: **`@morpha/*`**. The ADR-0009 mapping keeps its structure
  with only the scope swapped: handbook logical name `presentation-<x>`
  ↔ npm `@morpha/<x>` ↔ directory `packages/<x>`.
- Handbook prose keeps its logical `presentation-*` names — the handbook
  names *roles*, the scope names *artifacts*; only Package-Structure.md's
  mapping section changes (1.3.0).
- The owner's example names `@morpha/widgets` and `@morpha/pptx` were
  treated as illustrations of the scope, not directives: `widgets-base`
  keeps its name (it is the base pack, not the widget concept), and the
  exporter/importer split (`export-pptx`/`import-pptx`) is a deliberate
  architectural boundary (Serialization.md §17, independently ownable
  packages) that a merged `pptx` package would erase. Renaming/merging
  either is a trivial follow-up if explicitly requested.

## Consequences

- All 19 package names, imports, dependency declarations, dependency-cruiser
  patterns, scaffolder, and docs updated; ADR-0009's text is preserved
  as-written (historical record).
- The `@morpha` npm organization should be registered before publishing
  (note added to the deferral table's publishing trigger).
