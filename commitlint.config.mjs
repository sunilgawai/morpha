/**
 * Conventional Commits, enforced on every commit message (lefthook) and PR
 * title (CI). Scopes are package short-names plus repo-level scopes.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  // The changesets action authors this subject; it is not, and cannot be, a
  // Conventional Commit. CI disables hooks outright (release.yml), this covers
  // the same commit made locally by `pnpm version-packages`.
  ignores: [(message) => message.startsWith("Version Packages")],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "domain",
        "events",
        "state",
        "commands",
        "runtime",
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
        "react",
        "devtools",
        "testing",
        "docs",
        "repo",
        "ci",
        "apps",
        "examples",
        "deps",
        "release",
      ],
    ],
  },
};
