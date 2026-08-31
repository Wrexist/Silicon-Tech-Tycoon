# Device Support Decision — iPad: intentional, or inherited?

**Repo:** `Wrexist/Silicon-Tech-Tycoon` · **Branch:** `claude/silicon-tech-tycoon-excellence-4twr18`
**Compiled:** 2026-08-31, from repository evidence only (no macOS, no simulator, no device, no ASC).
**Builds on** `RELEASE_EVIDENCE.md` §10 blocker **H2** — this document supplies the evidence and both
execution branches. **It changes nothing.**

---

## 0. Verdict, up front

### The iPad build setting is **INTENTIONAL**, not inherited.

The evidence is unambiguous and it is not circumstantial: there is a **dedicated commit** that turned
it on, with a message explaining *why* and *how it was verified*; a **roadmap item marked DONE**
referencing that commit by name; a **hand-written rationale comment** in `Info.plist` next to the
iPad orientation keys; **four separate iPad-aware CSS sites** in `src/`; and a **committed iPad
screenshot pipeline** with an npm script. An accidentally-inherited Capacitor default produces none
of those.

### But the *release strategy* is **OWNER DECISION REQUIRED**.

> ## ⚠️ OWNER DECISION REQUIRED
>
> "iPad was deliberately enabled" is a fact. "iPad should ship in this submission" is a judgement
> the repository cannot make for you, because:
>
> - The committed iPad screenshots **are not real iPad captures** — they are the 540 px phone
>   column composited into a drawn iPad frame (§4.4). They cannot be uploaded as an honest
>   submission asset in their current form.
> - The iPad layout has **never been verified on an iPad** — only at an 820×1180 headless viewport
>   (§3.1). Landscape, Split View, Stage Manager, iPad safe areas and the 3D HQ under iPad
>   thermals are all unverified.
> - `APP_STORE_FEATURING.md:157` still lists iPad support as a **future, unticked** growth lane,
>   directly contradicting `ROADMAP.md:224`'s **DONE** (§4.3).
>
> **Choose §7 (keep universal) or §8 (ship iPhone-only).** Both are written as ready-to-execute
> plans. Doing neither ships a universal binary into an App Review that will run it on a 13" iPad,
> against an ASC listing that has no valid iPad screenshot set.

---

## 1. Current technical reality

| Fact | Location | Value |
|---|---|---|
| Device family, **Debug** | `ios/App/App.xcodeproj/project.pbxproj:341` | `TARGETED_DEVICE_FAMILY = "1,2";` |
| Device family, **Release** | `ios/App/App.xcodeproj/project.pbxproj:363` | `TARGETED_DEVICE_FAMILY = "1,2";` |
| iPhone orientations | `ios/App/App/Info.plist:37-40` | Portrait only |
| **iPad orientations** | `ios/App/App/Info.plist:44-49` | Portrait + LandscapeLeft + LandscapeRight |
| iPad rationale comment | `ios/App/App/Info.plist:41-43` | present, hand-written (quoted §3.3) |
| `LSRequiresIPhoneOS` | `ios/App/App/Info.plist:29-30` | `true` (iOS-only app; **does not** exclude iPad — iPad runs iPadOS and accepts this) |
| Required capabilities | `ios/App/App/Info.plist:33-35` | `arm64` only — excludes no modern iPad |
| App column width | `src/index.css:41` | `max-width: 540px` on `#root`, `margin-inline: auto` |

Apple's encoding: `1` = iPhone/iPod touch, `2` = iPad. `"1,2"` is **Universal**. Both build
configurations agree, so there is no "Debug is universal, Release is not" escape hatch — a Release
archive today ships an iPad-capable binary.

**iPhone support status:** fully supported, portrait-only, the primary and only verified target.
No open questions.

**iPad support status:** **enabled in the binary, deliberately, and partially designed for — but
never verified on real iPad hardware or in a real iPad window.** The app will install and run on
iPad. What it looks like there is a centered 540 px column with the ambient backdrop filling the
gutters (by design, §3.1), unverified in landscape, Split View or Stage Manager.

---

## 2. Was it inherited from the Capacitor template? — No

The Capacitor iOS template does default to `"1,2"`, so "inherited" was a plausible hypothesis. It is
refuted directly:

`BUILD_IOS.md:66-73` instructs the reader to **turn the template default off**:

> *"**REQUIRED — lock orientation + ship iPhone-only** (the Capacitor template defaults to
> portrait+landscape and iPhone+iPad; the UI is a portrait phone layout) … **iPhone only**
> (`TARGETED_DEVICE_FAMILY = 1`)."*

And `TASK.md:493` records that this was **done**:

> *"`Info.plist`/pbxproj match the locked ship target: `armv7`→`arm64`; portrait-only; iPad orientation…"*

So the project was **explicitly narrowed to iPhone-only at some point**, and the value in the repo
today is `"1,2"`. That is not an inherited default surviving untouched — it is a value that was set
to `1`, and then **deliberately changed back to `"1,2"` later**. §3.1 identifies exactly when, by
whom, and why.

---

## 3. Positive evidence that it is intentional

### 3.1 A dedicated commit exists, with a rationale and a verification method

```
git log -S'TARGETED_DEVICE_FAMILY = "1,2"' -- ios/App/App.xcodeproj/project.pbxproj
```

returns exactly one commit — **`827b707`, 2026-08-21, `feat(ios): enable iPad`**:

> *TARGETED_DEVICE_FAMILY 1 -> "1,2" (Debug + Release), and an explicit
> UISupportedInterfaceOrientations~ipad (portrait + both landscapes) so the app stays
> multitasking/Split-View eligible. The web layer is already width-safe: #root is a centered 540px
> column at any width, verified at 820x1180 via the shots harness (centered nav/cards, clamped speed
> dial, ambient backdrop filling the sides).*

This message does four things an accident cannot: it **names the old value** (`1`), it changes
**both configurations** on purpose, it **adds a companion Info.plist key** for iPad orientations, and
it **states how the layout was checked** (820×1180 via the shots harness) and what was looked at
(centered nav/cards, the clamped speed dial, the ambient backdrop). Note the verification was
headless at an iPad-ish viewport — **not on an iPad**. That limitation is the reason §0 still needs
an owner.

### 3.2 The roadmap marks it DONE, citing that commit

`ROADMAP.md:224`, under **Phase 6 — Reach & accessibility 🟢 (largely DONE)**:

> *"- [x] **iPad layout** — DONE (`feat(ios): enable iPad`, wide-screen chrome centering)."*

It cites the commit by its subject line and names the layout work that accompanied it. `ROADMAP.md:320`
lists the same item in the phase table (`| **6** | iPad layout + Dynamic Type | reach/a11y | post-launch |`).
`EXECUTION_PLAN.md:166-167` carried it as the planned task beforehand — *"re-enable
`TARGETED_DEVICE_FAMILY` "1,2" in `Info.plist`/pbxproj; iPad screenshots for ASC. On-device check."*
— note the word **re-enable**, matching §2, and note it also asked for an **on-device check** and
**iPad screenshots**, neither of which the commit delivered.

### 3.3 `Info.plist` carries a hand-written iPad rationale

`ios/App/App/Info.plist:41-49`:

```xml
<!-- iPad: portrait + both landscapes. The web layer is a centered 540px column at any width
     (verified via SHOTS_VIEWPORT=820x1180 captures), so rotation is safe, and supporting all
     orientations keeps the app multitasking/Split-View eligible on iPad. -->
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

The `~ipad` suffix is a deliberate device-specific override, sitting immediately below an
iPhone block (`:37-40`) that is **portrait-only**. Someone wrote two different orientation policies
for two device classes and explained the difference in a comment. That is not inheritance.

### 3.4 `src/` contains iPad-aware layout code — four independent sites

| Site | What it does |
|---|---|
| `src/components/hud.css:158-162` | *"On wide screens (iPad) the app is a centered 540px column, so clamp to the COLUMN's left edge instead of drifting to the viewport edge far from the content."* → `left: max(var(--edge), calc(50% - 270px + var(--edge)));` — a real formula (`270px` = half the 540 px column) written specifically for wide screens. |
| `src/components/decisionInbox.css:26` | *"Center within the strip on wide screens (iPad): the app column is 540px, so…"* |
| `src/components/proNudge.css:30` | *"Center within the strip on wide screens (iPad) — see `.dinbox__card`."* |
| `src/components/paywall.css:344, 368, 389` | Height-based rules naming *"Pro Max, iPad, desktop"*, *"landscape phones and iPad split view"*, and *"a floating iPad pane"* — i.e. the paywall was reasoned about **in Split View / Slide Over**. |

Plus the foundation the commit message relies on: `src/index.css:40-45` — `#root { max-width: 540px;
margin-inline: auto; overflow-x: clip; }`.

### 3.5 An iPad screenshot pipeline is committed and wired into npm

- `package.json` scripts → `"shots:ipad": "node scripts/shots-ipad.mjs"`.
- `scripts/shots-ipad.mjs:1-5` — *"Immersive iPad App Store screenshots (10) … Output:
  `app-store-screenshots/ipad/NN-*.png` at 2064×2752 (13" iPad portrait — the largest required iPad
  slot; App Store Connect scales it to the 12.9"/11" slots)."*
- `app-store-screenshots/ipad/` — 10 PNGs present, `01-design.png` measured at **2064 × 2752**, the
  exact 13" iPad slot.

Nobody builds a dedicated 13"-iPad screenshot renderer for a device they do not intend to support.

### 3.6 Marketing copy already promises iPad

`app-store-video/README.md:42` — the app preview video's end card:

> *"**End card** — 'Coming to iPhone & iPad.'"*

**Verdict on intent: INTENTIONAL.** Confidence: high. Six independent artefacts, one of them a
commit whose entire purpose was this change.

---

## 4. The documentation contradictions — quoted, with file:line

Nine documents assert or imply iPhone-only. The dividing line is **2026-08-21**, the date of
`827b707`. Documents last touched *before* that date are **stale**. Two touched *after* it state a
value that **does not exist in the repository** — those are the serious ones.

### 4.1 ACTIVELY FALSE — written *after* iPad was enabled, and quote a value that is not in the repo

**`RELEASE_CANDIDATE_READINESS.md:93`** — last commit `c00e600`, **2026-08-29** (8 days *after* 827b707):

> *"| `app-store-screenshots/ipad/` | 10 | 2064 × 2752 | **Press-kit only** — app is iPhone-only
> (`TARGETED_DEVICE_FAMILY = "1"`), so ASC never asks. Also renders the pre-Vault line-up |"*

**`RELEASE_CANDIDATE_READINESS.md:142`** — same commit:

> *"Apple requires **one iPhone set**; everything else is scaled by ASC. … iPad is **not required**
> for this app."*

**`appstore/APP_STORE_METADATA.md:396-398`** — last commit `c00e600`, **2026-08-29**:

> *"**iPad:** none required — the app ships iPhone-only (`TARGETED_DEVICE_FAMILY = "1"`), so ASC
> never asks for an iPad slot. `app-store-screenshots/ipad/` exists as press-kit material only, and
> renders the older line-up that predates the Vault."*

These three quote `TARGETED_DEVICE_FAMILY = "1"` as fact. The repository says `"1,2"` at
`project.pbxproj:341` and `:363`. **This is the highest-severity contradiction in the set**: it is a
submission-planning document telling the owner that ASC will not ask for iPad screenshots, when — if
the binary ships as-is — ASC **will**.

### 4.2 STALE — written *before* iPad was enabled

**`BUILD_IOS.md:66-73`** — last commit `c1e6256`, 2026-07-29:

> *"**REQUIRED — lock orientation + ship iPhone-only** … **General → Deployment Info → Supported
> Destinations / Device family**: **iPhone only** (`TARGETED_DEVICE_FAMILY = 1`). Otherwise Apple
> reviews the app on a 13" iPad — which would require iPad screenshots and shows a letterboxed 540px
> phone column — an avoidable rejection risk. Add iPad support deliberately in a later release if
> wanted."*

Note the closing sentence: *"Add iPad support deliberately in a later release if wanted."* — which is
precisely what `827b707` then did. The instruction is not wrong about the consequences; it is simply
describing a decision that has since been reversed.

**`app-store-screenshots/README.md:49-54`** — last commit `0593b0c`, 2026-08-08:

> *"**These are marketing renders, not submission assets.** `ios/App/App.xcodeproj/project.pbxproj`
> sets `TARGETED_DEVICE_FAMILY = "1"` — the app ships iPhone-only, so App Store Connect never asks
> for an iPad screenshot slot. They are useful for a press kit or a featuring pitch and nothing else.
> … If iPad support is ever enabled, refresh these before relying on them."*

The final sentence is now a live instruction, not a hypothetical.

**`SHIP_READINESS.md:37`** — last commit `95dfff0`, 2026-08-15:

> *"| Orientation/device | `Info.plist` portrait-only; `TARGETED_DEVICE_FAMILY = "1"` (iPhone-only) |
> ✅ matches the locked ship target |"*

*(Corroborating staleness: the very next row, `SHIP_READINESS.md:39`, claims
`MARKETING_VERSION 1.0` / `CURRENT_PROJECT_VERSION 1` / `package.json 1.0.0`. The repo is at
1.3.0 / 5 / 1.3.0. This whole table is a pre-1.1 snapshot.)*

**`WHAT_YOU_NEED_TO_DO.md:163-164`** — last commit `1095a95`, 2026-08-22 *(one day after 827b707, but
the file was edited for unrelated reasons and this passage was not revisited)*:

> *"8. **General → Deployment Info**: set device family to **iPhone only** — otherwise Apple reviews
> it on a 13" iPad (extra screenshots required, letterboxed layout)"*

**`STORE_LISTING.md:435`** — last commit `12d1372`, 2026-08-17:

> *"| Supported devices | iPhone (all sizes); iPad optional (untested) |"*

Weaker than the others ("optional (untested)" rather than "unsupported"), but still not the current
state. `STORE_LISTING.md:413` is, notably, **already correct** for the universal path:

> *"- iPad Pro 13" (2064×2752) — required if you select iPad as a supported device"*

**`TASK.md:472`**:

> *"rem-based type / iOS Dynamic Type; iPad layout (v1 ships iPhone-only, documented)."*

Historical backlog prose scoped to "v1"; low priority, but it is another iPhone-only assertion.
*(`TASK.md:2529` already records the contradiction itself: "the project ships universal iPad while
three docs assert…" — so the discrepancy was noticed and logged, just never resolved.)*

### 4.3 CONTRADICTS THE ROADMAP — treats iPad as future work

**`APP_STORE_FEATURING.md:157`** — last commit `c1e6256`, 2026-07-29:

> *"- [ ] **iPad support** (currently iPhone-only, portrait-only) → opens the iPad feature lane."*

**`APP_STORE_FEATURING.md:174`**:

> *"- **iPhone-only** (iPad documented as unsupported)."*

An **unticked** growth item, versus `ROADMAP.md:224`'s **ticked** *"iPad layout — DONE"*. Two
planning documents disagree on whether iPad is done or not yet started. This is the specific gap that
makes the *strategy* an owner call rather than a documentation cleanup.

### 4.4 The committed iPad screenshots are not real iPad captures

Independent of the docs, and material to §7. `scripts/shots-ipad.mjs:7-11`:

> *"The app is a phone-width UI (hard-capped at 540px, viewport-fixed chrome). Capturing at a wide
> iPad viewport would letterbox that column with dark gutters and detach the nav to the screen edges.
> So we capture at a **540×720 viewport** — the app's *designed maximum* width, where the column fills
> edge-to-edge (no gutters, chrome aligned) at a clean 3:4 aspect — then **scale that into the iPad's
> 3:4 screen full-bleed**."*

So each "iPad screenshot" is the **phone column upscaled to fill an iPad screen**, then composited
into a drawn aluminium iPad. It does not depict the app running on an iPad. Uploading these as the
iPad submission set would show reviewers a layout the app does not produce on that device — an App
Review risk in its own right, on top of `app-store-screenshots/README.md:52-54`'s own admission that
they render a pre-Vault, pre-Autonomy-Era, pre-Nemesis-Duels line-up.

---

## 5. Release consequences of each path

### If the binary ships universal (`"1,2"` — the current state)

| Consequence | Detail |
|---|---|
| **App Review runs it on iPad** | Apple reviews a universal binary on a 13" iPad. Anything broken in iPad portrait *or* landscape is a rejection surface — and landscape is enabled for iPad by `Info.plist:44-49`. |
| **ASC requires an iPad 13" screenshot set** | Mandatory for a universal binary. The committed set is stale *and* not a genuine iPad capture (§4.4). This must be produced. |
| **Split View / Slide Over / Stage Manager are in scope** | `Info.plist:44-49` deliberately keeps the app multitasking-eligible, so reviewers can resize the window arbitrarily. `paywall.css:368,389` shows this was anticipated; nothing shows it was tested. |
| **iPad thermals and GPU for the 3D HQ** | Untested (`RELEASE_EVIDENCE.md` §9 lists thermals/framerate as NEEDS DEVICE for iPhone too). |
| **Upside** | Reach into the iPad store, and the iPad feature lane `APP_STORE_FEATURING.md:157` names. The end card at `app-store-video/README.md:42` already promises "iPhone & iPad". |
| **Cost** | An iPad (or simulator) QA pass + a real iPad screenshot set + 6 doc corrections. |

### If the binary ships iPhone-only (`"1"`)

| Consequence | Detail |
|---|---|
| **App Review runs it on iPhone only** | The single verified form factor. Removes the whole iPad rejection surface. |
| **No iPad screenshots required** | ASC never asks. `app-store-screenshots/ipad/` reverts to press-kit material, exactly as its README already says. |
| **Matches the documentation** | Six of the nine documents in §4 become correct again with no edit. |
| **iPad users can still install it** | An iPhone-only app runs on iPad in compatibility mode (letterboxed, 1×/2×). It is not blocked — just not marketed or reviewed there. |
| **Downside** | Discards the work in `827b707` and the four CSS sites in §3.4 (they stay harmless — wide-screen centering also helps landscape phones). Contradicts `ROADMAP.md:224`'s DONE and the video end card. Re-enabling later is a one-line change plus a screenshot set. |
| **Cost** | Two pbxproj lines, one Info.plist block, a rebuild, and 3 doc corrections. |

---

## 6. Weighing it

| | Universal | iPhone-only |
|---|---|---|
| Matches the last deliberate engineering decision | ✅ `827b707` | ❌ reverses it |
| Matches the roadmap | ✅ `ROADMAP.md:224` | ❌ |
| Matches the featuring plan | ❌ `APP_STORE_FEATURING.md:157,174` | ✅ |
| Matches the submission-prep docs | ❌ (§4.1 — but those are factually wrong today) | ✅ |
| Matches the marketing end card | ✅ | ❌ |
| Verified on the target device | ❌ never | ✅ (iPhone, extensively) |
| Submission assets ready | ❌ | ✅ |
| Effort to become shippable | iPad QA pass + real screenshots + 6 doc fixes | 2 pbxproj lines + 1 plist block + 3 doc fixes |

**The honest reading:** engineering intent points at universal; release readiness points at
iPhone-only. If this submission needs to go out promptly and cleanly, §8 is the low-risk path and
§7 becomes a 1.4 feature with real device QA behind it. If iPad reach matters more than schedule,
§7 is legitimate — the layout work genuinely exists — but it must not ship without the device pass
and honest screenshots. **The owner picks.**

---

## 7. PLAN A — IF IPAD REMAINS SUPPORTED

No pbxproj or Info.plist change. The work is QA, assets and documentation.

### 7.1 QA requirements — every item needs a real iPad or an iPad simulator

Nothing below is verifiable from this repository; all are Category **B/C** in
`RELEASE_EVIDENCE.md`'s scheme.

**Layout**
- [ ] 540 px column centers correctly at every iPad width (11", 12.9"/13", iPad mini).
- [ ] Ambient backdrop fills the side gutters as `827b707` claims — no dark bands, no seams.
- [ ] Sticky HUD stays pinned and full-width-of-column; `overflow-x: clip` (`src/index.css:44`) does
      not break it at iPad widths.
- [ ] Speed dial clamps to the **column** edge, not the viewport edge — verify the
      `left: max(var(--edge), calc(50% - 270px + var(--edge)))` formula at `hud.css:162` on device.
- [ ] Decision inbox (`decisionInbox.css:26`) and Pro nudge (`proNudge.css:30`) center within the
      strip.
- [ ] **Known open bug at exactly this width:** `IDEAS.md:28` / `IDEAS.md:145` — *"the absolute leaks
      onto the layout grid so at the app's 540px max width (iPad / web / wide phones) the Design Lab
      hero overlaps the Category selector"* (`src/screens/designLab.css`, `.lab__hero-grid` declared
      twice, ~L121 and ~L138). Logged since the screenshot pass, worked around only in the capture
      scripts, **never fixed in source**. The Design Lab is a flagship screen. **Fix before shipping
      iPad** — an iPad reviewer sees this, an iPhone reviewer does not.

**Safe areas**
- [ ] Top and bottom insets on every iPad model, incl. home-indicator devices.
- [ ] `env(safe-area-inset-bottom)` in the speed dial (`hud.css:163`) and the tab bar resolve
      correctly on iPad.
- [ ] `contentInset: "never"` (`capacitor.config.ts`) does not double-pad or under-pad on iPad.

**Both orientations** (iPad has all three per `Info.plist:44-49`)
- [ ] Portrait: full sweep of every screen.
- [ ] Landscape left **and** right: full sweep. Short-viewport paths especially — `paywall.css:368`
      (*"landscape phones and iPad split view"*) and `paywall.css:389` (*"a floating iPad pane"*).
- [ ] Rotation **mid-modal**: rotate with each interrupt overlay open (celebration, awards, rival
      strike, rivalry, eureka, community ask, earnings call, ready-to-launch, launch reveal,
      decorate tutorial, paywall, `.ds-sheet` sheets, scenarios confirm) — the full list in
      `CLAUDE.md`'s popup section.
- [ ] Rotation mid-3D-scene in both HQ and Factory.
- [ ] **Split View / Slide Over / Stage Manager** at every window width, including the narrowest
      pane, and while resizing live.

**Scaling and touch**
- [ ] No blurry upscaled raster assets at 2× iPad scale; icons are Lucide vectors, but verify the
      PWA/app icons and `Splash.imageset` (2732×2732, `RELEASE_EVIDENCE.md` §6).
- [ ] Touch targets still ≥ 44 pt — the 8 controls given invisible hit-area expansion
      (`RELEASE_EVIDENCE.md` §8) behave the same at iPad pointer/touch.
- [ ] Apple Pencil and trackpad/mouse pointer (iPadOS supports both) do not break drag interactions —
      the decorate/placement flows especially.

**Text scaling**
- [ ] iPad Dynamic Type at max, plus the in-app Text Size setting, on the densest screens
      (Finance, People, Design Lab). rem-based type shipped (`ROADMAP.md:225`); clipping is
      unverified.

**HQ 3D rendering**
- [ ] Office (`Garage3D`) and Factory (`Factory3D`) render, hold framerate, and do not thermally
      throttle on the **lowest-end supported iPad**, not just an M-series one.
- [ ] DPR caps ([1,1.75] HQ, [1,1.4] preview per `ROADMAP.md:214`) behave sensibly at iPad
      resolutions.
- [ ] `frameloop → "never"` on `visibilitychange` still fires when the app is backgrounded **into
      Split View** rather than fully hidden.
- [ ] `ModelBoundary` procedural-furniture fallback still degrades cleanly.

**Modal behaviour**
- [ ] Every popup obeys the house liquid-glass standard at iPad width — card `backdrop-filter`
      frosts, scrim stays **clear** (no blur), edge reflection present (`CLAUDE.md`).
- [ ] Centered cards do not stretch or misalign in the 540 px column on a 13" screen.
- [ ] `.ds-sheet` bottom sheets anchor to the correct edge in landscape.
- [ ] Full-screen milestone takeovers (`.bankrupt`, `.era-modal`, `.ipo`) fill the **iPad** screen,
      not just the column — they are the deliberate exception to the column rule.
- [ ] Focus trap + Escape (`useDialogFocus`) work with an attached iPad keyboard.

**Screenshots**
- [ ] Produce a **genuine 13" iPad set at 2064 × 2752** — captured from the app actually running at
      an iPad viewport, **not** the 540×720-upscaled composite that `scripts/shots-ipad.mjs:7-11`
      currently produces.
- [ ] Refresh the line-up to the current ten screens — `app-store-screenshots/README.md:52-54` states
      the committed set predates the Vault, the Autonomy Era and Nemesis Duels.
- [ ] Confirm no price/monetization claims regress the 2.3.7 and 3.1.2 rejection fixes
      (`LAUNCH_CHECKLIST.md:100`).
- [ ] Upload the iPad set alongside the required 6.7" iPhone set.

### 7.2 Documents carrying false iPhone-only claims — the complete correction list

| # | File:line | Claim to correct |
|---|---|---|
| 1 | `RELEASE_CANDIDATE_READINESS.md:93` | *"app is iPhone-only (`TARGETED_DEVICE_FAMILY = "1"`), so ASC never asks"* → universal; ASC **does** ask; set is press-kit-quality only and must be re-shot |
| 2 | `RELEASE_CANDIDATE_READINESS.md:142` | *"iPad is **not required** for this app."* → iPad 13" set **is** required |
| 3 | `appstore/APP_STORE_METADATA.md:396-398` | *"**iPad:** none required — the app ships iPhone-only (`TARGETED_DEVICE_FAMILY = "1"`)"* → required; add it to the §12 pre-submit checklist |
| 4 | `SHIP_READINESS.md:37` | *"`TARGETED_DEVICE_FAMILY = "1"` (iPhone-only) ✅ matches the locked ship target"* → `"1,2"` universal (**and** `:39`'s version row is stale — see `RELEASE_VERSION_PLAN.md`) |
| 5 | `BUILD_IOS.md:66-73` | The whole *"REQUIRED — … ship iPhone-only"* block → iPad is now supported deliberately; keep the orientation guidance, drop the device-family instruction |
| 6 | `app-store-screenshots/README.md:49-54` | *"sets `TARGETED_DEVICE_FAMILY = "1"` — the app ships iPhone-only … press kit … and nothing else"* → these are submission assets now; act on the file's own *"If iPad support is ever enabled, refresh these"* |
| 7 | `WHAT_YOU_NEED_TO_DO.md:163-164` | *"set device family to **iPhone only**"* → remove; it is already `"1,2"` |
| 8 | `STORE_LISTING.md:435` | *"iPad optional (untested)"* → supported. (`:413` is already correct.) |
| 9 | `APP_STORE_FEATURING.md:157` | unticked *"iPad support (currently iPhone-only, portrait-only)"* → tick it, or restate as "iPad layout shipped; iPad-native design is the remaining lane" |
| 10 | `APP_STORE_FEATURING.md:174` | *"**iPhone-only** (iPad documented as unsupported)."* → universal |
| 11 | `TASK.md:472` | *"iPad layout (v1 ships iPhone-only, documented)"* → historical; annotate as superseded by `827b707` |
| 12 | `TASK.md:2529` | already *describes* the contradiction — update to record the resolution |
| 13 | `RELEASE_EVIDENCE.md` §10 **H2** | resolve the blocker with the chosen path |
| 14 | `OWNER_RELEASE_ACTIONS.md:33-37, 75, 94-95` | already frames it as an open decision — record the outcome |

*(`scripts/shots-ipad.mjs:1-11` is code, not a doc, but its capture strategy must change per §7.1
"Screenshots" — it is currently documented honestly and is honestly the wrong tool for a submission
asset.)*

---

## 8. PLAN B — IF IPHONE-ONLY IS CHOSEN

### 8.1 Repository changes — exact and complete

**Two pbxproj lines.** In `ios/App/App.xcodeproj/project.pbxproj`, change both occurrences:

| Line | Configuration | From | To |
|---|---|---|---|
| `341` | `504EC3171FED79650016851F /* Debug */` (target `App`) | `TARGETED_DEVICE_FAMILY = "1,2";` | `TARGETED_DEVICE_FAMILY = "1";` |
| `363` | `504EC3181FED79650016851F /* Release */` (target `App`) | `TARGETED_DEVICE_FAMILY = "1,2";` | `TARGETED_DEVICE_FAMILY = "1";` |

**Both** must change. Editing only Release leaves a universal Debug build that behaves differently
from the shipped one and misleads anyone testing locally.

**One Info.plist key block.** In `ios/App/App/Info.plist`, remove lines **41-49** — the comment plus
the entire `UISupportedInterfaceOrientations~ipad` key and its `<array>`:

```xml
<!-- iPad: portrait + both landscapes. The web layer is a centered 540px column at any width
     (verified via SHOTS_VIEWPORT=820x1180 captures), so rotation is safe, and supporting all
     orientations keeps the app multitasking/Split-View eligible on iPad. -->
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

Leave `UISupportedInterfaceOrientations` (`:37-40`, portrait-only) exactly as it is — that is the
iPhone policy and it is correct.

**Do NOT touch:**
- `LSRequiresIPhoneOS` (`:29-30`) — already `true`; unrelated to device family.
- `UIRequiredDeviceCapabilities` (`:33-35`) — `arm64`; do not attempt to exclude iPad here.
- The four CSS sites in §3.4 — wide-screen centering still benefits landscape phones, large phones
  and the web/PWA build. Removing them is churn with a regression risk and zero payoff.
- `scripts/shots-ipad.mjs` and `app-store-screenshots/ipad/` — they revert to being exactly what
  `app-store-screenshots/README.md:49-54` already describes: press-kit material.
- `capacitor.config.ts` — carries no device-family setting.

### 8.2 Validation

- [ ] `grep -n 'TARGETED_DEVICE_FAMILY' ios/App/App.xcodeproj/project.pbxproj` → **exactly two**
      lines, both `"1"`.
- [ ] `grep -n 'ipad' ios/App/App/Info.plist` → **no matches**.
- [ ] `plutil -lint ios/App/App/Info.plist` → OK *(needs macOS; otherwise any XML/plist validator —
      the risk of hand-removing a key block is an unbalanced `<array>`)*.
- [ ] `npx cap sync ios` — confirm it does **not** rewrite the device family back to `"1,2"`
      (it regenerates `Package.swift` and copies `dist/`; it should not touch build settings — but
      verify, because a silent revert here undoes the whole change).
- [ ] `npm test` / `npx tsc -b` / `npm run build` green — no source changed, so this is a
      no-regression check.
- [ ] `.github/workflows/ios-build-check.yml` passes on the branch (real `xcodebuild build` on
      macOS — the only way to prove the plist edit did not break the build without a Mac).
- [ ] After a TestFlight upload: App Store Connect shows **iPhone only** under the build's supported
      devices, and the version's screenshot requirements list **no** iPad slot.
- [ ] Install on an iPad from TestFlight and confirm it runs in compatibility mode without crashing
      (optional, but cheap reassurance).

### 8.3 App Store consequences

- **Screenshots:** iPhone 6.7" set only. No iPad slot appears. `app-store-screenshots/store/` (10 ×
  1284 × 2778, `RELEASE_CANDIDATE_READINESS.md:92`) is the complete submission set.
- **App Review:** runs on iPhone only. The 13"-iPad review surface disappears, along with the Design
  Lab hero overlap bug at 540 px (`IDEAS.md:28`) as a *reviewer-visible* issue — **it still exists on
  web/PWA and wide phones and should still be fixed**, it just stops being a submission risk.
- **Store listing:** the App Store product page shows "iPhone" under Compatibility. iPad users can
  still find and install it (compatibility mode).
- **Marketing correction required:** `app-store-video/README.md:42`'s end card reads *"Coming to
  iPhone & iPad."* — that claim must be removed from any preview video before submission. Shipping
  it alongside an iPhone-only binary is an inaccurate-metadata surface.
- **Documents to correct** (much shorter list — most of §4 becomes true again):
  | # | File:line | Correction |
  |---|---|---|
  | 1 | `ROADMAP.md:224` | *"iPad layout — DONE"* → the layout work landed but iPad support was **deliberately deferred** for this release; move back to the unticked list with a pointer to this document |
  | 2 | `app-store-video/README.md:42` | remove *"& iPad"* from the end card |
  | 3 | `RELEASE_EVIDENCE.md` §10 **H2** | resolve: iPhone-only chosen |
  | 4 | `OWNER_RELEASE_ACTIONS.md:33-37` | record the decision |
  | 5 | `WHAT_YOU_NEED_TO_DO.md:163-164` | still says to set it in Xcode's GUI; note that the repo already carries `"1"` so no manual step is needed |
- **Reversibility:** re-enabling iPad later is two pbxproj lines plus the Info.plist block back, and
  the CSS in §3.4 will still be there. Nothing is burned.

---

## 9. Summary for the owner

1. iPad was **deliberately enabled** on 2026-08-21 by `827b707 feat(ios): enable iPad`. It is not an
   inherited Capacitor default — the project had previously been set to iPhone-only and was
   explicitly changed back.
2. The binary in this repo is **universal today** (`project.pbxproj:341,363`).
3. **Nine documents** contradict that. Three of them (`RELEASE_CANDIDATE_READINESS.md:93,142`,
   `appstore/APP_STORE_METADATA.md:396`) were written *after* the change, quote a value that is not in
   the repo, and tell you ASC will not ask for iPad screenshots — **it will**.
4. The iPad layout has **never run on an iPad**. It was verified at an 820×1180 headless viewport.
5. The committed iPad screenshots are the **phone column upscaled into a drawn iPad frame**, not real
   iPad captures, and they render a pre-Vault line-up.
6. There is a **known unfixed layout bug at exactly the 540 px width** an iPad exposes
   (`IDEAS.md:28` — Design Lab hero overlaps the Category selector).
7. **You must choose §7 or §8 before submitting.** §8 is the fast, low-risk path for this release;
   §7 is legitimate but needs a device pass, honest screenshots and that bug fixed first.

**This document made no code changes.**
