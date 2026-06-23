// Aesthetics → demand (Epic G1: "form affects demand"). PURE.
//
// The parametric device render is the centerpiece toy (pillar #2), yet several of its choices — the
// screen notch, the camera module shape + layout, the flash — were purely cosmetic and affected
// NOTHING. That is exactly Automation's self-inflicted "looks don't affect sales" failure, on the one
// system we built the game around. styleAppeal turns a coherent, modern DESIGN LANGUAGE into a bounded
// bonus that lifts the Style/Trend segment's fit only (applied in segments.ts), so form is a real
// lever for design-led buyers — with zero ripple to the global economy.
//
// Note: finish + design tier + refresh rate already feed the `design` STAT (and thus every segment),
// so they are deliberately NOT re-counted here — styleAppeal is purely the otherwise-inert form cues.
import { BALANCE } from "./balance.ts";
import { CATEGORIES } from "./catalogs.ts";
import type { Product } from "./types.ts";

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** 0..maxStyleAppeal — how striking + coherent the device's form is, from the otherwise-cosmetic
 *  render choices. Camera cues only count for categories with a camera; the notch only for categories
 *  with a screen. A fully-considered design (island screen + squircle/pill module + a layout that
 *  suits the lens count + flash) reaches the cap. */
export function styleAppeal(product: Product): number {
  const a = BALANCE.market.aesthetics;
  const slots = CATEGORIES[product.category].slots;
  let s = 0;

  if (slots.includes("display")) {
    s += a.notch[product.notch ?? "none"] ?? 0;
  }

  if (slots.includes("camera") && product.camera) {
    const cam = product.camera;
    s += a.module[cam.module] ?? 0;
    const count = clamp(cam.count ?? 1, 1, 4);
    // A layout that suits the lens count reads intentional; a strip of 3–4 lenses reads cluttered.
    const layoutSuitsCount =
      count >= 3 ? cam.layout === "square" || cam.layout === "triangle"
        : cam.layout === "vertical" || cam.layout === "horizontal";
    if (layoutSuitsCount) s += a.coherentLayoutBonus;
    if (cam.flash) s += a.flashBonus;
  }

  return clamp(s, 0, a.maxStyleAppeal);
}

/** Plain-language label for the design language (UI). */
export function styleAppealLabel(appeal: number): "Dated" | "Plain" | "Clean" | "Striking" {
  const r = appeal / BALANCE.market.aesthetics.maxStyleAppeal;
  if (r >= 0.7) return "Striking";
  if (r >= 0.35) return "Clean";
  return appeal > 0 ? "Plain" : "Dated";
}
