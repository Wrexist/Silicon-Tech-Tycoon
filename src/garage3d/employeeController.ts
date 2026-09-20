// Living-office scheduling for the 3D team: who steps away from a desk this week, where they go,
// and a tiny live-pose registry so every renderer of a character reads the SAME current state.
//
// Presentation-only. The rolls are DERIVED hashes of (seed, week, character) — never Math.random,
// never the engine's sim RNG — so the same week always leaves the same desks and a capture is
// repeatable. `engine/` never reads any of this; the determinism pin cannot see it.
import { cosmeticHash01, workTargetFor } from "./officeLive.ts";
import { furnitureDef, worldOf, type PlacedItem } from "../engine/furniture.ts";

/** Where an employee can be found when they are not at their desk. */
export type DestinationKind = "coffee" | "arcade" | "board";

/** A single stand point in a destination (two people can share the coffee machine side by side). */
export interface DestinationSpot {
  x: number;
  z: number;
  face: number;
}

export interface Destination {
  kind: DestinationKind;
  spots: DestinationSpot[];
}

/** One desk-owning employee: seat position, facing, colour, and the robot animation seed. */
export interface RoamAgent {
  key: string;
  seed: number;
  colorIdx: number;
  x: number;
  z: number;
  face: number;
}

export type AwaySpot = DestinationSpot & { kind: DestinationKind };

// Derived-hash salts, cosmetic office streams only (registered in CLAUDE.md):
// 443 = who steps away this week · 449 = which spot · 457 = away priority · 461/463 = drifter wander.
const AWAY_SALT = 443;
const SPOT_SALT = 449;
const ORDER_SALT = 457;
export const WANDER_ANGLE_SALT = 461;
export const WANDER_RADIUS_SALT = 463;
const AWAY_CHANCE = 0.34;
export const MAX_AWAY = 2;

const agentSeed = (seed: number, i: number) => (seed ^ Math.imul((i + 1) >>> 0, 0x9e3779b1)) >>> 0;

/**
 * This week's break plan: at most MAX_AWAY characters leave their desk, each to its own spot, so no
 * two roamers can ever land on the same stand point. Only characters whose derived work state is
 * IDLE walk — a busy worker stays at the desk that week. Pure and stable for (agents, seed, week).
 */
export function awayPlanFor(
  agents: readonly RoamAgent[],
  seed: number,
  week: number,
  destinations: readonly Destination[],
): Map<string, AwaySpot> {
  const out = new Map<string, AwaySpot>();
  if (destinations.length === 0) return out;
  const candidates: { agent: RoamAgent; i: number; star: number }[] = [];
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const s = agentSeed(seed, i);
    if (workTargetFor(seed, week, Math.round(a.seed * 1000)) !== 0) continue; // working → at the desk
    if (cosmeticHash01(s, week, AWAY_SALT) >= AWAY_CHANCE) continue;
    candidates.push({ agent: a, i, star: cosmeticHash01(s, week, ORDER_SALT) });
  }
  // Highest priority first; the index breaks ties so the order is total and stable.
  candidates.sort((a, b) => (b.star - a.star) || (a.i - b.i));
  const used = new Set<string>(); // `${destinationIndex}:${spotIndex}`
  for (const c of candidates) {
    if (out.size >= MAX_AWAY) break;
    const s = agentSeed(seed, c.i);
    const start = Math.floor(cosmeticHash01(s, week, SPOT_SALT) * destinations.length) % destinations.length;
    for (let d = 0; d < destinations.length; d++) {
      const di = (start + d) % destinations.length;
      const dest = destinations[di];
      let claimed = false;
      for (let si = 0; si < dest.spots.length; si++) {
        if (used.has(`${di}:${si}`)) continue;
        used.add(`${di}:${si}`);
        out.set(c.agent.key, { ...dest.spots[si], kind: dest.kind });
        claimed = true;
        break;
      }
      if (claimed) break;
    }
  }
  return out;
}

// Furniture keep-out circles (x, z, radius, in the room's own units) so walkers never cross the
// fixed props. Positions/ranges scale with the facility (see officeDestinations + the Scene).
export const ROAM_BOUND = 3.4;
export const ROAM_OBSTACLES: { x: number; z: number; r: number }[] = [
  { x: -1.3, z: 2.3, r: 1.2 }, // founder desk
  { x: -3.5, z: 1.6, r: 0.95 }, // vault
  { x: 0.8, z: 3.55, r: 1.05 }, // security gate
  { x: 2.5, z: -3.55, r: 1.1 }, // kanban wall
  { x: -3.44, z: -3.44, r: 0.7 }, // corner plant
  { x: 3.44, z: -3.44, r: 0.7 }, // corner plant
];

/** Keep-out circles in WORLD units for a facility scale. */
export function scaledObstacles(roomScale: number): { x: number; z: number; r: number }[] {
  return ROAM_OBSTACLES.map((o) => ({ x: o.x * roomScale, z: o.z * roomScale, r: o.r * roomScale }));
}

/**
 * Stand points near the fixtures a break can target: the coffee station, the planning board, and
 * any placed arcade. Fixture-anchored points scale with the room; placed furniture is already in
 * world units. Every candidate is checked against the room bounds and the keep-outs, so a walker is
 * never handed a spot it cannot actually stand in (which would leave it walking in place).
 */
export function officeDestinations(opts: {
  amenityTier: number;
  showWhiteboard: boolean;
  dark: boolean;
  layout: readonly PlacedItem[];
  facilityTier: number;
  roomScale: number;
}): Destination[] {
  const { roomScale: k } = opts;
  const bound = ROAM_BOUND * k;
  const obstacles = scaledObstacles(k);
  const ok = (x: number, z: number) =>
    Math.abs(x) <= bound && Math.abs(z) <= bound &&
    obstacles.every((o) => Math.hypot(x - o.x, z - o.z) >= o.r + 0.30);
  const faceTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz);
  const out: Destination[] = [];
  if (opts.amenityTier >= 1) {
    // The machine sits at (-3.6, 0.5)·k facing +z; stand beside the counter (its right side), clear
    // of the vault keep-out. Both spots look back at the machine.
    const ax = -3.6 * k, az = 0.5 * k;
    const sx = ax + 0.79 * k;
    const spots = [
      { x: sx, z: az, face: faceTo(sx, az, ax, az) },
      { x: sx, z: az - 0.45 * k, face: faceTo(sx, az - 0.45 * k, ax, az) },
    ].filter((s) => ok(s.x, s.z));
    if (spots.length) out.push({ kind: "coffee", spots });
  }
  if (opts.showWhiteboard) {
    const spot = opts.dark
      ? { x: -3.1 * k, z: 2.85 * k, face: faceTo(-3.1 * k, 2.85 * k, -3.92 * k, 3.0 * k) }
      : { x: -1.2 * k, z: -3.13 * k, face: faceTo(-1.2 * k, -3.13 * k, -1.2 * k, -3.88 * k) };
    if (ok(spot.x, spot.z)) out.push({ kind: "board", spots: [spot] });
  }
  const arcade = opts.layout.find((it) => it.type === "arcade");
  if (arcade) {
    const w = worldOf(arcade, opts.facilityTier);
    const half = furnitureDef("arcade").d * 0.5 + 0.42;
    for (const side of [1, -1]) {
      const x = w.x + Math.sin(w.rotY) * half * side;
      const z = w.z + Math.cos(w.rotY) * half * side;
      if (!ok(x, z)) continue;
      out.push({ kind: "arcade", spots: [{ x, z, face: faceTo(x, z, w.x, w.z) }] });
      break;
    }
  }
  return out;
}

/** What a character is doing right now. `working`/`thinking` come from the seated robot; the walker
 *  owns `walking` and the destination kinds. The speech bubbles read this — never a second guess. */
export type Activity = "working" | "thinking" | "walking" | DestinationKind;

export interface LivePose {
  activity: Activity;
  x?: number;
  z?: number;
  /** True while the walker owns the character (away from the desk), so the seated robot hides. */
  roaming?: boolean;
}

const livePoses = new Map<string, LivePose>();

export function publishPose(key: string, pose: LivePose): void {
  livePoses.set(key, pose);
}

export function poseFor(key: string): LivePose | undefined {
  return livePoses.get(key);
}

export function clearPose(key: string): void {
  livePoses.delete(key);
}
