# ADR-0002 — Interaction Pipeline Ownership: Who Translates Intents into Commands

**Status:** Accepted
**Date:** 2026-07-12
**Resolves:** Readiness Review C1 (three documents assigned intent→Command
translation to three different owners; the interpreter registry was
referenced but never defined)

## Context

Four finalized documents described the interactive pipeline's middle
differently:

- Engine-Lifecycle.md §6.15: renderers report `InteractionIntent`s to the
  Interaction Manager, which produces Commands.
- Selection-and-Interaction.md §9: renderers report *raw input*; Tools
  produce intents; "the Command System is solely responsible" for turning
  a `moveRequested` into a `MoveWidgetCommand`.
- Command-System.md §20: the Command layer "receives only
  already-constructed Command objects."
- Rendering-Architecture.md §7.2: "the Event System … interprets them …
  and translates some of them into Commands" — contradicting
  Event-System.md §1/§17 ("never interprets intent").

## Decision

One pipeline, one owner per stage:

```
Renderer            — captures native input, normalizes it into
                      PointerInputEvent / KeyInputEvent / GestureInputEvent.
                      Renderers never produce InteractionIntents.
Tools               — hosted by the Interaction Manager; interpret
                      normalized input via the Tool state machine and emit
                      InteractionIntents (Selection-and-Interaction.md).
Interaction Manager — translates each intent into zero or more Commands
                      via the Intent Interpreter Registry (below), then
                      dispatches them. This is the ONLY intent→Command
                      translation point.
Event System        — transports interaction-event NOTIFICATIONS to
                      observers (property panels, telemetry). It is never
                      part of the mutation path and never interprets.
Command System      — receives only constructed Command objects
                      (Command-System.md §20 stands unchanged).
```

**Intent Interpreter Registry** (new, owned by the Interaction layer,
defined in Selection-and-Interaction.md §15): maps an
`InteractionIntent.kind` to an interpreter function
`(intent, query: DocumentQuery) => Command[]`. Built-in kinds ship with
built-in interpreters registered through the same API a plugin Tool's
custom intent kinds use. An intent with no registered interpreter fails
loudly (Engine-Lifecycle.md §9).

## Consequences

- Engine-Lifecycle.md §6.15 amended: Interaction Manager hosts Tools,
  receives normalized input (not intents) from renderers, and owns
  translation via the registry.
- Rendering-Architecture.md §7.2 amended: renderers' outbound contract is
  normalized input events; the intent union is owned by
  Selection-and-Interaction.md §9.
- Selection-and-Interaction.md §9/§15 amended: translation responsibility
  moves from "Command System" to the Interaction Manager + registry.
- Event-System.md §17 amended to remove "delivered to the Command
  Dispatcher" phrasing.
- Command-System.md is unchanged — its refusal was correct.
