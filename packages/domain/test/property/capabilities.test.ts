import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { seededRng, sequentialIdGenerator } from "../../src/testing/index";

/**
 * Foundations for Testing-Strategy.md §5 row P2 — ordering jitter is
 * reproducible under a seeded `Rng` (Ordering-Strategy.md; ADR-0005 §3). P2
 * itself lands with the ordering utility (T-002); these properties cover the
 * capability it will depend on.
 */
describe("seededRng (property)", () => {
  it("yields an identical sequence for any seed", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 32 }), (seed, draws) => {
        const a = seededRng(seed);
        const b = seededRng(seed);
        for (let i = 0; i < draws; i += 1) {
          expect(a.next()).toBe(b.next());
        }
      }),
    );
  });

  it("stays within [0, 1)", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 64 }), (seed, draws) => {
        const rng = seededRng(seed);
        for (let i = 0; i < draws; i += 1) {
          const n = rng.next();
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(1);
        }
      }),
    );
  });
});

describe("sequentialIdGenerator (property)", () => {
  it("never repeats an id within one generator", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (count) => {
        const ids = sequentialIdGenerator();
        const seen = new Set<string>();
        for (let i = 0; i < count; i += 1) {
          seen.add(ids.next());
        }
        expect(seen.size).toBe(count);
      }),
    );
  });
});
