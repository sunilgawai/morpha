# apps/

**Development applications — first-class engineering infrastructure**, not
demos and not throwaway examples. Governed by
[ADR-0011](../docs/architecture/adr/ADR-0011-development-applications-workspace.md),
which scopes Design Principle 7: DP7 forbids speculative *engine* abstractions,
not the developer-facing harness used to build the engine.

| App | Responsibility | Stack | Port |
| --- | --- | --- | --- |
| [`playground`](playground/) | Daily development environment; grows into a lightweight editor | Vite + React | 4173 |
| [`inspector`](inspector/) | DevTools-class runtime debugger (read-only) | Vite + React | 4174 |
| [`docs`](docs/) | Public documentation website | Astro + Starlight | 4175 |

## Running

```bash
pnpm dev:playground     # daily driver
pnpm dev:inspector      # runtime debugger (independent)
pnpm dev:docs           # documentation site (independent)
pnpm dev:apps           # all three in parallel
```

## Invariants (ADR-0011)

- **Public APIs only.** Every app consumes the engine exactly as an external
  developer would — only `@morpha/*` public exports, never package internals.
  If a feature needs something the public API can't provide, improve the API
  through governance; never bypass encapsulation.
- **Downstream of the engine.** Apps depend on packages, never the reverse, and
  are excluded from the engine CI gate (`pnpm build` / `pnpm check` stay
  package-scoped).
- **Displaying little is fine.** These are harnesses; their value is enabling
  development, not today's output.
