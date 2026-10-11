import { it, expect } from 'vitest';
import * as THREE from 'three';
import { officeFrame, OFFICE_FOV } from './officeFraming.ts';

const ASPECTS = [.6, .99, 1.3, 1.7, 2.4];

const projected = (aspect: number, tier: number) => {
  const f = officeFrame(aspect, tier), camera = new THREE.PerspectiveCamera(OFFICE_FOV, aspect, .1, 500);
  camera.position.copy(f.position); camera.lookAt(f.target); camera.updateMatrixWorld();
  const points = f.corners.map((c) => c.clone().project(camera));
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { f, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

it('never crops the room vertically and only trims its side tips on narrow cards', () => {
  for (const aspect of ASPECTS) for (const tier of [1, 2, 3]){
    const { x0, x1, y0, y1 } = projected(aspect, tier);
    expect(Math.max(-y0, y1)).toBeLessThanOrEqual(1);
    expect(Math.max(-x0, x1)).toBeLessThan(1.19);
  }
});

it('centres the room and fills the card on its tight axis', () => {
  for (const aspect of ASPECTS) for (const tier of [1, 2, 3]){
    const { x0, x1, y0, y1 } = projected(aspect, tier);
    expect(Math.abs(x0 + x1)).toBeLessThan(0.01);
    expect(Math.abs(y0 + y1)).toBeLessThan(0.01);
    // Either the height reaches the margin, or the width reaches (and slightly overflows) the sides.
    expect(Math.max((y1 - y0) / 2, (x1 - x0) / 2)).toBeGreaterThan(0.92);
  }
});

it('uses a wide card: the room is larger on an iPad-shaped card than on a phone card', () => {
  for (const tier of [1, 3]){
    const phone = projected(.99, tier).f, wide = projected(1.7, tier).f;
    expect(wide.position.distanceTo(wide.target)).toBeLessThan(phone.position.distanceTo(phone.target));
  }
});

it('keeps the pivot at desk height inside the room', () => {
  for (const aspect of ASPECTS) for (const tier of [1, 3]){
    const { f } = projected(aspect, tier);
    expect(f.target.y).toBeCloseTo(0.25, 6);
    expect(Math.abs(f.target.x)).toBeLessThan(2);
    expect(Math.abs(f.target.z)).toBeLessThan(2);
  }
});
