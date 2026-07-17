// Single source of truth for content: product categories + component lines/tiers.
// Strongly typed; no stringly-typed lookups. PURE.
import { dollars } from "./money.ts";
import type {
  CategoryDef,
  CategoryId,
  ComponentKind,
  ComponentLine,
  ComponentTier,
  Stats,
} from "./types.ts";

type TierSpec = {
  name: string;
  rd: number; // dollars
  unit: number; // dollars
  era: number;
  contributes: Partial<Stats>;
};

function line(
  kind: ComponentKind,
  displayName: string,
  global: boolean,
  specs: TierSpec[],
): ComponentLine {
  const tiers: ComponentTier[] = specs.map((s, i) => ({
    tier: i + 1,
    name: s.name,
    rdCost: dollars(s.rd),
    unitCost: dollars(s.unit),
    contributes: s.contributes,
    era: s.era,
  }));
  return { kind, displayName, global, tiers };
}

export const COMPONENT_LINES: Record<ComponentKind, ComponentLine> = {
  chip: line("chip", "Chip / SoC", false, [
    { name: "BudgetCore A1", rd: 0, unit: 18, era: 1, contributes: { performance: 16 } },
    { name: "BudgetCore A2", rd: 9_000, unit: 28, era: 1, contributes: { performance: 30 } },
    { name: "FusionCore F1", rd: 45_000, unit: 46, era: 2, contributes: { performance: 48 } },
    { name: "FusionCore F2", rd: 220_000, unit: 70, era: 2, contributes: { performance: 66 } },
    { name: "QuantumCore Q1", rd: 1_400_000, unit: 110, era: 3, contributes: { performance: 84 } },
    { name: "QuantumCore Q2", rd: 9_000_000, unit: 165, era: 4, contributes: { performance: 100 } },
    // Autonomy Era (era 5): a neural co-processor — maxes performance AND lifts on-device ecosystem AI.
    { name: "NeuralCore N1", rd: 42_000_000, unit: 240, era: 5, contributes: { performance: 100, ecosystem: 16 } },
  ]),
  display: line("display", "Display", false, [
    { name: "FlatPanel LCD", rd: 0, unit: 14, era: 1, contributes: { quality: 14, design: 6 } },
    { name: "BrightPanel LCD+", rd: 7_000, unit: 22, era: 1, contributes: { quality: 26, design: 12 } },
    { name: "LumaOLED", rd: 38_000, unit: 38, era: 2, contributes: { quality: 44, design: 22 } },
    { name: "LumaOLED Pro", rd: 190_000, unit: 58, era: 2, contributes: { quality: 60, design: 34 } },
    { name: "MicroLED Edge", rd: 1_200_000, unit: 92, era: 3, contributes: { quality: 80, design: 46 } },
    { name: "MicroLED Infinity", rd: 7_500_000, unit: 140, era: 4, contributes: { quality: 96, design: 58 } },
    // Autonomy Era: a holographic light-field panel — reference quality with a striking design lift.
    { name: "Holo Light-Field", rd: 34_000_000, unit: 215, era: 5, contributes: { quality: 100, design: 76 } },
  ]),
  battery: line("battery", "Battery", false, [
    { name: "CellPack 2K", rd: 0, unit: 6, era: 1, contributes: { battery: 18 } },
    { name: "CellPack 3K", rd: 6_000, unit: 10, era: 1, contributes: { battery: 34 } },
    { name: "DenseCell", rd: 30_000, unit: 16, era: 2, contributes: { battery: 52 } },
    { name: "DenseCell+", rd: 160_000, unit: 24, era: 2, contributes: { battery: 70 } },
    { name: "SolidState SS1", rd: 1_000_000, unit: 40, era: 3, contributes: { battery: 88 } },
    { name: "SolidState SS2", rd: 6_000_000, unit: 60, era: 4, contributes: { battery: 100 } },
    // Autonomy Era: a compact fusion cell — endless endurance with a build-quality halo.
    { name: "MicroFusion Cell", rd: 26_000_000, unit: 96, era: 5, contributes: { battery: 100, quality: 12 } },
  ]),
  materials: line("materials", "Materials", false, [
    { name: "Polycarbonate", rd: 0, unit: 8, era: 1, contributes: { quality: 8, design: 10 } },
    { name: "Anodised Alu", rd: 12_000, unit: 18, era: 1, contributes: { quality: 22, design: 26 } },
    { name: "Aerospace Alu", rd: 70_000, unit: 30, era: 2, contributes: { quality: 36, design: 42 } },
    { name: "Titanium Frame", rd: 400_000, unit: 52, era: 3, contributes: { quality: 52, design: 60 } },
    { name: "Forged Titanium", rd: 3_000_000, unit: 85, era: 4, contributes: { quality: 66, design: 78 } },
    // Autonomy Era: a self-healing graphene lattice — near-perfect fit and finish.
    { name: "Graphene Lattice", rd: 15_000_000, unit: 135, era: 5, contributes: { quality: 84, design: 96 } },
  ]),
  software: line("software", "Software / OS", true, [
    { name: "BasicOS", rd: 0, unit: 0, era: 1, contributes: { ecosystem: 14 } },
    { name: "BasicOS 2", rd: 20_000, unit: 0, era: 1, contributes: { ecosystem: 30 } },
    { name: "Ecosystem OS", rd: 120_000, unit: 0, era: 2, contributes: { ecosystem: 50 } },
    { name: "Ecosystem OS+", rd: 700_000, unit: 0, era: 3, contributes: { ecosystem: 72 } },
    { name: "Unified OS", rd: 5_000_000, unit: 0, era: 4, contributes: { ecosystem: 100 } },
    // Autonomy Era: an agentic OS that anticipates the user — peak ecosystem with a polish halo.
    { name: "Sentient OS", rd: 24_000_000, unit: 0, era: 5, contributes: { ecosystem: 100, quality: 12 } },
  ]),
  camera: line("camera", "Camera", false, [
    { name: "Single 12MP", rd: 0, unit: 9, era: 1, contributes: { quality: 8, design: 6 } },
    { name: "Dual 48MP", rd: 24_000, unit: 18, era: 2, contributes: { quality: 20, design: 16 } },
    { name: "Triple Pro", rd: 180_000, unit: 34, era: 2, contributes: { quality: 34, design: 26 } },
    { name: "Quad Cinematic", rd: 1_100_000, unit: 56, era: 3, contributes: { quality: 48, design: 36 } },
    // Era 4: a computational-photography array (fills the camera line's era-4 gap).
    { name: "Periscope Array", rd: 6_500_000, unit: 84, era: 4, contributes: { quality: 62, design: 48 } },
    // Autonomy Era: a neural imaging sensor — reference-grade capture with a striking design lift.
    { name: "Neural ISP", rd: 22_000_000, unit: 120, era: 5, contributes: { quality: 78, design: 60 } },
  ]),
};

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  phone: {
    id: "phone",
    displayName: "Phone",
    glyph: "Smartphone",
    slots: ["chip", "display", "battery", "materials", "software", "camera"],
    statEmphasis: { performance: 1.0, design: 1.0, ecosystem: 0.9 },
    unlockEra: 1,
    starter: true,
    marketSize: 1.0,
  },
  tablet: {
    id: "tablet",
    displayName: "Tablet",
    glyph: "Tablet",
    slots: ["chip", "display", "battery", "materials", "software", "camera"],
    statEmphasis: { quality: 1.1, battery: 1.0, design: 0.9 },
    unlockEra: 1,
    starter: false,
    marketSize: 0.65,
  },
  laptop: {
    id: "laptop",
    displayName: "Laptop",
    glyph: "Laptop",
    slots: ["chip", "display", "battery", "materials", "software"],
    statEmphasis: { performance: 1.2, battery: 1.0, quality: 1.0 },
    unlockEra: 2,
    starter: false,
    marketSize: 0.55,
  },
  desktop: {
    id: "desktop",
    displayName: "Desktop",
    glyph: "Cpu",
    slots: ["chip", "materials", "software"],
    statEmphasis: { performance: 1.4, ecosystem: 0.9 },
    unlockEra: 2,
    starter: false,
    marketSize: 0.4,
  },
  monitor: {
    id: "monitor",
    displayName: "Monitor",
    glyph: "Monitor",
    slots: ["display", "materials"],
    statEmphasis: { quality: 1.4, design: 1.0 },
    unlockEra: 2,
    starter: false,
    marketSize: 0.45,
  },
  console: {
    id: "console",
    displayName: "Console",
    glyph: "Gamepad2",
    slots: ["chip", "materials", "software"],
    statEmphasis: { performance: 1.3, ecosystem: 1.2 },
    unlockEra: 3,
    starter: false,
    marketSize: 0.7,
  },
  wearable: {
    id: "wearable",
    displayName: "Wearable",
    glyph: "Watch",
    slots: ["chip", "display", "battery", "materials", "software"],
    statEmphasis: { design: 1.3, battery: 1.1, ecosystem: 1.0 },
    unlockEra: 3,
    starter: false,
    marketSize: 0.6,
  },
  experimental: {
    id: "experimental",
    displayName: "AR Glasses",
    glyph: "Glasses",
    slots: ["chip", "display", "battery", "materials", "software", "camera"],
    statEmphasis: { performance: 1.2, design: 1.3, ecosystem: 1.2 },
    unlockEra: 4,
    starter: false,
    marketSize: 0.5,
  },
  // --- Autonomy Era (era 5, post-IPO) — the frontier categories the Frontier-Tech grind unlocks ---
  neuralband: {
    id: "neuralband",
    displayName: "Neural Band",
    glyph: "BrainCircuit",
    // A non-invasive brain-computer interface band: no display of its own; it lives on chip + platform.
    slots: ["chip", "battery", "materials", "software", "camera"],
    statEmphasis: { performance: 1.2, ecosystem: 1.35, design: 1.05 },
    unlockEra: 5,
    starter: false,
    marketSize: 0.45,
  },
  robot: {
    id: "robot",
    displayName: "Home Robot",
    glyph: "Bot",
    slots: ["chip", "battery", "materials", "software", "camera"],
    statEmphasis: { performance: 1.3, ecosystem: 1.1, quality: 1.15 },
    unlockEra: 5,
    starter: false,
    marketSize: 0.55,
  },
};

export const CATEGORY_LIST: CategoryDef[] = Object.values(CATEGORIES);

export function maxTier(kind: ComponentKind): number {
  return COMPONENT_LINES[kind].tiers.length;
}

export function tierDef(kind: ComponentKind, tier: number): ComponentTier | undefined {
  return COMPONENT_LINES[kind].tiers[tier - 1];
}
