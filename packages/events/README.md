# @morpha/events

**Ring 1** · **Status: placeholder — no implementation yet**

The semantic Event System: `Emitter`/`Event`/`Disposable`, the event taxonomy, `EventOrigin`, `EventEnvelope`. Notification transport only — never part of the mutation path (ADR-0002).

- Owning architecture document: [docs/architecture/runtime/Event-System.md](../../docs/architecture/runtime/Event-System.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
