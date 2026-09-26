import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { newGame, autoConnectLine, autoConnectQuote, buyFloorMachine, buyFloorExpansion, saveFactoryLayout, applyFactoryLayout, applyFactorySnapshot, startBuild, advanceOneWeek, launchReady } from '../src/state/gameState.ts';
import { floorWidth, canPlaceMachine, demoFloor, connectedChain, type MachineKind } from '../src/engine/factoryFloor.ts';
import { validFactoryPlacement } from '../src/engine/factoryValidation.ts';
import { parseSaveJson } from '../src/state/persistence.ts';
import { dollars } from '../src/engine/money.ts';
import { weeklyFinancials } from '../src/state/managementMetrics.ts';
import { machineMounts } from '../src/garage3d/machineMounts.ts';

const out = 'artifacts/pre-testflight-audit';
mkdirSync(out, { recursive: true });
const results: object[] = [];
const checks: { name: string; passed: boolean; error?: string }[] = [];
function check(name: string, fn: () => void) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (e) { checks.push({ name, passed: false, error: String(e) }); }
}
const roundtrip = (s: ReturnType<typeof newGame>) => {
  const loaded = parseSaveJson(JSON.stringify(s));
  assert(loaded, 'Valid game state must survive save/load');
  assert.deepEqual(loaded.factoryFloor, s.factoryFloor);
  assert.deepEqual(loaded.factoryProps, s.factoryProps);
  assert.equal(loaded.cash, s.cash);
  assert.deepEqual(loaded.building, s.building);
  assert.deepEqual(loaded.ready, s.ready);
  return loaded;
};
for (let expansion = 0; expansion <= 3; expansion++) {
  for (const count of [0, 7, 14, 28]) check(`Expansion ${expansion}, ${count} extra machines: Auto, ownership, Undo, named layout and reload`, () => {
    let s = { ...newGame(51), cash: dollars(20_000_000), onboarded: true, tutorialDone: true };
    for (let i = 0; i < expansion; i++) s = buyFloorExpansion(s).state;
    const kinds: MachineKind[] = ['mill', 'press', 'screen', 'arm', 'qa'];
    for (let i = 0; i < count; i++) {
      let bought = false;
      for (let r = 0; r < 10 && !bought; r++) for (let c = 0; c < floorWidth(expansion) && !bought; c++) {
        if (!canPlaceMachine(s.factoryFloor, kinds[i % kinds.length], c, r, floorWidth(expansion))) continue;
        const action = buyFloorMachine(s, kinds[i % kinds.length], c, r);
        assert(action.ok); s = action.state; bought = true;
      }
    }
    s = saveFactoryLayout(s, `Audit ${expansion}-${count}`).state;
    const before = roundtrip(s);
    const snap = { floor: s.factoryFloor, props: s.factoryProps, editCash: s.factoryEditCash ?? 0 };
    const quote = autoConnectQuote(s), routed = autoConnectLine(s);
    if (!routed.ok) {
      assert.deepEqual(routed.state, s, 'Refused Auto must not mutate possessions');
      if (expansion === 0) writeFileSync(`${out}/blocked-auto.json`, JSON.stringify(s));
      results.push({ expansion, requestedExtra: count, owned: s.factoryFloor.machines.length, auto: 'refused safely', reason: routed.reason });
      return;
    }
    assert(quote); assert.equal(routed.state.cash, s.cash - quote.cost);
    assert(validFactoryPlacement(routed.state.factoryFloor, routed.state.factoryProps, expansion));
    assert.deepEqual(routed.state.factoryFloor.machines.map(m => [m.id, m.kind, m.level]).sort(), s.factoryFloor.machines.map(m => [m.id, m.kind, m.level]).sort());
    s = roundtrip(routed.state);
    const mounts = machineMounts(s.factoryFloor, connectedChain(s.factoryFloor));
    const stations = new Map<string, string[]>();
    for (const m of s.factoryFloor.machines.filter(m => ['mill', 'press', 'screen', 'qa'].includes(m.kind))) {
      const mount = mounts.get(m.id); if (!mount) continue;
      const key = mount.point.join(','); stations.set(key, [...(stations.get(key) ?? []), m.id]);
    }
    const collisions = [...stations].filter(([, ids]) => ids.length > 1);
    results.push({ expansion, requestedExtra: count, owned: s.factoryFloor.machines.length, auto: 'passed', beltTiles: s.factoryFloor.belts.length, overlappingHeads: collisions });
    if (expansion === 3 && count === 14) writeFileSync(`${out}/crowded.json`, JSON.stringify(s));
    const undone = applyFactorySnapshot(s, snap);
    assert.equal(undone.cash, before.cash); assert.deepEqual(undone.factoryFloor, before.factoryFloor);
    const restored = applyFactoryLayout(s, before.factoryLayouts[0].id);
    assert(restored.ok); assert.deepEqual(restored.state.factoryFloor, before.factoryFloor);
    roundtrip(restored.state);
  });
}

check('Production completes, survives reload every week, launches once and records consistent finances', () => {
  let s = parseSaveJson(readFileSync('scripts/fixtures/save-release-review.json', 'utf8'))!;
  assert(s); s = { ...s, designBudgetEnabled: false, factoryFloor: demoFloor(), factoryProps: [], factoryExpansion: 0, factoryLayouts: [] };
  const product = { ...s.launched[0].product, id: 'release-audit-product', name: 'Release Audit Phone' };
  const started = startBuild(s, product, 100);
  assert(started.ok); s = roundtrip(started.state);
  writeFileSync(`${out}/active-save.json`, JSON.stringify(s));
  const second = startBuild(s, { ...product, id: 'release-audit-second', name: 'Second Audit Phone' }, 100);
  assert(second.ok);
  writeFileSync(`${out}/multi-save.json`, JSON.stringify(roundtrip(second.state)));
  const job = s.building.find(b => b.product.name === product.name)!;
  assert(job); const id = job.product.id;
  for (let i = 0; i < 30 && !s.ready.some(p => p.id === id); i++) s = roundtrip(advanceOneWeek(s));
  assert(s.ready.some(p => p.id === id)); assert(!s.building.some(b => b.product.id === id));
  const launched = launchReady(s, id); assert(launched.ok); s = roundtrip(launched.state);
  assert.equal(s.launched.filter(p => p.product.id === id).length, 1);
  assert.equal(launchReady(s, id).ok, false);
  for (let i = 0; i < 4; i++) {
    const f = weeklyFinancials(s); assert.equal(f.revenue - f.costs, f.profit);
    s = roundtrip(advanceOneWeek(s));
    const history = s.financialHistory!.at(-1)!;
    assert.equal(history.revenue - history.expenses, history.profit);
  }
  assert(s.launched.find(p => p.product.id === id)!.unitsSold > 0);
  results.push({ production: 'passed', unitsSold: s.launched.find(p => p.product.id === id)!.unitsSold, financialHistory: s.financialHistory?.slice(-4) });
});

// A legal hand-built choke point can ask two heads to occupy one conveyor tile.
check('Inspect legal shared-belt machine mount geometry', () => {
  const floor = { machines: [
    { id: 'a', kind: 'mill' as const, c: 0, r: 0 },
    { id: 'b', kind: 'screen' as const, c: 3, r: 0 },
  ], belts: [{ c: 2, r: 0, dir: 's' as const }] };
  assert(validFactoryPlacement(floor, [], 0));
  const mounts = [...machineMounts(floor).values()];
  assert.equal(new Set(mounts.map(m => m.point.join(","))).size, mounts.length);
  assert.equal(mounts.length, 1);
  results.push({ sharedBelt: [...machineMounts(floor)], floor });
  writeFileSync(`${out}/shared-belt.json`, JSON.stringify({ ...newGame(51), onboarded: true, tutorialDone: true, cash: dollars(1_000_000), factoryFloor: floor }));
});
writeFileSync(`${out}/engine.json`, JSON.stringify({ checks, results }, null, 2));
console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed), results }, null, 2));
if (checks.some(c => !c.passed)) process.exitCode = 1;

const decisionFixture = JSON.parse(readFileSync('scripts/fixtures/save-release-review.json', 'utf8'));
const decisionSave = JSON.parse(readFileSync(`${out}/active-save.json`, 'utf8'));
for (const key of Object.keys(decisionSave)) if (key.startsWith("pending")) decisionSave[key] = Array.isArray(decisionSave[key]) ? [] : null;
decisionSave.pendingChoice = decisionFixture.pendingChoice;
writeFileSync(`${out}/decision-save.json`, JSON.stringify(decisionSave));
