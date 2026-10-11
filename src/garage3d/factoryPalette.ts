import { CATALOG } from "./palette.ts";

// The factory world's materials, drawn from the SAME families as the office (palette.ts CATALOG), so
// switching between the Office and Factory tabs reads as one studio instead of two games: graphite /
// charcoal / slate shells, steel and aluminium metal, ink devices, tan cartons. The only saturated
// entries are purpose colours (displays, status, the product's board, the company livery), each one
// allowlisted with its job in SATURATED_ALLOWED — `factoryPalette.test.ts` holds that line.
//
// The machines wear the office robots' product language: satin white housings, graphite structure
// (bases, columns, booms), smoked dark glass, bright aluminium on every moving part, and the andon
// strip as the one colour that changes (era accent while working, amber hum otherwise).
export const FACTORY_PALETTE = {
  groundNight: CATALOG.charcoal,   // the grounds around the building, dark theme
  groundDay: CATALOG.silver,       // …and by day
  pad: CATALOG.charcoal,
  concrete: CATALOG.steel,         // poured-concrete floor (the player can repaint it)
  concreteJoint: CATALOG.slate,    // expansion joints / build grid
  wallTrim: CATALOG.graphite,      // wall skirting / base course
  wallTop: CATALOG.aluminium,      // capping rail on the walls
  beltBed: CATALOG.slate,
  beltFrame: CATALOG.graphite,     // metal side frame of the conveyor
  beltRubber: CATALOG.charcoal,    // dark rubber belt surface
  rollerHi: CATALOG.steel,         // polished metal roller
  rail: CATALOG.slate,
  roller: CATALOG.graphite,
  machine: CATALOG.graphite,       // machine structure: plinths, columns, booms, joints
  machineHi: CATALOG.slate,
  housing: CATALOG.chalk,          // satin white machine housings (the robots' shell white)
  smoke: CATALOG.ink,              // smoked dark glass bands and display bezels
  metal: CATALOG.aluminium,        // the moving metal: pistons, spindle bits, packer plates, fingers
  dark: CATALOG.charcoal,
  accent: CATALOG.screen,          // working-machine glow (the era accent overrides it live)
  amber: CATALOG.ledWarn,          // overtime
  hazard: CATALOG.ledWarn,         // hazard striping
  crate: CATALOG.tan,              // cartons on the pallet
  slab: CATALOG.steelLight,
  board: "#2f9e6e",                // the circuit board travelling the line (product, allowlisted)
  device: CATALOG.ink,
  screen: CATALOG.screen,
  truck: CATALOG.silver,
  cab: "#3b82f6",                  // the company livery on the truck cab (allowlisted)
  agv: CATALOG.chalk,              // the AGVs are white housings too; the beacon carries their status
  beacon: CATALOG.ledOk,           // an AGV running normally (amber in overtime)
  palletWood: CATALOG.wood,
  palletSlat: CATALOG.woodDark,
  road: CATALOG.charcoal,
  dropOk: CATALOG.ledOk,           // hold-to-move: legal drop cells / valid footprint
  dropBad: CATALOG.ledAlert,       // hold-to-move: footprint over an illegal spot
} as const;
