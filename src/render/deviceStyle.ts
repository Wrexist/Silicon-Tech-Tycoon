// DeviceStyle — maps a product's chosen components/design/era to exact visual parameters.
// This is the make-or-break system: flagship-render look, never clip-art. PURE.
import { maxTier } from "../engine/catalogs.ts";
import { defaultCameraDesign } from "../engine/types.ts";
import type {
  CameraLayout,
  CameraModuleShape,
  CameraPosition,
  FinishId,
  NotchStyle,
  Product,
} from "../engine/types.ts";

export interface Swatch {
  name: string;
  body: string; // base body color
  bodyLight: string; // gradient light stop (top-left)
  bodyDark: string; // gradient dark stop (bottom-right)
  accent: string; // buttons / camera ring tint
}

// Curated, always-harmonious swatches per finish (NO freeform color wheel — curation is premium).
export const FINISH_SWATCHES: Record<FinishId, Swatch[]> = {
  plastic: [
    { name: "Midnight", body: "#23262d", bodyLight: "#33363d", bodyDark: "#16181d", accent: "#3b82f6" },
    { name: "Coral", body: "#f06b5b", bodyLight: "#ff8474", bodyDark: "#cf5848", accent: "#ffffff" },
    { name: "Mint", body: "#54c2a0", bodyLight: "#6fd9b8", bodyDark: "#3da888", accent: "#ffffff" },
    { name: "Bluebird", body: "#5b8def", bodyLight: "#76a4ff", bodyDark: "#4574d6", accent: "#ffffff" },
    { name: "Lilac", body: "#9b7ede", bodyLight: "#b598ef", bodyDark: "#8167c6", accent: "#ffffff" },
    { name: "Sunburst", body: "#f5b53d", bodyLight: "#ffca5c", bodyDark: "#d99a26", accent: "#23262d" },
  ],
  aluminium: [
    { name: "Silver", body: "#c8cdd4", bodyLight: "#e6e9ed", bodyDark: "#a6acb5", accent: "#5b8def" },
    { name: "Space Grey", body: "#8b9099", bodyLight: "#aab0b8", bodyDark: "#6c7178", accent: "#3b82f6" },
    { name: "Graphite", body: "#5d6168", bodyLight: "#7c8088", bodyDark: "#43464c", accent: "#76a4ff" },
    { name: "Sky", body: "#a9c4e6", bodyLight: "#cadcf3", bodyDark: "#88a8d4", accent: "#3b82f6" },
    { name: "Rose", body: "#e6bcb5", bodyLight: "#f5d6d0", bodyDark: "#cf9f97", accent: "#cf5848" },
    { name: "Sage", body: "#b6c2ab", bodyLight: "#d3ddc9", bodyDark: "#98a78b", accent: "#3da888" },
  ],
  titanium: [
    { name: "Natural Ti", body: "#9b948c", bodyLight: "#c0b9b0", bodyDark: "#746e66", accent: "#d4af37" },
    { name: "Black Ti", body: "#46433f", bodyLight: "#605c57", bodyDark: "#2c2a27", accent: "#a8a29e" },
    { name: "Blue Ti", body: "#6e7a86", bodyLight: "#8d99a6", bodyDark: "#525c66", accent: "#76a4ff" },
    { name: "Desert Ti", body: "#b39a7d", bodyLight: "#d2b896", bodyDark: "#8f7a61", accent: "#f5b53d" },
    { name: "Slate Ti", body: "#7a7d82", bodyLight: "#9a9da2", bodyDark: "#5c5f63", accent: "#c8cdd4" },
  ],
  gold: [
    { name: "Champagne", body: "#d4af37", bodyLight: "#f0d370", bodyDark: "#b08f22", accent: "#23262d" },
    { name: "Rose Gold", body: "#e0a8a0", bodyLight: "#f3cac4", bodyDark: "#c4877e", accent: "#23262d" },
    { name: "Platinum", body: "#d8d6cf", bodyLight: "#efeee9", bodyDark: "#b9b6ad", accent: "#d4af37" },
  ],
};

export interface DeviceVisual {
  finish: FinishId;
  swatch: Swatch;
  metallic: boolean; // gradient body + specular edge
  bezel: number; // 0..1 fraction of the short side
  cornerRadius: number; // 0..1 fraction of the short side
  smoothing: number;
  edgeHighlight: number; // 0..1 rim-light opacity
  screenGlow: number; // 0..1 inner screen luminance
  sheen: number; // 0..1 glass reflection strength
  cameraCount: number; // 0..4
  cameraLayout: CameraLayout;
  cameraPosition: CameraPosition;
  cameraModule: CameraModuleShape;
  cameraFlash: boolean;
  lensQuality: number; // 0..1 from camera tier (lens detail / coating tint)
  notch: NotchStyle;
  eraDetail: number; // 1..4 (chunky retro -> sleek modern)
  buttons: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0..1 progress of a component tier within its line. */
function tierProgress(kind: Parameters<typeof maxTier>[0], tier: number): number {
  const max = maxTier(kind);
  return max <= 1 ? 0 : (tier - 1) / (max - 1);
}

export function deviceVisual(product: Product): DeviceVisual {
  const finish = product.finish;
  const swatches = FINISH_SWATCHES[finish];
  const swatch = swatches[((product.colorIndex % swatches.length) + swatches.length) % swatches.length];

  const cam = product.camera ?? defaultCameraDesign();
  const notch = product.notch ?? "punch";
  const displayTier = product.tiers.display ?? 1;
  const materialsTier = product.tiers.materials ?? 1;
  const cameraTier = product.tiers.camera ?? 0;

  const dispP = tierProgress("display", displayTier);
  const matP = tierProgress("materials", materialsTier);
  const camP = cameraTier > 0 ? tierProgress("camera", cameraTier) : 0;

  // Thinner bezel = more premium (the biggest visual "wow" lever).
  const bezel = lerp(0.085, 0.022, dispP);
  const cornerRadius = lerp(0.14, 0.34, dispP);
  const screenGlow = displayTier >= 5 ? 0.85 : displayTier >= 3 ? 0.55 : 0.28;
  const metallic = finish === "aluminium" || finish === "titanium" || finish === "gold";

  return {
    finish,
    swatch,
    metallic,
    bezel,
    cornerRadius,
    smoothing: 0.6,
    edgeHighlight: metallic ? lerp(0.15, 0.5, matP) : 0.06,
    screenGlow,
    sheen: lerp(0.1, 0.32, dispP),
    cameraCount: cameraTier === 0 ? 0 : Math.min(4, Math.max(1, cam.count)),
    cameraLayout: cam.layout,
    cameraPosition: cam.position,
    cameraModule: cam.module,
    cameraFlash: cam.flash,
    lensQuality: camP,
    notch,
    eraDetail: Math.min(4, Math.max(1, product.designTier <= 1 ? 1 : 4)),
    buttons: true,
  };
}

/** A one-line natural-language description of the rendered device (for VoiceOver / alt text). */
export function describeDevice(product: Product, v: DeviceVisual): string {
  const cam = v.cameraCount > 0 ? `, ${v.cameraCount}-lens camera` : "";
  return `${product.name}: ${v.swatch.name} ${v.finish} ${product.category}${cam}.`;
}
