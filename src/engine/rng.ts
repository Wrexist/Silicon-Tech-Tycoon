// Tiny deterministic RNG (mulberry32) so the sim is reproducible & testable. PURE.
export interface Rng {
  next(): number; // [0,1)
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  state(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (m) => Math.floor(next() * m),
    range: (min, max) => min + next() * (max - min),
    state: () => a >>> 0,
  };
}
