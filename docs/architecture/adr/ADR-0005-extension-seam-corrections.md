# ADR-0005 — Extension Seam Corrections: Sandbox Scope, AI Streaming, Determinism

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review M5 (sandboxed plugin tier overclaimed for
function-bearing contributions), M11 (AI provider contract batch-only),
M12 (nondeterministic ordering jitter; no command-payload migration path)

## 1. Sandboxed Plugin Tier — Honest Scope

**Context.** Plugin-System.md §11 claimed the sandboxed (Worker/iframe)
tier "requires no special-cased contract" because all contracts are
serializable. This is false for function-bearing contributions:
`WidgetDefinition` is mostly functions (`createDefaultData`, `validate`,
`render`), and proxying per-frame `render()` or per-keystroke `validate()`
across a message channel is not viable (latency, and it breaks the
synchronous validation pipeline).

**Decision.** The sandboxed tier is scoped to **data-shaped
contributions** whose invocation is coarse-grained and naturally async:
Importers, Exporters, AI Providers, Collaboration Providers, and
Plugin-Source resolvers. **Function-bearing contributions** — Widgets,
Tools, Renderers, Property Panels, Validators, Intent Interpreters — are
**trusted-tier-only** in this architecture version. Opening them to
untrusted authors requires a dedicated future ADR (candidate approaches:
declarative widget templates, compiled-sandbox execution à la Figma's
plugin VM) and is deliberately not designed speculatively (Principle 7).

## 2. AI Provider Streaming Seam

**Context.** `generate(request): Promise<Command[]>` is batch-only; AI
presentation products stream results progressively, and a 30-second
generation racing live edits produces stale Commands with no recovery
story.

**Decision.**

- `AIProviderContribution` gains an optional
  `generateStream?(request): AsyncIterable<Command[]>`. Each yielded batch
  is dispatched as one Macro Command; grouping multiple batches into a
  single undo step is a tracked open question for AI.md (seam:
  `HistoryManager` grouping, not designed yet).
- Staleness is handled by the existing pipeline: stale Commands fail
  validation and are rejected per batch; *rebase/compensation policy is
  the AI provider's responsibility* (Command-System.md §12's retry rule),
  with the `DocumentQuery` read surface available for re-reading current
  state between batches.

## 3. Determinism Corrections

- **Ordering jitter** (Ordering-Strategy.md): the collision-avoidance
  suffix is drawn from the engine's **injected RNG/ID source** (Principle
  8), never `Math.random()`. Replay contexts inject a seeded source;
  determinism of replay is thereby preserved.
- **Command payload migration**: the Command Factory Registry
  (Command-System.md §16) accepts an optional
  `migrate(payload, fromVersion)` per command type, mirroring widget-data
  migration, so persisted/replayed `SerializedCommand`s from older engines
  remain rehydratable. Without this, cross-version replay was a fiction.
