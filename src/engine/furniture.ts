// Placeable furniture catalog + a PURE grid-placement model for the office builder.
// No React/three imports — fully unit-testable. The 3D layer renders these by id.

export type FurnitureId =
  // desks
  | "desk" | "deskL" | "standingDesk" | "dualDesk" | "reception" | "executiveDesk"
  // seating
  | "chair" | "armchair" | "sofa" | "stool" | "beanbag" | "gamingChair" | "bench" | "loungeChair" | "sofaL" | "napPod"
  // tables
  | "coffeeTable" | "meetingTable" | "roundTable" | "sideTable" | "barTable"
  // storage
  | "bookshelf" | "cabinet" | "lockers" | "filingCabinet" | "shelfUnit" | "crates" | "wardrobe" | "trophyCase"
  // plants
  | "plantTall" | "plantPot" | "cactus" | "planterBox" | "monstera" | "bonsai" | "indoorTree"
  // decor
  | "rug" | "rugRound" | "tvStand" | "easel" | "neonSign" | "artStand" | "globe" | "floorClock" | "sculpture" | "divider" | "floorVase"
  | "aquarium" | "zenFountain" | "focusPod" | "ideaWall" | "rocketModel" | "mascotStandee"
  // lighting
  | "floorLamp" | "arcLamp" | "lantern" | "cubeLamp" | "treeLamp" | "uplight"
  // fun
  | "arcade" | "pingpong" | "watercooler" | "foosball" | "vending" | "poolTable" | "treadmill" | "guitar" | "coffeeBar"
  | "espressoRobot" | "microKitchen" | "kombuchaTap"
  // tech
  | "serverRack" | "printer" | "robotArm" | "towerPC" | "superCluster" | "holoGlobe" | "quantumRig" | "dronePad"
  // garage
  | "workbench" | "toolCabinet" | "tireStack" | "ladder" | "oilDrum" | "pizzaStack" | "cableSpool";

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

/** Gameplay attributes a piece of furniture contributes to the office (all optional, default 0).
 *  comfort → team happiness (mood) · focus → research speed · inspiration → product design.
 *  Summed across the room and capped (see BALANCE.shop) — a complement to the HQ upgrades. */
export interface FurnitureAttrs {
  comfort?: number;
  focus?: number;
  inspiration?: number;
}

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  category: FurnitureCategory;
  icon: string; // lucide icon name (resolved in the UI)
  w: number; // footprint width in cells at rotation 0
  d: number; // footprint depth in cells at rotation 0
  flat?: boolean; // rugs etc. sit on the floor (others can overlap them)
  cost: number; // price in dollars to buy + place in the office shop
  attrs?: FurnitureAttrs; // gameplay attributes (omitted = pure cosmetic)
  /** Removed from the shop (not purchasable/searchable) but kept in the catalog so saves that
   *  already own one keep rendering + selling it. Never delete a shipped id — retire it. */
  retired?: boolean;
}

// cost = dollars to buy + place. attrs (comfort/focus/inspiration) buff the office (capped in
// BALANCE.shop). Values are the locked v2 table in OFFICE_SHOP_PLAN.md §2.3.
export const FURNITURE: FurnitureDef[] = [
  // ---- Desks (seats + focus) ----
  { id: "desk", name: "Desk", category: "desks", icon: "Table", w: 2, d: 1, cost: 1500, attrs: { focus: 2 } },
  { id: "deskL", name: "L-Desk", category: "desks", icon: "Table2", w: 2, d: 2, cost: 2400, attrs: { focus: 3 } },
  { id: "standingDesk", name: "Standing Desk", category: "desks", icon: "Table", w: 2, d: 1, cost: 2000, attrs: { comfort: 1, focus: 3 } },
  { id: "dualDesk", name: "Dual Setup", category: "desks", icon: "Monitor", w: 2, d: 1, cost: 3500, attrs: { focus: 5 } },
  { id: "executiveDesk", name: "Executive Desk", category: "desks", icon: "Table2", w: 3, d: 2, cost: 8000, attrs: { focus: 4, inspiration: 3 } },
  // ---- Seating (comfort) ----
  { id: "chair", name: "Office Chair", category: "seating", icon: "Armchair", w: 1, d: 1, cost: 300, attrs: { comfort: 1 } },
  { id: "armchair", name: "Armchair", category: "seating", icon: "Armchair", w: 1, d: 1, cost: 700, attrs: { comfort: 2 } },
  { id: "sofa", name: "Sofa", category: "seating", icon: "Sofa", w: 2, d: 1, cost: 1800, attrs: { comfort: 5 } },
  { id: "stool", name: "Bar Stool", category: "seating", icon: "Armchair", w: 1, d: 1, cost: 250, attrs: { comfort: 1 } },
  { id: "beanbag", name: "Bean Bag", category: "seating", icon: "Armchair", w: 1, d: 1, cost: 600, attrs: { comfort: 3 } },
  { id: "gamingChair", name: "Gaming Chair", category: "seating", icon: "Gamepad2", w: 1, d: 1, cost: 1200, attrs: { comfort: 3, focus: 1 } },
  { id: "bench", name: "Bench", category: "seating", icon: "Armchair", w: 2, d: 1, cost: 500, attrs: { comfort: 1 } },
  { id: "loungeChair", name: "Lounge Chair", category: "seating", icon: "Armchair", w: 1, d: 1, cost: 1400, attrs: { comfort: 4 } },
  { id: "sofaL", name: "Sectional Sofa", category: "seating", icon: "Sofa", w: 2, d: 2, cost: 3200, attrs: { comfort: 7 } },
  { id: "napPod", name: "Nap Pod", category: "seating", icon: "BedDouble", w: 2, d: 2, cost: 3800, attrs: { comfort: 8 } },
  // ---- Tables ----
  { id: "coffeeTable", name: "Coffee Table", category: "tables", icon: "Coffee", w: 2, d: 1, cost: 600, attrs: { comfort: 1 } },
  { id: "meetingTable", name: "Meeting Table", category: "tables", icon: "Presentation", w: 3, d: 2, cost: 3000, attrs: { focus: 2, inspiration: 2 } },
  { id: "roundTable", name: "Round Table", category: "tables", icon: "CircleDot", w: 2, d: 2, cost: 1500, attrs: { comfort: 1, inspiration: 1 } },
  { id: "sideTable", name: "Side Table", category: "tables", icon: "Table", w: 1, d: 1, cost: 300, attrs: { comfort: 1 } },
  { id: "barTable", name: "Bar Table", category: "tables", icon: "GlassWater", w: 1, d: 1, cost: 800, attrs: { comfort: 2 } },
  // ---- Storage ----
  { id: "bookshelf", name: "Bookshelf", category: "storage", icon: "BookOpen", w: 1, d: 1, cost: 500, attrs: { focus: 1, inspiration: 1 } },
  { id: "cabinet", name: "Cabinet", category: "storage", icon: "Archive", w: 2, d: 1, cost: 700, attrs: { focus: 1 } },
  { id: "lockers", name: "Lockers", category: "storage", icon: "Box", w: 1, d: 1, cost: 600, attrs: { comfort: 1 } },
  { id: "filingCabinet", name: "Filing Cabinet", category: "storage", icon: "Archive", w: 1, d: 1, cost: 400, attrs: { focus: 1 } },
  { id: "shelfUnit", name: "Shelving Unit", category: "storage", icon: "Library", w: 1, d: 1, cost: 500, attrs: { focus: 1 } },
  { id: "crates", name: "Crates", category: "storage", icon: "Boxes", w: 1, d: 1, cost: 200 },
  { id: "wardrobe", name: "Wardrobe", category: "storage", icon: "Archive", w: 1, d: 1, cost: 700, attrs: { comfort: 1 } },
  { id: "trophyCase", name: "Trophy Case", category: "storage", icon: "Trophy", w: 2, d: 1, cost: 3600, attrs: { inspiration: 5 } },
  // ---- Plants (comfort) ----
  { id: "plantTall", name: "Tall Plant", category: "plants", icon: "Trees", w: 1, d: 1, cost: 700, attrs: { comfort: 3 } },
  { id: "plantPot", name: "Potted Plant", category: "plants", icon: "Sprout", w: 1, d: 1, cost: 200, attrs: { comfort: 2 } },
  { id: "cactus", name: "Cactus", category: "plants", icon: "Sprout", w: 1, d: 1, cost: 150, attrs: { comfort: 1 } },
  { id: "planterBox", name: "Planter Box", category: "plants", icon: "Sprout", w: 2, d: 1, cost: 900, attrs: { comfort: 4 } },
  { id: "monstera", name: "Monstera", category: "plants", icon: "Trees", w: 1, d: 1, cost: 600, attrs: { comfort: 3 } },
  { id: "bonsai", name: "Bonsai", category: "plants", icon: "Sprout", w: 1, d: 1, cost: 400, attrs: { comfort: 2, inspiration: 1 } },
  { id: "indoorTree", name: "Indoor Tree", category: "plants", icon: "TreePine", w: 2, d: 2, cost: 2000, attrs: { comfort: 6 } },
  // ---- Decor (inspiration) ----
  // RETIRED + reclassified from "desks": the reception model is a bare counter with no computer,
  // but as a desk staff were SEATED at it — a worker at an empty counter read as a bug. As decor it
  // never seats anyone (and no longer counts as a hiring seat); retired hides it from the shop
  // while existing owners keep rendering + selling theirs.
  { id: "reception", name: "Reception Desk", category: "decor", icon: "Building2", w: 3, d: 1, cost: 4000, attrs: { focus: 1, inspiration: 2 }, retired: true },
  { id: "rug", name: "Rug", category: "decor", icon: "Square", w: 3, d: 2, flat: true, cost: 900, attrs: { comfort: 2 } },
  { id: "rugRound", name: "Round Rug", category: "decor", icon: "CircleDot", w: 2, d: 2, flat: true, cost: 700, attrs: { comfort: 2 } },
  { id: "tvStand", name: "TV & Stand", category: "decor", icon: "Tv", w: 2, d: 1, cost: 1500, attrs: { comfort: 3 } },
  { id: "easel", name: "Whiteboard", category: "decor", icon: "PencilRuler", w: 1, d: 1, cost: 600, attrs: { focus: 2, inspiration: 1 } },
  { id: "neonSign", name: "Neon Sign", category: "decor", icon: "Zap", w: 1, d: 1, cost: 1200, attrs: { inspiration: 4 } },
  { id: "artStand", name: "Art Canvas", category: "decor", icon: "Image", w: 1, d: 1, cost: 1800, attrs: { inspiration: 5 } },
  { id: "globe", name: "Floor Globe", category: "decor", icon: "Globe", w: 1, d: 1, cost: 800, attrs: { focus: 1, inspiration: 2 } },
  { id: "floorClock", name: "Floor Clock", category: "decor", icon: "Clock", w: 1, d: 1, cost: 1000, attrs: { inspiration: 2 } },
  { id: "sculpture", name: "Sculpture", category: "decor", icon: "Shapes", w: 1, d: 1, cost: 2500, attrs: { inspiration: 6 } },
  { id: "divider", name: "Partition", category: "decor", icon: "Square", w: 2, d: 1, cost: 500, attrs: { focus: 1 } },
  { id: "floorVase", name: "Floor Vase", category: "decor", icon: "Sprout", w: 1, d: 1, cost: 600, attrs: { inspiration: 2 } },
  { id: "aquarium", name: "Reef Aquarium", category: "decor", icon: "Fish", w: 3, d: 1, cost: 9000, attrs: { comfort: 5, inspiration: 4 } },
  { id: "zenFountain", name: "Zen Fountain", category: "decor", icon: "Droplets", w: 2, d: 2, cost: 4200, attrs: { comfort: 4, inspiration: 2 } },
  { id: "focusPod", name: "Focus Pod", category: "decor", icon: "Container", w: 1, d: 1, cost: 2200, attrs: { focus: 4 } },
  { id: "ideaWall", name: "Idea Wall", category: "decor", icon: "Frame", w: 2, d: 1, cost: 1600, attrs: { focus: 2, inspiration: 3 } },
  { id: "rocketModel", name: "Rocket Model", category: "decor", icon: "Rocket", w: 1, d: 1, cost: 2800, attrs: { inspiration: 6 } },
  { id: "mascotStandee", name: "Mascot Standee", category: "decor", icon: "Sparkle", w: 1, d: 1, cost: 250 }, // flavour — cosmetic only
  // ---- Lighting ----
  { id: "floorLamp", name: "Floor Lamp", category: "lighting", icon: "Lamp", w: 1, d: 1, cost: 400, attrs: { comfort: 1 } },
  { id: "arcLamp", name: "Arc Lamp", category: "lighting", icon: "Lamp", w: 1, d: 1, cost: 900, attrs: { comfort: 2, inspiration: 1 } },
  { id: "lantern", name: "Lantern", category: "lighting", icon: "Lightbulb", w: 1, d: 1, cost: 300, attrs: { comfort: 1 } },
  { id: "cubeLamp", name: "Cube Lamp", category: "lighting", icon: "Lightbulb", w: 1, d: 1, cost: 700, attrs: { comfort: 1, inspiration: 1 } },
  { id: "treeLamp", name: "Tree Lamp", category: "lighting", icon: "Lightbulb", w: 1, d: 1, cost: 850, attrs: { comfort: 2, inspiration: 1 } },
  { id: "uplight", name: "Uplight Bar", category: "lighting", icon: "Zap", w: 1, d: 1, cost: 500, attrs: { inspiration: 2 } },
  // ---- Fun (big comfort) ----
  { id: "arcade", name: "Arcade", category: "fun", icon: "Gamepad2", w: 1, d: 1, cost: 4500, attrs: { comfort: 8 } },
  { id: "pingpong", name: "Ping-Pong", category: "fun", icon: "Table2", w: 3, d: 2, cost: 3500, attrs: { comfort: 7 } },
  { id: "watercooler", name: "Water Cooler", category: "fun", icon: "GlassWater", w: 1, d: 1, cost: 800, attrs: { comfort: 3 } },
  { id: "foosball", name: "Foosball", category: "fun", icon: "Users", w: 3, d: 2, cost: 3000, attrs: { comfort: 7 } },
  { id: "vending", name: "Vending Machine", category: "fun", icon: "Refrigerator", w: 1, d: 1, cost: 2000, attrs: { comfort: 5 } },
  { id: "poolTable", name: "Pool Table", category: "fun", icon: "Target", w: 3, d: 2, cost: 6000, attrs: { comfort: 9 } },
  { id: "treadmill", name: "Treadmill", category: "fun", icon: "Footprints", w: 2, d: 1, cost: 2500, attrs: { comfort: 3, focus: 1 } },
  { id: "guitar", name: "Guitar", category: "fun", icon: "Music", w: 1, d: 1, cost: 1200, attrs: { comfort: 3, inspiration: 2 } }, // was $900 — best-value outlier ($180/pt); bumped toward peers
  { id: "coffeeBar", name: "Coffee Bar", category: "fun", icon: "Coffee", w: 2, d: 1, cost: 3000, attrs: { comfort: 6 } },
  { id: "espressoRobot", name: "Barista Bot", category: "fun", icon: "Bot", w: 1, d: 1, cost: 5000, attrs: { comfort: 7 } },
  { id: "microKitchen", name: "Micro-Kitchen", category: "fun", icon: "Utensils", w: 3, d: 1, cost: 4500, attrs: { comfort: 7 } },
  { id: "kombuchaTap", name: "Cold-Brew Tap", category: "fun", icon: "CupSoda", w: 1, d: 1, cost: 1500, attrs: { comfort: 4 } },
  // ---- Tech (focus) ----
  { id: "serverRack", name: "Server Rack", category: "tech", icon: "Server", w: 1, d: 1, cost: 5000, attrs: { focus: 6 } },
  { id: "printer", name: "3D Printer", category: "tech", icon: "Printer", w: 1, d: 1, cost: 4000, attrs: { focus: 4, inspiration: 1 } },
  { id: "robotArm", name: "Robot Arm", category: "tech", icon: "Bot", w: 1, d: 1, cost: 5000, attrs: { focus: 6 } }, // was $6000 — aligned to serverRack's ~$833/focus-pt
  { id: "towerPC", name: "Tower PC", category: "tech", icon: "Monitor", w: 1, d: 1, cost: 3000, attrs: { focus: 5 } },
  { id: "superCluster", name: "GPU Supercluster", category: "tech", icon: "Server", w: 2, d: 1, cost: 8500, attrs: { focus: 9 } },
  { id: "holoGlobe", name: "Holo Globe", category: "tech", icon: "Globe", w: 1, d: 1, cost: 7000, attrs: { focus: 3, inspiration: 5 } },
  { id: "quantumRig", name: "Quantum Rig", category: "tech", icon: "Atom", w: 1, d: 1, cost: 8000, attrs: { focus: 6, inspiration: 2 } },
  { id: "dronePad", name: "Drone Pad", category: "tech", icon: "Radar", w: 2, d: 2, cost: 4800, attrs: { focus: 4, inspiration: 3 } },
  // ---- Garage (focus / theme) ----
  { id: "workbench", name: "Workbench", category: "garage", icon: "Hammer", w: 2, d: 1, cost: 1500, attrs: { focus: 3 } },
  { id: "toolCabinet", name: "Tool Cabinet", category: "garage", icon: "Wrench", w: 1, d: 1, cost: 700, attrs: { focus: 2 } },
  { id: "tireStack", name: "Tire Stack", category: "garage", icon: "Disc", w: 1, d: 1, cost: 200 },
  { id: "ladder", name: "Step Ladder", category: "garage", icon: "Construction", w: 1, d: 1, cost: 150 },
  { id: "oilDrum", name: "Oil Drum", category: "garage", icon: "Cylinder", w: 1, d: 1, cost: 200 },
  { id: "pizzaStack", name: "Pizza Stack", category: "garage", icon: "Boxes", w: 1, d: 1, cost: 120 }, // flavour — cosmetic only
  { id: "cableSpool", name: "Cable Spool", category: "garage", icon: "Disc", w: 1, d: 1, cost: 150 }, // flavour — cosmetic only
];

const BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
export function furnitureDef(id: FurnitureId): FurnitureDef {
  // Fallback keeps a corrupt/legacy layout id from crashing the renderer + grid math.
  return BY_ID[id] ?? FURNITURE[0];
}

/** Shop price (dollars) for a furniture id. */
export function furnitureCost(id: FurnitureId): number {
  return furnitureDef(id).cost;
}

/** Sum every placed item's gameplay attributes (UNCAPPED — the caller applies BALANCE.shop caps).
 *  Pure: the whole office buff is a function of the layout. */
export function officeAttrs(layout: readonly PlacedItem[]): Required<FurnitureAttrs> {
  let comfort = 0, focus = 0, inspiration = 0;
  for (const it of layout) {
    const a = furnitureDef(it.type).attrs;
    if (!a) continue;
    comfort += a.comfort ?? 0;
    focus += a.focus ?? 0;
    inspiration += a.inspiration ?? 0;
  }
  return { comfort, focus, inspiration };
}

// Office ZONES (item 5.5) — where a piece SITS matters, not just that you own it. A desk placed NEXT
// to an amenity (a plant, a lamp, a bit of decor) forms a pleasant little zone that lifts the room's
// comfort/focus/inspiration a touch. PURE + derived from placement (no RNG, no salt). Bounded, and
// exactly ZERO for the default office (its lone desk and plant sit far apart), so a room the player
// never rearranges — and the pinned sim, which never places furniture — is byte-identical.
const AMENITY_CATEGORIES: ReadonlySet<FurnitureCategory> = new Set<FurnitureCategory>(["plants", "lighting", "decor", "fun"]);
const ZONE_PROX_RADIUS = 1;   // Chebyshev cells: an amenity must be immediately beside the desk
const ZONE_MAX_PER_DESK = 2;  // a desk earns from at most this many nearby amenities
const ZONE_COMFORT_PER = 1.5; // raw comfort per desk↔amenity pairing (focus/inspiration are half)

/** The extra comfort/focus/inspiration a layout earns from desks sitting beside amenities. Additive on
 *  top of officeAttrs; the same caps in the state selectors still bound the total. Pure. */
export function officeZoneBonus(layout: readonly PlacedItem[]): Required<FurnitureAttrs> {
  const desks = layout.filter((it) => isDeskType(it.type));
  const amenities = layout.filter((it) => AMENITY_CATEGORIES.has(furnitureDef(it.type).category));
  let pairs = 0;
  for (const d of desks) {
    let near = 0;
    for (const a of amenities) {
      if (Math.max(Math.abs(d.c - a.c), Math.abs(d.r - a.r)) <= ZONE_PROX_RADIUS) near++;
    }
    pairs += Math.min(near, ZONE_MAX_PER_DESK);
  }
  const comfort = pairs * ZONE_COMFORT_PER;
  return { comfort, focus: comfort * 0.5, inspiration: comfort * 0.5 };
}

/** Which desks are actually EARNING the zone bonus, so the builder can show it. `officeZoneBonus`
 *  pays for desks that sit beside an amenity, and nothing in the UI ever said so — the buff bars just
 *  moved. This is the same fold, reported per desk instead of summed, plus the amenity ids doing the
 *  work (they get highlighted too, so the pairing is obvious rather than asserted). Pure. */
export interface DeskZones {
  /** iids of desks with at least one amenity beside them. */
  zoned: string[];
  /** iids of the amenities that are pairing with at least one desk. */
  pairing: string[];
  /** Total desks placed (the denominator in "4 of 6 desks"). */
  desks: number;
  /** Desk↔amenity pairings counted toward the bonus (capped per desk, same as the bonus itself). */
  pairs: number;
  /** How many more amenities the best-placed desks could still earn from (0 when every desk is full). */
  headroom: number;
}

export function deskZones(layout: readonly PlacedItem[]): DeskZones {
  const desks = layout.filter((it) => isDeskType(it.type));
  const amenities = layout.filter((it) => AMENITY_CATEGORIES.has(furnitureDef(it.type).category));
  const zoned: string[] = [];
  const pairing = new Set<string>();
  let pairs = 0;
  let headroom = 0;
  for (const d of desks) {
    const near = amenities.filter((a) => Math.max(Math.abs(d.c - a.c), Math.abs(d.r - a.r)) <= ZONE_PROX_RADIUS);
    const counted = Math.min(near.length, ZONE_MAX_PER_DESK);
    if (counted > 0) {
      zoned.push(d.iid);
      // Only the amenities that are actually paying get highlighted (the cap can leave extras out).
      for (const a of near.slice(0, counted)) pairing.add(a.iid);
    }
    pairs += counted;
    headroom += ZONE_MAX_PER_DESK - counted;
  }
  return { zoned, pairing: [...pairing], desks: desks.length, pairs, headroom };
}

/** The adjacency rule, in one line, for the builder to state outright. */
export const ZONE_RULE = `Put a plant, lamp or bit of decor next to a desk (up to ${ZONE_MAX_PER_DESK}) and that desk earns extra comfort, focus and inspiration.`;

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
    (f) => !f.retired && (f.name.toLowerCase().includes(q) || CATEGORY_LABEL[f.category].toLowerCase().includes(q)),
  );
}

// ---- Grid model ----
// A square floor grid centred on the room. Cells are addressed by (c, r) with the item's
// anchor at its min corner. World units: cell ≈ 0.86m. `GRID.n` is the BASE (Garage) size; the grid
// GROWS with the facility so a bigger building fits more desks + open floor (see gridN below).
export const GRID = { n: 9, cell: 0.86 } as const;

// The office footprint scales with the facility upgrade: Garage → Studio → Campus. Only the cell
// COUNT grows (the cell size is constant), and the grid stays centred on the room, so the whole
// diorama scales symmetrically around the camera and existing furniture keeps its cell coordinates.
// Indexed by facilityTier (1 Garage / 2 Studio / 3 Campus); tier 0 / unknown falls back to the base.
const GRID_N_BY_TIER = [9, 9, 11, 13] as const;
export function gridN(facilityTier = 1): number {
  return GRID_N_BY_TIER[facilityTier] ?? GRID_N_BY_TIER[GRID_N_BY_TIER.length - 1];
}
/** World coord of the grid's min edge for a facility tier (grid stays centred → −half its span). */
export function gridOrigin(facilityTier = 1): number {
  return -(gridN(facilityTier) * GRID.cell) / 2;
}

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

function inBounds(c: number, r: number, w: number, d: number, facilityTier = 1): boolean {
  const n = gridN(facilityTier);
  return c >= 0 && r >= 0 && c + w <= n && r + d <= n;
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
  facilityTier = 1,
): boolean {
  const def = furnitureDef(type);
  const { w, d } = footprint(def, rot);
  if (!inBounds(c, r, w, d, facilityTier)) return false;
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

export function worldOf(item: PlacedItem, facilityTier = 1): { x: number; z: number; rotY: number } {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  const origin = gridOrigin(facilityTier);
  return {
    x: origin + (item.c + w / 2) * GRID.cell,
    z: origin + (item.r + d / 2) * GRID.cell,
    rotY: item.rot * (Math.PI / 2),
  };
}

// ---- Tidy up (auto-arrange) ------------------------------------------------------------------
// The factory floor has had a one-tap auto-router for a while; the office had nothing, so a room
// that grew piece by piece stayed however it grew. `tidyLayout` is the office's equivalent, with one
// deliberate difference: it BUYS NOTHING and SELLS NOTHING. Every iid, type and rotation-eligible
// piece the player owns comes back — only `c`/`r`/`rot` change — so it can never cost a cent and
// Undo restores the old room exactly.
//
// It arranges desks into open rows with a walkway between them, then tucks each desk's amenities
// (plants / lamps / decor / fun) into the cells right beside it — which is exactly what the zone
// bonus pays for. So the tidy is also the teach: run it once and the "good spots" counter jumps,
// which explains the rule better than any tooltip.
//
// PURE + deterministic (fixed scan order, no RNG). Never loses a piece: anything that somehow can't
// be placed keeps its original cell.

/** Rows reserved for desks — every third row, so each desk row has a clear row for its chair, its
 *  amenities and a walkway. */
const TIDY_ROW_STEP = 3;

/** The rows desks are allowed to occupy, top-down. */
function tidyDeskRows(n: number): number[] {
  const rows: number[] = [];
  for (let r = 1; r < n - 1; r += TIDY_ROW_STEP) rows.push(r);
  return rows;
}

/** Columns of one row, ordered from the row's CENTRE outwards, so a half-full row sits in the middle
 *  of the office instead of jammed against the left wall. */
function centredColumns(n: number): number[] {
  const mid = Math.floor(n / 2);
  const out: number[] = [mid];
  for (let d = 1; d <= n; d++) {
    if (mid - d >= 0) out.push(mid - d);
    if (mid + d < n) out.push(mid + d);
  }
  return out;
}

/** Every cell, back rows first, centred within each row — where the non-desk furniture goes. */
function tidyAnchors(n: number): [number, number][] {
  const cols = centredColumns(n);
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++) for (const c of cols) out.push([c, r]);
  return out;
}

/** The ring of cells touching a placed item (orthogonal first, then diagonal) — where an amenity has
 *  to sit to earn that desk its zone bonus. */
function ringAround(item: PlacedItem): [number, number][] {
  const { w, d } = footprint(furnitureDef(item.type), item.rot);
  const orth: [number, number][] = [];
  const diag: [number, number][] = [];
  for (let c = item.c - 1; c <= item.c + w; c++) {
    for (let r = item.r - 1; r <= item.r + d; r++) {
      const inside = c >= item.c && c < item.c + w && r >= item.r && r < item.r + d;
      if (inside) continue;
      const offC = c < item.c || c >= item.c + w;
      const offR = r < item.r || r >= item.r + d;
      (offC && offR ? diag : orth).push([c, r]);
    }
  }
  return [...orth, ...diag];
}

/** Re-arrange a room the player already owns into desk rows with amenities beside them. Returns a NEW
 *  layout with the same items (same iids/types), or the SAME array reference when there is nothing to
 *  arrange (no items), so callers can skip a no-op write. */
export function tidyLayout(layout: readonly PlacedItem[], facilityTier = 1): PlacedItem[] {
  if (layout.length === 0) return layout as PlacedItem[];
  const n = gridN(facilityTier);
  const bySize = (a: PlacedItem, b: PlacedItem) => {
    const fa = furnitureDef(a.type), fb = furnitureDef(b.type);
    // Biggest first (first-fit-decreasing packs far better), then by iid so the result is stable.
    return (fb.w * fb.d) - (fa.w * fa.d) || a.iid.localeCompare(b.iid);
  };
  const desks = layout.filter((it) => isDeskType(it.type)).sort(bySize);
  const amenities = layout
    .filter((it) => !isDeskType(it.type) && AMENITY_CATEGORIES.has(furnitureDef(it.type).category) && !furnitureDef(it.type).flat)
    .sort(bySize);
  const rest = layout
    .filter((it) => !isDeskType(it.type) && !(AMENITY_CATEGORIES.has(furnitureDef(it.type).category) && !furnitureDef(it.type).flat))
    .sort(bySize);

  const out: PlacedItem[] = [];
  /** First-fit an item over `anchors`, un-rotated (rot 0) — desks and amenities read best square-on. */
  const fit = (it: PlacedItem, anchors: [number, number][], rot: Rot = 0): boolean => {
    for (const [c, r] of anchors) {
      if (canPlace(out, it.type, c, r, rot, it.iid, facilityTier)) {
        out.push({ ...it, c, r, rot });
        return true;
      }
    }
    return false;
  };
  const keep = (it: PlacedItem) => { out.push({ ...it }); };

  // 1. Desks spread EVENLY across the reserved rows, each row filled from its centre outwards — so a
  //    six-desk office reads as two open rows of three, not one row crammed against the back wall.
  const anyAnchors = tidyAnchors(n);
  const rows = tidyDeskRows(n);
  const cols = centredColumns(n);
  const perRow = Math.max(1, Math.ceil(desks.length / Math.max(1, rows.length)));
  let placed = 0;
  let rowIdx = 0;
  for (const dk of desks) {
    // Move to the next row once this one has taken its share (the last row absorbs any remainder).
    if (placed >= perRow && rowIdx < rows.length - 1) { rowIdx++; placed = 0; }
    const rowAnchors: [number, number][] = cols.map((c) => [c, rows[rowIdx]] as [number, number]);
    if (fit(dk, rowAnchors)) { placed++; continue; }
    // This row is full (wide desks, or a rug in the way) — try the remaining rows, then anywhere.
    const laterRows: [number, number][] = rows.slice(rowIdx + 1).flatMap((r) => cols.map((c) => [c, r] as [number, number]));
    if (fit(dk, laterRows)) { placed = perRow; continue; }
    if (!fit(dk, anyAnchors)) keep(dk);
  }

  // 2. Amenities beside a desk that still has room to earn — the zone bonus, laid out for you.
  const placedDesks = out.filter((it) => isDeskType(it.type));
  const earned = new Map<string, number>(placedDesks.map((dk) => [dk.iid, 0]));
  for (const am of amenities) {
    let done = false;
    for (const dk of placedDesks) {
      if ((earned.get(dk.iid) ?? 0) >= ZONE_MAX_PER_DESK) continue;
      if (fit(am, ringAround(dk))) {
        earned.set(dk.iid, (earned.get(dk.iid) ?? 0) + 1);
        done = true;
        break;
      }
    }
    // Every desk is already fully paired (or nothing fit beside one) → park it wherever it fits.
    if (!done && !fit(am, anyAnchors)) keep(am);
  }

  // 3. Everything else fills in from the back of the room forward; flats (rugs) never collide.
  for (const it of rest) if (!fit(it, [...anyAnchors].reverse(), it.rot)) keep(it);

  // Return in the ORIGINAL order so anything keyed on layout order (desk assignment via deskItems is
  // iid-sorted, but the 3D scene maps the array) stays stable.
  const byIid = new Map(out.map((it) => [it.iid, it]));
  return layout.map((it) => byIid.get(it.iid) ?? it);
}

/** How many pieces `tidyLayout` would actually move — so the button can say what it will do (and stay
 *  disabled when the room is already tidy). Pure. */
export function tidyMoveCount(layout: readonly PlacedItem[], facilityTier = 1): number {
  const tidied = tidyLayout(layout, facilityTier);
  let moved = 0;
  for (let i = 0; i < layout.length; i++) {
    const a = layout[i], b = tidied[i];
    if (!b || a.c !== b.c || a.r !== b.r || a.rot !== b.rot) moved++;
  }
  return moved;
}

/** Convert a world (x,z) hit point to the anchor cell that centres a w×d footprint there. */
export function cellAt(x: number, z: number, w: number, d: number, facilityTier = 1): { c: number; r: number } {
  const origin = gridOrigin(facilityTier);
  const n = gridN(facilityTier);
  const c = Math.round((x - origin) / GRID.cell - w / 2);
  const r = Math.round((z - origin) / GRID.cell - d / 2);
  return {
    c: Math.max(0, Math.min(n - w, c)),
    r: Math.max(0, Math.min(n - d, r)),
  };
}

// ---- Pure layout operations (return a NEW array, or the same if rejected) ----
export function addItem(layout: PlacedItem[], iid: string, type: FurnitureId, c: number, r: number, rot: Rot, facilityTier = 1): PlacedItem[] {
  if (!canPlace(layout, type, c, r, rot, undefined, facilityTier)) return layout;
  return [...layout, { iid, type, c, r, rot }];
}
export function moveItem(layout: PlacedItem[], iid: string, c: number, r: number, facilityTier = 1): PlacedItem[] {
  const it = layout.find((x) => x.iid === iid);
  if (!it || !canPlace(layout, it.type, c, r, it.rot, iid, facilityTier)) return layout;
  return layout.map((x) => (x.iid === iid ? { ...x, c, r } : x));
}
export function rotateItem(layout: PlacedItem[], iid: string, facilityTier = 1): PlacedItem[] {
  const it = layout.find((x) => x.iid === iid);
  if (!it) return layout;
  const rot = ((it.rot + 1) % 4) as Rot;
  if (!canPlace(layout, it.type, it.c, it.r, rot, iid, facilityTier)) return layout;
  return layout.map((x) => (x.iid === iid ? { ...x, rot } : x));
}
export function removeItem(layout: PlacedItem[], iid: string): PlacedItem[] {
  return layout.filter((x) => x.iid !== iid);
}

/** The starting garage is deliberately BARE — just the founder's desk and a single plant.
 *  Everything else is bought from the office shop (Decorate), which is the whole point: the
 *  player builds the office up. The one desk is the founder's seat; hiring needs another desk.
 *  Collision-checked by the defaultLayout test. (Existing saves keep their own layout.) */
export function defaultLayout(): PlacedItem[] {
  const mk = (i: number, type: FurnitureId, c: number, r: number, rot: Rot = 0): PlacedItem => ({ iid: `f${i}`, type, c, r, rot });
  return [
    mk(1, "dualDesk", 3, 4, 0), // the founder's desk, centred — a proper dual-screen computer setup
    mk(2, "plantPot", 7, 6, 0), // a single touch of green
  ];
}
