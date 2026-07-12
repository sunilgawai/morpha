import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@presentation/renderer-canvas (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@presentation/renderer-canvas");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "@presentation/domain",
      "@presentation/rendering",
      "@presentation/widget-api",
    ]);
  });
});
