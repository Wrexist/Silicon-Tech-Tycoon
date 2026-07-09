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
  { id: "walnut", name: "Walnut", dark: "#3a281b", light: "#9c7449", lineDark: "#241811", lineLight: "#795731", roughness: 0.66, metalness: 0.0, pattern: "plank" },
  { id: "slate", name: "Slate", dark: "#262b33", light: "#c8cdd4", lineDark: "#191d23", lineLight: "#aab0b8", roughness: 0.5, metalness: 0.1, pattern: "tile" },
  { id: "marble", name: "Marble", dark: "#20242b", light: "#eceef2", lineDark: "#161a20", lineLight: "#d2d6dd", roughness: 0.14, metalness: 0.2, pattern: "tile" },
  { id: "moss", name: "Moss Carpet", dark: "#28362c", light: "#b7c9ac", lineDark: "#28362c", lineLight: "#b7c9ac", roughness: 1.0, metalness: 0.0, pattern: "none" },
  // Appended (saved as numeric indices — never reorder/prepend the rows above).
  { id: "oak", name: "Oak", dark: "#6b4e30", light: "#d8b483", lineDark: "#4a3620", lineLight: "#b89055", roughness: 0.68, metalness: 0.0, pattern: "plank" },
  { id: "checker", name: "Checker", dark: "#232833", light: "#e4e7ec", lineDark: "#12151b", lineLight: "#b7bcc6", roughness: 0.30, metalness: 0.10, pattern: "tile" },
  { id: "neonGrid", name: "Neon Grid", dark: "#141a24", light: "#e9f4fb", lineDark: "#2bd4d0", lineLight: "#3aa0d8", roughness: 0.22, metalness: 0.28, pattern: "grid" },
  { id: "campusCarpet", name: "Campus Carpet", dark: "#2c343a", light: "#c2ccc9", lineDark: "#2c343a", lineLight: "#c2ccc9", roughness: 1.0, metalness: 0.0, pattern: "none" },
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
  { id: "sky", name: "Sky", kind: "paint", dark: "#22303f", light: "#d3e4f2" },
  { id: "sage", name: "Sage", kind: "paint", dark: "#26332a", light: "#d5e3d3" },
  { id: "blush", name: "Blush", kind: "paint", dark: "#3a2830", light: "#f0dfe2" },
  { id: "ocean", name: "Ocean", kind: "paint", dark: "#1e2f3d", light: "#cfe0ee" },
  { id: "charcoal", name: "Charcoal", kind: "concrete", dark: "#23262b", light: "#40454d" },
  // Appended (saved as numeric indices — never reorder/prepend the rows above).
  { id: "whitebrick", name: "Whitewash Brick", kind: "brick", dark: "#4a4d55", light: "#e8e6e2" },
  { id: "navy", name: "Navy", kind: "paint", dark: "#1b2438", light: "#c6d0e6" },
  { id: "terracotta", name: "Terracotta", kind: "paint", dark: "#3d2820", light: "#e4b79a" },
  { id: "felt", name: "Acoustic Felt", kind: "panel", dark: "#2a2e36", light: "#b9bec7" },
];

export function floorFinish(i: number): FloorFinish {
  return FLOOR_FINISHES[i] ?? FLOOR_FINISHES[0];
}
export function wallStyle(i: number): WallStyle {
  return WALL_STYLES[i] ?? WALL_STYLES[0];
}
