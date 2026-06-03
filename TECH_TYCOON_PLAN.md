# SILICON — Production Plan & Claude Code Build Sequence
### An isometric tech-company management sim for iOS

**App Store name:** `Silicon: Tech Tycoon` (LOCKED — 20 chars, ASO in §11)
**Working title:** Silicon
**Owner:** Isac (Wrexist)
**Target:** iOS 26, native SwiftUI (LOCKED)
**Genre:** Mid-depth management/tycoon sim — design & build tech products (phones, laptops, consoles), time the market, grow the company. "Game Dev Tycoon, but for hardware, modernised."
**Visual:** Isometric 2.5D vector, parametric device system (LOCKED)
**Monetization:** $8.99 premium, complete & winnable as-is; IAPs = post-launch expansions + cosmetics ONLY, never progression gates (LOCKED — see §8)
**v1 launch categories:** Phone + Tablet playable end-to-end; rest ship FREE via updates (see §10)
**Build partner:** Claude Opus 4.8 via Claude Code
**Document type:** Session handoff + ordered prompt library

---

## 0. One-paragraph pitch

You run a tech company from a garage to a global empire. You **choose what to build** — phones, laptops, desktops, tablets, consoles, wearables — by allocating R&D into components (chip, display, battery, materials), setting a design, pricing it, and launching it into a market that has trends, competitors, and shifting consumer taste. Good products that hit the right market window sell; over-engineered or mistimed ones flop. Profit funds bigger R&D, better staff, new product categories, and new facilities. The visual hook is a **clean isometric company HQ that visibly grows** — desks fill with staff, labs light up, production lines animate — while your products are rendered by a **parametric device engine** so every phone/laptop you design is drawn live, clean, and perfectly consistent, at any resolution, with zero image assets.

---

## 1. Design pillars (do not violate)

> **RULE #1 — ALWAYS, ABOVE EVERYTHING: it must look premium, polished, and clean.**
> This is the governing constraint on every screen, every animation, every state. If a choice
> trades polish for speed of development, the polish wins. Nothing ships looking unfinished,
> cramped, janky, or "indie-default." Every prompt in §7 restates this; the audit prompt (§12)
> checks it; the polish bar is defined concretely in §6 and §15. When in doubt, do less but
> make it flawless. A smaller game that looks impeccable beats a bigger one that looks cheap.

1. **Premium through restraint.** Clean isometric vector, generous whitespace, one tight
   palette + one accent, smooth spring motion. Premium = consistency, alignment, spacing,
   and polish — NOT detail density. "Designed," never "busy."
2. **The product IS the toy.** Designing a device — picking components, watching the
   parametric render update live, naming it, launching it — must be the most satisfying
   moment in the game, and visually the centerpiece.
3. **Meaningful choices over idle waiting.** A management *sim*, not an idle clicker. The
   player makes real bets (R&D allocation, market timing, pricing) that can fail.
4. **Zero image assets for hero content.** Devices, UI, icons are vector/parametric/SF
   Symbols, drawn in code — guaranteeing consistency and killing AI-art stigma. (§3, §5.)
5. **Readable simulation.** The player always understands *why* a product won or flopped.
   No black-box outcomes — every result traces to a visible, explained cause.
6. **Respect the player.** Premium monetization (§8), no dark patterns, no manipulative
   nags, no aggressive notifications. The game treats the player as someone who paid for craft.

---

## 2. Core gameplay specification

### 2.1 The main loop
```
RESEARCH   -> spend R&D budget to unlock/improve components (chips, displays, etc.)
DESIGN     -> create a product: pick category + components + design tier + price
             (parametric render updates live as you choose)
LAUNCH     -> release into the market at a chosen moment
MARKET     -> simulation scores the product vs. trends, competitors, hype, price
EARN       -> revenue flows in over the product's lifecycle (sales curve)
REINVEST   -> hire staff, expand HQ, unlock categories, fund next-gen R&D
REPEAT     -> at higher scale, with tougher market and bigger bets
```

### 2.2 Product categories (unlock progression)
Start with one, unlock the rest via company growth / milestones:
1. **Phone** (start here — the universal device)
2. **Tablet**
3. **Laptop**
4. **Desktop / Tower**
5. **Monitor / Display**
6. **Console** (gaming pivot)
7. **Wearable** (watch/earbuds — small, high-margin)
8. **"Next thing"** (late-game: AR glasses / experimental — high risk/reward)

### 2.3 Components system (the R&D depth)
Every product is built from component slots. Each component has a **tier** (1–N) you unlock via R&D, and contributes to product **stats**:

| Component | Drives stat | Notes |
|-----------|-------------|-------|
| Chip / SoC | Performance | the headline spec; expensive R&D |
| Display | Visual quality | tier affects perceived premium-ness |
| Battery | Endurance | tradeoff vs. thinness |
| Materials / Chassis | Build quality + cost | plastic→aluminium→titanium |
| Software / OS | Ecosystem | improves ALL products once researched |
| Camera (where relevant) | Feature score | category-dependent |

Product **stats** (Performance, Quality, Battery, Design, Ecosystem) are computed from chosen component tiers. The market scores these stats against **what consumers currently want** (see 2.4).

### 2.4 The market simulation (the heart — get this right)

This is what makes it a *sim* not a clicker. Each product launch is scored:

```
demandScore = Σ ( consumerWeight[stat] * productStat[stat] )   // weighted by current trends
hypeMultiplier = f(marketing spend, company reputation, launch timing)
priceFit = how product price compares to perceived value & competitor pricing
competitionPenalty = strength of rival products in same category/window
launchScore = demandScore * hypeMultiplier * priceFit - competitionPenalty
```

- **Consumer trends shift over time.** Some quarters the market craves battery; others crave performance or design. The player should research the trend signals and *time* launches. This is the core skill.
- **Reputation** is a long-term currency — consistent hits raise it; flops and overpricing lower it. High reputation boosts hype on future launches.
- **Sales curve:** a launched product sells over N in-game weeks following a curve (ramp → peak → decline), with total volume driven by launchScore. Player watches revenue accrue and decides when to launch the *next* gen (cannibalization vs. staleness tension).
- **Competitors:** 2–4 AI companies also launch products, occupying market windows and forcing the player to differentiate (price, timing, or a category they're weak in).

### 2.5 Company / management layer
- **Staff:** hire engineers (faster/better R&D), designers (raise Design stat ceiling), marketers (boost hype). Staff have a salary cost (ongoing burn) and skill levels. This creates the management tension: payroll vs. runway.
- **Facilities:** garage → small office → campus. Each tier raises staff capacity and unlocks systems. The HQ is the visible isometric scene that grows.
- **Cash & runway:** ongoing burn (salaries, rent) vs. lumpy revenue (product launches). Going broke = game-over/restart pressure. This is what makes choices matter.
- **Milestones / eras:** the tech era advances (think: feature-phone era → smartphone era → AI era), unlocking new components and categories, keeping the long game fresh.

### 2.6 Progression & "prestige"
- Long-term arc: garage indie → established brand → industry giant.
- Optional **new-company-plus**: after going "public" / hitting an end milestone, restart with permanent perks (a legacy bonus), for replayability. (Post-launch feature — not v1.)

### 2.7 Numbers / scale
- Use `Decimal` or a money type with proper rounding for cash (NOT Double — money math needs exact rounding). Big-number formatting for display ($1.2M, $3.4B).
- All balancing constants live in a single tunable config (see architecture) so the Phase "balancing pass" can adjust without touching logic.

---

## 3. The parametric device engine (THE signature system)

This is the asset strategy and the visual identity in one. **No device images exist.** Every product the player designs is drawn live from its component/design choices.

### 3.1 How it works
- Each **category** (phone, laptop, etc.) is a SwiftUI `Shape`/`Canvas` composition: a parametric template built from rounded rectangles, screen insets, camera bumps, hinges, stands, bezels.
- The template takes **parameters** derived from the product's design:
  - `bodyColor`, `accentColor` (from chosen materials/design)
  - `screenRatio`, `bezelThickness`, `cornerRadius` (from display tier / era)
  - `thickness` hint, `cameraCount`, `portCount` (from components)
  - `finish` (matte/gloss/metal — a gradient/shading style)
  - `eraDetailLevel` (chunky retro → sleek modern, advances with tech era)
- Result: the player picks a titanium chassis + top-tier display + triple camera, and the on-screen phone **redraws instantly** — thinner bezels, metallic shading, three camera dots. Infinite unique products, all in one perfectly-consistent visual language, all resolution-independent (crisp on every device + App Store screenshots), all zero-MB.

### 3.2 Why this is the right call (not negotiable for premium)
- **Consistency is automatic** — every device shares the exact same rendering language, so the catalog can never look "mismatched" the way independently-generated AI/illustrated assets do.
- **No AI-art stigma**, no licensing risk, no asset pipeline, no re-export when you change the palette.
- **Plays to your strengths** — this is a *coding* problem (SwiftUI Shapes + parameters), not an illustration problem. It's the single biggest reason this game is buildable solo at premium quality.

### 3.3 Isometric scene (the HQ)
- The company HQ is an isometric vector scene (also vector shapes, optionally a small kit of isometric tiles/furniture).
- It **grows visibly** with progress: more desks, staff figures (simple stylized vector avatars), lab equipment lighting up, a production line animating when a product is in manufacturing.
- Subtle ambient animation (blinking screens, moving figures) = the "alive" feeling, achieved cheaply with vector + simple transforms, no heavy assets.

### 3.4 AI's role: none in production
Per the locked decision, the moodboard step is skipped and the exact palette/typography/shape
language is specified directly in code (§6). AI image tools are **not** used for any production
asset — devices, scene, icons are all parametric vector + SF Symbols. This eliminates
consistency drift, AI-art stigma, and licensing risk in one move, and turns the asset problem
into a coding problem (your strength). Seed this rule into LEARNINGS.md so no future session
re-introduces image assets.

---

## 4. Technical architecture

### 4.1 Stack
- **SwiftUI 5** — all UI, the parametric device renderer (`Canvas`/`Shape`), the isometric scene.
- **Swift 6**, strict concurrency, `@Observable` state.
- **SwiftData** — persistence (company, products, staff, market state, save versioning).
- **Swift Charts** — sales curves, market-trend graphs, financials (premium, native, free).
- **TimelineView / custom tick** — drives the simulation clock.
- **StoreKit 2** — monetization.
- **No backend at launch.** Fully offline. (Optional cloud save / leaderboard post-launch.)
- **Optional later:** SpriteKit via `SpriteView` ONLY if the HQ animation outgrows SwiftUI — start in pure SwiftUI, escalate only if needed.

### 4.2 Architecture pattern (mirrors your Dynasty Manager separation)
```
Sources/
  Engine/              # PURE logic, no UI imports — fully unit-testable
    Money.swift              # money type, exact rounding, formatting
    ComponentSystem.swift    # component tiers, stat computation
    ProductModel.swift       # a designed product + its computed stats
    MarketSimulation.swift   # demand, trends, hype, pricing, launch scoring
    SalesCurve.swift         # revenue-over-time after launch
    Competitor AI.swift      # rival company behaviour
    CompanyEconomy.swift     # cash, burn, payroll, runway
    TechEra.swift            # era progression, unlocks
    BalanceConfig.swift      # ALL tunable constants in one place
  State/
    GameStore.swift          # @Observable, composes engine, owns the sim tick
    SettingsStore.swift
  Data/
    ComponentCatalog.swift   # static component definitions per category
    CategoryCatalog.swift    # the 8 product categories + unlock rules
    SaveModel.swift          # SwiftData @Model + schema version/migration
  Render/                    # the signature parametric engine
    DeviceRenderer.swift     # routes a product -> the right category shape
    PhoneShape.swift, LaptopShape.swift, ... (one per category)
    DeviceStyle.swift        # colors, finishes, shading, era detailing
    IsometricScene.swift     # the HQ scene
    IsoTileKit.swift         # reusable isometric furniture/desk/lab pieces
  Views/
    HQView.swift             # main scene + HUD
    DesignLabView.swift      # the product designer (live parametric preview)
    ResearchView.swift       # R&D tree / component upgrades
    MarketView.swift         # trends, competitors, your launched products
    FinancialsView.swift     # cash, charts, payroll
    StaffView.swift          # hire/manage staff
    FacilitiesView.swift     # upgrade HQ
    SettingsView.swift
  App/
    SiliconApp.swift
```

**Golden rule:** `Engine/` imports nothing from SwiftUI. The entire simulation is pure Swift and unit-tested. This is what prevents the orchestration-slice bloat you hit on Dynasty Manager, and it lets the market sim be tuned via tests.

**Protected (no refactor without explicit instruction):** `Engine/`, `Data/SaveModel.swift` + migrations, `Render/DeviceRenderer.swift` + category shapes, StoreKit config.

---

## 5. Asset strategy summary (so it's unambiguous)

| Asset type | How it's made | Why |
|------------|---------------|-----|
| Product devices (hero) | **Parametric SwiftUI shapes** | infinite, consistent, zero-MB, resolution-free, no stigma |
| UI / icons | **SF Symbols + vector shapes** | native, premium, free, consistent |
| HQ scene + furniture | **Vector iso-tile kit (code or simple SVG)** | cheap "alive" depth, consistent |
| Staff avatars | **Simple stylized vector figures (parametric: skin/hair/outfit recolors)** | variety from one system |
| Charts | **Swift Charts** | native, premium |
| Concept exploration | **None — skipped** | palette/style locked in code (§6); no AI assets in production |
| Sound/music | **Licensed royalty-free, logged in ASSETS_LICENSE.md** | same IP discipline as your other projects |

**Net: you create essentially no individual hero image assets.** The "build all assets individually with AI" path is explicitly rejected — it would *lower* quality here via inconsistency + stigma, and cost more effort than the parametric system.

---

## 6. Locked visual design system (moodboard skipped — build to these values)

No moodboard step. These are the exact tokens to implement in code (Prompt 8 builds
DeviceStyle and the design system against these). The aesthetic: **clean isometric vector,
premium minimal, generous whitespace, one tight palette + one bold accent.**

**Color palette (light theme — primary):**
- Background / canvas: `#F4F5F7` (soft cool off-white)
- Surface / cards: `#FFFFFF`
- Primary ink / text: `#1A1D23` (near-black, never pure black)
- Secondary text: `#6B7280` (cool grey)
- Hairlines / dividers: `#E5E7EB`
- **Accent (brand, use sparingly):** `#3B82F6` (confident blue) with a secondary pop `#10B981`
  (success green for revenue/positive) and `#EF4444` (red for loss/flop) — semantic only.
- Device-material shades: plastic `#9CA3AF`, aluminium gradient `#D1D5DB→#9CA3AF`,
  titanium gradient `#A8A29E→#78716C`, gold accent finish `#D4AF37` (premium tier reward).

**Dark theme:** invert to `#0F1115` bg / `#1A1D23` surface / `#F4F5F7` text, same accents.
Ship both; respect system setting.

**Typography:**
- Use **SF Pro** (system) throughout — it's premium, free, native, and zero-asset. Rounded
  variant (SF Pro Rounded) for big numbers/currency to feel friendly; standard SF Pro for body.
- Type scale: Large title 34 / title 28 / headline 20 semibold / body 17 / caption 13.
- Generous line spacing, tabular figures for all money/stats (so numbers don't jitter).

**Shape & motion language:**
- Corner radius: cards 16, buttons 12, device bezels parametric (8–28 by era/tier).
- Isometric projection: 2:1 tile ratio (standard iso), light source top-left, soft long shadows.
- Motion: spring animations (response ~0.35, damping ~0.8) for device-preview redraws and
  panel transitions; everything eases, nothing snaps. Count-up tweens on money/stats.
- Depth via soft layered shadows + subtle gradients, NOT heavy detail. Restraint = premium.

> AI image tools are NOT used for production assets at all in this project. If a future
> session proposes generating image assets, that violates the locked asset strategy (§3, §5)
> — devices/scene/icons are parametric vector + SF Symbols only. (This is seeded in LEARNINGS.md.)

### 6.1 Spacing & layout grid (the invisible thing that reads as "premium")
- **8-point spacing system.** All padding/margins/gaps are multiples of 4, preferably 8:
  4, 8, 12, 16, 24, 32, 48. Nothing arbitrary. This single rule is responsible for most of
  the difference between "designed" and "indie-default."
- Screen edge margin: 20pt. Card internal padding: 16–20pt. Section gaps: 24–32pt.
- **Alignment is law:** everything aligns to the grid; no off-by-a-pixel labels. Numbers
  right-align in columns; labels left-align. Optical alignment over mathematical where they differ.
- Touch targets ≥ 44×44pt (Apple HIG). Generous, never cramped.
- One screen = one primary action. Don't crowd. Whitespace is a feature, not wasted space.

### 6.2 Component design tokens (build a real design system, not ad-hoc views)
Prompt 8 creates a `DesignSystem` namespace so every view pulls from tokens — never hardcodes:
- `DS.Color.*` (semantic: bg, surface, surfaceElevated, ink, inkSecondary, hairline, accent,
  positive, negative, warning) — all theme-aware (light/dark).
- `DS.Spacing.*` (xs4, sm8, md16, lg24, xl32, xxl48).
- `DS.Radius.*` (button12, card16, sheet24, pill).
- `DS.Shadow.*` (subtle, card, floating — soft, low-opacity, never harsh).
- `DS.Type.*` (largeTitle, title, headline, body, caption — with tabular-figure money style).
- `DS.Motion.*` (springStandard, springSnappy, springGentle, countUp duration).
- Reusable primitives: `DSCard`, `DSButton` (primary/secondary/tertiary/destructive),
  `DSStatPill`, `DSSectionHeader`, `DSSheet`, `DSEmptyState`, `DSToast`. Every screen is
  assembled from these so polish is consistent and free everywhere.

### 6.3 The parametric DeviceStyle spec (the make-or-break for "premium devices")
This is the most important visual system in the game — it determines whether designed devices
look like a flagship product render or like clip-art. Build `Render/DeviceStyle.swift` to map a
product's chosen components/design/era → these exact visual parameters:

**Inputs → visual mappings:**
| Design input | Visual parameter | Range / behavior |
|---|---|---|
| Materials tier | `bodyFinish` | plastic = flat matte fill; aluminium = subtle linear gradient + soft specular edge; titanium = brushed-metal gradient + crisp edge highlight; gold/premium = warm gradient + glow accent |
| Materials tier | `edgeHighlight` | width 0→1.5pt, opacity 0→0.4 (higher tiers get a crisper rim light) |
| Display tier | `bezelThickness` | 28pt (low) → 6pt (flagship) — thinner bezel = more premium, biggest visual "wow" lever |
| Display tier | `screenInset` + `cornerRadius` | higher tier = tighter inset, larger smooth radius (squircle, not circular arc) |
| Display tier | `screenContent` | off (low) → subtle gradient "on" glow → animated shimmer (flagship) |
| Chip tier | (no direct visual; shown in stats) | keep visual honesty — perf isn't visible on a body |
| Camera count | `cameraModules` | 1→4 lenses, laid out in a clean module with consistent spacing + lens depth shading |
| Design tier | `overallProportion` | refines aspect ratio, symmetry, button placement toward "considered" |
| Era | `eraDetailLevel` | retro = chunkier, thicker bezels, visible buttons; modern = sleek, minimal, seamless |
| Color choice | `bodyColor` + `accentColor` | from a curated, always-harmonious palette set (never let the player pick clashing colors — premium = curated swatches, not a raw color wheel) |

**Rendering rules (non-negotiable for the premium look):**
- **Squircle corners** (continuous curvature, like Apple hardware), never plain rounded rects.
- **Soft layered shadow** under each device (ambient + key), light from top-left, consistent
  across all categories so the catalog feels like one product family.
- **Subtle material gradients**, never flat dead fills on metal/glass finishes; screens get a
  faint top-down glass reflection sheen.
- **Pixel-crisp at all sizes** (it's vector) — verify on the design-lab hero size AND the small
  catalog thumbnail; both must look intentional.
- **Curated color system:** offer ~8–10 hand-picked device colors per finish that are
  guaranteed to look good with the UI palette. No freeform color picker — curation is premium.
- A 3/4 or front-on presentation in the Design Lab with a slow idle float + parallax so the
  hero device feels physical and alive (the screenshot moment).

### 6.4 Microinteraction & polish checklist (applies to every interactive element)
- Button press: subtle scale-down (0.97) + haptic; release springs back. No instant flat taps.
- Money/stat changes: count-up tween + brief color flash (green up / red down), never snap.
- Screen transitions: matched-geometry where it makes sense (e.g. device thumbnail → hero);
  otherwise gentle spring slide/fade. No hard cuts.
- Empty states: every list/screen that can be empty has a designed `DSEmptyState` (icon +
  one-line copy + action), never a blank void.
- Loading/async: skeleton shimmers or smooth spinners, never a frozen frame.
- Success moments (product launch, milestone): a tasteful celebratory beat — confetti is too
  much; think a smooth scale-in, soft glow, a satisfying sound + haptic. Premium = restrained joy.
- Sound: a small, cohesive set of soft, high-quality UI sounds (tap, confirm, launch, success,
  error). Subtle, mutable, never cartoonish. Licensed + logged.
- Haptics: Core Haptics for confirm/launch/milestone — crisp, meaningful, not constant buzzing.
- Respect Reduce Motion / Reduce Transparency / Increase Contrast at all times.

---

## 7. The Claude Code build sequence

Same workflow as your other projects: one focused session per prompt, ends with `Stop.`, commit after each. Paste into Claude Code (Opus 4.8) one at a time. Don't run ahead.

> **PREMIUM MANDATE (prepend to every prompt, or keep it as a standing rule in CLAUDE.md so
> it always applies):** "RULE #1: the result must look premium, polished, and clean — use the
> DesignSystem tokens (§6.2), the 8pt grid (§6.1), the motion/microinteraction rules (§6.4).
> Never hardcode colors/spacing, never ship a cramped or unfinished-looking screen, never a
> blank empty state. If something can't be made to look polished in this session, leave it out
> and log it rather than ship it rough."

> Before prompt 1: create the Xcode project manually (iOS app, SwiftUI, name it, bundle ID, iOS 26 target, Swift 6 strict concurrency). Point Claude Code at the repo.

---

### PROMPT 1 — Scaffold & handoff docs
```
You are working on SILICON, a native SwiftUI management/tycoon sim for iOS 26 (Swift 6
strict concurrency) where the player designs and sells tech products (phones, laptops,
etc.). Read the existing Xcode project structure first.

Create the folder structure under Sources/: Engine, State, Data, Render, Views, App.
Add a placeholder Swift file in each with a doc comment stating that module's single
responsibility. Enforce the rule that Engine/ imports no UI frameworks.

Create three root handoff docs:
- CLAUDE.md: project overview, the 6 design pillars (RULE #1 = premium/polished/clean above
  all), architecture rules (Engine/ is pure; parametric device engine is the asset strategy;
  protected directories), commit-per-turn, AND the standing audit/quality rules from §12 (the
  END-OF-SESSION CHECK + the rule that improvements get logged to TASK.md, not acted on
  mid-session), AND the PREMIUM MANDATE banner from §7.
- TASK.md: the full build plan (I'll paste the phase list) with an empty `## Backlog` section.
- LEARNINGS.md: seed it with the asset-strategy decision (devices/scene/icons are parametric
  vector + SF Symbols, NOT images; no AI assets in production) and the locked design system
  (§6) so no future session re-introduces image assets or hardcodes styles.

No game logic yet. Commit "chore: scaffold and handoff docs". Stop.
```

### PROMPT 1B — Design system foundation (build BEFORE any view)
```
Implement the DesignSystem namespace in Render/ (or a DesignSystem/ folder) per §6.1–6.2 and
the locked palette/typography in §6. This is the foundation every screen is built from — it
exists before any view so polish is consistent and free everywhere.

Create:
- DS.Color (theme-aware semantic colors, light + dark), DS.Spacing (8pt scale), DS.Radius,
  DS.Shadow (soft layered), DS.Type (with tabular-figure money style), DS.Motion (named springs
  + count-up duration).
- Reusable primitives: DSCard, DSButton (primary/secondary/tertiary/destructive with press
  scale + haptic), DSStatPill, DSSectionHeader, DSSheet, DSEmptyState, DSToast.
- A SwiftUI preview "kitchen sink" screen showing every token and primitive in light AND dark,
  so the design language is visible and reviewable in one place.

These primitives must be used by ALL later view prompts — no view hardcodes color/spacing/font.
Make it look genuinely premium: correct spacing, soft shadows, crisp type. Commit
"feat: design system foundation + kitchen-sink preview". Stop.
```

### PROMPT 2 — Money type + balance config
```
Implement Engine/Money.swift: a money value type backed by Decimal with exact rounding,
arithmetic, comparison, Codable, and formatted display ($1.23K, $4.56M, $7.89B, $1.2T).
NEVER use Double for money. Write unit tests (rounding edge cases, formatting thresholds,
Codable round-trip).

Implement Engine/BalanceConfig.swift: a single struct holding ALL tunable constants
(starting cash, salary ranges, R&D costs, market weights, sales-curve shape params, era
thresholds). Everything else reads from here so balancing never touches logic. Stub with
reasonable first-pass values.
Commit "feat: money type and balance config with tests". Stop.
```

### PROMPT 3 — Static catalogs (categories + components)
```
Create Data/CategoryCatalog.swift and Data/ComponentCatalog.swift — the single source of
truth for content.

CategoryCatalog: the 8 product categories (phone, tablet, laptop, desktop, monitor, console,
wearable, experimental) with: id, displayName, unlock rule, which component slots apply,
which stats matter most. Phone is the starter.

ComponentCatalog: components (chip, display, battery, materials, software, camera) each with
tiers (1..N), per-tier cost (Money), R&D cost, and the stat contribution per tier. Strongly
typed, no stringly-typed lookups.

Add an integrity unit test (unique ids, ascending tier costs, every category references valid
component slots). Commit "feat: category and component catalogs". Stop.
```

### PROMPT 4 — Product model + stat computation
```
Implement Engine/ProductModel.swift and Engine/ComponentSystem.swift. PURE logic.

A Product = chosen category + selected component tiers + design tier + price + name.
ComponentSystem computes the product's Stats (Performance, Quality, Battery, Design,
Ecosystem) from the selected component tiers, using BalanceConfig weights and the catalogs.
Also compute unit build cost (sum of component costs) — this feeds margin later.

Unit tests: stat computation for known configs, build-cost summation, boundary tiers.
Commit "feat: product model and stat computation with tests". Stop.
```

### PROMPT 5 — Market simulation
```
Implement Engine/MarketSimulation.swift and Engine/SalesCurve.swift. PURE logic. This is
the core of the game — read §2.4 of the design doc (I'll paste it).

MarketSimulation holds current consumer trend weights (which stats are in demand this
period) and evolves them over time. scoreLaunch(product, hype, competitorStrength) returns
a launchScore from demandScore * hypeMultiplier * priceFit - competitionPenalty.

SalesCurve: given a launchScore, produce a revenue-over-weeks curve (ramp/peak/decline) and
expose weekly revenue for the sim tick.

Unit tests: a great-fit product beats a mistimed one; overpricing reduces priceFit; trend
shifts change which products win; sales curve integrates to sensible totals. All pass.
Commit "feat: market simulation and sales curves with tests". Stop.
```

### PROMPT 6 — Competitor AI, company economy, tech eras
```
Implement Engine/CompetitorAI.swift, Engine/CompanyEconomy.swift, Engine/TechEra.swift.
PURE logic.

CompetitorAI: 2-4 rival companies that periodically launch products into categories/windows
with their own (simpler) strategies, producing competitorStrength values the market sim uses.

CompanyEconomy: cash, ongoing burn (salaries + facility rent), revenue intake from active
sales curves, runway calculation, bankruptcy condition.

TechEra: era progression gated by milestones/time; advancing unlocks new component tiers and
categories; raises the detail level passed to the renderer.

Unit tests for each (rival cadence, runway/bankruptcy math, era unlock gating). Stop.
```

### PROMPT 7 — Game store + SwiftData persistence + sim clock
```
Implement State/GameStore.swift (@Observable) composing all engine systems and owning the
simulation tick (a time-based clock advancing the market, sales curves, burn, and trends).
Expose published state to the UI.

Implement Data/SaveModel.swift (SwiftData @Model) + save/load persisting: company (cash,
reputation, era), staff, facilities, all designed/launched products + their sales-curve
progress, market trend state, competitor state, lastActiveTimestamp. Include a schema
version field and a migration strategy (treat SaveModel + migrations as protected — must
never wipe a player's company).

On launch: load, advance the sim for elapsed offline time (capped, at a reduced rate),
present a "while you were away" summary.
Test: save -> mutate -> load is identical; offline advance is deterministic. Stop.
```

### PROMPT 8 — Parametric device renderer (THE signature system)
```
Implement the parametric device engine in Render/. Read §3 AND §6.3 (the detailed DeviceStyle
spec) first. NO image assets — everything is SwiftUI Shape/Canvas. This is the make-or-break
premium system; hold it to a flagship-product-render bar, not clip-art.

- DeviceStyle.swift: implement the EXACT input→visual mappings from the §6.3 table (bodyFinish,
  edgeHighlight, bezelThickness, screenInset, squircle cornerRadius, screenContent glow,
  cameraModules, eraDetailLevel) plus the curated device-color system (hand-picked harmonious
  swatches per finish — NO freeform color wheel).
- Build PHONE and TABLET first (the v1 launch categories): parametric Shape/Canvas views with
  squircle corners (continuous curvature), soft layered shadow (light top-left), subtle material
  gradients on metal/glass, faint screen reflection sheen.
- DeviceRenderer.swift: takes a Product, routes to the category view, applies DeviceStyle,
  renders pixel-crisp at ANY size (verify hero size AND small thumbnail both look intentional).

Build a SwiftUI preview gallery: same category across low/mid/flagship tiers and several
curated colors, in light + dark, to prove consistency + premium feel. It must genuinely look
like a high-end product render. Commit "feat: parametric device renderer (phone, tablet)". Stop.
```

### PROMPT 9 — Remaining device categories (post-core; do after the v1 loop is solid)
```
NOTE: phone + tablet (Prompt 8) are the v1 launch categories. Do this prompt AFTER the core
loop and screens are polished and shippable — these categories ship FREE via updates (laptop,
desktop, monitor) or as the basis for paid expansions (console/experimental as additive layers).

Extend the parametric renderer with: laptop, desktop/tower, monitor, console, wearable,
experimental. Each a parametric Shape/Canvas view fully consistent with the established
DeviceStyle language (§6.3) — same squircle/shadow/gradient/sheen rules, same curated colors,
so the whole catalog looks like ONE coherent premium product family.

Update the preview gallery to show all categories across tiers/colors, light + dark, in one
screen. Verify cross-category visual consistency. Commit "feat: remaining device categories". Stop.
```

### PROMPT 10 — Design Lab (the core toy)
```
Build Views/DesignLabView.swift — the product designer and the most important screen.
Player picks category, selects component tiers (gated by what's researched), picks design
tier + finish/color, sets price, names the product. The parametric device preview updates
LIVE as choices change, and a stats panel (Performance/Quality/Battery/Design/Ecosystem) +
projected unit cost + margin update live too.

A "Launch" action validates affordability and hands the product to the market sim via
GameStore. Make the live-redraw feel delightful (smooth animated transitions on the device
preview when a component changes). No business logic in the view — route through GameStore.
Commit "feat: design lab with live parametric preview". Stop.
```

### PROMPT 11 — Research & Market screens
```
Build Views/ResearchView.swift and Views/MarketView.swift.

ResearchView: the R&D tree — spend R&D budget to unlock/upgrade component tiers per the
catalog; show costs, current tier, locked/unlocked state, and what each unlock improves.

MarketView: show current consumer trends (which stats are hot now, with a Swift Charts
trend graph), your active launched products with their live sales curves, competitor
launches in each category, and your reputation. This is where the player reads the market
to time the next launch. Route everything through GameStore. Stop.
```

### PROMPT 12 — Isometric HQ scene + HUD + navigation
```
Build Render/IsometricScene.swift + Render/IsoTileKit.swift and Views/HQView.swift as the
main shell. Read §3.3.

Isometric vector HQ that grows with progress: desks, staff figures, lab benches, a
production line that animates when manufacturing. Start in pure SwiftUI (Canvas / stacked
iso tiles); subtle ambient animation (blinking screens, small figure motion) for the
"alive" feel. Top HUD: cash, reputation, current era, date/quarter. Bottom navigation to
Design Lab, Research, Market, Staff, Facilities, Financials, Settings.

Handle safe areas / Dynamic Island. Keep 60fps (120 on ProMotion). Commit
"feat: isometric HQ scene, HUD and navigation". Stop.
```

### PROMPT 13 — Staff, Facilities, Financials screens
```
Build Views/StaffView.swift, Views/FacilitiesView.swift, Views/FinancialsView.swift.

Staff: hire/fire engineers, designers, marketers; show skill levels, salaries, and their
effect (R&D speed, Design ceiling, hype). Reflect payroll burn in economy.

Facilities: upgrade garage -> office -> campus; each raises staff capacity / unlocks systems
and visibly upgrades the isometric HQ.

Financials: Swift Charts dashboards — cash over time, revenue per product, payroll vs income,
runway. Premium, readable. Route through GameStore. Stop.
```

### PROMPT 14 — Balancing pass & game-feel tuning
```
Read all Engine systems + BalanceConfig. Do a full balancing pass via a test harness that
fast-forwards the simulation and prints time-to-milestones: first profitable product, first
$1M, first category unlock, first era advance, typical bankruptcy causes. Tune BalanceConfig
ONLY (not logic) until: early game is forgiving and teachable, mid game requires real market
timing, a careless player can go broke, a skilled player scales. Document final tuned numbers
+ the reasoning in LEARNINGS.md.

Also tune game feel: device-preview animation timing, sim tick rate, number count-up tweens.
Stop.
```

### PROMPT 15 — Onboarding / tutorial
```
Build a lightweight first-run onboarding that teaches the loop by DOING, not by walls of
text: guided first product (pick a chip, pick a screen, set a price, launch), then show the
result and explain why it sold. Gate the deeper systems (competitors, eras, staff) to unlock
as the player progresses so the first 5 minutes aren't overwhelming. Make it skippable and
ensure it never blocks a returning player. Route through GameStore. Stop.
```

### PROMPT 16 — StoreKit 2 monetization ($8.99 premium + clean IAPs)
```
Implement StoreKit 2 monetization per §8 (LOCKED). The app is PAID at $8.99 and must be a
complete, winnable game with no progression behind any IAP.

Implement the IAP system to SUPPORT three product types, but only SANDBOX ships live at launch:
- LIVE at launch: "Sandbox / Creative Mode" unlock (~$1.99) — unlimited money / free-build /
  scenario experimentation. Gates ONLY that mode; campaign is untouched and fully winnable.
- SCAFFOLD now, content later: Expansion DLC entitlements (new era / new "city" market /
  scenario packs) and Cosmetic packs (HQ themes, device finishes via DeviceStyle). Build the
  entitlement + purchase + restore plumbing so future content is a data drop, not a rebuild.
  Do NOT expose empty DLC/cosmetic products in the store UI at launch — hide until content exists.

Build: purchase flow, StoreKit 2 transaction verification, restore purchases, entitlement
checks, a StoreKit config file for local testing. Add a clear, non-pushy in-game store
screen. Assert via test that with ZERO purchases the full campaign is completable.
Also: note in LEARNINGS.md to enroll in Apple's Small Business Program (15% cut).
Commit "feat: storekit2 premium + clean IAP system". Stop.
```

### PROMPT 16B — Dedicated premium polish pass (the "make it feel $9" session)
```
POLISH SESSION — no new features. Goal: raise every screen to the premium bar (RULE #1).
Read §6 (all subsections) and §6.4. Go screen by screen and harden the FEEL:

- Verify every view uses DesignSystem tokens — fix any hardcoded color/spacing/font/radius.
- Apply the 8pt grid everywhere; fix any cramped padding, misalignment, or inconsistent gaps.
- Add/verify microinteractions (§6.4): button press scale+haptic, count-up tweens with
  color flash on money/stats, spring transitions, matched-geometry device thumbnail→hero.
- Ensure every possible empty/loading state is a designed DSEmptyState / skeleton — no blank
  or frozen frames anywhere.
- Polish the Design Lab hero device: idle float + parallax, smooth animated transitions when
  components change — this is the screenshot moment, make it sing.
- Polish launch/milestone success beats (restrained: scale-in + soft glow + sound + haptic).
- Pass over typography: tabular figures on all numbers, correct hierarchy, no orphaned labels.
- Light AND dark theme both look intentional on every screen.

Produce a short before/after notes list in LEARNINGS.md of what was tightened. Run tests green.
Commit "polish: premium feel pass across all screens". Stop.
```

### PROMPT 17 — Accessibility, performance, App Store prep
```
Final pass:
- Accessibility: VoiceOver labels on all controls and on the device preview (describe the
  rendered product in words), Dynamic Type support, Reduce Motion / Reduce Transparency /
  Increase Contrast alternatives honored everywhere (esp. HQ ambient animation + device float).
- PrivacyInfo.xcprivacy with correct required-reason API declarations; no tracking SDKs at
  launch. Verify no iOS 26 required-reason API violations.
- App icon (design a clean, premium, parametric-device-inspired icon spec) + polished launch screen.
- Performance: hold 120fps on ProMotion under load (device-preview redraws, iso scene ambient
  animation, sim ticks), stable memory over a long session, no main-thread stalls.
- Write STORE_LISTING.md: name, subtitle, keyword field, screenshot captions, full description,
  respecting character limits, using the §11 ASO structure. Plan screenshots that LEAD with the
  Design Lab hero device + the growing HQ (the premium-look selling points).
Run a pre-submission P0 blocker checklist (incl. a RULE #1 premium-look sign-off) and report. Stop.
```

---

## 8. Monetization (LOCKED — $8.99 premium + non-progression IAPs)

**Price point:** $8.99 paid upfront (premium positioning, fits the management-sim audience
and the premium vector look).

**The governing rule (non-negotiable):** the $8.99 buys a COMPLETE, WINNABLE game. A player
who never spends another cent must feel they got a full, finished product. Every IAP is
something a *satisfied* player buys for *more*, never something a player needs to feel the
base game is whole.

**Why this rule exists (researched):** people who buy paid apps are specifically paying to
AVOID being nickel-and-dimed. A $9 game that then paywalls progression triggers the "paid
twice" reaction — and a premium app with no free tier lives or dies on its rating, with no
free-user funnel to absorb angry reviews. Content/progression IAPs on top of a purchase price
are the #1 review-killer for premium games and now actively backfire industry-wide.

**Allowed IAPs — staged:**

*v1 (at launch):*
1. **Sandbox / Creative mode unlock (~$1.99):** unlimited-money / scenario-editor / free-build
   mode for players who want to experiment or who've finished the campaign. Touches no
   campaign progression. This is the ONE IAP at launch — clean, additive, premium-friendly.

*Post-launch (scaffold the entitlement system in v1, ship the content later):*
2. **Expansion DLC (~$2.99–$4.99):** substantial NEW content — a new tech era ("AI age"), a
   scenario/campaign pack, or a **new-market/"new city" expansion** with its own rivals,
   trends and mechanics. The "move to a new city" idea works ONLY as a meaty expansion that
   adds a new layer — never as a gate on normal progression.
3. **Cosmetic packs (~$0.99–$1.99):** HQ visual themes, device-finish/color packs, UI skins.
   Zero gameplay effect.

> The StoreKit system is built in v1 to support all three (so adding DLC/cosmetics later is a
> content drop, not an architecture change), but only the Sandbox unlock is live at launch.

**Forbidden in this game:** selling in-game currency, "skip the wait" / speed-up boosts,
loot boxes/gacha, anything gating the base campaign, forced ads/interstitials. These destroy
a premium app.

**Pricing the IAPs:** expansions ~$2.99–$4.99 each (priced as "worth it for the extra
content"); cosmetic packs ~$0.99–$1.99; sandbox unlock ~$1.99. Keep the whole catalog small
and legible — premium buyers reward restraint.

> Note on app-store cut: Apple takes ~30% (15% if enrolled in the Small Business Program,
> which you almost certainly qualify for — enroll). A direct-to-consumer web shop (lower cut)
> is a known tactic but is overkill at your scale and adds compliance overhead — skip for v1.

## 9. Go-to-market notes
- The shareable/marketing hook is **the Design Lab**: a short clip of designing a device and watching the parametric render update is genuinely satisfying and screenshot-friendly. Lead store screenshots with the designer + the growing HQ.
- Management-sim players find games via search ("tycoon", "company simulator", "business sim") and word of mouth more than virality — ASO + a few good screenshots + a clear premium look does a lot of the work. Less dependent on the meme-virality lottery than the clicker.
- The premium vector look is itself the differentiator in a genre full of "same low-poly Unity template" games.

## 10. Scope discipline (so this actually ships)
- **v1 = the full loop, kept tight:** start with **phone + tablet** categories playable
  end-to-end (design → launch → market → reinvest), the market sim, staff, one facility
  upgrade, financials. The base $8.99 game must feel COMPLETE with just these two.
- Prompts 8–9 build all categories in the *renderer* (cheap, since parametric), but you gate
  which are *unlocked in gameplay* via catalog flags — render-ready, gameplay-gated.
- **Critical monetization/scope distinction (write this in CLAUDE.md):**
  - Categories that complete the *core* experience (laptop, desktop, monitor) ship **FREE via
    updates** — they're part of the complete game promise, just staged.
  - Only genuinely *additive* layers (a new era, a new market/"city", scenario packs) may be
    **paid expansions**. Never paywall something that makes the base game feel incomplete.
- Resist adding deep factory/supply-chain mechanics in v1. That was the rejected over-scope.
  The management-sim loop is the game; depth comes from market timing + R&D + economy.

## 11. App Store name & ASO (name LOCKED, metadata to validate)
**App Title (LOCKED):** `Silicon: Tech Tycoon` (20 chars — room to spare).
- "Silicon" = brandable, evocative, ownable; "Tech Tycoon" = two high-intent genre keywords
  ("tycoon" is the primary search term for this genre) in the title where they rank strongest.

**Subtitle (≤30 char, draft):** `Build a phone empire & sim` or `Design, sell, run your company`
— pick up "build", "empire", "design", "company", "sim" without repeating "tycoon"/"tech".

**Keyword field (100 char, comma-separated, no spaces, draft):**
`business,simulation,management,idle,startup,manager,phone,gadget,empire,strategy,money,builder`

**Still validate before submitting (don't skip):** confirm "Silicon: Tech Tycoon" is free on
the App Store + clear on a trademark search; run title/subtitle/keywords through an ASO tool
(AppTweak / App Radar / Sensor Tower) for real volume + difficulty and swap weak terms.
> IP discipline: no real brand/company/product names anywhere (no "iPhone", no real chip
> names). Fictional components only — same ship-blocker rule as the EA FC flag on Dynasty Manager.

## 12. Audit & quality discipline (your "always fix & improve" request, done right)

You asked that every prompt continuously hunt for incomplete features, bugs, crashes, and
improvements. That instinct is right, but bolting "also improve everything" onto every prompt
causes scope creep that prevents sessions from ever converging. Here's the disciplined version
that gets you the same outcome without the thrash:

**A. Standing rule (goes in CLAUDE.md, applies to every session):**
- End every session with a short **END-OF-SESSION CHECK**: does the code compile, do tests
  pass, are there obvious crashes/force-unwraps/`TODO`s in what was just touched? Fix anything
  *within the current task's scope* before committing.
- If you spot an improvement or incomplete feature **outside** the current task, DO NOT act on
  it — append it to a `## Backlog` section in TASK.md as a one-line note. This keeps sessions
  focused while capturing every idea.
- Never leave the build broken between sessions. A session that can't finish cleanly should
  revert to the last green commit, not commit half-work.

**B. Dedicated audit checkpoints (run these as their own sessions at intervals):**
Insert an audit pass after Prompt 7 (engine+state done), after Prompt 13 (all screens done),
and as the final Prompt 17. Use the AUDIT PROMPT below. These are where "find and fix
everything" actually happens — concentrated, not constant.

**AUDIT PROMPT (reusable — run at each checkpoint):**
```
AUDIT SESSION — do not add new features. Read CLAUDE.md, TASK.md (incl. Backlog), and
LEARNINGS.md first. Then systematically review the codebase and report findings grouped as:
1. CRASHES & CORRECTNESS: force-unwraps, array out-of-bounds, unhandled errors, retain
   cycles, main-actor violations, save/load data-loss risks, money/Double misuse.
2. INCOMPLETE: stubbed functions, unfinished features, dead code, TODOs, views not wired to
   the store, catalog entries with placeholder values.
3. ARCHITECTURE DRIFT: any Engine/ file importing UI; logic leaking into Views; protected
   files modified; orchestration bloat (a single file growing too large).
4. PERFORMANCE: dropped frames in device-preview redraw or iso scene, unnecessary
   recomputation, large @Observable invalidations.
5. IMPROVEMENTS (propose, don't build): concrete polish/feature ideas with a one-line
   rationale and rough effort estimate.

Then FIX everything in categories 1–4 (these are correctness/quality, in-scope). For
category 5, append to TASK.md Backlog for me to prioritize — do NOT implement without my go.
Update LEARNINGS.md with anything non-obvious you discovered. Run all tests; report green.
Commit "chore: audit pass — fixes + backlog". Stop.
```

**C. The split that matters:** bugs/crashes/incompleteness/drift = fix immediately (it's
quality). New features/improvements = log to backlog, you decide (it's scope). This is how you
get a continuously-hardening codebase without sessions that never end.
1. ✅ **Monetization:** $8.99 premium, complete & winnable. **v1 IAP = Sandbox/Creative mode
   unlock only.** DLC expansions (new era / "new city" market / scenarios) + cosmetics are
   scaffolded in v1 but ship as post-launch content. No progression gates, currency, boosts,
   or ads, ever. (§8)
2. ✅ **Name:** `Silicon: Tech Tycoon` — pending availability/trademark/ASO validation (§11).
3. ✅ **v1 categories:** Phone + Tablet end-to-end; core categories (laptop/desktop/monitor)
   ship FREE via updates; only additive layers are paid expansions. (§10)
4. ✅ **Art direction:** moodboard skipped — exact palette/typography/DeviceStyle is specified
   in code (see §6); the build sequence includes standing audit discipline (see §12).
