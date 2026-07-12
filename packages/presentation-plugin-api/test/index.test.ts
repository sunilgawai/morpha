import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("presentation-plugin-api (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("presentation-plugin-api");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual([
      "presentation-domain",
      "presentation-commands",
      "presentation-widget-api",
      "presentation-rendering",
      "presentation-interaction",
    ]);
  });
});
