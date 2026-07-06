import { describe, it, expect } from "vitest";
import {
  FLOOR, MACHINE_DEFS, beltPath, canPlaceBelt, canPlaceMachine, formMarks,
  machineCells, placeBelt, placeMachine, removeAt, starterFloor, worldOf,
} from "./factoryFloor.ts";

const empty = { machines: [], belts: [] };

describe("factory floor grid (F2)", () => {
  it("worldOf centres the grid on the origin", () => {
    const [x0, z0] = worldOf(0, 0);
    const [x1, z1] = worldOf(FLOOR.w - 1, FLOOR.h - 1);
    expect(x0).toBe(-x1);
    expect(z0).toBe(-z1);
  });

  it("machines respect bounds and overlap (machines AND belts)", () => {
    expect(canPlaceMachine(empty, "press", 14, 0)).toBe(false); // 3-wide off the east edge
    const f1 = placeMachine(empty, "arm", 3, 3, "a")!;
    expect(f1).not.toBeNull();
    expect(canPlaceMachine(f1, "qa", 4, 4)).toBe(false); // overlaps the arm's 2×2
    const f2 = placeBelt(f1, 8, 8, "e")!;
    expect(canPlaceMachine(f2, "qa", 8, 8)).toBe(false); // machine can't sit on a belt
  });

  it("belts can't sit on machines; re-placing a belt re-aims it", () => {
    const f1 = placeMachine(empty, "arm", 3, 3, "a")!;
    expect(canPlaceBelt(f1, 4, 4)).toBe(false);
    const f2 = placeBelt(f1, 0, 0, "e")!;
    const f3 = placeBelt(f2, 0, 0, "s")!;
    expect(f3.belts).toHaveLength(1);
    expect(f3.belts[0].dir).toBe("s");
  });

  it("removeAt clears a machine by ANY of its cells, or a single belt tile", () => {
    const f1 = placeBelt(placeMachine(empty, "press", 2, 2, "p")!, 9, 9, "n")!;
    const f2 = removeAt(f1, 4, 3); // press covers c2-4, r2-3
    expect(f2.machines).toHaveLength(0);
    expect(f2.belts).toHaveLength(1);
    expect(removeAt(f2, 9, 9).belts).toHaveLength(0);
  });

  it("beltPath chains directed tiles from the unfed start and runs off the end", () => {
    const belts = [
      { c: 2, r: 2, dir: "e" as const },
      { c: 3, r: 2, dir: "e" as const },
      { c: 4, r: 2, dir: "s" as const },
      { c: 4, r: 3, dir: "s" as const },
    ];
    const path = beltPath(belts);
    expect(path).toHaveLength(5); // 4 tiles + the run-off point
    expect(path[0]).toEqual(worldOf(2, 2));
    const [ex, ez] = worldOf(4, 4); // run-off continues south past the last tile
    expect(path[4]).toEqual([ex, ez]);
  });

  it("the starter floor is valid, fully chained, and covers every machine kind", () => {
    const f = starterFloor();
    for (const m of f.machines) {
      const others = { ...f, machines: f.machines.filter((x) => x.id !== m.id) };
      expect(canPlaceMachine(others, m.kind, m.c, m.r)).toBe(true);
    }
    const path = beltPath(f.belts);
    expect(path.length).toBe(f.belts.length + 1); // one unbroken chain
    const kinds = new Set(f.machines.map((m) => m.kind));
    expect(kinds.size).toBe(Object.keys(MACHINE_DEFS).length);
    const [a, b, c] = formMarks(f, path);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(1);
  });

  it("floor expansion widens the buildable grid east while the base bound stays put", async () => {
    const { canPlaceBelt, canPlaceMachine, floorWidth, EXPAND_STEP } = await import("./factoryFloor.ts");
    const empty = { machines: [], belts: [] };
    // Column 17 is off the base 16-wide grid...
    expect(canPlaceBelt(empty, 17, 5)).toBe(false);
    expect(canPlaceMachine(empty, "qa", 17, 5)).toBe(false);
    // ...but placeable once one expansion widens it.
    const w1 = floorWidth(1);
    expect(w1).toBe(16 + EXPAND_STEP);
    expect(canPlaceBelt(empty, 17, 5, w1)).toBe(true);
    expect(canPlaceMachine(empty, "qa", 17, 5, w1)).toBe(true);
    // The expansion is capped.
    expect(floorWidth(99)).toBe(floorWidth(3));
  });

  it("line speed: starter is neutral, extra arms speed up, a broken line is slower", async () => {
    const { lineSpeedMult, placeMachine } = await import("./factoryFloor.ts");
    const f = starterFloor();
    expect(lineSpeedMult(f)).toBe(1); // complete single-arm starter → baseline unchanged
    const twoArms = placeMachine(f, "arm", 13, 8, "arm2")!; // add a second assembly arm
    expect(lineSpeedMult(twoArms)).toBeLessThan(1);
    const broken = removeAt(f, 7, 6); // sever the bottom lane
    expect(lineSpeedMult(broken)).toBeGreaterThan(1);
  });

  it("per-machine upgrades: cost, level cap, speed bonus, and richer refund", async () => {
    const {
      lineSpeedMult, upgradeMachineAt, machineUpgradeCostAt, machineLevel, machineInvested,
      MACHINE_MAX_LEVEL, demolitionRefund,
    } = await import("./factoryFloor.ts");
    const f = starterFloor();
    const press = f.machines.find((m) => m.kind === "press")!; // starter press, level 1
    expect(machineLevel(press)).toBe(1);
    expect(machineUpgradeCostAt(f, press.c, press.r)).toBe(Math.round(MACHINE_DEFS.press.cost * 0.75)); // 1→2 = 0.75× base
    const up1 = upgradeMachineAt(f, press.c, press.r)!;
    expect(up1).not.toBeNull();
    expect(machineLevel(up1.machines.find((m) => m.kind === "press")!)).toBe(2);
    expect(lineSpeedMult(up1)).toBeLessThan(1); // an upgrade shaves build time below the neutral 1.0

    // Cap at MACHINE_MAX_LEVEL: keep upgrading, then a further upgrade is refused.
    let g = up1;
    for (let i = 0; i < 5; i++) { const n = upgradeMachineAt(g, press.c, press.r); if (n) g = n; }
    expect(machineLevel(g.machines.find((m) => m.kind === "press")!)).toBe(MACHINE_MAX_LEVEL);
    expect(machineUpgradeCostAt(g, press.c, press.r)).toBeNull();
    expect(upgradeMachineAt(g, press.c, press.r)).toBeNull();

    // Demolition refunds half of TOTAL invested (base + upgrades) — more than an un-upgraded machine.
    expect(demolitionRefund(g, press.c, press.r)).toBe(Math.round(machineInvested("press", MACHINE_MAX_LEVEL) / 2));
    expect(demolitionRefund(g, press.c, press.r)).toBeGreaterThan(demolitionRefund(f, press.c, press.r));
    expect(machineUpgradeCostAt(f, 9, 9)).toBeNull(); // empty cell → nothing to upgrade
  });

  it("topology: a floor missing a product's required machine builds it slower; the starter never is", async () => {
    const { lineSpeedMult, missingMachineKinds } = await import("./factoryFloor.ts");
    const { requiredKindsFor } = await import("./assemblyLine.ts");
    const f = starterFloor();
    const phoneReq = requiredKindsFor("phone"); // slab family: intake, press, screen, qa, packer
    // The starter has every machine kind → covers any recipe → no penalty (still neutral ×1).
    expect(missingMachineKinds(f, phoneReq)).toEqual([]);
    expect(lineSpeedMult(f, phoneReq)).toBe(1);
    // Rip out the screen bonder: a phone (which needs it) now builds slower, and the HUD can name it.
    const noScreen = removeAt(f, f.machines.find((m) => m.kind === "screen")!.c, f.machines.find((m) => m.kind === "screen")!.r);
    expect(missingMachineKinds(noScreen, phoneReq)).toContain("screen");
    expect(lineSpeedMult(noScreen, phoneReq)).toBeGreaterThan(lineSpeedMult(noScreen)); // penalty only vs a needed kind
    expect(lineSpeedMult(noScreen, phoneReq)).toBeGreaterThan(1);
    // A laptop (clamshell) doesn't use a screen bonder, so the same floor isn't penalised for it.
    const laptopReq = requiredKindsFor("laptop");
    expect(missingMachineKinds(noScreen, laptopReq)).toEqual([]);
    expect(lineSpeedMult(noScreen, laptopReq)).toBe(1);
  });

  it("auto-route lays a valid Intake→Packer chain around machines, or bails cleanly", async () => {
    const { autoRouteBelts, lineComplete, canPlaceBelt } = await import("./factoryFloor.ts");
    // No intake/packer → nothing to route.
    expect(autoRouteBelts({ machines: [], belts: [] })).toBeNull();
    // A bare intake + packer (belts stripped) auto-routes into a complete, valid line.
    const bare = { machines: starterFloor().machines, belts: [] };
    const routed = autoRouteBelts(bare)!;
    expect(routed).not.toBeNull();
    expect(lineComplete(routed)).toBe(true); // head beside Intake, tail beside Packer
    // Every routed tile is a legal belt cell (on the grid, not on a machine).
    for (const b of routed.belts) {
      const others = { ...routed, belts: routed.belts.filter((x) => x !== b) };
      expect(canPlaceBelt(others, b.c, b.r)).toBe(true);
    }
    // The chain is unbroken (beltChain covers every tile + the run-off point).
    const path = beltPath(routed.belts);
    expect(path.length).toBe(routed.belts.length + 1);
    // It RUNS THROUGH the machines, not around them: every processing machine has a belt beside it.
    const beltCells = new Set(routed.belts.map((b) => `${b.c},${b.r}`));
    const beside = (m: { kind: string; c: number; r: number }) =>
      machineCells(m as { kind: import("./factoryFloor.ts").MachineKind; c: number; r: number }).some((s) => {
        const [mc, mr] = s.split(",").map(Number);
        for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (beltCells.has(`${mc + dc},${mr + dr}`)) return true;
        return false;
      });
    for (const m of routed.machines) expect(beside(m)).toBe(true); // intake, packer AND every station
    // Deterministic: same input → identical route.
    expect(autoRouteBelts(bare)).toEqual(routed);
  });

  it("auto-route lays STRAIGHT lanes — few turns, no staircases (turn-penalised legs)", async () => {
    const { autoRouteBelts, beltChain } = await import("./factoryFloor.ts");
    const bare = { machines: starterFloor().machines, belts: [] };
    const routed = autoRouteBelts(bare)!;
    const chain = beltChain(routed.belts);
    let turns = 0;
    for (let i = 1; i < chain.length; i++) if (chain[i].dir !== chain[i - 1].dir) turns++;
    // The starter's horseshoe needs exactly 2 corners; anything staircasing balloons past 8.
    expect(turns).toBeLessThanOrEqual(4);
    // And no immediate zig-zag anywhere: two direction changes within a 3-tile window reads as a
    // staircase, which is exactly what the turn penalty exists to kill.
    for (let i = 2; i < chain.length; i++) {
      const zig = chain[i].dir !== chain[i - 1].dir && chain[i - 1].dir !== chain[i - 2].dir;
      expect(zig).toBe(false);
    }
  });

  it("machineCells matches the def footprint", () => {
    expect(machineCells({ kind: "press", c: 1, r: 1 })).toHaveLength(MACHINE_DEFS.press.w * MACHINE_DEFS.press.d);
  });
});

describe("F3 — line completeness + demolition refund", () => {
  it("the starter line is complete (intake feeds the head, packer catches the tail)", async () => {
    const { lineComplete } = await import("./factoryFloor.ts");
    expect(lineComplete(starterFloor())).toBe(true);
  });

  it("breaking the chain mid-line makes it incomplete; repairing restores it", async () => {
    const { lineComplete } = await import("./factoryFloor.ts");
    const f = starterFloor();
    const broken = removeAt(f, 7, 6); // a middle tile of the bottom lane
    expect(lineComplete(broken)).toBe(false);
    const repaired = placeBelt(broken, 7, 6, "w")!;
    expect(lineComplete(repaired)).toBe(true);
  });

  it("demolition refunds half the occupant's cost, zero for empty cells", async () => {
    const { demolitionRefund, BELT_COST, MACHINE_DEFS } = await import("./factoryFloor.ts");
    const f = starterFloor();
    expect(demolitionRefund(f, 7, 0)).toBe(Math.round(MACHINE_DEFS.press.cost / 2)); // press cell
    expect(demolitionRefund(f, 5, 2)).toBe(Math.round(BELT_COST / 2)); // belt tile
    expect(demolitionRefund(f, 9, 9)).toBe(0); // empty
  });
});
