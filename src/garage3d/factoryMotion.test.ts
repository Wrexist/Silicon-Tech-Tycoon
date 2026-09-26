import { describe, it, expect } from 'vitest';
import { factoryAnimationKinds, animationDelta, advanceFactoryItems } from './factoryMotion.ts';
describe('factory animation state', () => {
  it('includes the whole product recipe and client work without duplicates', () => {
    const kinds=factoryAnimationKinds('phone',['mill','qa']);
    for(const k of ['intake','packer','press','screen','arm','qa','mill']) expect(kinds).toContain(k);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
  it('freezes for pause and reduced motion and clamps resume gaps', () => {
    expect(animationDelta(10,true,false)).toBe(0);
    expect(animationDelta(10,false,true)).toBe(0);
    expect(animationDelta(10,false,false)).toBe(.05);
    expect(animationDelta(-1,false,false)).toBe(0);
  });
  it('never transports items on an idle or disconnected line', () => {
    const items=[1,2];
    advanceFactoryItems(items,10,.03,false,true,false);
    advanceFactoryItems(items,10,.03,true,false,false);
    expect(items).toEqual([1,2]);
  });
  it('moves consistently at different frame rates and wraps at the dock', () => {
    const a=[9.9], b=[9.9];
    for(let i=0;i<60;i++)advanceFactoryItems(a,10,1/60,true,true,false);
    for(let i=0;i<30;i++)advanceFactoryItems(b,10,1/30,true,true,false);
    expect(a[0]).toBeCloseTo(b[0],10);expect(a[0]).toBeCloseTo(1.15,10);
  });
});
