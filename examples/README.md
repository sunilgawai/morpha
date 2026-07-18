# examples/

**Educational reference applications — a numbered ladder** (`01`…`17`).
Governed by
[ADR-0011](../docs/architecture/adr/ADR-0011-development-applications-workspace.md).

An example is **not** a test and **not** a demo. Each teaches **exactly one
concept**, consumes only `@morpha/*` public exports, and is kept small enough
to read in one sitting. Later examples build on concepts from earlier ones.

| # | Example | Teaches |
| --- | --- | --- |
| 01 | [hello-presentation](01-hello-presentation/) | The domain model is the single source of truth |
| 02 | [basic-rendering](02-basic-rendering/) | Renderers are stateless projections |
| 03 | [viewer](03-viewer/) | The `DocumentQuery` read surface |
| 04 | [basic-editor](04-basic-editor/) | The closed mutation loop (input → intent → Command) |
| 05 | [commands](05-commands/) | Commands are the only mutation mechanism |
| 06 | [widgets](06-widgets/) | Composing built-in widgets via the registry |
| 07 | [custom-widget](07-custom-widget/) | Authoring a widget (no privileged path) |
| 08 | [custom-tool](08-custom-tool/) | Tools + Intent Interpreters |
| 09 | [plugin-development](09-plugin-development/) | The plugin system |
| 10 | [serialization](10-serialization/) | Persistence and migration |
| 11 | [pptx-export](11-pptx-export/) | Exporter adapters (units at the boundary) |
| 12 | [pptx-import](12-pptx-import/) | Importer adapters |
| 13 | [react-integration](13-react-integration/) | Session-scoped React bindings |
| 14 | [nextjs-integration](14-nextjs-integration/) | Framework integration at the edge |
| 15 | [server-side-rendering](15-server-side-rendering/) | The SSR renderer |
| 16 | [ai-integration](16-ai-integration/) | AI as a Command-producing adapter |
| 17 | [whiteboard](17-whiteboard/) | The engine is document-shape-agnostic |

All examples are **structure only** today; each is implemented once the
packages it teaches exist (see each README for what it's blocked on). Examples
16–17 depend on documents/packages that are deliberately deferred (AI.md;
whiteboard tooling) — their scaffolds mark the seam without creating the
deferred work.

## Running an example

Each is an isolated workspace package; run one individually with a pnpm filter:

```bash
pnpm --filter example-01-hello-presentation dev     # once it has a dev script
```
