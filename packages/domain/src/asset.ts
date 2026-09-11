/** Assets — Domain-Model.md §8. */

import type { AssetId } from "./ids.js";

/**
 * Domain-Model.md §8. The engine stores *references*; it never uploads,
 * downloads, or transforms binary data (Design Principle 11 — no I/O in
 * core). A host application or adapter resolves a source into bytes.
 */
export type AssetSource =
  | { type: "url"; url: string }
  | { type: "dataUri"; data: string }
  | { type: "reference"; providerKey: string; providerId: string };

/** Domain-Model.md §8. Provider mechanics belong to Asset-System.md (pending). */
export interface Asset {
  id: AssetId;
  kind: "image" | "video" | "audio" | "font" | "other";
  source: AssetSource;
  metadata: {
    width?: number;
    height?: number;
    durationMs?: number;
    mimeType: string;
    sizeBytes?: number;
    /** Content-addressing — enables dedup across documents. */
    checksum?: string;
  };
}
