# tests/property/

**Cross-package Property Tests**

fast-check property suites for invariants that span packages: Command replay determinism (Command-System.md §17) and migration-chain correctness (Serialization.md §15). Single-package property tests (e.g. fractional-index ordering, Ordering-Strategy.md) stay in the owning package's `test/`.

See [../README.md](../README.md) for the full taxonomy and the single-
vs-cross-package dividing line.
