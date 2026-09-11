/**
 * Injected capabilities — Design Principle 8, ADR-0005 §3, ADR-0006.
 *
 * Everything nondeterministic enters the engine through one of these. No core
 * code path calls `Math.random()`, `Date.now()`, or `crypto.randomUUID()`
 * inline, and no renderer measures text. Replay contexts inject seeded/fixed
 * implementations, which is the whole reason Command replay
 * (Command-System.md §17) can mean anything.
 *
 * Deterministic implementations live on this package's `./testing` subpath
 * (ADR-0012).
 *
 * Provisional signatures: the handbook fixes the *mechanism* for
 * `IdGenerator`/`Rng`/`Clock` (Domain-Model.md §10, Ordering-Strategy.md,
 * Command-System.md §15) but prints no signature for any of the three. These
 * are the minimal single-method shapes; changing them once a real consumer
 * exists is an amendment, not a bug fix.
 */

import type { EntityId } from "./ids.js";

/**
 * Domain-Model.md §10: IDs are produced by an injected generator, never
 * generated inline. Tests inject a sequential generator; a future
 * collaborative backend can inject a coordinated scheme without touching
 * call sites.
 */
export interface IdGenerator {
  next(): EntityId;
}

/**
 * Ordering-Strategy.md (Collision Handling) + ADR-0005 §3: the fractional
 * index jitter suffix is drawn from here, never from `Math.random()`.
 */
export interface Rng {
  /** A number in [0, 1). */
  next(): number;
}

/**
 * Command-System.md §15: a Command captures "now" into its payload at
 * construction time through an injected clock. `execute()` never reads an
 * ambient clock, or replay would not be deterministic.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/**
 * The three types below are owned by Text-System.md, which does not exist
 * yet (Architecture-Index.md §12.1 — Critical, and the hard gate on the Text
 * widget per ADR-0006). ADR-0006 prints the `measure` signature but defines
 * none of its three types, annotating only that `TextLayout` carries "line
 * boxes, glyph advances, total bounds — engine units".
 *
 * They are therefore deliberately opaque here, on the same reasoning as
 * `LayoutConstraints` (Domain-Model.md §5): declaring a shape now would mean
 * designing Text-System.md by implementation, and that document would
 * inherit it. Narrowing them is that document's decision.
 */
export type TextRun = unknown;
export type MeasureConstraints = unknown;
export type TextLayout = unknown;

/**
 * ADR-0006: text measurement is one engine-level capability, injected at
 * construction. The Text widget's layout, hit-testing inside text,
 * renderers' line placement, and exporters' text positioning all consume
 * `TextLayout` from this one measurer — renderers *paint* text, they never
 * *measure* it authoritatively (Invariant 11).
 */
export interface TextMeasurer {
  measure(runs: TextRun[], constraints: MeasureConstraints): TextLayout;
}
