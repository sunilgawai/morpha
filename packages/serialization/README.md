# @presentation/serialization

**Ring 2** · **Status: placeholder — no implementation yet**

Canonical persistence: `CanonicalDocumentEnvelope`, asset manifest, integrity checking, schema-migration orchestration, snapshots, incremental save (with explicit removal sets).

- Owning architecture document: [docs/architecture/persistence/Serialization.md](../../docs/architecture/persistence/Serialization.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
