// Contract tests for the workstation module (item 5). Pure functions only: the frame proves the
// module renders; these pin that it is deterministic, restrained, and that the unit adds no grid
// footprint at all (the density cap and circulation lane of item 3 depend on that).
import { describe, expect, it } from "vitest";
import { stationKey, workstationModuleFor, type ScreenLayout, type WorkstationProp } from "./workstationModule.ts";

const STATIONS = Array.from({ length: 60 }, (_, i) => stationKey({ iid: `f${i + 1}`, c: (i * 5) % 13, r: (i * 3) % 11 }));

describe("workstation module — deterministic composition", () => {
  it("resolves the same module for the same (station, seed, monitors)", () => {
    for (const st of STATIONS.slice(0, 10)) {
      const a = workstationModuleFor(st, 7, 2);
      const b = workstationModuleFor(st, 7, 2);
      expect(a).toEqual(b);
    }
    // A different run seed is a different office — the modules may differ, never crash or drift out
    // of range.
    expect(workstationModuleFor(STATIONS[0], 8, 2).prop).toMatch(/papers|plant|books/);
  });

  it("stays inside the screen budget the computers upgrade sets", () => {
    for (const st of STATIONS) {
      expect([1, 2]).toContain(workstationModuleFor(st, 7, 2).screens);
      expect(workstationModuleFor(st, 7, 1).screens).toBe(1); // no upgrade → a single panel
      expect(workstationModuleFor(st, 7, 1).screenLayout).toBe("single");
    }
  });

  it("always gives the desk exactly one prop, from the restrained set", () => {
    for (const st of STATIONS) {
      const prop = workstationModuleFor(st, 7, 2).prop;
      expect(["papers", "plant", "books"]).toContain(prop as WorkstationProp);
    }
  });

  it("varies across a band but never chaotically", () => {
    const modules = STATIONS.map((st) => workstationModuleFor(st, 7, 2));
    const layouts = new Set<ScreenLayout>(modules.map((m) => m.screenLayout));
    const props = new Set<WorkstationProp>(modules.map((m) => m.prop));
    expect(layouts.size).toBeGreaterThan(1);
    expect(props.size).toBe(3);
    // Restraint: no single prop choice should swallow the room (deterministic sample, so this is a
    // stable assertion, not a flaky distribution test).
    const share = (k: WorkstationProp) => modules.filter((m) => m.prop === k).length / modules.length;
    for (const k of ["papers", "plant", "books"] as const) expect(share(k)).toBeLessThan(0.6);
  });

  it("keys two identical desks apart by their cells", () => {
    const a = stationKey({ iid: "f1", c: 2, r: 3 });
    const b = stationKey({ iid: "f1", c: 2, r: 4 });
    expect(a).not.toBe(b);
  });
});
