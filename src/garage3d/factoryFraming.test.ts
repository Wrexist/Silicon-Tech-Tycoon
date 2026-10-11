import { it, expect } from 'vitest';
import * as THREE from 'three';
import { factoryFrame } from './factoryFraming.ts';

const project = (aspect: number, cx: number, margin?: number, bay = 0) => {
  const f = factoryFrame(aspect, cx, margin, aspect < 1, bay), camera = new THREE.PerspectiveCamera(f.fov, aspect, .1, 500);
  camera.position.copy(f.position); camera.lookAt(f.target); camera.updateMatrixWorld();
  return { f, points: f.corners.map((corner) => corner.clone().project(camera)) };
};

it('keeps the workshop and dock visible at small phone, landscape and expanded-floor sizes', () => {
  for (const aspect of [.45,.75,1,1.6,2.4]) for (const cx of [0,2,4,8]) for (const bay of [0,4]) {
    for (const p of project(aspect, cx, undefined, bay).points) { expect(Math.abs(p.x)).toBeLessThanOrEqual(1);expect(Math.abs(p.y)).toBeLessThanOrEqual(1);expect(p.z).toBeLessThan(1); }
  }
});

it('centres the floor and fills the frame on its tight axis', () => {
  for (const aspect of [.45,.75,.91,1,1.6,2.4]) for (const cx of [0,2,4,8]) for (const bay of [0,4]) {
    const { points } = project(aspect, cx, undefined, bay);
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // Balanced: neither side of the frame carries the empty margin alone.
    expect(Math.abs(x0 + x1)).toBeLessThan(0.01);
    expect(Math.abs(y0 + y1)).toBeLessThan(0.01);
    // Filled: the tight axis reaches the margin (1 / 1.08 ≈ 0.926), not ~0.65 of the frame.
    expect(Math.max(x1 - x0, y1 - y0) / 2).toBeGreaterThan(0.9);
  }
});

it('keeps the orbit pivot at working height, inside the building footprint', () => {
  for (const aspect of [.45,1,2.4]) for (const cx of [0,4]) {
    const { f } = project(aspect, cx);
    expect(f.target.y).toBeCloseTo(0.8, 6);
    const box = new THREE.Box3().setFromPoints(f.corners);
    expect(box.containsPoint(f.target)).toBe(true);
  }
});
