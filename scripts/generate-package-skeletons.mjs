/**
 * One-time scaffolder for the placeholder packages, driven by the
 * Package-Structure.md 1.1.0 catalogue. Kept in the repo as the executable
 * record of the initial topology. Safe to re-run: it refuses to overwrite
 * an existing package directory.
 *
 * Usage: node scripts/generate-package-skeletons.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** @type {Record<string, {ring: 0|1|2|3, deps: string[], preset: "base"|"node"|"dom"|"react", doc: string, blurb: string}>} */
const CATALOGUE = {
  "@presentation/domain": {
    ring: 0,
    deps: [],
    preset: "base",
    doc: "domain/Domain-Model.md",
    blurb:
      "The Presentation Domain Model: `PresentationDocument`, `Page`, `WidgetInstance`, `Transform`, `Theme`, `Asset`, validation primitives, versioning/migration contracts, and the fractional-index ordering utility (Ordering-Strategy.md). Zero runtime dependencies — pure data types and pure functions only.",
  },
  "@presentation/events": {
    ring: 1,
    deps: ["@presentation/domain"],
    preset: "base",
    doc: "runtime/Event-System.md",
    blurb:
      "The semantic Event System: `Emitter`/`Event`/`Disposable`, the event taxonomy, `EventOrigin`, `EventEnvelope`. Notification transport only — never part of the mutation path (ADR-0002).",
  },
  "@presentation/state": {
    ring: 1,
    deps: ["@presentation/domain", "@presentation/events"],
    preset: "base",
    doc: "state/State-Management.md",
    blurb:
      "The Store: transaction application, structural sharing, the `DocumentQuery` read model, ChangeSet-derived `RenderStateDiff`/`IncrementalSaveOp`, dispatch-queue reentrancy rules.",
  },
  "@presentation/commands": {
    ring: 1,
    deps: ["@presentation/domain", "@presentation/events", "@presentation/state"],
    preset: "base",
    doc: "runtime/Command-System.md",
    blurb:
      "The mutation architecture: the `Command` contract, Command Dispatcher, Transaction Manager integration, History Manager, Command Factory Registry with payload migration. Commands are the only legal mutation mechanism (ADR-0007).",
  },
  "@presentation/runtime": {
    ring: 1,
    deps: [
      "@presentation/domain",
      "@presentation/events",
      "@presentation/state",
      "@presentation/commands",
    ],
    preset: "base",
    doc: "runtime/Engine-Lifecycle.md",
    blurb:
      "The Engine itself: `Engine`, `DocumentSession`, lifecycle phases, the Scheduler, service composition root, and injected capabilities (IDs, RNG, clock, `TextMeasurer` per ADR-0006). Interacts with Ring 2 only through registry interfaces.",
  },
  "@presentation/widget-api": {
    ring: 2,
    deps: ["@presentation/domain"],
    preset: "base",
    doc: "widgets/Widget-System.md",
    blurb:
      "The widget authoring contract: `defineWidget()`, `WidgetDefinition<T>` (including `hitTest`), the Widget Registry, and `RenderNode` (homed here per Package-Structure.md 1.1.0). Widgets never construct or dispatch Commands.",
  },
  "@presentation/rendering": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/state", "@presentation/widget-api"],
    preset: "base",
    doc: "rendering/Rendering-Architecture.md",
    blurb:
      "The renderer-agnostic projection core: the canonical `RendererAdapter` contract (ADR-0004), `RenderState`/`RenderContext`, reconciliation utilities, virtualization support. Renderer families live in their own downstream packages.",
  },
  "@presentation/interaction": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/events", "@presentation/rendering"],
    preset: "base",
    doc: "interaction/Selection-and-Interaction.md",
    blurb:
      "Tools as hierarchical state machines, selection/focus/hover models, hit-testing, `InteractionIntent`, and the Intent Interpreter Registry — the system's only intent-to-Command translation point (ADR-0002).",
  },
  "@presentation/plugin-api": {
    ring: 2,
    deps: [
      "@presentation/domain",
      "@presentation/commands",
      "@presentation/widget-api",
      "@presentation/rendering",
      "@presentation/interaction",
    ],
    preset: "base",
    doc: "plugins/Plugin-System.md",
    blurb:
      "The general extensibility surface: `PluginManifest`, `PluginContext`, activation events, permissions, and every Extension Point registry interface. Sandboxed tier is scoped to data-shaped contributions (ADR-0005 §1).",
  },
  "@presentation/serialization": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/state"],
    preset: "base",
    doc: "persistence/Serialization.md",
    blurb:
      "Canonical persistence: `CanonicalDocumentEnvelope`, asset manifest, integrity checking, schema-migration orchestration, snapshots, incremental save (with explicit removal sets).",
  },
  "@presentation/widgets-base": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/widget-api"],
    preset: "base",
    doc: "widgets/Widget-System.md",
    blurb:
      "The first-party reference widgets (`text`, `image`, `rect`, `group`) built via the exact same `WidgetDefinition` contract any third party uses — the living compliance test for Design Principle 6 (Widget-System.md §5).",
  },
  "@presentation/renderer-dom": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/rendering", "@presentation/widget-api"],
    preset: "dom",
    doc: "rendering/Rendering-Architecture.md",
    blurb:
      "The DOM renderer family — the interactive-editing `RendererAdapter` implementation. Browser only.",
  },
  "@presentation/renderer-canvas": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/rendering", "@presentation/widget-api"],
    preset: "dom",
    doc: "rendering/Rendering-Architecture.md",
    blurb:
      "The Canvas renderer family — presentation-mode/performance rendering, including the parallel accessibility tree obligation (Rendering-Architecture.md §15). Browser only.",
  },
  "@presentation/renderer-ssr": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/rendering", "@presentation/widget-api"],
    preset: "node",
    doc: "rendering/Rendering-Architecture.md",
    blurb:
      "The headless server-side renderer family — thumbnails and static previews in Node, architecturally an ordinary `RendererAdapter` (Rendering-Architecture.md §17).",
  },
  "@presentation/export-pptx": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/serialization", "@presentation/plugin-api"],
    preset: "node",
    doc: "persistence/Serialization.md",
    blurb:
      "PPTX exporter — translates a `PresentationDocument` into OOXML bytes. Never renders UI, never mutates the document (Serialization.md §17). Node primary.",
  },
  "@presentation/import-pptx": {
    ring: 2,
    deps: ["@presentation/domain", "@presentation/commands", "@presentation/plugin-api"],
    preset: "node",
    doc: "persistence/Serialization.md",
    blurb:
      "PPTX importer — parses OOXML into a `PresentationDocument` value or Import Commands (Command-System.md §4). Never knows about rendering. Node primary.",
  },
  "@presentation/react": {
    ring: 3,
    deps: ["@presentation/runtime", "@presentation/rendering", "@presentation/interaction"],
    preset: "react",
    doc: "packages/Package-Structure.md",
    blurb:
      "React bindings: hooks (`useEngine`, `useSelection`, `useWidget`), a `RenderNode`-to-React reconciler, `<PresentationCanvas>`. Session-scoped per ADR-0004. `react`/`react-dom` become peer dependencies when implementation begins.",
  },
  "@presentation/devtools": {
    ring: 3,
    deps: [
      "@presentation/runtime",
      "@presentation/events",
      "@presentation/commands",
      "@presentation/plugin-api",
    ],
    preset: "base",
    doc: "packages/Package-Structure.md",
    blurb:
      "The inspector built on the read-only observability contracts (`EventObserver`, `CommandObserver`, plugin logging). Observes, never dispatches.",
  },
  "@presentation/testing": {
    ring: 3,
    deps: ["@presentation/domain", "@presentation/runtime", "@presentation/commands"],
    preset: "base",
    doc: "packages/Package-Structure.md",
    blurb:
      "Shared test utilities: `createTestEngine()` (deterministic clock/ID/RNG/text-measurer injection), `fixtureDocument()`, `mockRenderer()`, assertion helpers. devDependency-only for every consumer.",
  },
};

const camel = (name) =>
  `dep${name.replace("@presentation/", "").replace(/(?:^|-)(\w)/g, (_, c) => c.toUpperCase())}`;

const root = new URL("..", import.meta.url).pathname;

for (const [name, meta] of Object.entries(CATALOGUE)) {
  const dir = join(root, "packages", name.replace("@presentation/", ""));
  if (existsSync(dir)) {
    console.log(`skip (exists): ${name}`);
    continue;
  }
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "test"), { recursive: true });

  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    description: `Presentation Engine — ${name.replace("@presentation/", "")} (Ring ${meta.ring}). Placeholder; see docs/architecture/${meta.doc}.`,
    license: "MIT",
    type: "module",
    sideEffects: false,
    exports: { ".": { types: "./src/index.ts", default: "./src/index.ts" } },
    publishConfig: {
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
          require: "./dist/index.cjs",
        },
      },
      main: "./dist/index.cjs",
      module: "./dist/index.js",
      types: "./dist/index.d.ts",
    },
    files: ["dist"],
    scripts: {
      build: "tsdown",
      clean: "rm -rf dist *.tsbuildinfo",
    },
    ...(meta.deps.length > 0 && {
      dependencies: Object.fromEntries(meta.deps.map((d) => [d, "workspace:*"])),
    }),
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  const tsconfig = {
    extends: `../../configs/typescript/tsconfig.${meta.preset}.json`,
    compilerOptions: { outDir: "dist/tsc", rootDir: "." },
    include: ["src", "test"],
    ...(meta.deps.length > 0 && {
      references: meta.deps.map((d) => ({ path: `../${d}` })),
    }),
  };
  writeFileSync(join(dir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);

  writeFileSync(
    join(dir, "tsdown.config.ts"),
    `import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
`,
  );

  const imports = meta.deps
    .map((d) => `import { PACKAGE_NAME as ${camel(d)} } from "${d}";`)
    .join("\n");
  const depList = meta.deps.map((d) => camel(d)).join(", ");
  writeFileSync(
    join(dir, "src/index.ts"),
    `/**
 * ${name} — placeholder package. No engine implementation yet.
 *
 * Owning architecture document: docs/architecture/${meta.doc}
 * Package contract: docs/architecture/packages/Package-Structure.md (Ring ${meta.ring})
 */
${imports ? `${imports}\n` : ""}
export const PACKAGE_NAME: "${name}" = "${name}";

/** The dependency edges declared by Package-Structure.md 1.1.0, made real so
 * that dependency-cruiser and knip validate the actual graph from day one. */
export const DECLARED_DEPENDENCIES: readonly string[] = [${depList}];
`,
  );

  writeFileSync(
    join(dir, "test/index.test.ts"),
    `import { describe, expect, it } from "vitest";
import { DECLARED_DEPENDENCIES, PACKAGE_NAME } from "../src/index";

describe("${name} (placeholder)", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("${name}");
  });

  it("declares its Package-Structure.md dependency edges", () => {
    expect(DECLARED_DEPENDENCIES).toEqual(${JSON.stringify(meta.deps)});
  });
});
`,
  );

  writeFileSync(
    join(dir, "README.md"),
    `# ${name}

**Ring ${meta.ring}** · **Status: placeholder — no implementation yet**

${meta.blurb}

- Owning architecture document: [docs/architecture/${meta.doc}](../../docs/architecture/${meta.doc})
- Package boundaries and import law: [Package-Structure.md](../../docs/architecture/packages/Package-Structure.md)

Do not add code here that contradicts the owning document's boundary tables.
Cross-package imports must satisfy \`pnpm lint:deps\`.
`,
  );

  console.log(`created: ${name}`);
}

console.log("done");
