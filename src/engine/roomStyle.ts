// Room theming for the office builder — floor finishes + wall styles. PURE data; the 3D layer
// reads these by index. Each option carries a dark + light colour so it stays theme-aware.

export type FloorPattern = "grid" | "plank" | "tile" | "none";

export interface FloorFinish {
  id: string;
  name: string;
  dark: string;
  light: string;
  lineDark: string;
  lineLight: string;
  roughness: number;
  metalness: number;
  pattern: FloorPattern;
}

export const FLOOR_FINISHES: FloorFinish[] = [
  { id: "concrete", name: "Concrete", dark: "#222731", light: "#e7e9ee", lineDark: "#171b22", lineLight: "#c4c8cf", roughness: 0.62, metalness: 0.06, pattern: "grid" },
  { id: "wood", name: "Wood", dark: "#4a3526", light: "#bd9061", lineDark: "#2e2118", lineLight: "#946c40", roughness: 0.7, metalness: 0.0, pattern: "plank" },
  { id: "tile", name: "Tile", dark: "#2a2f38", light: "#d9dde4", lineDark: "#171b22", lineLight: "#b4bac4", roughness: 0.32, metalness: 0.12, pattern: "tile" },
  { id: "carpet", name: "Carpet", dark: "#2c3442", light: "#c4b8a4", lineDark: "#2c3442", lineLight: "#c4b8a4", roughness: 1.0, metalness: 0.0, pattern: "none" },
  { id: "polished", name: "Polished", dark: "#1a1d23", light: "#eef0f4", lineDark: "#0f1115", lineLight: "#d6dae0", roughness: 0.18, metalness: 0.24, pattern: "grid" },
];

export type WallKind = "brick" | "paint" | "concrete" | "panel";

export interface WallStyle {
  id: string;
  name: string;
  kind: WallKind;
  dark: string;
  light: string;
}

export const WALL_STYLES: WallStyle[] = [
  { id: "brick", name: "Brick", kind: "brick", dark: "#5d3b34", light: "#b07a68" },
  { id: "paint", name: "Painted", kind: "paint", dark: "#2b313c", light: "#e6e9ee" },
  { id: "warm", name: "Warm", kind: "paint", dark: "#33291f", light: "#efe6d6" },
  { id: "concrete", name: "Concrete", kind: "concrete", dark: "#30363f", light: "#cdd1d8" },
  { id: "panel", name: "Wood Panel", kind: "panel", dark: "#3a2c1e", light: "#b58a5c" },
];

export function floorFinish(i: number): FloorFinish {
  return FLOOR_FINISHES[i] ?? FLOOR_FINISHES[0];
}
export function wallStyle(i: number): WallStyle {
  return WALL_STYLES[i] ?? WALL_STYLES[0];
}
