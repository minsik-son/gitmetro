export interface Point {
  x: number;
  y: number;
}

export interface Pan {
  x: number;
  y: number;
}

export interface ZoomAtPointInput {
  oldZoom: number;
  nextZoom: number;
  pan: Pan;
  /** Anchor in container-local coordinates (e.g. e.clientX - rect.left). */
  anchor: Point;
}

export function clampZoom(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the pan adjustment that keeps the world point under `anchor`
 * pinned to the same screen position when zoom changes from `oldZoom` to
 * `nextZoom`.
 *
 * Transform model: screen = pan + world * zoom.
 */
export function zoomAtPoint(input: ZoomAtPointInput): Pan {
  if (!Number.isFinite(input.oldZoom) || input.oldZoom <= 0) {
    return input.pan;
  }
  if (input.oldZoom === input.nextZoom) {
    return input.pan;
  }
  const worldX = (input.anchor.x - input.pan.x) / input.oldZoom;
  const worldY = (input.anchor.y - input.pan.y) / input.oldZoom;
  return {
    x: input.anchor.x - worldX * input.nextZoom,
    y: input.anchor.y - worldY * input.nextZoom,
  };
}
