// Device-specific manufacturing recipes — what a product's build ACTUALLY looks like on the line.
// A phone and a tablet are the same kind of object (a bonded slab), so they share one recipe; a
// laptop is a different machine entirely (milled chassis + hinge + keyboard deck), so it gets its
// own. PURE data + tiny selectors, mirroring the money/catalog discipline; the presentation layer
// (BuildProgress / Factory Mode) maps `icon` keys to Lucide glyphs and drives the visuals off the
// build's completion fraction. The sim never reads this — it's a truthful readout of a run's stage.
import type { CategoryId } from "./types.ts";

/** Families of device that share a build process. Categories map onto one of these. */
export type LineFamily = "slab" | "clamshell" | "tower" | "wearable" | "display";

/** One named step in a device's build.
 *  - `from` — completion fraction (0–1) at which this step becomes the active one.
 *  - `machineStage` — 0..4, which physical Factory-floor machine (intake/press/arm/qa/packer)
 *    lights up during it. Lets a recipe name more sub-steps than there are machines (e.g. a
 *    laptop's "Keyboard & deck" still runs on the assembly arm) without changing the 3D scene.
 *  - `icon` — a stable key the presentation layer maps to a glyph (the engine stays icon-free). */
export interface LineStage {
  from: number;
  key: string;
  label: string;
  sub: string;
  machineStage: 0 | 1 | 2 | 3 | 4;
  icon: string;
}

/** Which build family each device category runs on. Phone + tablet share `slab`; a laptop is a
 *  wholly different line. Console shares the tower build; experimental falls back to the slab line. */
export const FAMILY_OF: Record<CategoryId, LineFamily> = {
  phone: "slab",
  tablet: "slab",
  laptop: "clamshell",
  desktop: "tower",
  console: "tower",
  monitor: "display",
  wearable: "wearable",
  experimental: "slab",
};

// Each recipe: stages sorted by `from` ascending, first at 0, `machineStage` within 0..4.
export const LINE_RECIPES: Record<LineFamily, LineStage[]> = {
  // Phone / tablet — a bonded glass-and-metal slab.
  slab: [
    { from: 0.0, key: "source", label: "Sourcing components", sub: "Chips, panels & cells inbound", machineStage: 0, icon: "source" },
    { from: 0.2, key: "press", label: "Board press", sub: "Stamping the logic boards", machineStage: 1, icon: "press" },
    { from: 0.45, key: "bond", label: "Screen bond", sub: "Fusing the display to the chassis", machineStage: 2, icon: "bond" },
    { from: 0.75, key: "qa", label: "Quality assurance", sub: "Testing every unit", machineStage: 3, icon: "qa" },
    { from: 0.92, key: "pack", label: "Packaging & shipping", sub: "Boxing the run", machineStage: 4, icon: "pack" },
  ],
  // Laptop — milled unibody with a hinge and a keyboard deck. A different machine from a phone.
  clamshell: [
    { from: 0.0, key: "source", label: "Sourcing components", sub: "Alloy, panels & cells inbound", machineStage: 0, icon: "source" },
    { from: 0.16, key: "chassis", label: "Chassis milling", sub: "CNC-cutting the unibody", machineStage: 1, icon: "chassis" },
    { from: 0.4, key: "board", label: "Board & hinge", sub: "Mounting mainboard and hinge", machineStage: 2, icon: "board" },
    { from: 0.62, key: "keyboard", label: "Keyboard & deck", sub: "Fitting deck, keys & trackpad", machineStage: 2, icon: "keyboard" },
    { from: 0.8, key: "qa", label: "Burn-in & QA", sub: "Stress-testing every unit", machineStage: 3, icon: "qa" },
    { from: 0.93, key: "pack", label: "Packaging & shipping", sub: "Boxing the run", machineStage: 4, icon: "pack" },
  ],
  // Desktop / console — a framed enclosure with wiring and cooling.
  tower: [
    { from: 0.0, key: "source", label: "Sourcing components", sub: "Boards, drives & cooling inbound", machineStage: 0, icon: "source" },
    { from: 0.18, key: "chassis", label: "Chassis build", sub: "Framing the enclosure", machineStage: 1, icon: "chassis" },
    { from: 0.42, key: "board", label: "Board install", sub: "Seating the board & modules", machineStage: 2, icon: "board" },
    { from: 0.62, key: "cooling", label: "Cabling & cooling", sub: "Wiring the loom and fans", machineStage: 2, icon: "cooling" },
    { from: 0.8, key: "qa", label: "Burn-in & QA", sub: "Power-cycling every unit", machineStage: 3, icon: "qa" },
    { from: 0.93, key: "pack", label: "Packaging & shipping", sub: "Boxing the run", machineStage: 4, icon: "pack" },
  ],
  // Wearable — a sealed micro-module with sensors and a band.
  wearable: [
    { from: 0.0, key: "source", label: "Sourcing components", sub: "Micro-cells & sensors inbound", machineStage: 0, icon: "source" },
    { from: 0.24, key: "board", label: "Micro-board", sub: "Placing the SiP module", machineStage: 1, icon: "board" },
    { from: 0.5, key: "sensor", label: "Sensors & band", sub: "Fitting sensors and straps", machineStage: 2, icon: "sensor" },
    { from: 0.76, key: "qa", label: "Quality assurance", sub: "Water & fit testing", machineStage: 3, icon: "qa" },
    { from: 0.92, key: "pack", label: "Packaging & shipping", sub: "Boxing the run", machineStage: 4, icon: "pack" },
  ],
  // Monitor — a laminated panel stack with a driver board and colour calibration.
  display: [
    { from: 0.0, key: "source", label: "Sourcing components", sub: "Panels & driver ICs inbound", machineStage: 0, icon: "source" },
    { from: 0.2, key: "panel", label: "Panel lamination", sub: "Bonding the display stack", machineStage: 1, icon: "panel" },
    { from: 0.44, key: "board", label: "Driver board", sub: "Mounting driver & ports", machineStage: 2, icon: "board" },
    { from: 0.66, key: "calibrate", label: "Colour calibration", sub: "Tuning every panel", machineStage: 2, icon: "calibrate" },
    { from: 0.82, key: "qa", label: "Quality assurance", sub: "Dead-pixel & QA scan", machineStage: 3, icon: "qa" },
    { from: 0.93, key: "pack", label: "Packaging & shipping", sub: "Boxing the run", machineStage: 4, icon: "pack" },
  ],
};

/** The ordered build stages for a device category. */
export function lineFor(category: CategoryId): LineStage[] {
  return LINE_RECIPES[FAMILY_OF[category]];
}

/** The active stage for a build at completion fraction `frac` — the last stage whose `from` is
 *  ≤ frac (clamped, so 0 and 1 are always in range). */
export function stageForLine(category: CategoryId, frac: number): LineStage {
  const stages = lineFor(category);
  let active = stages[0];
  for (const cand of stages) if (frac >= cand.from) active = cand;
  return active;
}

/** Index of the active stage within the category's recipe (for the stepper's done/active/todo). */
export function stageIndexForLine(category: CategoryId, frac: number): number {
  const stages = lineFor(category);
  const active = stageForLine(category, frac);
  return stages.indexOf(active);
}
