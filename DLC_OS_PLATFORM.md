# DLC #1 — The OS / Platform Division

**Status:** Phases A + B + C BUILT (TASK.md v22/v22.1) — `engine/platform.ts` + state +
`screens/Platform.tsx`, gated behind `platformUnlocked` (Settings → Expansions). Phase C: license
your OS to rivals for a recurring fee that strengthens them (the trade-off has teeth).
Original design spec below. Post-launch (NOT v1). Ship the base game first.
**One-liner:** Surface the OS economy that already runs invisibly inside the engine as a
first-class, visible "Platform" division — research and release your own operating system,
watch it earn recurring licensing revenue across your whole installed base, and license it to
rivals for a new income stream.

---

## 1. Why this is the right first DLC

- **On-brand to the core.** A tech tycoon's endgame fantasy is owning the *platform*, not just
  shipping boxes. The game already has a "Platform Era" (era 3) and an `ecosystem` stat — this
  DLC is the headline expression of both.
- **Low risk for its size.** The money model already exists (see §2). This is mostly a
  *visibility + framing* layer over working mechanics plus two new levers, not a new economy
  built from zero. That keeps balance-destabilization risk far lower than a greenfield system.
- **Fixes the endgame "what now?" beat.** Once you've IPO'd, a Platform division gives the most
  invested players a fresh strategic axis (recurring revenue, licensing politics) instead of a
  wall. Pairs naturally with New Game+ legacy bonuses.
- **Monetization fit.** The base game's monetization is LOCKED ($8.99 premium, complete &
  winnable). CLAUDE.md already reserves "DLC expansions ... ship post-launch." This is a paid
  content expansion, not a v1 gate — no progression locks land in the base game.

## 2. What ALREADY exists in the engine (do not rebuild)

| Concern | Where | Notes |
|---|---|---|
| OS tech tiers | `engine/catalogs.ts` — `software` line: BasicOS → BasicOS 2 → Ecosystem OS → Ecosystem OS+ → **Unified OS** | R&D- and era-gated; each tier `contributes` to the `ecosystem` stat. |
| OS as a build ingredient | `catalogs.ts` category `slots` include `"software"` | You already pick an OS tier when designing a device. |
| Recurring platform revenue | `engine/balance.ts` — `ecosystem.weeklyServiceRate` (cents/unit/ecosystem-point/week), `ecosystem.minEcosystemStat` | Installed base already pays you weekly. This IS "release an OS, earn like a platform." |
| Ecosystem demand weighting | `catalogs.ts` `statEmphasis.ecosystem` per category | Platform-heavy categories already value ecosystem. |

**Implication:** today the OS is an *invisible ingredient*. The DLC makes it a *visible actor*.

## 3. New player-facing mechanics

### 3.1 The Platform screen (new tab or Company sub-section, DLC-gated)
- **Your OS, named.** Let the player name their OS line (e.g. "Nucleus OS"). Show the current
  released version and its tier.
- **Installed base.** Aggregate `unitsSold` across every launched device that shipped with your
  OS tier (data already on `launched[]`). Show it as the headline number — "X devices running
  Nucleus OS."
- **Licensing revenue.** Surface the recurring `ecosystem` income the installed base already
  generates, broken out as its own line (today it's folded silently into weekly cash).

### 3.2 OS version releases (new lever)
- Releasing a new OS *version* (gated by the existing `software` research tiers) gives a
  one-time **installed-base-wide uplift**: a temporary bump to the ecosystem service rate and a
  fan/reputation moment — a "launch day" for software, mirroring the hardware launch beat.
- Real decision: time the OS release for maximum installed base vs. release early to lift demand
  on upcoming hardware.

### 3.3 License your OS to rivals (new income + politics)
- Offer your OS to a rival (reuses `competitors[]`). They pay a recurring license fee → new
  revenue line, **but** it lifts that rival's `ecosystem`-weighted competitiveness in shared
  categories. Classic platform tradeoff: reach & revenue vs. sharpening a competitor.
- Decline-to-license keeps you exclusive (premium brand signal). Mirrors the existing
  CHOICE_EVENT opportunity-cost pattern.

## 4. Data model (additive, migration-safe)

All new fields default safely on old saves (the established `persistence.ts` migrate pattern):
```text
osName: string                 // player-named, defaults to "<Company> OS"
osVersion: number              // released version counter
osLicensees: string[]          // rival ids currently licensing the OS
platformUnlocked: boolean      // DLC entitlement gate (mirrors sandboxUnlocked)
```
No change to how `ecosystem` revenue is computed — the DLC *reads and reframes* it, and adds the
release-uplift + license-fee terms on top.

## 5. Balance & safety
- Keep new revenue **bounded**: license fees and release uplifts must not trivialize the
  hardware loop (the core toy). Tune so platform income rewards a *committed* ecosystem strategy,
  not a free side-faucet — mirror the discipline in `balance.ts` `ecosystem` (there's already a
  `minEcosystemStat` floor and a deliberately low `weeklyServiceRate`).
- Licensing to rivals must have teeth (the competitiveness uplift) so it's a real bet, not free
  money — consistent with pillar #3 (meaningful choices that can fail).
- Everything new lives behind `platformUnlocked`; the base game plays identically without it.

## 6. Scope & phasing
- **Phase A (MVP):** Platform screen (name + installed base + licensing revenue readout) over
  existing data. Mostly UI. Highest delight-per-risk.
- **Phase B:** OS version releases (the uplift lever) + the software-launch moment.
- **Phase C:** Rival licensing (revenue + competitiveness politics).

## 7. Risks
- **Balance creep** — adding recurring income to a carefully-nerfed economy. Mitigation: bound
  it, gate it, tune against the existing ecosystem constants, add engine tests asserting caps.
- **Screen real estate** — a new tab is a big UI commitment. Consider a Company sub-section for
  Phase A before promoting to a full tab.
- **Scope drift** — Phase A alone is a shippable, satisfying DLC. B and C are stretch.

## 8. Test plan (engine-first, per project discipline)
- Pure `engine/platform.ts`: installed-base aggregation, license-fee math, release-uplift decay
  — all unit-tested with boundary cases (0 ecosystem, no licensees, all rivals licensed).
- Migration tests: old saves backfill the new fields and behave identically until DLC unlock.
- A balance test asserting platform income can't exceed a defined share of total revenue at a
  given scale (the "no free faucet" guard).
