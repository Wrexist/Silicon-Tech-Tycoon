// Procedural-3D garage palette — fixed character/material colours (intrinsic to objects),
// chosen to read premium in both light and dark UI themes.
export interface RoomPalette {
  floor: string;
  wallA: string;
  wallB: string;
  trim: string;
  desk: string;
  deskDark: string;
  metal: string;
  metalDark: string;
  chest: string;
  plant: string;
  pot: string;
  screen: string;
  screenOff: string;
  lamp: string;
  box: string;
  shadow: string;
  // garage-startup detailing
  floorLine: string; // expansion-joint seams in the concrete
  floorPaint: string; // painted "work zone" outline
  brick: string; // exposed brick accent wall
  brickEdge: string; // mortar / shading between bricks
  door: string; // sectional garage-door panels
  doorRail: string; // door tracks + dark trim
  baseboard: string; // skirting along wall bottoms
  board: string; // whiteboard surface
  // Room-pass detailing: the brand wall, the lower-wall band, the nook rug and the floor pools.
  slat: string; // feature-wall timber slats (lit face)
  slatEdge: string; // the shadow gap behind + between the slats
  signInk: string; // lit wordmark + mark (self-lit, so the sign reads as an installation)
  signGlow: string; // cove / backlight behind the sign
  wainscot: string; // lower wall band — separates wall treatment from wall field
  rail: string; // chair-rail trim sitting on top of the band
  rug: string; // scene-owned nook rug (coffee corner)
  rugTrim: string; // its border
  poolWarm: string; // warm floor light pool
  poolCool: string; // cool floor light pool
  floorField: string; // floor field border (material separation on the slab)
  skyGlass: string; // the studio frontage's glazing — night sky after dark, daylight by day
  skyGlow: string; // its faint self-light
}

// ---- Item 2: palette discipline -----------------------------------------------------------------
// The room reads neutral, and saturation is a signal. Architecture + furniture may only use the
// graphite / charcoal / warm-grey / dark-wood families below; technology is near-black + metal;
// plants are one muted green; lighting is warm white. The ONLY saturated colours left in the
// furniture catalog are the ones with a job: display glow, status LEDs, the plant green and
// self-lit fixtures — every one of them named in SATURATED_ALLOWED with its purpose. Employees are
// deliberately out of scope here: their colours live in robotModels.ts (ROBOT_COLORS) and are
// supposed to pop against this room.
export const CATALOG = {
  // near-black + metal (technology shells, frames, hardware)
  ink: "#15181d",
  charcoal: "#22262c",
  graphite: "#3a3f47",
  slate: "#4a505a",
  steel: "#8a9099",
  steelLight: "#9aa1ab",
  aluminium: "#c0c5cc",
  silver: "#d9dde4",
  chalk: "#eef1f5",
  // warm greys, paper, tan and wood (furniture families)
  warmGrey: "#8a8070",
  paper: "#e8e2d6",
  tan: "#c9a274",
  wood: "#5a4630",
  woodMid: "#cbb38e",
  woodDark: "#9b8568",
  brass: "#8a7a52",
  fabric: "#617c98",
  fabric2: "#7189a1",
  // the one muted green, and a deeper shade of the same family for foliage depth
  plantDeep: "#41674e",
  // purpose colours (saturated by design — each one justified in SATURATED_ALLOWED)
  screen: "#5b9dff",
  screenDim: "#8ecbff",
  screenCyan: "#22cfe6",
  ledOk: "#34c759",
  ledWarn: "#e0a63c",
  ledAlert: "#c4473a",
  glow: "#fff2cc",
} as const;

/** The entire saturated-colour allowlist for `furniture3d.tsx` + `palette.ts`. A hex key here is a
 *  promise that the colour is doing one of these jobs; anything else saturated fails the invariant
 *  test in `palette.test.ts`. Actionable failure: pick a CATALOG neutral, or add the hex here with
 *  its purpose. */
export const SATURATED_ALLOWED: Record<string, string> = {
  "#5b9dff": "display glow — technology (cool)",
  "#4a9af5": "display glow — technology (cool)",
  "#22cfe6": "display glow — holographic/tech accent",
  "#8ecbff": "display glow — dim cool",
  "#34c759": "status indicator — good",
  "#e0a63c": "status indicator — busy / warning",
  "#c4473a": "status indicator — alert",
  "#3f8557": "the one muted green — foliage (dark theme)",
  "#52b070": "the one muted green — foliage (light theme)",
  "#fff2cc": "warm light — glow / lamp glass",
  "#ffcf86": "warm light — lamp / pool (dark theme)",
  "#ffd98a": "warm light — lamp (light theme)",
  "#ffe9c9": "warm light — lit wordmark ink (dark theme)",
  "#ff9d3c": "warm light — brand-wall cove (dark theme)",
  "#ffb054": "warm light — brand-wall cove (light theme)",
  "#ffc46b": "warm light — wordmark ink (light theme)",
  "#ffb877": "warm light — floor pool (dark theme)",
  "#7fb4ff": "cool light — floor pool (dark theme)",
  "#8ec4ff": "cool light — floor pool (light theme)",
  "#d6eaff": "daylight — studio window sky glass (light theme)",
  "#b5d8ff": "daylight — studio window sky glow (light theme)",
  "#2f9e6e": "product — the circuit board travelling the factory line",
  "#3b82f6": "livery — the company blue on the factory truck cab",
};

/** Item 2's rule applied to a live colour: keep the hue and lightness, pull the saturation most of
 *  the way to zero. Used on the fitted glTF catalog's baked materials (in place, no new materials).
 *  Structural type so this stays three-free in the palettes/test layer. */
export function desaturatedColor<T extends { getHSL(t: { h: number; s: number; l: number }): unknown; setHSL(h: number, s: number, l: number): unknown }>(color: T, keep = 0.22): T {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, hsl.s * keep, hsl.l);
  return color;
}

export function roomPalette(dark: boolean): RoomPalette {
  return dark
    ? {
        floor: "#222731",
        wallA: "#272d37",
        wallB: "#1d222b",
        trim: "#313845",
        desk: CATALOG.wood,
        deskDark: CATALOG.woodDark,
        metal: "#5a616b",
        metalDark: "#3c4149",
        chest: CATALOG.slate,
        plant: "#3f8557",
        pot: "#6b5a48",
        screen: "#5b9dff",
        screenOff: "#2a313c",
        lamp: "#ffcf86",
        box: CATALOG.warmGrey,
        shadow: "#05070c",
        floorLine: "#171b22",
        floorPaint: "#8a877e",
        brick: "#5d3b34",
        brickEdge: "#241712",
        door: "#2b323d",
        doorRail: "#171b22",
        baseboard: "#2b313b",
        board: "#dfe5ec",
        slat: "#3b2c1e",
        slatEdge: "#1e1610",
        signInk: "#ffe9c9",
        signGlow: "#ff9d3c",
        wainscot: "#1f242c",
        rail: "#3a4250",
        rug: "#3d3731",
        rugTrim: "#4d453b",
        poolWarm: "#ffb877",
        poolCool: "#7fb4ff",
        floorField: "#1b1f26",
        skyGlass: "#2a313c",
        skyGlow: "#5b9dff",
      }
    : {
        // ONE ROOM, two lightings: the light theme is the same garage BY DAY — warm plaster, natural
        // brick with pale mortar, light steel, the same wood and the same lit sign, so switching
        // theme changes the time of day, not the building. (It used to be a separate white diorama.)
        floor: "#cfcbc4",
        wallA: "#d9d4cb",
        wallB: "#cdc7bd",
        trim: "#bdb6ab",
        desk: "#bb9067",
        deskDark: "#7a5c42",
        metal: "#b8bec6",
        metalDark: "#7f8794",
        chest: "#9aa1ab",
        plant: "#52b070",
        pot: "#b3aa9d",
        screen: "#4a9af5",
        screenOff: "#3a4150",
        lamp: "#ffd98a",
        box: "#c2b39a",
        shadow: "#5f6b7d",
        floorLine: "#b7b1a8",
        floorPaint: "#a49f95",
        brick: "#8f6252",
        brickEdge: "#cdc3b6",
        door: "#c8ccd2",
        doorRail: "#8a9099",
        baseboard: "#b9b2a7",
        board: "#f8f9fb",
        slat: "#5f4630",
        slatEdge: "#2b1e13",
        signInk: "#ffc46b",
        signGlow: "#ffb054",
        wainscot: "#c6bfb4",
        rail: "#aaa397",
        rug: "#cbbda7",
        rugTrim: "#b3a38b",
        poolWarm: "#ffb877",
        poolCool: "#8ec4ff",
        floorField: "#c8c3bb",
        skyGlass: "#d6eaff",
        skyGlow: "#b5d8ff",
      };
}
