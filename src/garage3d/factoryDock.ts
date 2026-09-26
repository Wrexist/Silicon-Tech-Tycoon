/** Delivery traffic lives outside the open west wall. Floor expansions grow east,
 * so this loading bay is stable across Auto, manual edits and saved layouts. */
export const FACTORY_DOCK = {
  yaw: -Math.PI / 2,
  pallet: [-9.1, 0, 2.5] as [number, number, number],
  truck: [-11.5, 0, 2.5] as [number, number, number],
  road: [-10.8, 0, 2.5] as [number, number, number],
};

/** Dedicated exterior lanes avoid cutting through any player-owned equipment.
 * lane 0 loads the truck; upgrade robots use parallel lanes away from the truck. */
export function deliveryPosition(time: number, lane: number, overtime: boolean) {
  const period = overtime ? 3.2 : 5;
  const phase = ((time / period + lane / 3) % 1 + 1) % 1;
  const outbound = phase < 0.5;
  const t = outbound ? phase * 2 : (1 - phase) * 2;
  const eased = t * t * (3 - 2 * t);
  return { x: -9.1 - 3.4 * eased, z: lane === 0 ? 3.65 : 1 - lane,
    yaw: outbound ? -Math.PI / 2 : Math.PI / 2, outbound };
}
