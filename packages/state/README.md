# @presentation/state

**Ring 1** · **Status: placeholder — no implementation yet**

The Store: transaction application, structural sharing, the `DocumentQuery` read model, ChangeSet-derived `RenderStateDiff`/`IncrementalSaveOp`, dispatch-queue reentrancy rules.

- Owning architecture document: [docs/architecture/state/State-Management.md](../../docs/architecture/state/State-Management.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
