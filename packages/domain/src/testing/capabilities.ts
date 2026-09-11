/**
 * Deterministic implementations of the injected capabilities — ADR-0012.
 *
 * These are **fakes with real behavior**, not assertion spies
 * (Testing-Strategy.md §3.2). They are also not merely test doubles: a seeded
 * RNG and a fixed clock are the implementations Command replay
 * (Command-System.md §17) is defined against, which is why they live on a
 * published surface rather than in a test folder.
 */

import type { Clock, IdGenerator, Rng, TextLayout, TextMeasurer } from "../capabilities.js";
import type { EntityId } from "../ids.js";

/**
 * IDs of the form `<prefix>1`, `<prefix>2`, … — stable across runs and
 * readable in failure output, which matters more here than uniqueness.
 */
export function sequentialIdGenerator(prefix: string = "id"): IdGenerator {
  let n = 0;
  return {
    next(): EntityId {
      n += 1;
      return `${prefix}${n}`;
    },
  };
}

/**
 * Deterministic PRNG (mulberry32) — same seed, same sequence, on every
 * platform. Seeds are literal constants written in the test; a seed derived
 * from the ambient clock is not reproducible (Testing-Strategy.md §3.2).
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A `Clock` that moves only when the test moves it. */
export interface TestClock extends Clock {
  /** Advance by a positive number of milliseconds. */
  advance(ms: number): void;
  /** Jump to an absolute instant (milliseconds since the epoch). */
  set(ms: number): void;
}

/**
 * Starts at a fixed instant and never advances on its own — no wall-clock
 * waiting anywhere in the suite (Testing-Strategy.md §4 rule 3).
 *
 * Default epoch is Domain-Model.md §13's example timestamp,
 * `2026-07-12T00:00:00Z`, so a fixture document's `createdAt` and the clock
 * agree by default.
 */
export function fixedClock(startMs: number = Date.parse("2026-07-12T00:00:00Z")): TestClock {
  let current = startMs;
  return {
    now(): number {
      return current;
    },
    advance(ms: number): void {
      if (ms < 0) {
        throw new RangeError(`fixedClock.advance requires ms >= 0, received ${ms}`);
      }
      current += ms;
    },
    set(ms: number): void {
      current = ms;
    },
  };
}

/** A `TextMeasurer` that records what it was asked to measure. */
export interface RecordingTextMeasurer extends TextMeasurer {
  /** Every `measure` call, in order. */
  readonly calls: readonly { runs: unknown[]; constraints: unknown }[];
}

/**
 * Returns `layout` for every call and records the arguments.
 *
 * Deliberately not metric-producing: `TextLayout` is opaque until
 * Text-System.md exists (ADR-0006; `capabilities.ts`), so no implementation
 * can compute real line boxes yet without inventing that document's model.
 * What this *can* prove today is the invariant that matters most —
 * that a renderer consulted the injected measurer rather than measuring text
 * itself (Invariant 11, ADR-0006 §2) — by asserting on `calls`.
 */
export function recordingTextMeasurer(layout: TextLayout = undefined): RecordingTextMeasurer {
  const calls: { runs: unknown[]; constraints: unknown }[] = [];
  return {
    calls,
    measure(runs: unknown[], constraints: unknown): TextLayout {
      calls.push({ runs, constraints });
      return layout;
    },
  };
}
