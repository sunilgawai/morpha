/** Pages — Domain-Model.md §4. */

import type { ColorValue } from "./color.js";
import type { AssetId, LayoutId, PageId } from "./ids.js";

/** Domain-Model.md §4. */
export type Background =
  | { type: "color"; color: ColorValue }
  | { type: "gradient"; stops: { offset: number; color: ColorValue }[]; angle: number }
  | { type: "asset"; assetId: AssetId; fit: "cover" | "contain" | "tile" }
  | { type: "none" };

/**
 * Domain-Model.md §4. Deliberately `Page`, never `Slide` — a whiteboard's
 * page is a viewport bookmark, a resume builder's is a printable sheet
 * (Vision.md's product-agnostic vocabulary).
 */
export interface Page {
  id: PageId;
  /** Fractional index — Ordering-Strategy.md. */
  order: string;
  name: string;
  /** Overrides `CanvasConfig.defaultPageSize`. */
  size: { width: number; height: number };
  background: Background;
  /**
   * DERIVED cache, runtime-only: TOP-LEVEL widgets only (`parentId === null`),
   * sorted by `order`. Container members are a separate derived cache per
   * container (State-Management.md §3). Never serialized (Serialization.md §4)
   * — see `SerializedPage`.
   */
  widgetOrder: string[];
  /** Optional — Layout-System.md (pending). */
  layoutRef?: LayoutId;
  notes?: string;
  hidden?: boolean;
}
