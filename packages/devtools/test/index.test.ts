import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@presentation/devtools (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@presentation/devtools");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "@presentation/runtime",
      "@presentation/events",
      "@presentation/commands",
      "@presentation/plugin-api",
    ]);
  });
});
