# Screenshot-Driven Polish & Fun Audit

Source: 11 captured screenshots of the design → launch → market flow (iPhone viewport, built
web app). Each item cites the shot it came from. Ordered into phases by impact ÷ risk: fix the
mixed-signal/readability stuff first (cheap, high payoff), then the first-run *feel*, then
premium polish, then deeper fun.

Caveat: backdrop-blur and some shadow effects can under-render in a headless browser, so items
tagged **[verify-device]** must be confirmed on TestFlight before acting.

Legend: ⚡ quick win · 🎯 high impact · ⚠️ touches balance · 💎 premium polish

---

## Phase 1 — Kill the mixed signals (readability, cheap, do first)
1. **Verdict label is unstable for the same "Fit".** [01 vs 08] A fresh draft reads `Fit 19 ·
   Steady seller` at wk 0 but `Fit 19 · Likely flop` at wk 3 — identical fit number, opposite
   verdict. The cause (competition rose) is invisible, so it just looks buggy. Fix: when the
   verdict is competition-driven, say so on the pill/sub-line ("rivals moved in"), or show the
   effective score the verdict is actually gated on. ⚡🎯
2. **Wizard review contradicts itself.** [05] `Demand fit 19 · Weak fit` (alarming red) sits
   right next to `Projected sales 155 · sells out` (green). It sells out only because the run is
   tiny. Fix: label it "sells out (small run)" or annotate that low fit + small run still
   clears. ⚡🎯
3. **"Fit 19" is cryptic.** [01/08/11] No scale, no unit. Reads like it could be /20 or /100.
   Fix: `Fit 19/100` or a tiny labelled bar; explain on tap. ⚡
4. **Two different cost names + an unexplained gap.** [02/03] Price tab shows `Build $67` and
   `BOM total $55`; the wizard calls the same number `Unit cost $67`. Players can't reconcile
   $55 vs $67 or Build vs Unit cost. Fix: one name everywhere ("Unit cost"), and label the gap
   ("$55 parts + $12 assembly"). ⚡
5. **Three toasts stack at launch.** [09] `Achievement — Liftoff`, `Achievement — Sold Out`,
   `Launched — sales are slow` all fire at once — the hero moment (the launch) is buried in a
   stack and competes with itself. Fix: sequence them, or merge the achievements into one
   "2 milestones unlocked" toast so the launch verdict lands cleanly. ⚡🎯💎

## Phase 2 — The first-launch *feeling* (fun & retention)
6. **First product trends toward "flop".** [06/08/09/11] The early default build previews as
   `Likely flop`, launches to `sales are slow`, and scores `36/100`. Honest, but a deflating
   first experience for a brand-new player. Fix (pick a lane, ⚠️): forgive the first 1–2 launches
   (gentler verdict bands early), or steer the starter design so a sensible first attempt lands
   ≥ Steady, or wrap the harsh result in coaching ("here's the one thing to change"). 🎯⚠️
7. **"Overall 20" shown big on the win screen.** [06] Right under "Design complete" a prominent
   `Overall 20` reads like a fail grade on a celebratory screen. Fix: contextualize ("20 — entry
   tier, room to grow") or de-emphasize the raw number at the moment of celebration. ⚡
8. **Negative launch copy as a first impression.** [09] "Launched — sales are slow" is the first
   thing a new founder hears. Soften early-game framing or pair it with a next-step nudge. ⚡
9. **Make the first *hit* a real moment.** Confetti exists; add a dedicated first-hit beat
   (bigger reward callout) so the loop's payoff is unmistakable. 🎯

## Phase 3 — Sheet & overlay polish (premium)
10. **Faded screen content bleeds behind wizard sheets.** [03/05] Dimmed design content (price,
    BOM) shows behind the wizard's big numbers, muddying them. Likely the headless-blur caveat —
    **[verify-device]**; if real, strengthen the scrim or add a top fade-mask so the sheet reads
    as a clean surface. 💎
11. **Toast system pass.** [09/10] Toasts persist across a tab change (launch toasts still
    visible on Market). Define max-visible, consistent placement, and tidy exit. 💎

## Phase 4 — HUD & information design
12. **HUD pills are icon-only and cryptic.** [all] The flask `0` (RP), star `8` (reputation),
    and `Wk 0 · Y1 Q1` carry no visible label — a new player can't decode "star 8". Fix: micro
    labels or clearer glyphs; make reputation read as reputation. ⚡
13. **Oversized screen titles eat vertical space.** [01/10] Giant "Design Lab" / "Market"
    headers push the actual content (the device, the cards) down on a small screen. Fix: tighten
    the title scale / make it a compact header so more product is visible above the fold. ⚡💎

## Phase 5 — Layout & spacing refinements
14. **Cramped design footer.** [01] The `Components / Style` sub-tabs sit tight against the
    `Next: Style` CTA — the two competing controls crowd each other. Add separation/hierarchy. 💎
15. **Under-device pill cluster.** [01/08] `View back` + `Fit 19` + verdict float loosely under
    the device. Group them into one tidy status bar. 💎
16. **Reviews are buried.** [11] The fun payoff (Press reception 36/100, outlet scores, quote)
    is at the very bottom of a long detail sheet. Surface the score higher, or tease it in the
    launch moment. 🎯

## Phase 6 — Fun amplifiers (engagement)
17. **Leaderboard needs a hook.** [10] `#7 of 7` with rival valuations is static. Add "Overtake
    NovaPlus — $X to go" so there's a concrete next target. 🎯
18. **Surface the review at launch.** [09/11] Show a quick review card in the launch celebration
    instead of only in Market — turns the new critic system into a hero beat. 🎯
19. **IPO progress as a bar.** [10] "IPO unlocks at $750K — you're at $0" is text; a progress
    bar toward IPO is a motivating long-term goal. ⚡
20. **"Next milestone" nudge.** Subtly surface the nearest achievement (respecting the no-nag
    rule) so there's always a visible next thing to chase. 🎯

---

## Suggested execution order
P1 (items 1–5) is the highest payoff for the least risk — pure clarity wins, mostly copy +
small UI. P2 (6–9) is the biggest *fun* lever but item 6 touches balance, so it needs care +
tests. P3–P5 are premium polish. P6 is additive fun once the core reads cleanly.
