import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// ADR-0011: the docs site is content-first (Astro ships ~zero JS by default);
// a future embedded Playground mounts as a React island without committing the
// whole site to a framework, mirroring the engine's framework-agnostic core.
export default defineConfig({
  integrations: [
    starlight({
      title: "morpha",
      description:
        "The Presentation Domain Engine — a framework-agnostic core for visual documents.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/sunilgawai/morpha" }],
      sidebar: [
        { label: "Getting Started", autogenerate: { directory: "getting-started" } },
        { label: "Architecture Handbook", autogenerate: { directory: "architecture" } },
        { label: "Developer Guide", autogenerate: { directory: "guide" } },
        { label: "SDK Reference", autogenerate: { directory: "sdk" } },
        { label: "Widget Guide", autogenerate: { directory: "widgets" } },
        { label: "Plugin Guide", autogenerate: { directory: "plugins" } },
        { label: "Examples", autogenerate: { directory: "examples" } },
        { label: "Tutorials", autogenerate: { directory: "tutorials" } },
        { label: "Migration Guides", autogenerate: { directory: "migrations" } },
        { label: "Project", autogenerate: { directory: "project" } },
      ],
    }),
  ],
});
