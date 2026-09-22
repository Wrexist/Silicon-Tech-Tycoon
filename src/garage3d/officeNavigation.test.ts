import { describe, expect, it } from 'vitest';
import { clearPoint, clearSegment, findOfficePath, type Point } from './officeNavigation.ts';
import {
  awayPlanFor,
  furnitureObstacles,
  emptyChairObstacles,
  officeDestinations,
  reachableDestination,
  type RoamAgent,
} from './employeeController.ts';
import { type PlacedItem, worldOf, defaultLayout, planSeats } from '../engine/furniture.ts';

describe('office navigation', () => {
  it('gives the real default office a reachable plant-care destination', () => {
    const layout=defaultLayout(), desk=layout[0], w=worldOf(desk), flip=planSeats(layout,1).flipped[desk.iid];
    const agent:RoamAgent={key:'founder',seed:0,colorIdx:0,x:w.x,z:w.z+(flip?0.86:-0.86),face:flip?Math.PI:0};
    const destinations=officeDestinations({amenityTier:0,showWhiteboard:false,dark:true,layout,facilityTier:1,roomScale:1});
    expect(destinations.some(d=>d.kind==='watering'&&d.spots.some(spot=>reachableDestination(agent,spot,furnitureObstacles(layout,1),3.4)))).toBe(true);
  });

  it('keeps empty workstation chairs blocked but leaves the assigned desk exit available', () => {
    const layout=defaultLayout(), empty=emptyChairObstacles(layout,1,0);
    expect(empty).toHaveLength(1);
    expect(clearPoint(empty[0],empty,3.4)).toBe(false);
    expect(emptyChairObstacles(layout,1,1)).toEqual([]);
  });
  it('routes around a wall instead of pushing through it', () => {
    const start = { x: -2, z: 0 },
      end = { x: 2, z: 0 },
      blocks = [{ x: 0, z: 0, hx: 0.35, hz: 1.4 }];
    const path = findOfficePath(start, end, blocks, 3)!;
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(1);
    let last: Point = start;
    for (const p of path) {
      expect(clearSegment(last, p, blocks, 3)).toBe(true);
      last = p;
    }
    expect(last).toEqual(end);
    expect(findOfficePath(start, end, blocks, 3)).toEqual(path);
  });
  it('rejects disconnected rooms and corner cutting', () => {
    expect(
      findOfficePath({ x: -2, z: 0 }, { x: 2, z: 0 }, [{ x: 0, z: 0, hx: 0.2, hz: 3 }], 3),
    ).toBeNull();
    expect(
      clearSegment({ x: -1, z: 0 }, { x: 0, z: 1 }, [{ x: 0, z: 0, hx: 0.3, hz: 0.3 }], 3),
    ).toBe(false);
  });
  it('does not route an overlapping or out-of-bounds character through furniture', () => {
    expect(findOfficePath({ x: 0, z: 0 }, { x: 2, z: 0 }, [{ x: 0, z: 0, r: 0.5 }], 3)).toBeNull();
    expect(findOfficePath({ x: 0, z: 0 }, { x: 4, z: 0 }, [], 3)).toBeNull();
  });
  it('treats flat rugs as walkable and uses rotated owned footprints without mutation', () => {
    const items: PlacedItem[] = [
      { iid: 'sofa', type: 'sofa', c: 3, r: 3, rot: 1 },
      { iid: 'rug', type: 'rug', c: 1, r: 1, rot: 0 },
    ];
    const before = JSON.stringify(items),
      blocks = furnitureObstacles(items, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].hz).toBeGreaterThan(blocks[0].hx!);
    expect(JSON.stringify(items)).toBe(before);
  });
  it('anchors sofa entry and plant care to all four saved rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const items: PlacedItem[] = [
        { iid: 'sofa', type: 'sofa', c: 3, r: 3, rot },
        { iid: 'plant', type: 'plantPot', c: 6, r: 6, rot },
      ];
      const dests = officeDestinations({
        amenityTier: 0,
        showWhiteboard: false,
        dark: false,
        layout: items,
        facilityTier: 1,
        roomScale: 1,
      });
      const sofa = dests.find((d) => d.kind === 'relaxing')!.spots[0];
      expect(sofa.resource).toBe('sofa');
      expect(sofa.seat).toBeDefined();
      expect(clearPoint(sofa, furnitureObstacles(items, 1), 3.4)).toBe(true);
      const w = worldOf(items[0]);
      expect(Math.hypot(sofa.seat!.x - w.x, sofa.seat!.z - w.z)).toBeCloseTo(0.1);
      expect(
        dests.find((d) => d.kind === 'watering')!.spots.every((s) => s.resource === 'plant'),
      ).toBe(true);
    }
  });
  it('rejects a blocked sofa approach and unreachable destinations', () => {
    const agent: RoamAgent = { key: 'a', seed: 0, colorIdx: 0, x: -2, z: 0, face: 0 };
    const spot = { x: 2, z: 0, face: 0, resource: 'sofa', seat: { x: 2, z: 1 } };
    expect(reachableDestination(agent, spot, [{ x: 0, z: 0, hx: 0.2, hz: 3 }], 3)).toBe(false);
    expect(reachableDestination(agent, spot, [{ x: 2, z: 0.5, hx: 0.4, hz: 0.1 }], 3)).toBe(false);
  });
  it('reserves one plant across its multiple approach points', () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      key: `a${i}`,
      seed: i * 2.1,
      colorIdx: i,
      x: -2,
      z: 0,
      face: 0,
    }));
    const spots = [
      { x: 0, z: 1, face: 0, resource: 'plant' },
      { x: 1, z: 0, face: 0, resource: 'plant' },
    ];
    let seen = false;
    for (let week = 1; week < 60; week++) {
      const plan = awayPlanFor(agents, 7, week, [{ kind: 'watering', spots }]);
      expect(plan.size).toBeLessThanOrEqual(1);
      seen ||= plan.size === 1;
      expect(awayPlanFor(agents, 7, week, [{ kind: 'watering', spots }], () => false).size).toBe(0);
    }
    expect(seen).toBe(true);
  });
});
