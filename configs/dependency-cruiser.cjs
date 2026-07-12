/**
 * Executable encoding of Package-Structure.md §6 (v1.1.0):
 * ring ordering plus the named forbidden-import pairs. CI-gated — these are
 * laws, not conventions. Rings per Package-Structure.md §2/§3.
 */

const RING = {
  0: ["domain"],
  1: ["events", "state", "commands", "runtime"],
  2: [
    "widget-api",
    "rendering",
    "interaction",
    "plugin-api",
    "serialization",
    "widgets-base",
    "renderer-dom",
    "renderer-canvas",
    "renderer-ssr",
    "export-pptx",
    "import-pptx",
  ],
  3: ["react", "devtools", "testing"],
};

/** Match a source file belonging to one of these packages. */
const from = (names) => `^packages/(${names.join("|")})/`;
/**
 * Match a resolved dependency target in one of these packages. pnpm resolves
 * workspace imports through node_modules symlinks, so a cross-package import
 * may surface as either `packages/<name>/…` or `node_modules/@presentation/<name>/…` —
 * match both, or the rules silently never fire.
 */
const to = (names) => `^(packages|node_modules/@presentation)/(${names.join("|")})/`;
const ALL = Object.values(RING).flat();

/** Named forbidden pairs beyond the ring rule — Package-Structure.md §6. */
const FORBIDDEN_PAIRS = [
  ["rendering", ["commands"]],
  ["interaction", ["commands"]], // types-only exception handled at review time
  ["widget-api", ["commands", "rendering"]],
  ["export-pptx", ["rendering", "commands"]],
  ["import-pptx", ["rendering"]],
  ["serialization", ["commands", "rendering"]],
];

module.exports = {
  forbidden: [
    {
      name: "no-unresolvable",
      severity: "error",
      comment:
        "An import that cannot be resolved is either a typo or an undeclared " +
        "cross-package import pnpm's strict isolation refused to link — both are bugs.",
      from: { path: "^packages/" },
      to: { couldNotResolve: true },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Intra-ring graphs must stay acyclic (Package-Structure.md §2, corrected 1.1.0)",
      from: {},
      to: { circular: true },
    },
    {
      name: "ring0-imports-nothing",
      severity: "error",
      comment: "presentation-domain is the innermost ring (Package-Structure.md §3)",
      from: { path: from(RING[0]) },
      to: { path: to(ALL), pathNot: to(RING[0]) },
    },
    {
      name: "ring1-only-inward",
      severity: "error",
      from: { path: from(RING[1]) },
      to: { path: to(ALL), pathNot: to([...RING[0], ...RING[1]]) },
    },
    {
      name: "ring2-only-inward",
      severity: "error",
      from: { path: from(RING[2]) },
      to: { path: to(ALL), pathNot: to([...RING[0], ...RING[1], ...RING[2]]) },
    },
    ...FORBIDDEN_PAIRS.map(([source, targets]) => ({
      name: `forbidden-pair-${source}`,
      severity: "error",
      comment: "Named forbidden import pair — Package-Structure.md §6",
      from: { path: from([source]) },
      to: { path: to(targets) },
    })),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Workspace packages point their exports at ./src/index.ts during the
    // private phase; teach enhanced-resolve to follow that, or cross-package
    // imports stay unresolved and every rule silently never fires.
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "default"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs"],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    exclude: { path: "\\.(test|bench)\\.ts$|/dist/" },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
