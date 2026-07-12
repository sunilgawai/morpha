# ADR-0004 — One RendererAdapter Contract; Session-Scoped SDK Surfaces

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review C4 (RendererAdapter defined differently in
Rendering-Architecture.md §5 and Developer-SDK.md §8; renderer attachment
engine-scoped in one document and session-scoped in another) and C7 (SDK
exposed per-DocumentSession services as engine-global namespaces, breaking
the multi-session capability Engine-Lifecycle.md guarantees).

## Context

Two generations of the renderer contract were written independently:
`mount(target, initialState) → RendererHandle{update, unmount, dispose,
capabilities}` (Rendering-Architecture) vs `{id, mount(container, ctx),
reconcile(handle, diff), unmount(handle)}` (Developer-SDK). Separately,
the SDK hung `commands`, `history`, `selection`, and document-event
subscription off `engine.*` even though Engine-Lifecycle.md §5 makes all
four per-`DocumentSession`; with multiple concurrent sessions,
`engine.history.undo()` is ambiguous.

## Decision

1. **Rendering-Architecture.md §5 is the canonical `RendererAdapter`
   contract**, with one addition: a required `id: string`. The SDK's
   `reconcile`-shaped variant is struck. Handles are returned by `mount()`
   and expose `update(state, diff)`, `unmount()`, `dispose()`,
   `capabilities`.
2. **Renderer *registration* is engine-scoped; renderer *attachment* is
   session-scoped**, with an explicit `RenderTarget`:

   ```typescript
   engine.renderers.register(adapter);                       // registry
   const handle = session.renderers.attach(adapterId, target); // instance
   ```

3. **The SDK root splits into two scopes:**
   - `engine.*` — registries and engine-global services only: `widgets`,
     `tools`, `commands` (factory registration only), `renderers`
     (registration only), `plugins`, `themes`, `assets`, `adapters`
     (importers/exporters), `ai`, `collaboration`, `devtools`, `documents`.
   - `session.*` — everything per-document: `dispatch()` /
     `dispatchBatch()`, `history`, `selection`, `renderers.attach()`,
     `events` (Document/Interaction event subscription), `collaboration
     .connect()`, `store` (read-only query accessor — the `DocumentQuery`
     surface, State-Management.md).
   Convenience delegation from `engine.*` to "the sole open session" is
   permitted for single-document applications but is documented sugar,
   not the contract.

## Consequences

- Developer-SDK.md §3, §4, §8, §13, §16 rewritten to the split-scope
  model; the minimal path now includes the render target.
- Engine-Lifecycle.md §4.4 amended: attachment moves to
  `session.renderers.attach(...)`; §6.1's namespace list annotated.
- `presentation-react` hooks bind to a session, not the engine.
