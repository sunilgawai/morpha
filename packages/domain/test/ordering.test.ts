import { describe, expect, it } from "vitest";
import {
  compareOrdered,
  compareOrderKeys,
  generateKeyBetween,
  generateNKeysBetween,
} from "../src/index";
import { seededRng } from "../src/testing/index";

const rng = () => seededRng(1);

describe("generateKeyBetween — boundaries", () => {
  it("produces the first key of an empty collection", () => {
    expect(generateKeyBetween(null, null, rng())).toMatch(/^a0/);
  });

  it("appends after a key", () => {
    const first = generateKeyBetween(null, null, rng());
    const second = generateKeyBetween(first, null, rng());
    expect(compareOrderKeys(first, second)).toBe(-1);
  });

  it("prepends before a key", () => {
    const first = generateKeyBetween(null, null, rng());
    const before = generateKeyBetween(null, first, rng());
    expect(compareOrderKeys(before, first)).toBe(-1);
  });

  it("inserts strictly between two keys", () => {
    const a = generateKeyBetween(null, null, rng());
    const c = generateKeyBetween(a, null, rng());
    const b = generateKeyBetween(a, c, rng());
    expect(compareOrderKeys(a, b)).toBe(-1);
    expect(compareOrderKeys(b, c)).toBe(-1);
  });
});

describe("generateKeyBetween — rejections", () => {
  it("rejects reversed bounds", () => {
    expect(() => generateKeyBetween("a2", "a1", rng())).toThrow(RangeError);
  });

  it("rejects equal bounds", () => {
    expect(() => generateKeyBetween("a1", "a1", rng())).toThrow(RangeError);
  });

  it("rejects a malformed key", () => {
    expect(() => generateKeyBetween("", null, rng())).toThrow(TypeError);
    expect(() => generateKeyBetween("!!", null, rng())).toThrow(TypeError);
    expect(() => generateKeyBetween("a", null, rng())).toThrow(TypeError);
  });

  it("rejects a key whose fraction ends in a zero digit", () => {
    expect(() => generateKeyBetween("a1V0", null, rng())).toThrow(TypeError);
  });
});

describe("jitter (Ordering-Strategy.md collision handling; ADR-0005 §3)", () => {
  it("makes two clients inserting into the same gap disagree", () => {
    const fromClientA = generateKeyBetween("a1", null, seededRng(1));
    const fromClientB = generateKeyBetween("a1", null, seededRng(2));
    expect(fromClientA).not.toBe(fromClientB);
  });

  it("is reproducible for a given seed — replay determinism", () => {
    expect(generateKeyBetween("a1", null, seededRng(7))).toBe(
      generateKeyBetween("a1", null, seededRng(7)),
    );
  });

  it("never ends in a zero digit, so the key stays insertable beside", () => {
    let key = generateKeyBetween(null, null, seededRng(99));
    for (let i = 0; i < 50; i += 1) {
      expect(key.endsWith("0")).toBe(false);
      key = generateKeyBetween(key, null, seededRng(i));
    }
  });

  it("drops jitter rather than overshoot a prefix upper bound", () => {
    // "a1" is a proper prefix of "a1V": any suffix could sort past the bound,
    // so correctness wins over collision resistance here.
    const key = generateKeyBetween("a0", "a1V", seededRng(3));
    expect(compareOrderKeys(key, "a1V")).toBe(-1);
  });
});

describe("generateNKeysBetween", () => {
  it("returns nothing for zero", () => {
    expect(generateNKeysBetween(null, null, 0, rng())).toEqual([]);
  });

  it("rejects a negative or fractional count", () => {
    expect(() => generateNKeysBetween(null, null, -1, rng())).toThrow(RangeError);
    expect(() => generateNKeysBetween(null, null, 1.5, rng())).toThrow(RangeError);
  });

  it("returns ascending keys within the bounds", () => {
    const a = generateKeyBetween(null, null, rng());
    const b = generateKeyBetween(a, null, rng());
    const keys = generateNKeysBetween(a, b, 20, rng());
    expect(keys).toHaveLength(20);
    expect([...keys].sort(compareOrderKeys)).toEqual(keys);
    for (const key of keys) {
      expect(compareOrderKeys(a, key)).toBe(-1);
      expect(compareOrderKeys(key, b)).toBe(-1);
    }
  });

  it("works with open bounds in both directions", () => {
    const appended = generateNKeysBetween("a1", null, 5, rng());
    expect([...appended].sort(compareOrderKeys)).toEqual(appended);
    const prepended = generateNKeysBetween(null, "a1", 5, rng());
    expect([...prepended].sort(compareOrderKeys)).toEqual(prepended);
    for (const key of prepended) {
      expect(compareOrderKeys(key, "a1")).toBe(-1);
    }
  });
});

describe("compareOrdered — id tie-break (Ordering-Strategy.md)", () => {
  it("orders by key first", () => {
    expect(compareOrdered({ id: "z", order: "a1" }, { id: "a", order: "a2" })).toBe(-1);
  });

  it("falls back to id when two clients produced the same key", () => {
    expect(compareOrdered({ id: "widget_1", order: "a1" }, { id: "widget_2", order: "a1" })).toBe(
      -1,
    );
    expect(compareOrdered({ id: "widget_2", order: "a1" }, { id: "widget_1", order: "a1" })).toBe(
      1,
    );
  });

  it("is zero only for the same entity", () => {
    expect(compareOrdered({ id: "w", order: "a1" }, { id: "w", order: "a1" })).toBe(0);
  });
});

/**
 * Ordering-Strategy.md's "Reference Implementation Note" requires this module to
 * match the established base-62 algorithm rather than a home-grown variant.
 * These are that implementation's published values, pinned.
 *
 * Order keys are persisted data, so this table is a regression guard with teeth:
 * a future "optimization" that changed generated keys would be a silent change
 * to every document written afterward.
 *
 * `frozenRng` never advances, so jitter is a constant `"VVV"` (index
 * 1 + floor(0.5 × 61) = 31 = "V") and the suffix can be stripped to recover the
 * unjittered key — except where the jitter guard drops it, which is itself
 * asserted below.
 */
describe("matches the reference base-62 algorithm", () => {
  const frozenRng = () => ({ next: () => 0.5 });
  const unjittered = (a: string | null, b: string | null): string => {
    const key = generateKeyBetween(a, b, frozenRng());
    return key.endsWith("VVV") ? key.slice(0, -3) : key;
  };

  const LARGEST_INTEGER = `z${"z".repeat(26)}`;
  const RESERVED_FLOOR = `A${"0".repeat(26)}`;

  it.each([
    [null, null, "a0"],
    ["a0", null, "a1"],
    ["a1", null, "a2"],
    [null, "a0", "Zz"],
    [null, "Zz", "Zy"],
    ["a0", "a1", "a0V"],
    ["a1", "a2", "a1V"],
    ["a0", "a2", "a1"],
    ["a0V", "a1", "a0l"],
    ["Zz", "a0", "ZzV"],
    ["Zz", "a1", "a0"],
    ["Zz", null, "a0"],
    ["a0", "a0V", "a0G"],
    ["a0", "a0G", "a08"],
    ["b125", "b129", "b127"],
    ["bzz", null, "c000"],
  ])("(%s, %s) -> %s", (a, b, expected) => {
    expect(unjittered(a, b)).toBe(expected);
  });

  it("rejects an integer part of the wrong length for its head character", () => {
    // A head of "A" declares a 27-character integer part, so these are not
    // merely unusual keys — they are malformed.
    expect(() => unjittered("Az", null)).toThrow(TypeError);
    expect(() => unjittered("z".repeat(26), null)).toThrow(TypeError);
  });

  it("extends a fraction once the integer part cannot increment", () => {
    expect(unjittered(LARGEST_INTEGER, null)).toBe(`${LARGEST_INTEGER}V`);
    expect(unjittered(`${LARGEST_INTEGER}V`, null)).toBe(`${LARGEST_INTEGER}l`);
  });

  it("has a hard floor that fails loudly instead of producing a broken key", () => {
    // Reaching the floor is astronomically unlikely from a real document (it is
    // ~62^26 prepends below "a0"), but the behavior is pinned: the floor key can
    // be generated once, and inserting below it throws rather than silently
    // returning something that sorts wrong.
    expect(unjittered(null, `A${"0".repeat(25)}1`)).toBe(RESERVED_FLOOR);
    expect(() => unjittered(null, RESERVED_FLOOR)).toThrow(TypeError);
  });
});
