// Item 5: the workstation module — desk + chair + screen(s) + keyboard + one small prop, treated as
// ONE authored unit instead of pieces that happen to stand near each other.
//
// A desk can't be decorated by scattering extra grid items: the engine derives each desk's chair
// (planSeats) and refuses anything placed inside a seat band, so the chair, the extra screen and the
// desk-top prop are render-time parts of the unit, anchored to the desk they belong to. That is true
// in both directions:
//
//   • a PLAYER-owned desk is decorated in place — the unit mounts on the desk's own transform and
//     the desk is never moved, rotated or written to;
//   • a GAME-owned desk (the arranger's work zone) carries the same module spec on its
//     `ArrangedPiece`, so the unit the room was designed around is the unit that renders.
//
// Variation is deliberate and restrained: the computers upgrade sets the screen budget (1, or up to
// 2), the unit picks a duo layout, and the prop is one of three. The pick is a derived cosmetic hash
// of (seed, station) — salt 479, registered in CLAUDE.md — so the same room always draws the same
// desks and two desks never share a stream. The engine never reads any of this.
import { cosmeticHash01 } from "./officeLive.ts";
import type { PlacedItem } from "../engine/furniture.ts";

/** Module stream. Fresh salt — never shared with the arrangement's own (467) or the office's others. */
const MODULE_SALT = 479;

export type WorkstationProp = "papers" | "plant" | "books";
export type ScreenLayout = "single" | "duo-left" | "duo-right";

export interface WorkstationModule {
  /** Panels on the desk, within the computers upgrade's budget. */
  screens: 1 | 2;
  screenLayout: ScreenLayout;
  /** The one small prop, always present (variation picks which, never whether). */
  prop: WorkstationProp;
}

/** Stable per-desk stream key: the iid plus the desk's cells, so a moved desk keeps its identity but
 *  two identical desks never correlate. Pure. */
export function stationKey(item: Pick<PlacedItem, "iid" | "c" | "r">): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < item.iid.length; i++) h = Math.imul(h ^ item.iid.charCodeAt(i), 16777619) >>> 0;
  h = (h ^ Math.imul(item.c + 1, 0x9e3779b1)) >>> 0;
  h = (h ^ Math.imul(item.r + 1, 0x85ebca77)) >>> 0;
  return h >>> 0;
}

/**
 * The authored unit for one desk. `monitors` is the office config's panel budget (1 without the
 * computers upgrade, 2 with it); the unit only ever chooses within it. Deterministic: the same
 * (station, seed, monitors) always resolves to the same module.
 */
export function workstationModuleFor(station: number, runSeed: number, monitors = 2): WorkstationModule {
  const s = (runSeed ^ Math.imul(station >>> 0, 0x9e3779b1)) >>> 0;
  const screens: 1 | 2 = monitors >= 2 && cosmeticHash01(s, 0, MODULE_SALT) > 0.45 ? 2 : 1;
  const screenLayout: ScreenLayout =
    screens === 1 ? "single" : cosmeticHash01(s, 0, MODULE_SALT + 1) < 0.5 ? "duo-left" : "duo-right";
  const propRoll = cosmeticHash01(s, 0, MODULE_SALT + 2);
  const prop: WorkstationProp = propRoll < 0.38 ? "papers" : propRoll < 0.68 ? "plant" : "books";
  return { screens, screenLayout, prop };
}
