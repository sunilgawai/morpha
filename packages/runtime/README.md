# @presentation/runtime

**Ring 1** · **Status: placeholder — no implementation yet**

The Engine itself: `Engine`, `DocumentSession`, lifecycle phases, the Scheduler, service composition root, and injected capabilities (IDs, RNG, clock, `TextMeasurer` per ADR-0006). Interacts with Ring 2 only through registry interfaces.

- Owning architecture document: [docs/architecture/runtime/Engine-Lifecycle.md](../../docs/architecture/runtime/Engine-Lifecycle.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
