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
  beam: string; // exposed wood ceiling beams
  door: string; // sectional garage-door panels
  doorRail: string; // door tracks + dark trim
  baseboard: string; // skirting along wall bottoms
  board: string; // whiteboard surface
}

export function roomPalette(dark: boolean): RoomPalette {
  return dark
    ? {
        floor: "#222731",
        wallA: "#272d37",
        wallB: "#1d222b",
        trim: "#313845",
        desk: "#6e5238",
        deskDark: "#4f3a26",
        metal: "#5a616b",
        metalDark: "#3c4149",
        chest: "#b03a32",
        plant: "#3f8557",
        pot: "#8c5a30",
        screen: "#5b9dff",
        screenOff: "#2a313c",
        lamp: "#ffcf86",
        box: "#9c7c4c",
        shadow: "#05070c",
        floorLine: "#171b22",
        floorPaint: "#c9a23c",
        brick: "#5d3b34",
        brickEdge: "#241712",
        beam: "#4a3826",
        door: "#2b323d",
        doorRail: "#171b22",
        baseboard: "#2b313b",
        board: "#dfe5ec",
      }
    : {
        floor: "#e7e9ee",
        wallA: "#d9dce2",
        wallB: "#ced2d9",
        trim: "#c2c6cd",
        desk: "#bb9067",
        deskDark: "#90694a",
        metal: "#a3a9b2",
        metalDark: "#7b828c",
        chest: "#d8504a",
        plant: "#4e9d6b",
        pot: "#b5743f",
        screen: "#3b82f6",
        screenOff: "#3a4150",
        lamp: "#ffd98a",
        box: "#c8a36b",
        shadow: "#10131c",
        floorLine: "#c4c8cf",
        floorPaint: "#e0b34a",
        brick: "#b07a68",
        brickEdge: "#8a5a4a",
        beam: "#9c7a4f",
        door: "#cfd3da",
        doorRail: "#9aa0a8",
        baseboard: "#c2c6cd",
        board: "#fbfdff",
      };
}
