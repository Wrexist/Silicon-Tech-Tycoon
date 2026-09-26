import { describe, it, expect } from 'vitest';
import { FACTORY_DOCK, deliveryPosition } from './factoryDock.ts';
import { FactoryGestureGuard } from './factoryGestures.ts';
import { floorWidth } from '../engine/factoryFloor.ts';

describe('exterior factory loading area', () => {
  it('keeps the entire truck and pallet outside the building at every expansion', () => {
    for (let expansion = 0; expansion <= 3; expansion++) {
      const westWall = (floorWidth(expansion) - 16) / 2 - (floorWidth(expansion) + .6) / 2;
      expect(FACTORY_DOCK.truck[0] + 1.5).toBeLessThan(westWall);
      expect(FACTORY_DOCK.pallet[0] + .65).toBeLessThan(westWall);
    }
  });
  it('keeps delivery traffic clear of player cells, parked truck and pallet', () => {
    for (const overtime of [false, true]) for (let lane = 0; lane <= 3; lane++) for (let t = 0; t < 20; t += .1) {
      const p = deliveryPosition(t, lane, overtime);
      expect(p.x + .4).toBeLessThan(-8.3);
      expect(Math.abs(p.z - FACTORY_DOCK.truck[2])).toBeGreaterThan(.95);
      expect(Math.abs(p.z - FACTORY_DOCK.pallet[2])).toBeGreaterThan(.95);
    }
  });
});

describe('factory touch gesture ownership', () => {
  it('blocks all build actions throughout a pinch, including the last finger up', () => {
    const g = new FactoryGestureGuard();
    expect(g.down(1)).toBe(false);
    expect(g.down(2)).toBe(true);
    g.up(2); expect(g.blocked).toBe(true);
    g.up(1); expect(g.blocked).toBe(true);
    expect(g.down(3)).toBe(false);
  });
  it('recovers cleanly after OS cancellation without committing the abandoned gesture', () => {
    const g = new FactoryGestureGuard();
    g.down(1); g.cancel(); expect(g.blocked).toBe(true);
    expect(g.down(2)).toBe(false);
    g.up(2); expect(g.down(3)).toBe(false);
  });
});
