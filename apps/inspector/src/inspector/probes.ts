// The Inspector is a catalogue of runtime "probes" — read-only views onto a
// running engine (React DevTools / Redux DevTools / Unreal Insights class).
// Each probe declares what it observes and which document governs the data it
// will surface. It is strictly read-only and consumes public exports only
// (ADR-0011): an inspector never mutates, never dispatches.

export type ProbeGroup = "structure" | "runtime" | "events" | "rendering" | "metrics" | "future";

export interface ProbeSpec {
  readonly id: string;
  readonly title: string;
  readonly group: ProbeGroup;
  readonly observes: string;
  readonly governedBy: string;
}

export const INSPECTOR_PROBES: readonly ProbeSpec[] = [
  {
    id: "presentation-tree",
    title: "Presentation Tree",
    group: "structure",
    observes: "Document → pages",
    governedBy: "docs/architecture/domain/Domain-Model.md",
  },
  {
    id: "page-tree",
    title: "Page Tree",
    group: "structure",
    observes: "Page membership + order",
    governedBy: "docs/architecture/domain/Domain-Model.md",
  },
  {
    id: "widget-tree",
    title: "Widget Tree",
    group: "structure",
    observes: "Widgets, groups, z-order",
    governedBy: "docs/architecture/domain/Domain-Model.md",
  },
  {
    id: "state-tree",
    title: "State Tree",
    group: "structure",
    observes: "Store snapshot + version",
    governedBy: "docs/architecture/state/State-Management.md",
  },

  {
    id: "command-log",
    title: "Command Log",
    group: "runtime",
    observes: "Dispatched commands",
    governedBy: "docs/architecture/commands/Command-System.md",
  },
  {
    id: "history-stack",
    title: "History Stack",
    group: "runtime",
    observes: "Undo/redo stacks",
    governedBy: "docs/architecture/commands/Command-System.md",
  },
  {
    id: "selection",
    title: "Selection",
    group: "runtime",
    observes: "Selection / focus / hover",
    governedBy: "docs/architecture/interaction/Selection-and-Interaction.md",
  },
  {
    id: "interaction-state",
    title: "Interaction State",
    group: "runtime",
    observes: "Active tool state machine",
    governedBy: "docs/architecture/interaction/Selection-and-Interaction.md",
  },
  {
    id: "runtime-services",
    title: "Runtime Services",
    group: "runtime",
    observes: "Injected capabilities + services",
    governedBy: "docs/architecture/runtime/Engine-Lifecycle.md",
  },
  {
    id: "plugin-registry",
    title: "Plugin Registry",
    group: "runtime",
    observes: "Registered/activated plugins",
    governedBy: "docs/architecture/plugins/Plugin-System.md",
  },

  {
    id: "event-stream",
    title: "Event Stream",
    group: "events",
    observes: "Emitted notifications",
    governedBy: "docs/architecture/events/Event-System.md",
  },

  {
    id: "renderer-tree",
    title: "Renderer Tree",
    group: "rendering",
    observes: "RenderNode projection",
    governedBy: "docs/architecture/rendering/Rendering-Architecture.md",
  },
  {
    id: "dirty-nodes",
    title: "Dirty Nodes",
    group: "rendering",
    observes: "Nodes marked for re-render",
    governedBy: "docs/architecture/rendering/Rendering-Architecture.md",
  },
  {
    id: "layout-cache",
    title: "Layout Cache",
    group: "rendering",
    observes: "Cached layout results",
    governedBy: "docs/architecture/rendering/Rendering-Architecture.md",
  },
  {
    id: "render-cache",
    title: "Render Cache",
    group: "rendering",
    observes: "Cached draw output",
    governedBy: "docs/architecture/rendering/Rendering-Architecture.md",
  },

  {
    id: "perf-metrics",
    title: "Performance Metrics",
    group: "metrics",
    observes: "Frame + commit timings (pending Performance.md)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "memory",
    title: "Memory Usage",
    group: "metrics",
    observes: "Store + cache footprint",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "fps",
    title: "FPS",
    group: "metrics",
    observes: "Render loop frame rate",
    governedBy: "docs/architecture/Architecture-Index.md",
  },

  {
    id: "timeline",
    title: "Timeline",
    group: "future",
    observes: "Time-travel (future)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "animation-state",
    title: "Animation State",
    group: "future",
    observes: "Animation system (future)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "ai-activity",
    title: "AI Activity",
    group: "future",
    observes: "AI command stream (deferred — AI.md)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
  {
    id: "collab-state",
    title: "Collaboration State",
    group: "future",
    observes: "Presence + op log (deferred — Collaboration.md)",
    governedBy: "docs/architecture/Architecture-Index.md",
  },
];

export const PROBE_GROUPS: readonly ProbeGroup[] = [
  "structure",
  "runtime",
  "events",
  "rendering",
  "metrics",
  "future",
];
