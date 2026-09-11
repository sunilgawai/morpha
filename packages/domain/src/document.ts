/** The document root — Domain-Model.md §3. */

import type { Asset } from "./asset.js";
import type { AssetId, EntityId, PageId, ThemeId, WidgetId, WidgetTypeId } from "./ids.js";
import type { Page } from "./page.js";
import type { Theme } from "./theme.js";
import type { WidgetInstance } from "./widget.js";

/** Domain-Model.md §3. */
export interface DocumentMetadata {
  title: string;
  /** ISO 8601 — informational only, never used for ordering or logic. */
  createdAt: string;
  updatedAt: string;
  locale?: string;
  /** Escape hatch for consuming-application metadata. */
  custom?: Record<string, unknown>;
}

/** Domain-Model.md §3. */
export interface CanvasConfig {
  /** Design Principle 5 — always this; adapters convert. */
  unit: "engine-unit";
  defaultPageSize: { width: number; height: number };
  defaultPageOrientation: "landscape" | "portrait";
}

/**
 * Domain-Model.md §3. Normalized throughout (Design Principle 3): flat,
 * ID-keyed maps, never nested trees. `widgets` holds ALL widgets of ALL
 * pages.
 */
export interface PresentationDocument {
  id: EntityId;
  /** Design Principle 9 — starts at 1. */
  schemaVersion: number;
  metadata: DocumentMetadata;
  canvas: CanvasConfig;
  /** Content-addressed, flat map. */
  assets: Record<AssetId, Asset>;
  themes: Record<ThemeId, Theme>;
  /** Which plugins this document depends on. */
  widgetDefinitionRefs: WidgetTypeId[];
  /** Flat map, NOT an array. */
  pages: Record<PageId, Page>;
  /**
   * DERIVED cache, runtime-only: page IDs sorted by `Page.order`, rebuilt by
   * the Store on hydration (State-Management.md §3). Never serialized
   * (Serialization.md §4) — see `SerializedPresentationDocument`. Not a
   * second source of truth: `Page.order` is.
   */
  pageOrder: string[];
  /** Flat map — ALL widgets, ALL pages. */
  widgets: Record<WidgetId, WidgetInstance>;
}
