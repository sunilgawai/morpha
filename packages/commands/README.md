# @morpha/commands

**Ring 1** · **Status: placeholder — no implementation yet**

The mutation architecture: the `Command` contract, Command Dispatcher, Transaction Manager integration, History Manager, Command Factory Registry with payload migration. Commands are the only legal mutation mechanism (ADR-0007).

- Owning architecture document: [docs/architecture/runtime/Command-System.md](../../docs/architecture/runtime/Command-System.md)
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy `pnpm lint:deps`.
