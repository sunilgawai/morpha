import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("@morpha/import-pptx (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@morpha/import-pptx");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "@morpha/domain",
      "@morpha/commands",
      "@morpha/plugin-api",
    ]);
  });
});
