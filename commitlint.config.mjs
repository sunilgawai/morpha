/**
 * Conventional Commits, enforced on every commit message (lefthook) and PR
 * title (CI). Scopes are package short-names plus repo-level scopes.
 */
export default {
  extends: ["@commitlint/config-conventional"],
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
