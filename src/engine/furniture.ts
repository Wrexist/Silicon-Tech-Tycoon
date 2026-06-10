// Placeable furniture catalog + a PURE grid-placement model for the office builder.
// No React/three imports — fully unit-testable. The 3D layer renders these by id.

export type FurnitureId =
  // desks
  | "desk" | "deskL" | "standingDesk" | "dualDesk" | "reception" | "executiveDesk"
  // seating
  | "chair" | "armchair" | "sofa" | "stool" | "beanbag" | "gamingChair" | "bench" | "loungeChair" | "sofaL"
  // tables
  | "coffeeTable" | "meetingTable" | "roundTable" | "sideTable" | "barTable"
  // storage
  | "bookshelf" | "cabinet" | "lockers" | "filingCabinet" | "shelfUnit" | "crates" | "wardrobe"
  // plants
  | "plantTall" | "plantPot" | "cactus" | "planterBox" | "monstera" | "bonsai"
  // decor
  | "rug" | "rugRound" | "tvStand" | "easel" | "neonSign" | "artStand" | "globe" | "floorClock" | "sculpture" | "divider" | "floorVase"
  // lighting
  | "floorLamp" | "arcLamp" | "lantern" | "cubeLamp"
  // fun
  | "arcade" | "pingpong" | "watercooler" | "foosball" | "vending" | "poolTable" | "treadmill" | "guitar" | "coffeeBar"
  // tech
  | "serverRack" | "printer" | "robotArm" | "towerPC"
  // garage
  | "workbench" | "toolCabinet" | "tireStack" | "ladder" | "oilDrum";

export type FurnitureCategory =
  | "desks"
  | "seating"
  | "tables"
  | "storage"
  | "plants"
  | "decor"
  | "lighting"
  | "fun"
  | "tech"
  | "garage";

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  category: FurnitureCategory;
  icon: string; // lucide icon name (resolved in the UI)
  w: number; // footprint width in cells at rotation 0
  d: number; // footprint depth in cells at rotation 0
  flat?: boolean; // rugs etc. sit on the floor (others can overlap them)
}

export const FURNITURE: FurnitureDef[] = [
  // ---- Desks ----
  { id: "desk", name: "Desk", category: "desks", icon: "Table", w: 2, d: 1 },
  { id: "deskL", name: "L-Desk", category: "desks", icon: "Table2", w: 2, d: 2 },
  { id: "standingDesk", name: "Standing Desk", category: "desks", icon: "Table", w: 2, d: 1 },
  { id: "dualDesk", name: "Dual Setup", category: "desks", icon: "Monitor", w: 2, d: 1 },
  { id: "reception", name: "Reception Desk", category: "desks", icon: "Building2", w: 3, d: 1 },
  { id: "executiveDesk", name: "Executive Desk", category: "desks", icon: "Table2", w: 3, d: 2 },
  // ---- Seating ----
  { id: "chair", name: "Office Chair", category: "seating", icon: "Armchair", w: 1, d: 1 },
  { id: "armchair", name: "Armchair", category: "seating", icon: "Armchair", w: 1, d: 1 },
  { id: "sofa", name: "Sofa", category: "seating", icon: "Sofa", w: 2, d: 1 },
  { id: "stool", name: "Bar Stool", category: "seating", icon: "Armchair", w: 1, d: 1 },
  { id: "beanbag", name: "Bean Bag", category: "seating", icon: "Armchair", w: 1, d: 1 },
  { id: "gamingChair", name: "Gaming Chair", category: "seating", icon: "Gamepad2", w: 1, d: 1 },
  { id: "bench", name: "Bench", category: "seating", icon: "Armchair", w: 2, d: 1 },
  { id: "loungeChair", name: "Lounge Chair", category: "seating", icon: "Armchair", w: 1, d: 1 },
  { id: "sofaL", name: "Sectional Sofa", category: "seating", icon: "Sofa", w: 2, d: 2 },
  // ---- Tables ----
  { id: "coffeeTable", name: "Coffee Table", category: "tables", icon: "Coffee", w: 2, d: 1 },
  { id: "meetingTable", name: "Meeting Table", category: "tables", icon: "Presentation", w: 3, d: 2 },
  { id: "roundTable", name: "Round Table", category: "tables", icon: "CircleDot", w: 2, d: 2 },
  { id: "sideTable", name: "Side Table", category: "tables", icon: "Table", w: 1, d: 1 },
  { id: "barTable", name: "Bar Table", category: "tables", icon: "GlassWater", w: 1, d: 1 },
  // ---- Storage ----
  { id: "bookshelf", name: "Bookshelf", category: "storage", icon: "BookOpen", w: 1, d: 1 },
  { id: "cabinet", name: "Cabinet", category: "storage", icon: "Archive", w: 2, d: 1 },
  { id: "lockers", name: "Lockers", category: "storage", icon: "Box", w: 1, d: 1 },
  { id: "filingCabinet", name: "Filing Cabinet", category: "storage", icon: "Archive", w: 1, d: 1 },
  { id: "shelfUnit", name: "Shelving Unit", category: "storage", icon: "Library", w: 1, d: 1 },
  { id: "crates", name: "Crates", category: "storage", icon: "Boxes", w: 1, d: 1 },
  { id: "wardrobe", name: "Wardrobe", category: "storage", icon: "Archive", w: 1, d: 1 },
  // ---- Plants ----
  { id: "plantTall", name: "Tall Plant", category: "plants", icon: "Trees", w: 1, d: 1 },
  { id: "plantPot", name: "Potted Plant", category: "plants", icon: "Sprout", w: 1, d: 1 },
  { id: "cactus", name: "Cactus", category: "plants", icon: "Sprout", w: 1, d: 1 },
  { id: "planterBox", name: "Planter Box", category: "plants", icon: "Sprout", w: 2, d: 1 },
  { id: "monstera", name: "Monstera", category: "plants", icon: "Trees", w: 1, d: 1 },
  { id: "bonsai", name: "Bonsai", category: "plants", icon: "Sprout", w: 1, d: 1 },
  // ---- Decor ----
  { id: "rug", name: "Rug", category: "decor", icon: "Square", w: 3, d: 2, flat: true },
  { id: "rugRound", name: "Round Rug", category: "decor", icon: "CircleDot", w: 2, d: 2, flat: true },
  { id: "tvStand", name: "TV & Stand", category: "decor", icon: "Tv", w: 2, d: 1 },
  { id: "easel", name: "Whiteboard", category: "decor", icon: "PencilRuler", w: 1, d: 1 },
  { id: "neonSign", name: "Neon Sign", category: "decor", icon: "Zap", w: 1, d: 1 },
  { id: "artStand", name: "Art Canvas", category: "decor", icon: "Image", w: 1, d: 1 },
  { id: "globe", name: "Floor Globe", category: "decor", icon: "Globe", w: 1, d: 1 },
  { id: "floorClock", name: "Floor Clock", category: "decor", icon: "Clock", w: 1, d: 1 },
  { id: "sculpture", name: "Sculpture", category: "decor", icon: "Shapes", w: 1, d: 1 },
  { id: "divider", name: "Partition", category: "decor", icon: "Square", w: 2, d: 1 },
  { id: "floorVase", name: "Floor Vase", category: "decor", icon: "Sprout", w: 1, d: 1 },
  // ---- Lighting ----
  { id: "floorLamp", name: "Floor Lamp", category: "lighting", icon: "Lamp", w: 1, d: 1 },
  { id: "arcLamp", name: "Arc Lamp", category: "lighting", icon: "Lamp", w: 1, d: 1 },
  { id: "lantern", name: "Lantern", category: "lighting", icon: "Lightbulb", w: 1, d: 1 },
  { id: "cubeLamp", name: "Cube Lamp", category: "lighting", icon: "Lightbulb", w: 1, d: 1 },
  // ---- Fun ----
  { id: "arcade", name: "Arcade", category: "fun", icon: "Gamepad2", w: 1, d: 1 },
  { id: "pingpong", name: "Ping-Pong", category: "fun", icon: "Table2", w: 3, d: 2 },
  { id: "watercooler", name: "Water Cooler", category: "fun", icon: "GlassWater", w: 1, d: 1 },
  { id: "foosball", name: "Foosball", category: "fun", icon: "Users", w: 3, d: 2 },
  { id: "vending", name: "Vending Machine", category: "fun", icon: "Refrigerator", w: 1, d: 1 },
  { id: "poolTable", name: "Pool Table", category: "fun", icon: "Target", w: 3, d: 2 },
  { id: "treadmill", name: "Treadmill", category: "fun", icon: "Footprints", w: 2, d: 1 },
  { id: "guitar", name: "Guitar", category: "fun", icon: "Music", w: 1, d: 1 },
  { id: "coffeeBar", name: "Coffee Bar", category: "fun", icon: "Coffee", w: 2, d: 1 },
  // ---- Tech ----
  { id: "serverRack", name: "Server Rack", category: "tech", icon: "Server", w: 1, d: 1 },
  { id: "printer", name: "3D Printer", category: "tech", icon: "Printer", w: 1, d: 1 },
  { id: "robotArm", name: "Robot Arm", category: "tech", icon: "Bot", w: 1, d: 1 },
  { id: "towerPC", name: "Tower PC", category: "tech", icon: "Monitor", w: 1, d: 1 },
  // ---- Garage ----
  { id: "workbench", name: "Workbench", category: "garage", icon: "Hammer", w: 2, d: 1 },
  { id: "toolCabinet", name: "Tool Cabinet", category: "garage", icon: "Wrench", w: 1, d: 1 },
  { id: "tireStack", name: "Tire Stack", category: "garage", icon: "Disc", w: 1, d: 1 },
  { id: "ladder", name: "Step Ladder", category: "garage", icon: "Construction", w: 1, d: 1 },
  { id: "oilDrum", name: "Oil Drum", category: "garage", icon: "Cylinder", w: 1, d: 1 },
];

const BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
export function furnitureDef(id: FurnitureId): FurnitureDef {
  // Fallback keeps a corrupt/legacy layout id from crashing the renderer + grid math.
  return BY_ID[id] ?? FURNITURE[0];
}

export const CATEGORY_ORDER: FurnitureCategory[] = [
  "desks",
  "seating",
  "tables",
  "storage",
  "lighting",
  "plants",
  "decor",
  "fun",
  "tech",
  "garage",
];
export const CATEGORY_LABEL: Record<string, string> = {
  desks: "Desks",
  seating: "Seating",
  tables: "Tables",
  storage: "Storage",
  lighting: "Lighting",
  plants: "Plants",
  decor: "Decor",
  fun: "Fun",
  tech: "Tech",
  garage: "Garage",
};

/** Case-insensitive search across name + category (for the builder search bar). */
export function searchFurniture(query: string): FurnitureDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FURNITURE.filter(
    (f) => f.name.toLowerCase().includes(q) || CATEGORY_LABEL[f.category].toLowerCase().includes(q),
  );
}

// ---- Grid model ----
// A square floor grid centred on the room. Cells are addressed by (c, r) with the item's
// anchor at its min corner. World units: cell ≈ 0.86m.
export const GRID = { n: 9, cell: 0.86 } as const;
const ORIGIN = -(GRID.n * GRID.cell) / 2; // world coord of the grid's min edge

export type Rot = 0 | 1 | 2 | 3;
export interface PlacedItem {
  iid: string;
  type: FurnitureId;
  c: number;
  r: number;
  rot: Rot;
}

/** Footprint (in cells) accounting for 90° rotations. */
export function footprint(def: FurnitureDef, rot: Rot): { w: number; d: number } {
  return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
}

export function inBounds(c: number, r: number, w: number, d: number): boolean {
  return c >= 0 && r >= 0 && c + w <= GRID.n && r + d <= GRID.n;
}

function cellsOf(item: PlacedItem): string[] {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  const out: string[] = [];
  for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) out.push(`${item.c + dc},${item.r + dr}`);
  return out;
}

/** Can `type` be placed at (c,r,rot) without leaving the grid or hitting a solid item?
 *  Flat items (rugs) don't block and can't be blocked. `ignore` skips an item being moved. */
export function canPlace(
  layout: PlacedItem[],
  type: FurnitureId,
  c: number,
  r: number,
  rot: Rot,
  ignore?: string,
): boolean {
  const def = furnitureDef(type);
  const { w, d } = footprint(def, rot);
  if (!inBounds(c, r, w, d)) return false;
  if (def.flat) return true; // rugs go anywhere
  const want = new Set<string>();
  for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) want.add(`${c + dc},${r + dr}`);
  for (const it of layout) {
    if (it.iid === ignore) continue;
    if (furnitureDef(it.type).flat) continue;
    for (const cell of cellsOf(it)) if (want.has(cell)) return false;
  }
  return true;
}

/** World-space centre + Y rotation for a placed item (for the 3D renderer). */
/** Desk-category items are SEATS: one employee works at one placed desk. */
export function isDeskType(type: FurnitureId): boolean {
  return furnitureDef(type).category === "desks";
}

/** The room's desks in a stable order (by placement id), so an employee keeps the same desk
 *  across renders/decorating instead of the team shuffling seats every re-render. */
export function deskItems(layout: readonly PlacedItem[]): PlacedItem[] {
  return layout
    .filter((it) => isDeskType(it.type))
    .sort((a, b) => (parseInt(a.iid.slice(1), 10) || 0) - (parseInt(b.iid.slice(1), 10) || 0));
}

export function worldOf(item: PlacedItem): { x: number; z: number; rotY: number } {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  return {
    x: ORIGIN + (item.c + w / 2) * GRID.cell,
    z: ORIGIN + (item.r + d / 2) * GRID.cell,
    rotY: item.rot * (Math.PI / 2),
  };
}

/** Convert a world (x,z) hit point to the anchor cell that centres a w×d footprint there. */
export function cellAt(x: number, z: number, w: number, d: number): { c: number; r: number } {
  const c = Math.round((x - ORIGIN) / GRID.cell - w / 2);
  const r = Math.round((z - ORIGIN) / GRID.cell - d / 2);
  return {
    c: Math.max(0, Math.min(GRID.n - w, c)),
    r: Math.max(0, Math.min(GRID.n - d, r)),
  };
}

// ---- Pure layout operations (return a NEW array, or the same if rejected) ----
export function addItem(layout: PlacedItem[], iid: string, type: FurnitureId, c: number, r: number, rot: Rot): PlacedItem[] {
  if (!canPlace(layout, type, c, r, rot)) return layout;
  return [...layout, { iid, type, c, r, rot }];
}
export function moveItem(layout: PlacedItem[], iid: string, c: number, r: number): PlacedItem[] {
  const it = layout.find((x) => x.iid === iid);
  if (!it || !canPlace(layout, it.type, c, r, it.rot, iid)) return layout;
  return layout.map((x) => (x.iid === iid ? { ...x, c, r } : x));
}
export function rotateItem(layout: PlacedItem[], iid: string): PlacedItem[] {
  const it = layout.find((x) => x.iid === iid);
  if (!it) return layout;
  const rot = ((it.rot + 1) % 4) as Rot;
  if (!canPlace(layout, it.type, it.c, it.r, rot, iid)) return layout;
  return layout.map((x) => (x.iid === iid ? { ...x, rot } : x));
}
export function removeItem(layout: PlacedItem[], iid: string): PlacedItem[] {
  return layout.filter((x) => x.iid !== iid);
}

/** A tasteful starter layout so the office looks furnished out of the box. */
/** The starting garage — a structured, deliberately-arranged room in three zones:
 *  WORK (center-left): the founder's desk. Desks are SEATS — hiring needs a free one.
 *  GARAGE/STORAGE (back wall): workbench + tools left, shelving + crates right.
 *  LOUNGE (front-right): rug, sofa, coffee table, lounge chair, lamp.
 *  Greenery + water cooler soften the edges. Every placement is collision-checked by the
 *  defaultLayout test, so a refactor here can't ship an overlapping room. */
export function defaultLayout(): PlacedItem[] {
  const mk = (i: number, type: FurnitureId, c: number, r: number, rot: Rot = 0): PlacedItem => ({ iid: `f${i}`, type, c, r, rot });
  return [
    // work zone — the founder's desk, centred and facing the room
    mk(1, "desk", 2, 3, 0),
    // garage zone along the back wall (left)
    mk(2, "workbench", 0, 0, 0),
    mk(3, "toolCabinet", 2, 0, 0),
    // storage along the back wall (right)
    mk(4, "shelfUnit", 8, 0, 0),
    mk(5, "crates", 7, 0, 0),
    // lounge, front-right
    mk(6, "rug", 5, 5, 0),
    mk(7, "sofa", 5, 5, 0),
    mk(8, "coffeeTable", 5, 6, 0),
    mk(9, "loungeChair", 7, 6, 1),
    mk(10, "floorLamp", 8, 5, 0),
    // greenery + water cooler
    mk(11, "plantTall", 0, 8, 0),
    mk(12, "plantPot", 8, 3, 0),
    mk(13, "watercooler", 0, 3, 0),
  ];
}
