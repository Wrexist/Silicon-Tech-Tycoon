// The 3D quality setting (Settings → 3D quality; handoff gap O6). One profile drives both worlds, so
// "Low" means the same thing in the office and on the factory floor: fewer pixels, no live shadow
// maps, half-resolution baked contact shadows and no ambient dust. Presentation-only — it changes how
// the scenes draw, never what they show, and nothing in `engine/` can see it.
import { useSettings, type GraphicsPref } from "../state/settings.ts";

export type Quality = "low" | "high";

export interface QualityProfile {
  /** Device-pixel-ratio clamp for the full 3D views (the HQ factory card keeps its own lower cap). */
  dpr: [number, number];
  /** Real-time shadow maps from the key lights. */
  shadows: boolean;
  /** Multiplier on each scene's baked contact-shadow texture size. */
  contactShadowScale: number;
  /** Ambient extras with a per-frame cost (the office's dust motes). */
  dust: boolean;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  high: { dpr: [1, 1.75], shadows: true, contactShadowScale: 1, dust: true },
  low: { dpr: [1, 1.25], shadows: false, contactShadowScale: 0.5, dust: false },
};

/** What the device tells us, when it tells us anything (Safari exposes no `deviceMemory`). */
export interface DeviceHints { cores?: number; memoryGb?: number }

export function deviceHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory };
}

/** "Auto" picks Low only on a clearly weak device (≤ 2 cores or ≤ 2 GB), so every phone that ran the
 *  3D worlds well before keeps exactly the look it had. An explicit choice always wins. */
export function resolveQuality(pref: GraphicsPref, hints: DeviceHints = deviceHints()): Quality {
  if (pref !== "auto") return pref;
  const weak = (hints.cores !== undefined && hints.cores > 0 && hints.cores <= 2)
    || (hints.memoryGb !== undefined && hints.memoryGb > 0 && hints.memoryGb <= 2);
  return weak ? "low" : "high";
}

/** The live profile; re-renders the caller only when the setting changes. */
export function useQuality(): QualityProfile {
  return QUALITY_PROFILES[resolveQuality(useSettings().graphics)];
}
