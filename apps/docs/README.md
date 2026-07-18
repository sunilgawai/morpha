# apps/docs

**The public documentation website.** Astro + Starlight, chosen and justified
in [ADR-0011](../../docs/architecture/adr/ADR-0011-development-applications-workspace.md).

## Why Astro + Starlight

- **Content-first, ~zero JS by default** — the primary payload is the markdown
  handbook; Starlight ships almost no client JS.
- **First-class MDX** — `docs/architecture/*.md` drops in with minimal
  reshaping; the repository handbook stays the source of truth.
- **Framework-agnostic islands** — a future embedded Playground mounts as a
  React island without committing the whole site to a framework, mirroring the
  engine's own framework-agnostic core.
- **TypeScript-native**, monorepo-friendly, and integrates TypeDoc for the SDK
  reference.

Rejected: VitePress (Vue-coupled), Nextra (ties docs to Next.js), Docusaurus
(heavier React runtime than a content-first handbook needs).

## Run it

```bash
pnpm dev:docs           # from the repo root
```

Opens on <http://localhost:4175>.

## Structure

Content lives under `src/content/docs/`, one directory per sidebar section
(configured in `astro.config.mjs`): getting-started, architecture, guide, sdk,
widgets, plugins, examples, tutorials, migrations, project. Pages are
placeholders (ADR-0011) that fill in as the engine is built.

The repository handbook at `docs/architecture/` remains canonical; this site
renders and links to it and must never diverge from it.
