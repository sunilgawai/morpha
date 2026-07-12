import { bench, describe } from "vitest";

// Placeholder keeping the bench pipeline runnable. Real suites (Store
// transaction throughput, RenderStateDiff derivation, ordering-key
// generation) arrive with their implementations.
describe("bench harness", () => {
  bench("noop", () => {});
});
