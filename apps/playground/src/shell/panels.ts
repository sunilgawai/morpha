// The Playground shell is a manifest of regions it will grow into. Each panel
// declares the engine capability it visualizes and where that capability is
// governed, so a contributor implementing a feature knows exactly which panel
// becomes real. Nothing here implements engine behavior (ADR-0011).

export type PanelRegion = "toolbar" | "left" | "center" | "right" | "bottom" | "statusbar";

export interface PanelSpec {
  readonly id: string;
  readonly title: string;
  readonly region: PanelRegion;
  /** What this panel will show once the backing capability exists. */
  readonly visualizes: string;
  /** Governing architecture document (relative to repo root). */
  readonly governedBy: string;
}

const PLAYGROUND_PANELS: readonly PanelSpec[] = [
  {
    id: "toolbar",
    title: "Toolbar",
    region: "toolbar",
    visualizes: "Active tool + tool switching",
    governedBy: "docs/architecture/interaction/Selection-and-Interaction.md",
  },
  {
    id: "engine-status",
    title: "Engine Status",
    region: "statusbar",
    visualizes: "Engine construction/disposal lifecycle",
    governedBy: "docs/architecture/runtime/Engine-Lifecycle.md",
  },
  {
    id: "runtime-status",
    title: "Runtime Status",
    region: "statusbar",
    visualizes: "Runtime services health",
    governedBy: "docs/architecture/runtime/Engine-Lifecycle.md",
  },
  {
    id: "package-versions",
    title: "Package Versions",
    region: "statusbar",
    visualizes: "Consumed @morpha/* packages",
    governedBy: "docs/architecture/packages/Package-Structure.md",
  },
  {
    id: "feature-flags",
    title: "Feature Flags",
    region: "statusbar",
    visualizes: "Enabled engine capabilities",
    governedBy: "docs/architecture/runtime/Engine-Lifecycle.md",
  },
  {
    id: "widget-tree",
    title: "Widget Tree",
    region: "left",
    visualizes: "Current document → pages → widgets",
    governedBy: "docs/architecture/domain/Domain-Model.md",
  },
  {
    id: "canvas",
    title: "Canvas",
    region: "center",
    visualizes: "RenderState projected by a renderer",
    governedBy: "docs/architecture/rendering/Rendering-Architecture.md",
  },
  {
    id: "property-panel",
    title: "Property Panel",
    region: "right",
    visualizes: "Selected widget's editable properties",
    governedBy: "docs/architecture/widgets/Widget-System.md",
  },
  {
    id: "inspector-toggle",
    title: "Inspector",
    region: "right",
    visualizes: "Handoff to apps/inspector",
    governedBy: "docs/architecture/adr/ADR-0011-development-applications-workspace.md",
  },
  {
    id: "selection",
    title: "Current Selection",
    region: "right",
    visualizes: "Selection / focus / hover",
    governedBy: "docs/architecture/interaction/Selection-and-Interaction.md",
  },
  {
    id: "history",
    title: "History",
    region: "bottom",
    visualizes: "Undo/redo command history",
    governedBy: "docs/architecture/commands/Command-System.md",
  },
  {
    id: "console",
    title: "Developer Console",
    region: "bottom",
    visualizes: "Dispatched commands + emitted events",
    governedBy: "docs/architecture/commands/Command-System.md",
  },
  {
    id: "performance",
    title: "Performance Overlay",
    region: "bottom",
    visualizes: "Frame budget (pending Performance.md)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "plugins",
    title: "Plugin Status",
    region: "left",
    visualizes: "Registered plugins + activation",
    governedBy: "docs/architecture/plugins/Plugin-System.md",
  },
];

export function panelsFor(region: PanelRegion): readonly PanelSpec[] {
  return PLAYGROUND_PANELS.filter((p) => p.region === region);
}
