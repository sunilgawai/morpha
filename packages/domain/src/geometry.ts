/** Engine-native geometry — Domain-Model.md §6. */

/**
 * Domain-Model.md §6. Engine units are an abstract number line: not pixels,
 * not EMU, not points. Unit conversion happens exclusively in adapters
 * (Design Principle 5) — the core never converts.
 */
export interface Transform {
  /** Engine units, top-left origin of the page. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise — NOT OOXML's 60,000ths of a degree. */
  rotation: number;
  /** Default 1 — independent of width/height for stroke-preserving scale. */
  scaleX?: number;
  scaleY?: number;
  /** 0–1 — NOT OOXML's 0–100000. */
  opacity: number;
}
