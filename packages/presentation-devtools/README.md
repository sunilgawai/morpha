# presentation-devtools

**Ring 3** · **Status: placeholder — no implementation yet**

The inspector built on the read-only observability contracts (`EventObserver`, `CommandObserver`, plugin logging). Observes, never dispatches.

- Owning architecture document: [docs/architecture/packages/Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
