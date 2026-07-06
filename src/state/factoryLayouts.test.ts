import { describe, it, expect } from "vitest";
import { dollars } from "../engine/money.ts";
import { MACHINE_DEFS, machineLevel, machineUpgradeStepCost } from "../engine/factoryFloor.ts";
import { MAX_LAYOUTS } from "../engine/factoryLayout.ts";
import { demoFloor, lineComplete, BELT_COST } from "../engine/factoryFloor.ts";
import {
  newGame, buyFloorMachine, buyFloorExpansion, upgradeFloorMachine, autoConnectLine, paintBeltRun,
  moveFloorMachine, moveFactoryProp, buyFactoryProp,
  saveFactoryLayout, applyFactoryLayout, deleteFactoryLayout, factoryLayoutCost,
  type GameState,
} from "./gameState.ts";

// Tests exercise a BUILT floor (new games start bare), so rich() carries the reference demo layout.
const rich = (over: Partial<GameState> = {}): GameState => ({ ...newGame(7), cash: dollars(5_000_000), factoryFloor: demoFloor(), ...over });

describe("saved factory layouts (F: save / name / switch)", () => {
  it("saves a named snapshot of the current floor, and caps the count", () => {
    let s = rich();
    const first = saveFactoryLayout(s, "  Main line  ");
    expect(first.ok).toBe(true);
    expect(first.state.factoryLayouts).toHaveLength(1);
    expect(first.state.factoryLayouts[0].name).toBe("Main line"); // trimmed
    expect(first.state.factoryLayouts[0].expansion).toBe(s.factoryExpansion);

    // An empty name falls back to a numbered default.
    s = saveFactoryLayout(first.state, "").state;
    expect(s.factoryLayouts[1].name).toBe("Layout 2");

    // Fill to the cap, then the next save is refused.
    while (s.factoryLayouts.length < MAX_LAYOUTS) s = saveFactoryLayout(s, "x").state;
    expect(s.factoryLayouts).toHaveLength(MAX_LAYOUTS);
    const over = saveFactoryLayout(s, "one too many");
    expect(over.ok).toBe(false);
    expect(over.state.factoryLayouts).toHaveLength(MAX_LAYOUTS);
  });

  it("gives every layout a UNIQUE id, even across delete + re-save in the same week", () => {
    // Regression: ids used to derive from array length, so save A, save B, delete A, save C reused
    // B's id — delete then removed both, and apply resolved the wrong row.
    let s = rich();
    s = saveFactoryLayout(s, "A").state;
    s = saveFactoryLayout(s, "B").state;
    const bId = s.factoryLayouts[1].id;
    s = deleteFactoryLayout(s, s.factoryLayouts[0].id); // delete A → only B remains (length 1)
    s = saveFactoryLayout(s, "C").state;                // C must NOT reuse B's id
    const ids = s.factoryLayouts.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);         // all unique
    expect(s.factoryLayouts.find((l) => l.id === bId)?.name).toBe("B"); // B still resolvable, untouched
  });

  it("applying an unchanged layout is a free no-op", () => {
    const saved = saveFactoryLayout(rich(), "same");
    const id = saved.state.factoryLayouts[0].id;
    const applied = applyFactoryLayout(saved.state, id);
    expect(applied.ok).toBe(true);
    expect(applied.state.cash).toBe(saved.state.cash); // identical floor → no charge
    expect(factoryLayoutCost(saved.state, saved.state.factoryLayouts[0])).toBe(0);
  });

  it("switching back to a saved layout removes the extra machine and refunds half its cost", () => {
    const base = rich();
    // Add a second assembly arm, then snapshot that richer floor.
    const built = buyFloorMachine(base, "arm", 13, 8);
    expect(built.ok).toBe(true);
    const withBig = saveFactoryLayout(built.state, "big").state;
    // Also snapshot the LEANER (starter) floor from the original state.
    const withLean = saveFactoryLayout(base, "lean").state;
    const leanId = withLean.factoryLayouts[0].id;

    // From the richer floor, apply the lean layout → the extra arm is torn out for a 50% refund.
    const richState: GameState = { ...withBig, factoryLayouts: withLean.factoryLayouts };
    const before = richState.cash;
    const back = applyFactoryLayout(richState, leanId);
    expect(back.ok).toBe(true);
    expect(back.state.factoryFloor.machines).toHaveLength(base.factoryFloor.machines.length);
    expect(back.state.cash).toBe((before + Math.round(MACHINE_DEFS.arm.cost / 2)) as typeof before);
  });

  it("refuses to apply a pricier layout when cash can't cover the retool", () => {
    const built = buyFloorMachine(rich(), "arm", 13, 8);
    const withBig = saveFactoryLayout(built.state, "big");
    const bigId = withBig.state.factoryLayouts[0].id;
    // A broke DEMO floor WITHOUT the extra arm: applying "big" must add (and charge for) the arm.
    const broke: GameState = { ...newGame(7), cash: dollars(1), factoryFloor: demoFloor(), factoryLayouts: withBig.state.factoryLayouts };
    expect(factoryLayoutCost(broke, withBig.state.factoryLayouts[0])).toBe(MACHINE_DEFS.arm.cost);
    const res = applyFactoryLayout(broke, bigId);
    expect(res.ok).toBe(false);
    expect(res.state).toBe(broke); // untouched on refusal
  });

  it("charges the expansion delta and only ever GROWS the floor (never shrinks)", () => {
    // Snapshot a floor expanded twice.
    let wide = rich();
    wide = buyFloorExpansion(wide).state;
    wide = buyFloorExpansion(wide).state;
    expect(wide.factoryExpansion).toBe(2);
    const wideLayout = saveFactoryLayout(wide, "wide").state.factoryLayouts[0];

    // Apply it over a fresh (un-expanded) floor: pay the 50k + 150k expansion delta, floor widens to 2.
    const fresh = rich();
    expect(factoryLayoutCost(fresh, wideLayout)).toBe(dollars(50_000 + 150_000));
    const grown = applyFactoryLayout({ ...fresh, factoryLayouts: [wideLayout] }, wideLayout.id);
    expect(grown.ok).toBe(true);
    expect(grown.state.factoryExpansion).toBe(2);

    // Applying a NARROW (expansion 0) layout over the now-wide floor keeps the width — no shrink.
    const narrowLayout = saveFactoryLayout(rich(), "narrow").state.factoryLayouts[0];
    const kept = applyFactoryLayout({ ...grown.state, factoryLayouts: [narrowLayout] }, narrowLayout.id);
    expect(kept.ok).toBe(true);
    expect(kept.state.factoryExpansion).toBe(2);
  });

  it("upgradeFloorMachine charges the step cost, caps the tier, and gates on cash", () => {
    const base = rich();
    const press = base.factoryFloor.machines.find((m) => m.kind === "press")!;
    const step = machineUpgradeStepCost("press", 1)!;
    const up = upgradeFloorMachine(base, press.c, press.r);
    expect(up.ok).toBe(true);
    expect(up.state.cash).toBe((base.cash - step) as typeof base.cash);
    expect(machineLevel(up.state.factoryFloor.machines.find((m) => m.kind === "press")!)).toBe(2);
    // Can't afford it → refused, state untouched.
    const broke: GameState = { ...base, cash: dollars(1) };
    const no = upgradeFloorMachine(broke, press.c, press.r);
    expect(no.ok).toBe(false);
    expect(no.state).toBe(broke);
  });

  it("a layout with upgraded machines charges the upgrade delta to apply (no free tune-ups)", () => {
    const base = rich();
    const press = base.factoryFloor.machines.find((m) => m.kind === "press")!;
    // Build an upgraded floor and snapshot it.
    const upgraded = upgradeFloorMachine(base, press.c, press.r).state; // press now level 2
    const layout = saveFactoryLayout(upgraded, "tuned").state.factoryLayouts[0];
    // Applying that layout over the un-upgraded base costs exactly the 1→2 step (matching cell + kind).
    const onBase: GameState = { ...base, factoryLayouts: [layout] };
    expect(factoryLayoutCost(onBase, layout)).toBe(machineUpgradeStepCost("press", 1)!);
  });

  it("autoConnectLine rebuilds a complete line from a stripped floor and charges the belt cost", () => {
    const base = rich();
    const stripped: GameState = { ...base, factoryFloor: { ...base.factoryFloor, belts: [] } };
    expect(lineComplete(stripped.factoryFloor)).toBe(false);
    const res = autoConnectLine(stripped);
    expect(res.ok).toBe(true);
    expect(lineComplete(res.state.factoryFloor)).toBe(true);
    expect(res.state.cash).toBeLessThan(stripped.cash); // paid for the new belt tiles
    // With no packer there's nothing to route to → clean refusal, state untouched.
    const noPacker: GameState = { ...base, factoryFloor: { machines: base.factoryFloor.machines.filter((m) => m.kind !== "packer"), belts: [] } };
    const fail = autoConnectLine(noPacker);
    expect(fail.ok).toBe(false);
    expect(fail.state).toBe(noPacker);
  });

  it("paintBeltRun lays a run auto-oriented toward the next cell, charging per NEW tile", () => {
    const empty: GameState = { ...rich(), factoryFloor: { machines: [], belts: [] } };
    const run = [{ c: 2, r: 5 }, { c: 3, r: 5 }, { c: 4, r: 5 }, { c: 4, r: 6 }];
    const res = paintBeltRun(empty, run, "e");
    expect(res.ok).toBe(true);
    expect(res.state.factoryFloor.belts).toHaveLength(4);
    expect(res.state.cash).toBe((empty.cash - 4 * BELT_COST) as typeof empty.cash);
    // Orientation follows the path: east along the row, then south into the turn.
    const at = (c: number, r: number) => res.state.factoryFloor.belts.find((b) => b.c === c && b.r === r)!;
    expect(at(2, 5).dir).toBe("e");
    expect(at(3, 5).dir).toBe("e");
    expect(at(4, 5).dir).toBe("s"); // turns toward the next cell
    expect(at(4, 6).dir).toBe("s"); // last tile continues straight
    // Re-painting the same cells re-aims for free (no new tiles → no charge).
    const again = paintBeltRun(res.state, run, "e");
    expect(again.state.cash).toBe(res.state.cash);
    // Budget cutoff: with only enough for two tiles, a longer run stops after two.
    const broke: GameState = { ...empty, cash: (BELT_COST * 2) as typeof empty.cash };
    const partial = paintBeltRun(broke, run, "e");
    expect(partial.ok).toBe(true);
    expect(partial.state.factoryFloor.belts).toHaveLength(2);
  });

  it("moveFloorMachine / moveFactoryProp relocate for FREE (hold-and-drag), validated", () => {
    const base = rich();
    const press = base.factoryFloor.machines.find((m) => m.kind === "press")!;
    const moved = moveFloorMachine(base, press.id, 6, 3);
    expect(moved.ok).toBe(true);
    expect(moved.state.cash).toBe(base.cash); // rearranging is free
    expect(moved.state.factoryFloor.machines.find((m) => m.id === press.id)).toMatchObject({ c: 6, r: 3 });
    // An illegal spot refuses and leaves state untouched.
    const bad = moveFloorMachine(base, press.id, 0, 1);
    expect(bad.ok).toBe(false);
    expect(bad.state).toBe(base);
    // Props: place one, move it, still free.
    const withProp = buyFactoryProp(base, "plant", 8, 4);
    expect(withProp.ok).toBe(true);
    const prop = withProp.state.factoryProps[0];
    const pMoved = moveFactoryProp(withProp.state, prop.id, 8, 5);
    expect(pMoved.ok).toBe(true);
    expect(pMoved.state.cash).toBe(withProp.state.cash);
    expect(pMoved.state.factoryProps[0]).toMatchObject({ c: 8, r: 5 });
  });

  it("deletes a layout by id", () => {
    const saved = saveFactoryLayout(rich(), "gone").state;
    const id = saved.factoryLayouts[0].id;
    const after = deleteFactoryLayout(saved, id);
    expect(after.factoryLayouts).toHaveLength(0);
    expect(deleteFactoryLayout(saved, "nope")).toBe(saved); // unknown id → unchanged reference
  });
});
