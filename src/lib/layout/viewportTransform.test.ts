import { describe, it, expect } from "vitest";
import { clampZoom, zoomAtPoint } from "./viewportTransform";

describe("clampZoom", () => {
  it("clamps below min", () => {
    expect(clampZoom(0.1, 0.25, 2)).toBe(0.25);
  });

  it("clamps above max", () => {
    expect(clampZoom(5, 0.25, 2)).toBe(2);
  });

  it("returns value within range unchanged", () => {
    expect(clampZoom(1, 0.25, 2)).toBe(1);
  });

  it("returns min for non-finite values", () => {
    expect(clampZoom(NaN, 0.25, 2)).toBe(0.25);
    expect(clampZoom(Infinity, 0.25, 2)).toBe(2);
  });
});

describe("zoomAtPoint — anchor invariant", () => {
  function screenForWorld(
    world: { x: number; y: number },
    pan: { x: number; y: number },
    zoom: number,
  ): { x: number; y: number } {
    return { x: pan.x + world.x * zoom, y: pan.y + world.y * zoom };
  }

  it("keeps the world point under the cursor pinned to the same screen pixel on zoom in", () => {
    const oldZoom = 1;
    const nextZoom = 1.6;
    const pan = { x: -120, y: -40 };
    const anchor = { x: 400, y: 300 };

    const worldBefore = {
      x: (anchor.x - pan.x) / oldZoom,
      y: (anchor.y - pan.y) / oldZoom,
    };

    const nextPan = zoomAtPoint({ oldZoom, nextZoom, pan, anchor });
    const screenAfter = screenForWorld(worldBefore, nextPan, nextZoom);
    expect(screenAfter.x).toBeCloseTo(anchor.x, 5);
    expect(screenAfter.y).toBeCloseTo(anchor.y, 5);
  });

  it("keeps the world point pinned on zoom out", () => {
    const oldZoom = 1.5;
    const nextZoom = 0.8;
    const pan = { x: 220, y: 130 };
    const anchor = { x: 250, y: 180 };

    const worldBefore = {
      x: (anchor.x - pan.x) / oldZoom,
      y: (anchor.y - pan.y) / oldZoom,
    };

    const nextPan = zoomAtPoint({ oldZoom, nextZoom, pan, anchor });
    const screenAfter = screenForWorld(worldBefore, nextPan, nextZoom);
    expect(screenAfter.x).toBeCloseTo(anchor.x, 5);
    expect(screenAfter.y).toBeCloseTo(anchor.y, 5);
  });

  it("returns the same pan when oldZoom === nextZoom", () => {
    const pan = { x: 50, y: -10 };
    const out = zoomAtPoint({ oldZoom: 1, nextZoom: 1, pan, anchor: { x: 200, y: 200 } });
    expect(out).toBe(pan);
  });

  it("returns the same pan for invalid oldZoom", () => {
    const pan = { x: 50, y: -10 };
    expect(
      zoomAtPoint({ oldZoom: 0, nextZoom: 1, pan, anchor: { x: 0, y: 0 } }),
    ).toBe(pan);
    expect(
      zoomAtPoint({ oldZoom: -1, nextZoom: 1, pan, anchor: { x: 0, y: 0 } }),
    ).toBe(pan);
    expect(
      zoomAtPoint({ oldZoom: NaN, nextZoom: 1, pan, anchor: { x: 0, y: 0 } }),
    ).toBe(pan);
  });

  it("anchor at top-left corner shifts pan exactly by the scale ratio", () => {
    const oldZoom = 1;
    const nextZoom = 2;
    const pan = { x: 0, y: 0 };
    const out = zoomAtPoint({ oldZoom, nextZoom, pan, anchor: { x: 0, y: 0 } });
    expect(out).toEqual({ x: 0, y: 0 });
  });
});
