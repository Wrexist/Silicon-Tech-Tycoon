// Material identity for the fitted glTF furniture catalog.
//
// The Kenney models ship with baked, saturated paint (a salmon sofa, a blue-grey desk). A previous
// pass pulled EVERY material's saturation to ~0.22 with no other change, which removed the hue but
// also flattened wood, painted metal, fabric and foliage into one grey. The palette policy (neutrals
// + one accent) is right; the failure was expressing it as a single tone instead of as MATERIAL
// FAMILIES with distinct physical responses.
//
// This table is the deliberate, reversible mapping: each source material name in the shipped
// `public/furniture/*.glb` files maps to one family, and each family carries its own saturation
// budget plus roughness/metalness, so wood ≠ painted metal ≠ fabric by touch as well as tone. The
// mapping is by NAME, not a blanket desaturation, and `familyForMaterial` names its fallback so an
// unmapped material is visible in the audit test rather than silently grey.
//
// Kept three-free (structural colour type) so the family table is unit-testable in Node.

/** The physical families the fitted catalog may use. */
export type MaterialFamily = "wood" | "metal" | "fabric" | "foliage" | "glow" | "neutral";

export interface MaterialFamilySpec {
  /** Fraction of the source colour's saturation that survives (hue + lightness are preserved). */
  keep: number;
  roughness: number;
  metalness: number;
  /** Self-lit families (lamp glass, screens) keep their warm/cool glow. */
  emissive?: boolean;
  /** What the family is for — read by the audit test and shown in failure messages. */
  role: string;
}

/** The family palette. Distinct roughness/metalness is the point: a wood surface and a metal frame
 *  must not respond to light identically even when their tones are close. */
export const MATERIAL_FAMILIES: Readonly<Record<MaterialFamily, MaterialFamilySpec>> = {
  wood: { keep: 0.5, roughness: 0.62, metalness: 0, role: "work surfaces + solid wood bodies" },
  metal: { keep: 0.12, roughness: 0.34, metalness: 0.72, role: "frames, legs, hardware, painted metal" },
  fabric: { keep: 0.35, roughness: 0.88, metalness: 0, role: "seating, rugs and woven textiles" },
  foliage: { keep: 0.85, roughness: 0.85, metalness: 0, role: "the one plant green" },
  glow: { keep: 1, roughness: 0.3, metalness: 0, emissive: true, role: "lamp glass and lit screens" },
  neutral: { keep: 0.1, roughness: 0.8, metalness: 0, role: "unlabelled / default material" },
};

/** Source material name → family. Keys are the material names authored into the Kenney GLBs
 *  (`wood`, `metal`, `carpet`, `plant`, `lamp`, a few variants). Add a row here when a new asset
 *  lands — an unmapped name falls back to `neutral` and the audit test flags it. */
export const MATERIAL_FAMILY_BY_NAME: Readonly<Record<string, MaterialFamily>> = {
  wood: "wood",
  woodDark: "wood",
  metal: "metal",
  metalMedium: "metal",
  carpet: "fabric",
  carpetBlue: "fabric",
  carpetDarker: "fabric",
  plant: "foliage",
  lamp: "glow",
  _defaultMat: "neutral",
  base: "neutral",
};

/** The documented fallback for a material this table does not name. */
export const UNMAPPED_FAMILY: MaterialFamily = "neutral";

/** Name → family, stripping any `#rrggbb` suffix a loader may append. Pure. */
export function familyForMaterial(name: string): MaterialFamily {
  const base = name.replace(/#[0-9a-fA-F]{3,8}$/, "").trim();
  return MATERIAL_FAMILY_BY_NAME[base] ?? UNMAPPED_FAMILY;
}

/** The subset of a three material this module touches — structural so the module stays three-free. */
interface ColorLike {
  getHSL(t: { h: number; s: number; l: number }): unknown;
  setHSL(h: number, s: number, l: number): unknown;
  copy(c: ColorLike): unknown;
}

export interface FamilyMaterial {
  name?: string;
  color?: ColorLike;
  emissive?: ColorLike;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}

/**
 * Apply a family's response to one material, IN PLACE (no new material/colour allocated). The
 * source hue and lightness survive at the family's saturation budget, and the physical response is
 * set from the family. `desaturate` is injected by the caller so this module needs no import of the
 * palette's three-aware helper. Pure aside from the material it is handed.
 */
export function applyMaterialFamily(
  mat: FamilyMaterial,
  desaturate: (c: ColorLike, keep: number) => ColorLike,
  family: MaterialFamily = familyForMaterial(mat.name ?? ""),
): MaterialFamily {
  const spec = MATERIAL_FAMILIES[family];
  if (mat.color) desaturate(mat.color, spec.keep);
  mat.roughness = spec.roughness;
  mat.metalness = spec.metalness;
  if (spec.emissive && mat.emissive && mat.color) {
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = 0.85;
  }
  return family;
}
