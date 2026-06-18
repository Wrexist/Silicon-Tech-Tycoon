# Plan — The Office Shop & Mobile Decorate Overhaul

**Status:** Refined spec (v2), build-ready, awaiting go-ahead to start Phase A.
Branch: `claude/game-audit-engagement-qiauna`.

**Locked decisions (v2):**
- Attributes are **ADDITIVE** — furniture buffs stack on top of the existing HQ upgrades; no upgrade
  line is removed except the `buyDesktop` purchase, which moves into the shop as desks.
- Three attributes only: **Comfort** (mood), **Focus** (research), **Inspiration** (design), each
  hard-capped (§5.1). Full per-item cost+attribute table is locked in §2.3.
- Buy charges cash; **Sell refunds 50%**; **Undo restores cash too** (true reversal); Reset removed.
- Starter garage = **desk + plant**; existing saves keep their rooms and get a capped one-way buff.

**Goal:** Turn the free "Decorate" tool into a premium **office shop** where furniture costs money,
carries gameplay **attributes** (team happiness, focus, inspiration), and where **buying a desk is
how you open a seat to hire**. Plus a mobile-first redesign so nothing clips off-screen and
decorating feels smooth and effortless. New games **start with just a desk and a plant** and grow
from there.

---

## 1. What exists today (the surfaces we touch)

| System | Today | Source |
|---|---|---|
| Furniture catalog | `FurnitureDef { id, name, category, icon, w, d, flat? }` — **no cost, no attributes** | `engine/furniture.ts` |
| Placement | Pure grid model, collision-checked, `placeFurniture` is **free** | `engine/furniture.ts`, `gameState.ts` |
| Desks = seats | `isDeskType`, `deskItems`, `deskCapacity = placed desks + desktops` | `engine/furniture.ts`, `gameState.ts:1624` |
| Hiring gate | `hireStaff`/`hireCandidate` blocked when `staff.length >= deskCapacity` | `gameState.ts:1626` |
| "Buy a desk" | `buyDesktop` / `desktops` count — a button in the **HQ Upgrades** card | `gameState.ts:438`, `HQ.tsx Upgrades()` |
| Team mood | Weekly drift toward `target = 60 + amenitiesUpgrade×5` | `gameState.ts:836`, `upgrades.ts moodBonus` |
| Starter room | `defaultLayout()` ships 13 items; `furnitureCounter: 20` | `engine/furniture.ts:283` |
| Decorate UI | `hqb__panel` — search + horizontal category row + items grid; toolbar when selected | `screens/HQ.tsx:448`, `hq.css` |

**Design constraints (must respect):** `engine/` stays pure + unit-tested; persistence schema is
versioned with safe backfills; `DeviceRenderer` + 3D category shapes are protected; everything must
use DesignSystem tokens + the 8pt grid; no nags, premium feel (RULE #1).

---

## 2. The model: furniture as a priced, attributed catalog

### 2.1 Extend `FurnitureDef` (engine/furniture.ts — pure)
```ts
export interface FurnitureAttrs {
  comfort?: number;     // → team happiness (mood)
  focus?: number;       // → productivity (research speed)
  inspiration?: number; // → creativity (design stat)
}
export interface FurnitureDef {
  id: FurnitureId; name: string; category: FurnitureCategory; icon: string;
  w: number; d: number; flat?: boolean;
  cost: number;            // dollars — set per item (REQUIRED going forward)
  attrs?: FurnitureAttrs;  // optional gameplay attributes
  seat?: boolean;          // desks are seats (derived from category today; make it explicit)
}
```
- `cost` becomes a required field on every catalog entry (a one-time data pass over the ~70 items).
- `seat: true` on the six desk types (keeps `isDeskType` working, but explicit + future-proof).
- Three attributes only — deliberately small so the shop is **readable**, not a spreadsheet.

### 2.2 What each attribute does (additive on top of existing systems — low risk)
| Attribute | Drives | Formula (capped) | Surfaced as |
|---|---|---|---|
| **Comfort** | Team mood | weekly mood `target += min(comfortCap, ΣcomfortΧk_c)` | "Team happiness" |
| **Focus** | Research | `weeklyRp ×= 1 + min(focusCap, ΣfocusΧk_f)` | "Focus" |
| **Inspiration** | Design | product Design stat `+= min(inspCap, ΣinspΧk_i)` | "Inspiration" |

- These are **additive** with the existing HQ upgrades (amenities/computers/designSuite stay as-is),
  so no upgrade line is removed and existing balance isn't gutted. Furniture becomes a *second,
  spatial* lever you actively build.
- **Hard caps** (`comfortCap`, `focusCap`, `inspCap` in `balance.ts`) stop runaway stacking — you
  can't carpet the floor in sofas for infinite mood. Past the cap, extra items are cosmetic.
- Pure helper `officeAttrs(layout): { comfort; focus; inspiration }` in `engine/furniture.ts`,
  unit-tested. Selectors `officeComfortMoodBonus(s)`, `officeFocusMult(s)`, `officeInspoBonus(s)`
  in `gameState.ts` apply the caps. Wire points:
  - mood target (`gameState.ts:836`) `+= officeComfortMoodBonus(s)`
  - `weeklyRpGen` `×= officeFocusMult(s)`
  - `productStats` design bonus `+= officeInspoBonus(s)`

### 2.3 The full catalog — final cost + attributes (the data pass)
Locked starting values (tunable, pinned by a balance test). `C`=comfort, `F`=focus, `I`=inspiration.
Seat = desk (opens a hire slot).

**Desks** (seats + focus)
| id | $ | C | F | I |
|---|--:|--:|--:|--:|
| desk | 1,500 | – | 2 | – |
| standingDesk | 2,000 | 1 | 3 | – |
| deskL | 2,400 | – | 3 | – |
| dualDesk | 3,500 | – | 5 | – |
| reception | 4,000 | – | 1 | 2 |
| executiveDesk | 8,000 | – | 4 | 3 |

**Seating** (comfort) · **Fun** (big comfort)
| id | $ | C | F | I | | id | $ | C | F | I |
|---|--:|--:|--:|--:|---|---|--:|--:|--:|--:|
| stool | 250 | 1 | – | – | | guitar | 900 | 3 | – | 2 |
| chair | 300 | 1 | – | – | | watercooler | 800 | 3 | – | – |
| bench | 500 | 1 | – | – | | treadmill | 2,500 | 3 | 1 | – |
| beanbag | 600 | 3 | – | – | | vending | 2,000 | 5 | – | – |
| armchair | 700 | 2 | – | – | | coffeeBar | 3,000 | 6 | – | – |
| gamingChair | 1,200 | 3 | 1 | – | | foosball | 3,000 | 7 | – | – |
| loungeChair | 1,400 | 4 | – | – | | pingpong | 3,500 | 7 | – | – |
| sofa | 1,800 | 5 | – | – | | arcade | 4,500 | 8 | – | – |
| sofaL | 3,200 | 7 | – | – | | poolTable | 6,000 | 9 | – | – |

**Tables / Storage** (light focus + collab)
| id | $ | C | F | I | | id | $ | C | F | I |
|---|--:|--:|--:|--:|---|---|--:|--:|--:|--:|
| sideTable | 300 | 1 | – | – | | filingCabinet | 400 | – | 1 | – |
| coffeeTable | 600 | 1 | – | – | | bookshelf | 500 | – | 1 | 1 |
| barTable | 800 | 2 | – | – | | shelfUnit | 500 | – | 1 | – |
| roundTable | 1,500 | 1 | – | 1 | | cabinet | 700 | – | 1 | – |
| meetingTable | 3,000 | – | 2 | 2 | | wardrobe | 700 | 1 | – | – |
| | | | | | | lockers | 600 | 1 | – | – |

**Plants** (comfort) · **Lighting** (light comfort/inspo)
| id | $ | C | F | I | | id | $ | C | F | I |
|---|--:|--:|--:|--:|---|---|--:|--:|--:|--:|
| cactus | 150 | 1 | – | – | | lantern | 300 | 1 | – | – |
| plantPot | 200 | 2 | – | – | | floorLamp | 400 | 1 | – | – |
| bonsai | 400 | 2 | – | 1 | | cubeLamp | 700 | 1 | – | 1 |
| monstera | 600 | 3 | – | – | | arcLamp | 900 | 2 | – | 1 |
| plantTall | 700 | 3 | – | – | | | | | | |
| planterBox | 900 | 4 | – | – | | | | | | |

**Decor** (inspiration) · **Tech** (focus) · **Garage** (focus/theme)
| id | $ | C | F | I | | id | $ | C | F | I |
|---|--:|--:|--:|--:|---|---|--:|--:|--:|--:|
| divider | 500 | – | 1 | – | | toolCabinet | 700 | – | 2 | – |
| easel | 600 | – | 2 | 1 | | workbench | 1,500 | – | 3 | – |
| floorVase | 600 | – | – | 2 | | towerPC | 3,000 | – | 5 | – |
| rugRound | 700 | 2 | – | – | | printer | 4,000 | – | 4 | 1 |
| globe | 800 | – | 1 | 2 | | serverRack | 5,000 | – | 6 | – |
| rug | 900 | 2 | – | – | | robotArm | 6,000 | – | 6 | – |
| floorClock | 1,000 | – | – | 2 | | tireStack | 200 | – | – | – |
| neonSign | 1,200 | – | – | 4 | | oilDrum | 200 | – | – | – |
| tvStand | 1,500 | 3 | – | – | | ladder | 150 | – | – | – |
| artStand | 1,800 | – | – | 5 | | crates | 200 | – | – | – |
| sculpture | 2,500 | – | – | 6 | | | | | | |

Rugs (`flat`) carry comfort but still don't block placement. The 4 garage "theme" props
(tireStack/oilDrum/ladder/crates) are cheap cosmetics with no attrs — kept for flavor.

### 2.4 Cost flow + resale
- **Buy:** placing an item deducts `cost` from cash. If `cash < cost`, the item is **disabled** in
  the shop (greyed, "Need $X") — never a silent fail.
- **Sell:** removing an item refunds **50%** (`BALANCE.shop.resaleRate`). The selected-item toolbar's
  "Remove" becomes **"Sell · +$X"**. This lets players redecorate without punishing experimentation.
- **Reset** (destructive "clear to starter") is **removed** from shop mode — with money attached it's a
  footgun. Undo stays. (Migration-safe: `resetFurniture` keeps existing callers but is unbound from UI.)
- **Duplicate** also costs (it's another purchase) — relabel to "Buy another · $X".
- **Undo must restore cash, not just the layout.** Today the Decorate undo history is a stack of
  `PlacedItem[][]` (layout only). With prices, undoing a purchase has to give the money back in full
  (undo = true reversal; Sell = a deliberate 50% disposal). So the undo snapshot becomes
  `{ layout, cash }`, and a new pure op `applyLayoutSnapshot(state, { layout, cash })` restores both.
  Moves/rotates snapshot the same shape (cash unchanged), so the stack stays uniform.

### 2.5 Desks = seats = hiring (the "buy a desk to hire" loop)
- Keep `deskCapacity`. **Buying a desk in the shop is the only way to add a furniture seat.**
- **Retire `buyDesktop` from the HQ Upgrades card** (the user's explicit ask). For back-compat,
  `deskCapacity` keeps counting any legacy `desktops` from old saves, but the **standalone desktop
  purchase UI and the `desktops` shop entry are removed** — new seats come from placed desks.
- **Surface the link in the shop:** the Desks category header shows
  `Seats: {staff}/{deskCapacity} · buy a desk to hire`. When you buy a desk with a free hire waiting,
  a subtle CTA appears: "Seat ready — hire in Company →". No nag; it's contextual.
- Hiring itself stays in Company (recruit → sign); the shop only governs **capacity**.

### 2.6 Starter garage = desk + plant
- `defaultLayout()` → just `[ desk @ centre, potted plant @ corner ]`; `furnitureCounter: 3`.
- Founder occupies the one desk (1 seat). To hire a second person you **buy a second desk**. This makes
  the shop matter from minute one.
- **Only affects new games.** Existing saves keep their layout (no migration of placed items).

---

## 3. The mobile decorate/shop UX (the "nothing off-screen, smooth" half)

### 3.1 Layout system — a true bottom-sheet shop
Decorate mode becomes a **fixed two-zone layout** sized in `dvh`, never overflowing:
```
┌─────────────────────────────┐
│  Decorate bar (cash · Done) │  fixed, safe-area top
├─────────────────────────────┤
│                             │
│      3D office (grid)       │  flex: 1 1 auto, min-height clamp,
│                             │  shrinks so the sheet always fits
├─────────────────────────────┤
│  ░ Shop sheet (snap, scroll)│  max-height: 42dvh, internal scroll,
│  [categories ▸ scroll]      │  rounded top, grab handle,
│  [ item · item · item ]     │  safe-area bottom inset
└─────────────────────────────┘
```
- The scene gets an explicit `height` driven by `100dvh − bar − sheet − nav − safe-areas` (not a fixed
  px), so on small phones the sheet wins space and the scene shrinks — **the grid is always fully
  visible while placing**.
- Shop sheet: `max-height: 42dvh` with `overflow-y:auto` and `overscroll-behavior: contain`;
  horizontal category strip uses `scroll-snap-type: x` and never wraps off-screen.
- All tap targets ≥44px; `env(safe-area-inset-*)` honored top and bottom (iOS notch/home bar).

### 3.2 The shop item card (visualize cost + attributes)
Each item is a card, not a bare icon+label:
```
┌──────────────┐
│   [glyph]    │
│  Sofa        │
│  $1,800      │  ← price (red + "Need $400" when unaffordable)
│ ☺+5  ·  ♥    │  ← attribute chips: ☺ comfort, ◎ focus, ✦ inspiration
└──────────────┘
```
- Attribute chips use the three icons consistently (a Lucide set: `Smile`/`Heart`=comfort,
  `Target`/`Crosshair`=focus, `Sparkles`=inspiration). Tap-and-hold shows a one-line tooltip
  ("Comfort lifts team happiness").
- Unaffordable → card dimmed, price shows the shortfall, tap gives a gentle "Need $X more" toast +
  error haptic (no placement attempt).
- Selected-to-place → accent ring + the existing on-floor ghost (green=valid / red=blocked).

### 3.3 Office overview (the "so on" — see your office working for you)
A compact **"Office" summary** at the top of the shop sheet (and mirrored on the Company screen):
```
Team happiness  +18  ▓▓▓▓▓░  (near cap)
Focus           +12%
Inspiration     +6
Seats           3 / 4
Spent on office $24,300
```
- Live: as you place/sell, the bars animate. This is the payoff — you *see* the office buffing the team.
- Caps shown as a faint track so players understand diminishing returns (premium, honest).

### 3.4 Smoothness & feel
- Placing: tap a card → tap the floor (existing flow), with `haptic.light` on select, `haptic.success`
  on a valid drop, `haptic.error` on blocked/too-poor. Sound cue on purchase (reuse `sfx("tap")`).
- Sheet open/close + category switches: spring transitions via existing motion tokens.
- Drag-to-move stays; the sheet auto-collapses to a slim bar while dragging so the floor is unobstructed.
- A first-time **2-line coach** in shop mode ("Tap an item, then tap the floor. Desks add seats to
  hire.") — dismissible, shown once.

---

## 4. Engine / data / state changes (file-by-file)

**`engine/furniture.ts`** (pure)
- Add `cost`, `attrs`, `seat` to `FurnitureDef`; fill `cost`/`attrs` for all items.
- `officeAttrs(layout)` → summed `{comfort, focus, inspiration}` (ignores `flat` rugs' absence of attrs).
- `defaultLayout()` → desk + plant; keep the collision test.

**`engine/balance.ts`**
- `shop: { resaleRate: 0.5, comfortCap, focusCap, inspCap, comfortK, focusK, inspK }`.
- (No change to `facilities.staffCapacity` — it still hard-caps total team independent of desks.)

**`gameState.ts`**
- `placeFurniture` / `duplicateFurniture`: charge `cost`; reject + reason if unaffordable (return a
  `{ ok, reason }`-style result so the UI can toast).
- `removeFurniture`: refund `cost × resaleRate`.
- Selectors: `officeComfortMoodBonus`, `officeFocusMult`, `officeInspoBonus` (apply caps); wire into
  mood target, `weeklyRpGen`, `productStats`.
- `furnitureCounter: 3`; new `defaultLayout`.
- Retire `buyDesktop` binding (keep the fn for migration math; remove from context/UI). `deskCapacity`
  unchanged.

**`state/useGame.tsx`**
- `placeFurniture`/`duplicate` callbacks return the `{ ok, reason }` result; emit spend FX on success.
- Drop `buyDesktop` from the context value (or keep no-op for one version, then remove).

**`screens/HQ.tsx` + `hq.css`**
- Rebuild the decorate panel as the bottom-sheet shop (§3); add item cards w/ price + attr chips;
  add the Office overview; wire affordability + sell; responsive `dvh` sizing.
- Remove the desktop purchase + "Reset" from the Upgrades card; Upgrades keeps the equipment lines.

**Persistence (`state/persistence.ts`) — migration**
- New saves only differ by `defaultLayout`/`furnitureCounter` (no migration needed for those).
- `officeAttrs` reads live layout — **old saves with the rich default layout simply get attributes
  for whatever they already own** (a free buff, fine). No destructive migration.
- `desktops` field retained + still counted in `deskCapacity` for old saves (grandfathered seats).
- Bump schema version, add a migration test asserting old saves load and get sane office attrs.

---

## 5. Balance & safety

### 5.1 Locked starting constants (`balance.ts` `shop`) — tunable, pinned by a test
| const | value | meaning | anchored against |
|---|--:|---|---|
| `resaleRate` | 0.50 | refund on Sell | — |
| `comfortK` | 0.5 | mood-target per comfort pt | amenities = +5/tier |
| `comfortCap` | 15 | max mood-target from furniture | so amenities(+20) + furniture(+15) tops out ~95 target, not a trivial 100 |
| `focusK` | 0.01 | +research mult per focus pt | workstations = +15%/tier |
| `focusCap` | 0.15 | max +15% research from furniture | a *complement* to the workstations line, not a replacement |
| `inspK` | 0.5 | +Design stat per inspiration pt | designSuite = +2 Design/tier |
| `inspCap` | 5 | max +5 Design from furniture | small, bounded creative edge |

Reach-the-cap sanity check (so caps bite at a *furnished* office, not a maxed one):
- Comfort cap (30 pts) ≈ 2 sofas (10) + arcade (8) + coffee bar (6) + a few plants (8).
- Focus cap (15 pts) ≈ serverRack (6) + robotArm (6) + a couple of desks (4).
- Inspiration cap (10 pts) ≈ sculpture (6) + neon (4), or canvas (5) + globe (2) + clock (2).

### 5.2 Guardrails
- **Caps are the guardrail:** comfort/focus/inspiration each cap well below "trivializes the game."
  Target: a fully-decorated office gives roughly what a mid-tier amenities/computers upgrade gives —
  a meaningful *complement*, not a replacement.
- **Old saves get a one-way buff:** the existing rich `defaultLayout` (sofa, lounge, plants, water
  cooler…) starts contributing comfort on load. No cash is moved on migration — it's a free, capped
  bump, so no save can be made worse. A migration test asserts this.
- **Money sink:** furniture now competes with R&D, production runs, and payroll for cash — a genuine
  bet (over-decorate early and you can't fund a launch). Resale at 50% means redecorating has a real,
  but not punishing, cost.
- **No soft-lock:** the starter desk guarantees the founder always has a seat; you can always sell
  furniture back for cash if you over-spend. Engine test asserts a broke player can still recover.

## 6. Phasing (each phase ships green: typecheck + tests + build)
- **Phase A — Model:** `cost`/`attrs`/`seat` on the catalog + `officeAttrs` + caps + selectors, wired
  to mood/research/design. Charge/refund in place/remove. New starter layout. Engine tests. *(No UI
  yet beyond costs working.)*
- **Phase B — Shop UI:** item cards with price + attribute chips, affordability/sell, Office overview.
- **Phase C — Mobile layout:** the `dvh` two-zone responsive rebuild; safe-area; snap; smoothness pass.
- **Phase D — Hire loop:** retire `buyDesktop` from Upgrades; surface "buy a desk → hire" in the shop
  + Company; the seat CTA.
- **Phase E — Polish & verify:** haptics/sound/motion, first-run coach, screenshot verification on a
  phone viewport, balance tuning via tests.

## 7. Risks / what could break (and the guard)
- **Balance destabilization** (furniture buffs stacking with upgrades) → hard caps + a balance test
  asserting max office attrs ≤ defined ceilings.
- **Saved-game economics** (old saves suddenly get attributes) → it's a one-way buff, no cash math on
  load; migration test covers it.
- **Mobile layout regressions on the 3D scene** (the keep-mounted HQ + dvh sizing) → verify on a 390px
  viewport screenshot pass; the `paused` frameloop work from the merged PR already de-risks the scene.
- **Removing `buyDesktop`** could strand a player mid-hire on an old save → keep counting `desktops`
  in `deskCapacity`; never remove existing seats.

## 8. Test plan (engine-first)
- `furniture.test.ts`: every item has a positive `cost`; `officeAttrs` sums correctly + respects caps;
  `defaultLayout` is collision-free and is exactly desk+plant; seats = desk count.
- `gameState`: place charges + rejects when broke; remove refunds 50%; mood/research/design selectors
  apply caps; hire still desk-gated; broke-player recovery via selling.
- `persistence`: old save loads, gets attributes, keeps legacy `desktops` seats; new save starts
  desk+plant.
- Screenshot pass (390×852): decorate mode with nothing clipped, shop sheet scrolls, cards show
  price + chips, Office overview animates.
