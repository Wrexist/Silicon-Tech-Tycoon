// Office configuration seam. Today it derives the same values the scene computed inline. Later
// phases grow visual rules here (era → appearance, tier → pieces) without touching Garage3D.
import { GRID, gridN } from "../engine/furniture.ts";
import { floorFinish, wallStyle, type FloorFinish, type WallStyle } from "../engine/roomStyle.ts";
import type { UpgradeId } from "../engine/upgrades.ts";

export type Upgrades = Partial<Record<UpgradeId, number>>;

/** The slice of run state the office is configured from. GameState structurally satisfies this. */
export interface OfficeState {
  facilityTier: number;
  upgrades: Upgrades;
  roomStyle: { floor: number; wall: number };
  desktops: number;
}

export interface OfficeConfig {
  facilityTier: number;
  upgrades: Upgrades;
  roomStyle: { floor: number; wall: number };
  desktops: number;
  /** Max roaming characters the room renders beyond the seated desks. */
  staffCap: number;
  /** Monitors per workstation (computers upgrade tier). */
  monitors: number;
  amenityTier: number;
  /** Room-shell scale for the facility tier. */
  roomScale: number;
  /** Player-bought pod desktops, clamped to the row's 0–4. */
  podCount: number;
  finish: FloorFinish;
  wall: WallStyle;
  showWhiteboard: boolean;
  /** Scene-owned fixtures an upgrade unlocks. The arranger reserves their cells only when they are
   *  actually drawn, so a light room without the upgrade keeps the space. */
  showEasel: boolean;
  showTestChamber: boolean;
}

// Ceiling on how many overflow employees roam the floor (the seated desks are added on top).
const STAFF_CAP = 16;

const tierOf = (u: Upgrades, id: UpgradeId) => u[id] ?? 0;

export function roomScaleFor(facilityTier: number): number {
  return gridN(facilityTier) / GRID.n;
}

export function officeConfigFor(s: OfficeState): OfficeConfig {
  const u = s.upgrades;
  return {
    facilityTier: s.facilityTier,
    upgrades: u,
    roomStyle: s.roomStyle,
    desktops: s.desktops,
    staffCap: STAFF_CAP,
    monitors: tierOf(u, "computers") >= 2 ? 2 : 1,
    amenityTier: tierOf(u, "amenities"),
    roomScale: roomScaleFor(s.facilityTier),
    podCount: Math.max(0, Math.min(4, s.desktops)),
    finish: floorFinish(s.roomStyle.floor),
    wall: wallStyle(s.roomStyle.wall),
    showWhiteboard: tierOf(u, "computers") >= 1,
    showEasel: tierOf(u, "designSuite") >= 1,
    showTestChamber: tierOf(u, "testLab") >= 1,
  };
}
