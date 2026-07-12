import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "tests/integration/**/*.test.ts"],
    benchmark: { include: ["tests/benchmarks/**/*.bench.ts"] },
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      reporter: ["text", "lcov"],
    },
  },
});
