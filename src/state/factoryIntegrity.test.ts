import { describe, expect, it } from 'vitest';
import { type GameState, newGame, buyFloorMachine, buyFloorExpansion, autoConnectLine, applyFactorySnapshot, acceptSideOrder, advanceOneWeek, saveFactoryLayout, factoryLayoutCost, moveFloorMachine, clearFloorCell } from './gameState.ts';
import { dollars } from '../engine/money.ts';
import { lineComplete, demoFloor, lineSpeedMult, placeMachine, autoRouteBelts } from '../engine/factoryFloor.ts';
import { parseSaveJson } from './persistence.ts';
import { generateSideOrder } from '../engine/sideOrders.ts';
import { hasFactoryAccess } from './factorySummary.ts';

describe('factory ownership and transaction integrity', () => {
  it('opens the factory from week zero and keeps it accessible after production', () => {
    const fresh = newGame(7);
    expect(hasFactoryAccess(fresh)).toBe(true);
    expect(hasFactoryAccess({ ...fresh, building: [{}] })).toBe(true);
    expect(hasFactoryAccess({ ...fresh, ready: [{}] })).toBe(true);
    expect(hasFactoryAccess({ ...fresh, launched: [{}] })).toBe(true);
  });
  it('erasing an empty cell does not change ownership, cash or the edit ledger', () => {
    const original = newGame(7);
    expect(clearFloorCell(original, 14, 8)).toBe(original);
  });
  it('repairs a stale office counter without changing existing furniture', () => {
    const original = newGame(7);
    original.furnitureCounter = 1;
    const restored = parseSaveJson(JSON.stringify(original))!;
    expect(restored.layout).toEqual(original.layout);
    expect(restored.furnitureCounter).toBeGreaterThan(6);
  });
  it('Auto preserves every purchased intake and packer', () => {
    let s = { ...newGame(7), cash: dollars(5_000_000) };
    s = buyFloorMachine(s, 'intake', 5, 1).state;
    s = buyFloorMachine(s, 'packer', 9, 6).state;
    const result = autoConnectLine(s);
    expect(result.ok).toBe(true);
    expect(result.state.factoryFloor.machines.map(m => m.id).sort()).toEqual(s.factoryFloor.machines.map(m => m.id).sort());
  });
  it('Undo refunds only the edit, preserving expansion cost and later income', () => {
    const original = { ...newGame(7), cash: dollars(5_000_000) };
    const snap = { floor: original.factoryFloor, props: original.factoryProps, editCash: original.factoryEditCash ?? 0 };
    let s = buyFloorMachine(original, 'qa', 5, 1).state;
    s = buyFloorExpansion(s).state;
    s = { ...s, cash: dollars(s.cash / 100 + 1000) };
    const undone = applyFactorySnapshot(s, snap);
    expect(undone.cash).toBe(dollars(4_951_000));
    expect(undone.factoryExpansion).toBe(1);
    expect(undone.factoryFloor).toEqual(original.factoryFloor);
  });
  it('a longer disconnected belt does not disable a working route', () => {
    const floor = { machines: [{ id: 'i', kind: 'intake' as const, c: 0, r: 0 }, { id: 'p', kind: 'packer' as const, c: 4, r: 0 }], belts: [{ c: 2, r: 1, dir: 'e' as const }, { c: 3, r: 1, dir: 'e' as const }] };
    expect(lineComplete(floor)).toBe(true);
    expect(lineComplete({ ...floor, belts: [...floor.belts, ...[5,6,7,8,9].map(c => ({ c, r: 8, dir: 'e' as const }))] })).toBe(true);
  });
  it('layout restoration moves owned equipment without charging for a replacement', () => {
    let s = saveFactoryLayout(newGame(7), 'Original').state;
    s = moveFloorMachine(s, 'st-intake', 4, 1).state;
    expect(factoryLayoutCost(s, s.factoryLayouts[0])).toBe(0);
  });
  it('unconnected machines remain owned without granting a connected-line bonus', () => {
    const floor = demoFloor();
    const withRemoteArm = placeMachine(floor, 'arm', 13, 8, 'remote')!;
    expect(withRemoteArm.machines).toHaveLength(floor.machines.length + 1);
    expect(lineSpeedMult(withRemoteArm)).toBe(lineSpeedMult(floor));
  });
  it('rejects impossible imported placements without returning a save with deleted possessions', () => {
    const s = newGame(7);
    s.factoryFloor.machines.push({ id: 'invalid', kind: 'qa', c: -4.5, r: 99 });
    expect(parseSaveJson(JSON.stringify(s))).toBeNull();
  });
  it('raises a stale finite ID counter above existing pieces', () => {
    const s = newGame(7);
    s.factoryFloor.machines.push({ id: 'fm-0-8', kind: 'qa', c: 5, r: 1 });
    s.factoryPieceCounter = 0;
    expect(parseSaveJson(JSON.stringify(s))!.factoryPieceCounter).toBeGreaterThanOrEqual(9);
  });
  it('pauses commissions without equipment and resumes to exactly one completion', () => {
    let s = { ...newGame(7), cash: dollars(1_000_000), week: 30, nextEventWeek: 9999, factoryFloor: demoFloor(), pendingSideOrder: generateSideOrder(7, 30, 2) };
    const accepted = acceptSideOrder(s);
    expect(accepted.ok).toBe(true);
    let current: GameState = { ...accepted.state, factoryFloor: { machines: [], belts: [] } };
    for (let i = 0; i < 6; i++) current = advanceOneWeek(current);
    expect(current.activeSideOrder?.completedWeeks).toBe(0);
    expect(current.sideOrdersCompleted).toBe(0);
    current = { ...current, factoryFloor: demoFloor() };
    for (let i = 0; i < 6; i++) current = advanceOneWeek(current);
    expect(current.activeSideOrder).toBeNull();
    expect(current.sideOrdersCompleted).toBe(1);
  });
  it('refuses unaffordable demolition undo without changing cash or ownership', () => {
    let s = { ...newGame(7), cash: dollars(20_000) };
    const snap = { floor: s.factoryFloor, props: s.factoryProps, editCash: 0 };
    s = clearFloorCell(s, 0, 1);
    s = { ...s, cash: dollars(0) };
    expect(applyFactorySnapshot(s, snap)).toBe(s);
  });
  it('refuses an automatic route that cannot reach an enclosed processing station', () => {
    const floor = demoFloor();
    const blocked = ['4,7','4,8','7,7','7,8','5,6','6,6','5,9','6,9'];
    expect(autoRouteBelts(floor, 16, blocked)).toBeNull();
  });
});
