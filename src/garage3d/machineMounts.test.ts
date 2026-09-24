import { describe, it, expect } from 'vitest';
import { machineMounts } from './machineMounts.ts';
import { worldOf, type FactoryFloor } from '../engine/factoryFloor.ts';

describe('conveyor working heads', () => {
  const floor: FactoryFloor = { machines: [{id:'press',kind:'press',c:2,r:1}], belts: [1,2,3,4,5].map(c => ({c,r:3,dir:'e' as const})) };
  it('mounts above an adjacent straight conveyor and follows its heading', () => {
    const before = JSON.stringify(floor);
    const mount = machineMounts(floor).get('press')!;
    expect(mount.point).toEqual(worldOf(3,3));
    expect(mount.yaw).toBe(Math.PI/2);
    expect(JSON.stringify(floor)).toBe(before);
  });
  it('does not connect remote machinery or unrelated route branches', () => {
    expect(machineMounts({...floor,belts:[{c:14,r:8,dir:'s'}]}).size).toBe(0);
    expect(machineMounts(floor,[]).size).toBe(0);
  });
  it('supports north-south lines and chooses distinct work positions', () => {
    const f: FactoryFloor = {machines:[{id:'a',kind:'qa',c:0,r:1},{id:'b',kind:'screen',c:3,r:1}],belts:[0,1,2,3,4].map(r=>({c:2,r,dir:'s'}))};
    const mounts=machineMounts(f);
    expect(mounts.get('a')!.yaw).toBe(0);
    expect(mounts.get('a')!.point).not.toEqual(mounts.get('b')!.point);
  });
});
