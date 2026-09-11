/**
 * Fractional-index ordering — Ordering-Strategy.md.
 *
 * Every ordered collection in the domain model carries `order: string`, a
 * base-62 fractional index sorted lexicographically. Inserting or moving is a
 * single property write on one entity: no sequence counter, no sibling
 * rewrite. That is what makes reordering conflict-free when collaboration
 * arrives (Design Principle 13).
 *
 * **Algorithm provenance.** Ordering-Strategy.md ("Reference Implementation
 * Note") directs us *not* to write this from scratch: the edge cases
 * (equal-prefix keys, null boundaries, trim-shortest midpoint, integer-part
 * carry) have known-correct solutions. The integer/fraction scheme below is
 * adapted from the widely used `fractional-indexing` implementation (MIT,
 * Rocicorp), itself derived from Figma's published approach. It is vendored
 * rather than depended upon because `presentation-domain` has zero runtime
 * dependencies by contract (Package-Structure.md §3, Ring 0).
 *
 * **Jitter.** Per Ordering-Strategy.md's collision handling and ADR-0005 §3,
 * a short suffix drawn from the injected `Rng` is appended so two clients
 * inserting into the same gap produce different keys. Never `Math.random()`:
 * a replay context injects a seeded source and gets identical keys back
 * (Command-System.md §17).
 */

import type { Rng } from "./capabilities.js";

/** Base-62, in ascending character-code order — the sort depends on that. */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ZERO = "0";
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

/**
 * Jitter length. 61 usable characters (`ZERO` is excluded so a key never ends
 * in a trailing zero, which the integer/fraction scheme forbids) over 3
 * positions is 61³ = 226,981 distinct suffixes — the "~1 in tens of thousands"
 * collision probability Ordering-Strategy.md accepts, in exchange for three
 * characters of key length.
 */
const JITTER_LENGTH = 3;

function digitAt(index: number): string {
  return DIGITS.charAt(index);
}

function digitIndex(char: string, key: string): number {
  const index = DIGITS.indexOf(char);
  if (index === -1) {
    throw new TypeError(
      `invalid order key ${JSON.stringify(key)}: ${JSON.stringify(char)} is not a base-62 digit`,
    );
  }
  return index;
}

/**
 * Length of a key's integer part, encoded in its head character: `a`-`z` count
 * upward from 2, `A`-`Z` count downward from `Z`. This is what lets the key
 * space extend indefinitely in both directions without a length prefix.
 */
function integerLength(head: string, key: string): number {
  if (head >= "a" && head <= "z") {
    return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  }
  if (head >= "A" && head <= "Z") {
    return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  }
  throw new TypeError(
    `invalid order key ${JSON.stringify(key)}: bad head character ${JSON.stringify(head)}`,
  );
}

function integerPart(key: string): string {
  const length = integerLength(key.charAt(0), key);
  if (length > key.length) {
    throw new TypeError(`invalid order key ${JSON.stringify(key)}: integer part is truncated`);
  }
  return key.slice(0, length);
}

function assertValidKey(key: string): void {
  if (key === "") {
    throw new TypeError("invalid order key: empty string");
  }
  if (key === SMALLEST_INTEGER) {
    throw new TypeError(`invalid order key ${JSON.stringify(key)}: smallest integer is reserved`);
  }
  const integer = integerPart(key);
  for (const char of integer.slice(1)) {
    digitIndex(char, key);
  }
  const fraction = key.slice(integer.length);
  for (const char of fraction) {
    digitIndex(char, key);
  }
  if (fraction.endsWith(ZERO)) {
    throw new TypeError(
      `invalid order key ${JSON.stringify(key)}: fraction must not end in a zero digit`,
    );
  }
}

function incrementInteger(value: string): string | null {
  const head = value.charAt(0);
  const digits = value.slice(1).split("");
  let carry = true;
  for (let i = digits.length - 1; carry && i >= 0; i -= 1) {
    const next = digitIndex(digits[i] ?? "", value) + 1;
    if (next === DIGITS.length) {
      digits[i] = ZERO;
    } else {
      digits[i] = digitAt(next);
      carry = false;
    }
  }
  if (!carry) {
    return head + digits.join("");
  }
  if (head === "Z") {
    return `a${ZERO}`;
  }
  if (head === "z") {
    return null;
  }
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > "a") {
    digits.push(ZERO);
  } else {
    digits.pop();
  }
  return nextHead + digits.join("");
}

function decrementInteger(value: string): string | null {
  const head = value.charAt(0);
  const digits = value.slice(1).split("");
  let borrow = true;
  for (let i = digits.length - 1; borrow && i >= 0; i -= 1) {
    const next = digitIndex(digits[i] ?? "", value) - 1;
    if (next === -1) {
      digits[i] = digitAt(DIGITS.length - 1);
    } else {
      digits[i] = digitAt(next);
      borrow = false;
    }
  }
  if (!borrow) {
    return head + digits.join("");
  }
  if (head === "a") {
    return `Z${digitAt(DIGITS.length - 1)}`;
  }
  if (head === "A") {
    return null;
  }
  const nextHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (nextHead < "Z") {
    digits.push(digitAt(DIGITS.length - 1));
  } else {
    digits.pop();
  }
  return nextHead + digits.join("");
}

/**
 * Shortest fraction strictly between `a` and `b`, where `""` means "no lower
 * bound" and `null` means "no upper bound". Trimming to the shortest correct
 * string is what keeps repeated insertion in one gap from growing keys
 * linearly (Ordering-Strategy.md: `"a0"`/`"a1"` yields `"a0V"`, not a
 * lengthening decimal).
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new RangeError(`cannot find a midpoint: ${JSON.stringify(a)} >= ${JSON.stringify(b)}`);
  }
  if (a.endsWith(ZERO) || b?.endsWith(ZERO)) {
    throw new TypeError("cannot find a midpoint between fractions ending in a zero digit");
  }
  if (b !== null) {
    // Share the common prefix, padding `a` with zeros as we walk it. `b` needs
    // no padding: it cannot run out before `a` across a common prefix.
    let shared = 0;
    while ((a.charAt(shared) || ZERO) === b.charAt(shared)) {
      shared += 1;
    }
    if (shared > 0) {
      return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
    }
  }
  const lower = a === "" ? 0 : digitIndex(a.charAt(0), a);
  const upper = b !== null ? digitIndex(b.charAt(0), b) : DIGITS.length;
  if (upper - lower > 1) {
    return digitAt(Math.round(0.5 * (lower + upper)));
  }
  // The leading digits are consecutive, so descend into `b`'s tail.
  if (b !== null && b.length > 1) {
    return b.slice(0, 1);
  }
  return digitAt(lower) + midpoint(a.slice(1), null);
}

/**
 * A jitter suffix, drawn from the injected `Rng`. `ZERO` is excluded from
 * every position so the result can never end in a zero digit, which would
 * make the key invalid for any later insertion beside it.
 */
function jitter(rng: Rng): string {
  let suffix = "";
  for (let i = 0; i < JITTER_LENGTH; i += 1) {
    const index = 1 + Math.floor(rng.next() * (DIGITS.length - 1));
    suffix += digitAt(Math.min(index, DIGITS.length - 1));
  }
  return suffix;
}

/**
 * Append jitter, but only while the result still sorts below `upperBound`.
 *
 * The guard is load-bearing. When the generated key is a proper prefix of the
 * upper bound — `"a1"` against `"a1V"` — appending any suffix can overshoot it,
 * which would break the one invariant this module exists to provide. In that
 * case the unjittered key is returned: correct ordering is not negotiable,
 * collision resistance is a probability.
 */
function withJitter(key: string, upperBound: string | null, rng: Rng): string {
  const candidate = key + jitter(rng);
  if (upperBound !== null && candidate >= upperBound) {
    return key;
  }
  return candidate;
}

/** The unjittered key strictly between `a` and `b`. */
function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) {
    assertValidKey(a);
  }
  if (b !== null) {
    assertValidKey(b);
  }
  if (a !== null && b !== null && a >= b) {
    throw new RangeError(
      `cannot order between ${JSON.stringify(a)} and ${JSON.stringify(b)}: a >= b`,
    );
  }

  if (a === null) {
    if (b === null) {
      return `a${ZERO}`;
    }
    const integer = integerPart(b);
    const fraction = b.slice(integer.length);
    if (integer === SMALLEST_INTEGER) {
      return integer + midpoint("", fraction);
    }
    if (integer < b) {
      return integer;
    }
    const decremented = decrementInteger(integer);
    if (decremented === null) {
      throw new RangeError("order key space exhausted below the smallest integer");
    }
    return decremented;
  }

  if (b === null) {
    const integer = integerPart(a);
    const fraction = a.slice(integer.length);
    const incremented = incrementInteger(integer);
    return incremented === null ? integer + midpoint(fraction, null) : incremented;
  }

  const integerA = integerPart(a);
  const fractionA = a.slice(integerA.length);
  const integerB = integerPart(b);
  const fractionB = b.slice(integerB.length);
  if (integerA === integerB) {
    return integerA + midpoint(fractionA, fractionB);
  }
  const incremented = incrementInteger(integerA);
  if (incremented === null) {
    throw new RangeError("order key space exhausted above the largest integer");
  }
  if (incremented < b) {
    return incremented;
  }
  return integerA + midpoint(fractionA, null);
}

/**
 * A key that sorts strictly between `a` and `b`.
 *
 * `null` for `a` means "insert at the start", `null` for `b` means "insert at
 * the end"; both null produces the first key of an empty collection
 * (Ordering-Strategy.md). The `rng` is the engine's injected source — jitter
 * is not optional, and it is never ambient.
 *
 * @throws RangeError if `a >= b`, or if the key space is exhausted at an end.
 * @throws TypeError if either bound is not a valid order key.
 */
export function generateKeyBetween(a: string | null, b: string | null, rng: Rng): string {
  return withJitter(keyBetween(a, b), b, rng);
}

/**
 * `count` keys in ascending order, all strictly between `a` and `b`.
 *
 * Batch generation exists so that inserting twenty widgets at once (an AI
 * pipeline, a paste, an import) is one call rather than twenty sequential
 * midpoint computations (Ordering-Strategy.md).
 *
 * Each key is jittered against the *next unjittered* key as its upper bound,
 * which keeps the batch strictly ascending: every jittered key stays below its
 * unjittered successor, and that successor only ever moves upward.
 *
 * @throws RangeError if `count` is negative or not an integer.
 */
export function generateNKeysBetween(
  a: string | null,
  b: string | null,
  count: number,
  rng: Rng,
): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`count must be a non-negative integer, received ${count}`);
  }
  if (count === 0) {
    return [];
  }
  const plain = plainKeysBetween(a, b, count);
  return plain.map((key, index) => withJitter(key, plain[index + 1] ?? b, rng));
}

/** Unjittered evenly spaced keys, split recursively around the midpoint. */
function plainKeysBetween(a: string | null, b: string | null, count: number): string[] {
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [keyBetween(a, b)];
  }
  if (b === null) {
    let current = keyBetween(a, null);
    const keys = [current];
    for (let i = 1; i < count; i += 1) {
      current = keyBetween(current, null);
      keys.push(current);
    }
    return keys;
  }
  if (a === null) {
    let current = keyBetween(null, b);
    const keys = [current];
    for (let i = 1; i < count; i += 1) {
      current = keyBetween(null, current);
      keys.push(current);
    }
    return keys.reverse();
  }
  const half = Math.floor(count / 2);
  const middle = keyBetween(a, b);
  return [
    ...plainKeysBetween(a, middle, half),
    middle,
    ...plainKeysBetween(middle, b, count - half - 1),
  ];
}

/** Lexicographic comparison of two order keys, for use as a sort comparator. */
export function compareOrderKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/** The minimum an entity must expose to take part in an ordered collection. */
export interface Ordered {
  id: string;
  order: string;
}

/**
 * Total order over an ordered collection: by `order`, then by `id`.
 *
 * The `id` tie-break is not defensive padding — Ordering-Strategy.md requires
 * it. Two clients can independently produce the same key for the same gap, and
 * `id` is already globally unique, so it makes the resulting sort deterministic
 * everywhere instead of dependent on the sort implementation's stability.
 */
export function compareOrdered(a: Ordered, b: Ordered): number {
  const byOrder = compareOrderKeys(a.order, b.order);
  return byOrder !== 0 ? byOrder : compareOrderKeys(a.id, b.id);
}
