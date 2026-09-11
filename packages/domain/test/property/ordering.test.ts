import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  compareOrdered,
  compareOrderKeys,
  generateKeyBetween,
  generateNKeysBetween,
} from "../../src/index";
import { seededRng } from "../../src/testing/index";

/**
 * Testing-Strategy.md §5 rows P1 and P2 — the algebraic guarantees
 * Ordering-Strategy.md states for fractional indexing. These are the invariants
 * every later reorder feature is built on, so they are proven over generated
 * insertion sequences rather than a handful of examples.
 */

/** An arbitrary sequence of insertion positions into a growing collection. */
const insertions = fc.array(fc.nat(), { minLength: 1, maxLength: 60 });

describe("P1 — a generated key sorts strictly between its bounds", () => {
  it("holds for arbitrary insertion sequences", () => {
    fc.assert(
      fc.property(insertions, fc.integer(), (positions, seed) => {
        const rng = seededRng(seed);
        const keys: string[] = [];
        for (const raw of positions) {
          const at = keys.length === 0 ? 0 : raw % (keys.length + 1);
          const before = at === 0 ? null : (keys[at - 1] ?? null);
          const after = at === keys.length ? null : (keys[at] ?? null);
          const key = generateKeyBetween(before, after, rng);
          if (before !== null) {
            expect(compareOrderKeys(before, key)).toBe(-1);
          }
          if (after !== null) {
            expect(compareOrderKeys(key, after)).toBe(-1);
          }
          keys.splice(at, 0, key);
        }
        // The collection is sorted at every point, by construction.
        expect([...keys].sort(compareOrderKeys)).toEqual(keys);
        expect(new Set(keys).size).toBe(keys.length);
      }),
    );
  });
});

describe("P1 — generation never exhausts the key space", () => {
  it("survives 200 successive insertions into the same gap", () => {
    // The failure mode this rules out is the float implementation's:
    // repeated midpoint insertion converging until insertion silently breaks
    // (Ordering-Strategy.md, "Why String, Not Float"). 200 is far past the ~50
    // at which 64-bit floats collapse.
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = seededRng(seed);
        let low = generateKeyBetween(null, null, rng);
        let high = generateKeyBetween(low, null, rng);
        for (let i = 0; i < 200; i += 1) {
          const mid = generateKeyBetween(low, high, rng);
          expect(compareOrderKeys(low, mid)).toBe(-1);
          expect(compareOrderKeys(mid, high)).toBe(-1);
          // Alternate which side closes in, so both midpoint paths are walked.
          if (i % 2 === 0) {
            low = mid;
          } else {
            high = mid;
          }
        }
      }),
      { numRuns: 20 },
    );
  });

  it("survives long append and prepend runs", () => {
    const rng = seededRng(11);
    let appended = generateKeyBetween(null, null, rng);
    for (let i = 0; i < 500; i += 1) {
      const next = generateKeyBetween(appended, null, rng);
      expect(compareOrderKeys(appended, next)).toBe(-1);
      appended = next;
    }
    let prepended = generateKeyBetween(null, null, rng);
    for (let i = 0; i < 500; i += 1) {
      const previous = generateKeyBetween(null, prepended, rng);
      expect(compareOrderKeys(previous, prepended)).toBe(-1);
      prepended = previous;
    }
  });
});

describe("P1 — batch generation matches single generation's guarantees", () => {
  it("returns count ascending keys strictly inside the bounds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer(), (count, seed) => {
        const rng = seededRng(seed);
        const a = generateKeyBetween(null, null, rng);
        const b = generateKeyBetween(a, null, rng);
        const keys = generateNKeysBetween(a, b, count, rng);
        expect(keys).toHaveLength(count);
        expect([...keys].sort(compareOrderKeys)).toEqual(keys);
        expect(new Set(keys).size).toBe(count);
        for (const key of keys) {
          expect(compareOrderKeys(a, key)).toBe(-1);
          expect(compareOrderKeys(key, b)).toBe(-1);
        }
      }),
    );
  });
});

describe("P1 — compareOrdered is a total order", () => {
  const entity = fc.record({
    id: fc.string({ minLength: 1, maxLength: 6 }),
    order: fc.constantFrom("a0", "a1", "a1V", "a2", "Zz", "b00V"),
  });

  it("is antisymmetric, and zero only for equal (order, id)", () => {
    fc.assert(
      fc.property(entity, entity, (x, y) => {
        const forward = compareOrdered(x, y);
        const backward = compareOrdered(y, x);
        expect(Math.sign(forward)).toBe(-Math.sign(backward));
        expect(forward === 0).toBe(x.order === y.order && x.id === y.id);
      }),
    );
  });

  it("is transitive", () => {
    fc.assert(
      fc.property(entity, entity, entity, (x, y, z) => {
        if (compareOrdered(x, y) <= 0 && compareOrdered(y, z) <= 0) {
          expect(compareOrdered(x, z)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });

  it("sorts identically regardless of input order — no reliance on sort stability", () => {
    fc.assert(
      fc.property(fc.array(entity, { minLength: 2, maxLength: 25 }), (entities) => {
        const unique = [...new Map(entities.map((e) => [`${e.order}/${e.id}`, e])).values()];
        const forward = [...unique].sort(compareOrdered);
        const reversed = [...unique].reverse().sort(compareOrdered);
        expect(reversed).toEqual(forward);
      }),
    );
  });
});

describe("P2 — jitter is reproducible under a seeded Rng, and only then", () => {
  it("produces identical keys for identical seeds (replay determinism)", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 25 }), (seed, count) => {
        const run = () => {
          const rng = seededRng(seed);
          const keys: string[] = [];
          let previous: string | null = null;
          for (let i = 0; i < count; i += 1) {
            previous = generateKeyBetween(previous, null, rng);
            keys.push(previous);
          }
          return keys;
        };
        expect(run()).toEqual(run());
      }),
    );
  });

  it("diverges across seeds, so concurrent inserts rarely collide", () => {
    // Not "never": Ordering-Strategy.md accepts a small collision probability,
    // and the jitter guard deliberately yields an unjittered key when a suffix
    // would overshoot the upper bound. The claim under test is that independent
    // clients usually disagree, with the id tie-break covering the rest.
    const distinct = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      distinct.add(generateKeyBetween("a1", null, seededRng(seed)));
    }
    expect(distinct.size).toBeGreaterThan(150);
  });

  it("draws jitter only from the injected source — no ambient randomness", () => {
    // A generator that never advances must yield byte-identical keys. If any
    // Math.random() crept into the path, this would flake.
    const frozen = () => ({ next: () => 0.5 });
    const first = generateKeyBetween("a1", null, frozen());
    const second = generateKeyBetween("a1", null, frozen());
    expect(first).toBe(second);
  });
});
