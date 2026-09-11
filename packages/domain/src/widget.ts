/** Widgets — Domain-Model.md §5. */

import type { Transform } from "./geometry.js";
import type { PageId, WidgetId, WidgetTypeId } from "./ids.js";

/**
 * Domain-Model.md §5 (`WidgetInstance.constraints`). The shape is owned by
 * Layout-System.md, which does not exist yet; §14 defers constraint
 * resolution to it by name. Typed as `unknown` by the 1.2.0 follow-up patch
 * so the field can exist without this package inventing a shape that
 * document has to live with. Narrowing it is that document's job.
 */
export type LayoutConstraints = unknown;

/**
 * Domain-Model.md §5 — the core extensibility point.
 *
 * `data` is `unknown` on purpose: the core has zero knowledge of what a
 * "chart" is (Design Principle 6). The registering plugin owns its type, its
 * runtime validator, and its own migrations. Grouping is a flat `parentId`
 * reference, never nested containment — a group is just a `WidgetInstance`
 * whose `type` is the built-in `"group"`.
 */
export interface WidgetInstance {
  id: WidgetId;
  pageId: PageId;
  /** Flat reference for grouping — never nested containment. */
  parentId: WidgetId | null;
  /** Fractional index within its page, or within its parent group. */
  order: string;
  type: WidgetTypeId;
  /** The plugin's own data-shape version at write time (Widget-System.md §3/§10). */
  dataVersion: number;
  transform: Transform;
  /** Shape owned entirely by the widget plugin, NOT the core. */
  data: unknown;
  constraints?: LayoutConstraints;
  locked?: boolean;
  hidden?: boolean;
  /** User-facing label, distinct from `type`. */
  name?: string;
}
