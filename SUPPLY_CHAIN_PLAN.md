# Supply Chain Expansion — Suppliers & Factories (Design + Build Plan)

Status: **P1 → P3 SHIPPED.** Suppliers, supplier-weighted crunch risk, contract factories with a
capacity/overtime mechanic, the stretch/defects capacity strategies, and owned factory lines with a
Company → Operations screen are all live. Remaining items (§10) are the post-P4 idea bank. This doc
is the complete plan for the supplier + factory layer plus a roadmap for expanding further.

---

## 1. Why this, why now

The build loop today is: **Design → Build (timed) → Ready → Launch.** Manufacturing is a single
opaque step. The cost/speed/quality of a run is decided entirely by hidden modifiers the player
can't steer:

- `effectiveUnitCost(s, product)` — `buildCost(product)` × tuning, ×0.85 if `leanSupply` researched.
- `toolingCost(s, product)` — `buildCost × 40 × buildCostMult(upgrades) × margin × perk`, floored at $4k.
- `buildWeeksFor(state)` — `baseWeeks 3` minus engineer skill / `assemblyLine`, floored at 1.
- Random `supplyCrunch` / `supplier-fail` events apply flat cash hits with **no player agency**.

Every lever exists but is **automatic**. The expansion makes the two biggest levers — *where your
parts come from* and *where you build* — into **meaningful, failable choices** (design pillar #3),
and gives the already-existing supply-crunch events a cause the player actually controls.

**Non-goals (hard guardrails):**
- No new currency, no timers-for-money, no gates — monetization stays LOCKED ($8.99 premium). (RULE: monetization.)
- No real supplier/foundry/brand names — fictional only. (IP discipline ship-blocker.)
- No screen that ships rough. If a sub-feature can't be made premium this pass, it's logged, not shipped. (RULE #1.)
- Keep `engine/` pure (no React/DOM); all new logic is unit-testable TS. (Golden rule.)

---

## 2. The two systems at a glance

| | **Suppliers** | **Factories** |
|---|---|---|
| Governs | per-unit **component cost**, part **quality**, **lead time**, **supply risk** | **tooling** cost, **per-unit assembly** cost, **build speed**, **capacity ceiling**, **defect risk** |
| Chosen | per component *kind* (chip/display/…) or one house supplier | one active factory per build (or standing default) |
| Trade-off axis | cheap+risky ↔ premium+reliable | contract (cheap, slow, capacity-capped) ↔ owned (expensive upfront, fast, high capacity) |
| Failure mode | a crunch spikes cost / delays parts → **late or over-budget run** | over-capacity run → **defects** (quality penalty) or **overtime** (cost spike) |
| Engine touch-points | `effectiveUnitCost`, the `supplyCrunch` event resolver | `toolingCost`, `buildWeeksFor`, `planProduction` capacity clamp |

They compose: a cheap supplier through a maxed-out contract factory is how a run blows up. A premium
supplier through an owned line is the safe flagship play. The player feels the **whole chain**.

---

## 3. Suppliers

### 3.1 Model (pure data — `engine/suppliers.ts`)

```ts
export type SupplierTrait = "cheap" | "balanced" | "premium" | "boutique";

export interface Supplier {
  id: SupplierId;                 // fictional, e.g. "novacore", "everline", "atlas-parts"
  name: string;                   // "NovaCore Components"
  era: number;                    // first era it becomes available
  // Per-unit cost MULTIPLIER applied to the components it sources (1.0 = catalog price).
  costMult: number;               // cheap ≈ 0.82 · premium ≈ 1.25
  // Quality DELTA added to the `quality` stat contribution of sourced components (−6..+8).
  qualityDelta: number;
  // Extra build weeks of lead time (0..2) — slow boats are cheap.
  leadWeeks: number;
  // 0..1 chance per run that a crunch hits THIS supplier (drives the event resolver).
  riskBase: number;               // cheap ≈ 0.18 · premium ≈ 0.04
  // Which component kinds it can source (some are specialists: a boutique display house).
  kinds: ComponentKind[] | "all";
  trait: SupplierTrait;
}
```

Catalog lives beside components in `engine/suppliers.ts` (NOT in `catalogs.ts`, which is protected —
suppliers reference component *kinds*, they don't change the component lines). 6–8 suppliers,
era-gated, e.g.:

- **BargainBin Sourcing** (cheap, 0.82×, −5 quality, +1 lead wk, risk 0.20, era 1)
- **Everline Standard** (balanced, 1.00×, +0, +0, risk 0.10, era 1)
- **NovaCore Components** (premium, 1.22×, +6 quality, 0 lead, risk 0.05, era 2)
- **Atlas Foundry Direct** (boutique chip specialist, 1.30×, +8 perf-via-quality on `chip`, era 3)
- … (display/battery specialists, an era-4 "in-house fab" once Vertical Integration is researched).

### 3.2 Selection UX

A new **Sourcing** card in the Design Lab **Components tab** (it already lives where parts are
chosen). Default = "House supplier" (one pick for the whole build); a "per-part" toggle for power
players assigns a supplier per component kind. Each option shows its cost/quality/lead/risk as the
same chip language the lab already uses (cost in $, quality as a stat delta, a small risk dot).

The choice is stored on the **product draft** (so a successor remembers it) and surfaced again in the
**Build wizard** summary ("Sourced via NovaCore · +6 quality · 5% crunch risk") so the player sees the
consequence right before paying.

### 3.3 Engine integration (surgical)

```ts
// effectiveUnitCost gains a supplier factor (replaces the flat leanSupply 0.85 with a real choice;
// leanSupply becomes a multiplier ON TOP, so research still matters):
unitCost = scale(buildCost(product, sourcing), supplierCostMult(sourcing));
if (leanSupply) unitCost = scale(unitCost, 0.85);

// computeStats: sourced quality delta folds into the `quality`/`performance` contribution.
// buildWeeksFor: + max lead time across chosen suppliers.
// planProduction: expose `crunchRisk` so the wizard can warn ("1-in-12 chance of a cost overrun").
```

`buildCost(product)` already loops `cat.slots`; it takes an optional `sourcing` arg defaulting to
"house/standard" so **every existing call and save stays valid** (older products = standard supplier).

### 3.4 Crunch events become causal

`events.ts` already fires `supplyCrunch` / `supplier-fail`. Reroute the resolver: the *magnitude*
and *probability* now scale by the cheapest supplier in your active sourcing. Premium sourcing ≈
shrugs it off; bargain sourcing ≈ eats the full hit **and** a 1-week delay. Same event content, now
**earned**. A premium supplier is insurance you chose to buy.

---

## 4. Factories

### 4.1 Model (pure data — `engine/factories.ts`)

```ts
export type FactoryKind = "contract" | "owned";

export interface Factory {
  id: FactoryId;                  // "shenzen-style" fictional → e.g. "eastwind-contract", "homeline-1"
  name: string;
  era: number;
  kind: FactoryKind;
  // CONTRACT: pay-as-you-go. OWNED: large upfront `acquireCost`, then cheaper per unit.
  acquireCost: Money;             // 0 for contract; large for owned (sits beside facility tiers)
  weeklyUpkeep: Money;            // owned lines carry rent even when idle (a real commitment)
  toolingMult: number;           // multiplies toolingCost — contract ≈ 1.0, owned ≈ 0.5 after acquire
  unitAssemblyMult: number;       // multiplies the per-unit cost — owned ≈ 0.9, premium contract ≈ 1.15
  speedMult: number;             // multiplies build weeks — fast line ≈ 0.7, cheap slow line ≈ 1.3
  capacityPerWeek: number;       // units/week before defects/overtime kick in
  defectBase: number;            // 0..1 quality-loss risk when run > capacity
}
```

### 4.2 The capacity mechanic (the new decision with teeth)

`planProduction` gains a **capacity check**: `runWeeks = ceil(plannedUnits / capacityPerWeek)` is
compared to the build window. Over capacity, the player picks (in the wizard) one of:

- **Overtime** — keep the timeline, pay `unitAssemblyMult × overtimeSurcharge` on the excess units.
- **Stretch** — add build weeks (cheaper, but later to market → demand/trend drift).
- **Defects** — accept a `defectBase`-scaled hit to the launch `quality` stat (cheapest, risky).

This is the moment the player *feels* the factory choice: a small contract line is fine for a 600-unit
boutique run and a disaster for a 50,000-unit flagship.

### 4.3 Owned vs contract progression

- **Era 1–2:** only **contract** factories (no upfront, capped capacity, slower). Mirrors a garage
  studio outsourcing production.
- **Era 2:** unlock **owning a line** — a big `acquireCost` (sits in the Company tab beside facility
  upgrades), `weeklyUpkeep` even when idle, but half tooling and higher capacity. The classic
  tycoon "buy the factory" beat.
- **Era 3+:** multiple owned lines, a **premium automated line** (fast + low defect), and the
  existing `verticalIntegration` research now *also* unlocks an in-house **fab** supplier (§3.1)
  — the two systems converge into true vertical integration.

### 4.4 Engine integration

`toolingCost` and `buildWeeksFor` take the active factory's mults; `planProduction` clamps/penalizes
by capacity and returns the chosen capacity strategy's cost/quality deltas. Owned-line `acquireCost`
+ `weeklyUpkeep` flow through the existing economy (`burn`/payroll path) so runway math stays honest.

---

## 5. Where it lives in the UI

1. **Design Lab → Components tab → "Sourcing" card** — pick supplier(s). (Reuses chip language.)
2. **Design Lab → Build wizard → new "Manufacturing" step** between *Run size* and *Confirm* —
   pick the factory, see the capacity readout (units/wk vs run), resolve over-capacity, and read the
   final "sourced + built" summary. This is the natural home and keeps the loop in one place.
3. **Company tab → new "Operations" section** — acquire/own factories, see line upkeep & utilization,
   standing default supplier. (Company already houses staff/facilities/financials.)
4. **In-production ring (just shipped)** — the live stage labels become supplier/factory-aware
   ("Sourcing components — via NovaCore", "Assembly — Homeline 1"). Tiny copy change, big immersion.

No new bottom-tab. Everything hangs off existing screens to avoid nav bloat (matches the "easier to
navigate" direction from playtest feedback).

---

## 6. Balance philosophy

- **No dominant strategy.** Cheap sourcing + small contract line = thin-margin volume play that a
  crunch can wreck. Premium + owned = high floor, high fixed cost that demands consistent shipping.
  Tuned so the *expected* value of cheap-vs-premium is close; the variance is the point.
- **All numbers in `balance.ts`** under a new `supply: { … }` block (suppliers' mult ranges, factory
  capacity curve, overtime surcharge, defect scaling). Tunable via the existing `npm run sim` harness.
- **Early game stays gentle.** Era-1 contract + standard supplier ≈ today's behaviour (so the
  recommendedRun / safetyReserve protections still hold and a fresh save can't brick).
- **Research stays relevant.** `leanSupply`, `assemblyLine`, `verticalIntegration`, `quickPrototype`
  all become multipliers *on top of* the chosen chain — they amplify a good supply chain rather than
  replace the decision.

---

## 7. Persistence & migration

- New optional fields: `product.sourcing?: Sourcing`, `state.ownedFactories?: FactoryId[]`,
  `state.defaultSupplierId?`, `BuildJob.factoryId?`, `BuildJob.sourcing?`.
- **All optional with safe defaults** → no schema-version bump needed for reads; a one-line migration
  in `useGame.tsx` backfills `defaultSupplierId = "everline-standard"` and `ownedFactories = []`.
- Older saves: products with no `sourcing` resolve to the standard supplier and a contract factory →
  **identical** behaviour to today. Zero regression risk for existing players.

---

## 8. Testing

Pure engine → fully unit-testable (Vitest), mirroring the existing `production.test.ts`:

- `suppliers.test.ts` — cost/quality/lead deltas; crunch-risk scaling; per-part vs house resolution.
- `factories.test.ts` — capacity math; the three over-capacity strategies; owned upkeep in burn.
- `economy` regression — a default-supplier + contract build equals today's `planProduction` output
  (golden test guarding the migration).
- `balanceGuards.test.ts` additions — no supply config makes a run free, infinitely fast, or
  zero-risk; cheap and premium expected-value stay within a tuned band.

---

## 9. Phasing (each phase independently shippable & premium)

- **P1 — Suppliers MVP. ✅ SHIPPED.** `engine/suppliers.ts` + Sourcing card + cost/quality/lead
  integration (`buildCost` / `computeStats` / `buildWeeksFor`). Ships the deterministic "what parts"
  decision. **Deferred to a fast-follow:** supplier-weighted `supplyCrunch` event risk, and per-part
  (vs house) sourcing — both build cleanly on the P1 `supplierId`-on-product foundation.
- **P1.5 — Supplier-weighted crunch risk. ✅ SHIPPED.** `supplyCrunch` events now scale by your
  sourcing resilience (`crunchMult` per supplier + `sourcingExposure`), with a feed annotation and a
  "shock-resistant / crunch-exposed" tag on the Sourcing card.
- **P2 — Contract factories. ✅ SHIPPED.** `engine/factories.ts` + Manufacturing card + capacity
  mechanic via an **overtime surcharge** on over-capacity units (cost/speed/capacity trade-offs).
  **Deferred to P3:** the stretch/defects capacity strategies (the overtime path ships now).
- **P3 — Owned lines + capacity strategies. ✅ SHIPPED.** P3a: the **stretch** (extend the schedule)
  and **defects** (accept a quality hit) alternatives to overtime, surfaced as a wizard picker when
  over capacity. P3b: **owned factory lines** (Homeline 1, GigaFab) with a one-time acquire cost +
  weekly upkeep (folded into `burn`), bought in a new Company → **Operations** section and selectable
  once owned. The tycoon "buy the factory" arc.
- **P4 — Polish & immersion.** Supplier/factory-aware in-production ring copy; a one-screen
  "Supply Chain" overview; supplier relationship flavor (a loyal supplier's risk decays over time).

Recommend building **P1 first** and validating fun before P2 — same incremental discipline the rest
of the game follows.

---

## 10. Expanding the supply chain further (post-P4 menu — pick by fun, not completeness)

Ordered by estimated value-to-effort. None are committed; this is the idea bank.

1. **Supplier relationships** — repeat business lowers a supplier's cost & risk over time; a crunch
   you weather together builds loyalty. Turns a one-off pick into an ongoing relationship.
2. **Contracts & negotiation** — lock a price for N weeks (hedge against crunches) vs spot pricing.
   A light, readable risk-management minigame, no dark patterns.
3. **Logistics & regions** — ties into the existing `unlockedRegions`: a region-local factory cuts
   shipping lead time to that market; a far one is cheaper but slower to shelves there.
4. **Quality tiers / yield** — a factory's *yield* (good units per batch) improves with utilization
   and the `qaLab` research; low yield = effective unit cost rises. Deepens the capacity decision.
5. **Sustainability / ethics axis** — a "responsible sourcing" supplier costs more but lifts
   reputation & fan loyalty; a sweatshop-cheap one risks a `scandal` event (events.ts already has
   scandals). A values choice with real trade-offs — handled tastefully, never preachy.
6. **Dual sourcing / resilience** — split a component across two suppliers to halve crunch impact at
   a small cost premium. The textbook real-world hedge, as a satisfying toggle.
7. **Disruption events with agency** — upgrade the random `supplyCrunch` into a *decision* ("pay to
   air-freight, or slip the launch a week?") using the existing event-choice plumbing.
8. **Factory tech tree** — robotics/automation upgrades per owned line (speed/defect/capacity),
   paralleling the office `UPGRADE_LINES` pattern so it reuses proven UI.

---

## 11. Risk register

| Risk | Mitigation |
|---|---|
| **Complexity creep** — too many knobs dull the core loop | Default "house supplier + contract line" is one tap; depth is opt-in (per-part toggle, owned lines). Ship P1 alone and verify fun. |
| **Balance regression** bricks early game | Golden migration test (§8) + era-1 defaults equal today; `npm run sim` sweep before each phase. |
| **UI bloat / nav confusion** | No new tab; everything hangs off Design Lab + Company + the existing wizard. |
| **Save breakage** | All fields optional with safe defaults; one backfill line; explicit old-save golden test. |
| **Engine purity drift** | All logic in `engine/suppliers.ts` + `engine/factories.ts`, zero React imports, full unit tests. |
| **Scope vs ship** | Phased; each phase is a complete, premium, shippable slice. Anything not premium-ready is logged, not shipped (RULE #1). |

---

## 12. First concrete step (when greenlit)

Build **P1, supplier-only**, as one vertical slice:
1. `engine/suppliers.ts` (catalog + `supplierCostMult` / `sourcedQualityDelta` / `sourcingLeadWeeks` / `crunchRisk`) + `suppliers.test.ts`.
2. Thread an optional `sourcing` through `buildCost` / `effectiveUnitCost` / `computeStats` / `buildWeeksFor` (defaults = standard → zero behaviour change for old saves).
3. Add `BALANCE.supply` numbers.
4. Sourcing card in the Components tab + wizard summary line.
5. Reroute `supplyCrunch` magnitude/odds through the active sourcing.
6. Migration backfill + golden "old save == today" test.

That slice alone turns manufacturing from an opaque step into a real bet — the rest builds on it.
