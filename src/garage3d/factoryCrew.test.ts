import { describe, expect, it } from "vitest";
import { MACHINE_DEFS, connectedMachines, demoFloor, machineCells, routeTiles } from "../engine/factoryFloor.ts";
import { machineMounts } from "./machineMounts.ts";
import { factoryCrewSpots } from "./factoryCrew.ts";

const crewFor = (floor: ReturnType<typeof demoFloor>) => {
  const route = routeTiles(floor);
  const mounts = machineMounts(floor, route.length ? route : floor.belts);
  return factoryCrewSpots(floor, mounts, new Set(connectedMachines(floor).map((m) => m.id)));
};

describe("factory crew (F6)", () => {
  it("staffs each connected processing station, not the intake, packer or arm", () => {
    const floor = demoFloor();
    const crew = crewFor(floor);
    const kinds = crew.map((c) => floor.machines.find((m) => m.id === c.id)!.kind);
    expect(crew.length).toBeGreaterThan(0);
    for (const k of kinds) expect(["mill", "press", "screen", "qa"]).toContain(k);
  });

  it("each operator stands inside its own machine's footprint, never on a belt", () => {
    const floor = demoFloor();
    const belts = new Set(floor.belts.map((b) => `${b.c},${b.r}`));
    for (const spot of crewFor(floor)) {
      const m = floor.machines.find((x) => x.id === spot.id)!;
      const cell = `${Math.round(spot.x + 7.5)},${Math.round(spot.z + 4.5)}`;
      expect(machineCells(m)).toContain(cell);
      expect(belts.has(cell)).toBe(false);
      expect(MACHINE_DEFS[m.kind]).toBeDefined();
    }
  });

  it("an unconnected floor has no crew, and the crew is the same every time", () => {
    const floor = demoFloor();
    expect(crewFor({ ...floor, belts: [] })).toEqual([]);
    expect(crewFor(floor)).toEqual(crewFor(demoFloor()));
  });
});
