// glTF model overrides for furniture — the drop-in seam for a real model library.
//
// PREMIUM MODEL LIBRARY: Kenney "Furniture Kit" (CC0 — free to ship, no attribution required).
//   Run once:  npm run furniture:fetch
//   That script downloads the current Kenney Furniture Kit, extracts it, and copies the matched
//   .glb files into `public/furniture/<id>.glb`. After it runs, the items below render as 3D
//   models instead of the parametric versions — SAME category, footprint, and search.
//
// Safety: anything NOT listed here keeps its hand-built parametric look (cohesive + theme-aware),
// and if a registered .glb is missing or fails to load, that item falls back to the parametric
// piece automatically (never a blank tile). So this registry is safe even before the fetch runs.
//
// Tuning: `scale` fits the model to the ~0.86m grid cell, `yaw` orients it to face the room,
// `offset` re-centres it on the tile. Defaults are sensible starting points — fine-tune visually.
//
// Licensing note: only CC0 / permissively-licensed packs may ship in a web/Capacitor app.
// Do NOT use paid Synty / Unity-Store packs — their license forbids redistributing extractable assets.
import type { FurnitureId } from "../engine/furniture.ts";

export interface ModelAsset {
  url: string; // relative to the app public root, e.g. "furniture/sofa.glb"
  scale?: number; // uniform scale to fit the grid cell (default 1)
  yaw?: number; // extra Y rotation in radians to orient it (default 0)
  offset?: [number, number, number]; // re-centre on the tile (default [0,0,0])
}

const u = (id: string): string => `furniture/${id}.glb`;

// Registered to match what `scripts/fetch-furniture.mjs` places. Kenney-only for a cohesive look.
export const MODEL_ASSETS: Partial<Record<FurnitureId, ModelAsset>> = {
  desk: { url: u("desk"), scale: 1 },
  deskL: { url: u("deskL"), scale: 1 },
  chair: { url: u("chair"), scale: 1 },
  armchair: { url: u("armchair"), scale: 1 },
  loungeChair: { url: u("loungeChair"), scale: 1 },
  sofa: { url: u("sofa"), scale: 1 },
  sofaL: { url: u("sofaL"), scale: 1 },
  stool: { url: u("stool"), scale: 1 },
  coffeeTable: { url: u("coffeeTable"), scale: 1 },
  meetingTable: { url: u("meetingTable"), scale: 1 },
  sideTable: { url: u("sideTable"), scale: 1 },
  bookshelf: { url: u("bookshelf"), scale: 1 },
  cabinet: { url: u("cabinet"), scale: 1 },
  shelfUnit: { url: u("shelfUnit"), scale: 1 },
  crates: { url: u("crates"), scale: 1 },
  plantTall: { url: u("plantTall"), scale: 1 },
  plantPot: { url: u("plantPot"), scale: 1 },
  rug: { url: u("rug"), scale: 1 },
  rugRound: { url: u("rugRound"), scale: 1 },
  tvStand: { url: u("tvStand"), scale: 1 },
  floorLamp: { url: u("floorLamp"), scale: 1 },
  arcLamp: { url: u("arcLamp"), scale: 1 },
  lantern: { url: u("lantern"), scale: 1 },
};

export function modelFor(id: FurnitureId): ModelAsset | undefined {
  return MODEL_ASSETS[id];
}
