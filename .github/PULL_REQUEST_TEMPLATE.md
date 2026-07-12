## Summary

<!-- What does this change do, and why? Link the issue if one exists. -->

## Architecture governance checklist

- [ ] This change does **not** contradict any finalized architecture document's boundary tables ("what this layer does NOT do").
- [ ] If it changes a package's dependencies, `docs/architecture/Architecture-Index.md` and `Package-Structure.md` are updated **in this same PR** (Index §11 rule 4).
- [ ] If it reverses an architectural decision, an ADR is included in `docs/architecture/adr/`.
- [ ] `pnpm lint:deps` passes (package import law).

## Quality checklist

- [ ] `pnpm check` passes locally.
- [ ] Tests cover the change (or the change is test-exempt and says why).
- [ ] A changeset is included (`pnpm changeset`), or the `no-changeset` label applies.
