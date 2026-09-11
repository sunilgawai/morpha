---
"@morpha/domain": minor
---

Add structural validation (Domain-Model.md §12): `validateDocument`,
`ValidationResult`, `ValidationIssue`, `ValidationIssueCode`,
`mergeValidationResults`, `validResult`, and the `WidgetTypeLookup` /
`WidgetDataValidator` ports introduced by ADR-0013. The testing subpath gains
`stubWidgetTypeLookup`, `acceptingWidgetDataValidator` and
`rejectingWidgetDataValidator`.

Validation checks references, parent-chain cycles, theme and asset lookups, and
optionally the runtime-only derived caches; widget `data` is delegated to the
widget's own validator and never inspected by the core. Issues accumulate rather
than throw.
