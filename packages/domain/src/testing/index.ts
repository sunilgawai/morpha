/**
 * `@morpha/domain/testing` — deterministic capability implementations and pure
 * document fixtures for the contracts this package owns (ADR-0012).
 *
 * Two rules govern this surface (Package-Structure.md §6):
 *
 * 1. It adds no edge to the package graph. A consumer may import it only along
 *    an import edge already legal for its package, which every Ring 1+
 *    package's existing `domain` dependency provides.
 * 2. Only test code imports it — `src/` never does, enforced by the
 *    dependency-cruiser rule `no-testing-subpath-from-src`.
 *
 * Rings 0-1 use this rather than `@morpha/testing`, which they cannot import:
 * they sit inside its dependency closure, and both `tsc --build` and Turbo
 * reject the cycle (ADR-0012).
 */

export type { RecordingTextMeasurer, TestClock } from "./capabilities.js";
export {
  fixedClock,
  recordingTextMeasurer,
  seededRng,
  sequentialIdGenerator,
} from "./capabilities.js";
export {
  CANONICAL_DOCUMENT,
  fixtureDocument,
  fixturePage,
  fixtureSerializedDocument,
  fixtureSerializedPage,
  fixtureWidget,
} from "./fixtures.js";
