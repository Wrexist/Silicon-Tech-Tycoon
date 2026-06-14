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
        door: "#2b323d",
        doorRail: "#171b22",
        baseboard: "#2b313b",
        board: "#dfe5ec",
      }
    : {
        floor: "#f6f7f9",
        wallA: "#ebebee",
        wallB: "#e5e6ea",
        trim: "#d5d6da",
        desk: "#bb9067",
        deskDark: "#90694a",
        metal: "#c4c9d0",
        metalDark: "#9095a0",
        chest: "#b0b5bc",
        plant: "#52b070",
        pot: "#c0c5cc",
        screen: "#4a9af5",
        screenOff: "#3a4150",
        lamp: "#ffd98a",
        box: "#c8cdd4",
        shadow: "#8090a8",
        floorLine: "#e0e2e8",
        floorPaint: "#cdd3de",
        brick: "#e0e1e4",
        brickEdge: "#d5d6da",
        door: "#ebebee",
        doorRail: "#c8cdd4",
        baseboard: "#dcdde2",
        board: "#f8f9fb",
      };
}
