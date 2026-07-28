# Silicon: Tech Tycoon — App Store Metadata (copy-paste ready)

Everything you paste into App Store Connect, field by field, within Apple's limits.
**IP rule:** no real brand/company/product names anywhere — every name here is fictional.
Before submitting, replace the three **live URLs** (privacy / support) and run the keyword
string through an ASO tool.

---

## 1. App information

| Field | Value | Limit |
|---|---|---|
| **App Name** | `Silicon: Tech Tycoon` | 30 (20 used) |
| **Subtitle** | `Design, sell, run your empire` | 30 (29 used) |
| **Bundle ID** | `com.wrexist.silicon` | — |
| **SKU** | `SILICON-TECH-TYCOON-001` | — |
| **Primary Category** | Games → **Simulation** | — |
| **Secondary Category** | Games → **Strategy** | — |
| **Primary Language** | English (U.S.) | — |
| **Age Rating** | **4+** | — |

**Subtitle is indexed for search** — it's a second keyword field, so make its words earn their place.
The current one is strong and brand-clear; A/B-test these keyword-denser alternates via Product Page
Optimization:
- `Startup to empire — build it all` (30) — adds *startup*
- `Design devices, build the line` (30) — adds *build/line* (factory)
- `Business & factory tycoon sim` (29) — front-loads *business, factory, sim* (repeats *tycoon* from the
  name, so slightly wasteful — use only if a tool shows it converts better)

---

## 2. Promotional Text (≤170 chars — editable anytime without review)

```text
The biggest update yet: build a 3D factory line, turn a rival into your nemesis, take your company public, and expand worldwide. Design devices down to the chip.
```
(159 chars)

**Alternates to A/B test (all ≤170):**
```text
Design devices down to the chip, build a real 3D factory, crush a dozen rivals, and rule the industry — from a one-room garage to the world. Premium, offline, no ads.
```
```text
Found a tech startup, design every device, build the factory, make an arch-rival, go public, and take over the industry. A premium tycoon sim. Offline. No ads, ever.
```

---

## 3. Keywords (≤100 chars, comma-separated, NO spaces after commas)

```text
business,simulation,management,idle,factory,empire,startup,strategy,mogul,magnate,builder,ceo,gadget
```
(100 chars exactly.)

**Why this set:** the App Name (`Silicon: Tech Tycoon`) and Subtitle are ALREADY indexed for search,
so `tycoon`, `tech`, `silicon`, `design`, `empire`(subtitle) are redundant to repeat here — every
keyword slot is spent on a term NOT already covered. Apple also auto-matches most singular/plural
forms, so use singulars only. The App Store *combines* your keyword words with the words in the
name/subtitle, so e.g. "business tycoon", "idle tycoon", "factory tycoon", "startup empire" all match.

**Reserve pool** (swap via A/B test in App Store Connect Product Page Optimization):
`capitalist,industry,invest,company,billionaire,manager,device,economy,sim,entrepreneur`

**Do NOT add:** competitor brand names, real company/phone names, or `game`/`app`/`free` (wasted slots —
Apple ignores them). Validate the final string in an ASO tool (AppTweak / Sensor Tower) before submit.

---

## 4. Description (≤4000 chars — paste as plain text, no markdown)

```text
Build a tech company from a one-room garage to a global empire — one device at a time.

Silicon is a premium business simulation and tycoon game. You don't just watch numbers tick — you DESIGN the products, BUILD the factory that makes them, and RUN the company that sells them. Found a startup, ship something great, crush your rivals, take it public, and rule the industry.

DESIGN EVERY DEVICE
Customise phones, tablets, laptops, consoles, monitors and AR glasses from the inside out — chip, display, battery, materials, camera array, finish and colour — and watch each one render live in a crisp vector preview. Every choice moves your cost, your margin, and how the market reacts. Form matters too: a striking design sells.

BUILD A REAL FACTORY
Factory Mode is a living 3D production line you build yourself. Lay conveyor belts, place and upgrade machines, and wire the floor so it builds faster — each device needs the right machines (a phone wants a screen bonder, a laptop a chassis mill). Decorate with props and painted walls, expand the building, and take Side Order commissions to keep the line busy between launches.

TIME THE MARKET
Consumer taste shifts week by week. Read the trend, price it right, pick the campaign that fits your budget, and find your launch window. The game always tells you WHY a product won or flopped — so every launch teaches you something.

MAKE ENEMIES
Race a dozen fictional rivals up the live industry leaderboard. One becomes your arch-rival — a living nemesis you clash with again and again. When a rival strikes your category, duel their device head-to-head and answer back. Every year the Silicon Awards judge every launch across Device of the Year, Design and Value — sweep the ceremony or build a grudge.

PLAY THE MARKET
Trade rival shares, buy a board seat for insider intel, take a controlling stake for a discounted hostile takeover, or acquire a rival outright to absorb its brand, fans and patents. Then take your own company public and beat Wall Street's quarterly earnings expectations.

GO GLOBAL
License new regions — each with its own taste and market size — then weather regional events: booms to ride, tariffs to answer, and rival surges to defend your standing.

RESEARCH THE FRONTIER
Develop a deep tech tree over time on a live progress ring — queue your next breakthroughs, commit to research doctrines that give your products identity, and chase Eureka flashes of insight for a jackpot.

BUILD A TEAM AND HQ
Hire engineers, designers and marketers — each with a specialty, a trait and a mood that moves their output. Senior staff grow into mentors and masters. Watch your real-time 3D headquarters fill with life from garage to campus.

PREMIUM. OFFLINE. YOURS.
No ads. No timers. No energy. No currencies. No dark patterns. The base game is complete and winnable with a single purchase, and it works fully offline. One optional Creative Mode sandbox is the only in-app purchase, ever.

Found your company. Ship something great. Run the industry.
```
(~3,050 chars — under the 4,000 limit)

---

## 5. What's New (release notes for v1.2.0)

> The canonical copy lives in `appstore/localizations/en-US/release_notes.txt` and is translated into
> all 39 ASC locales alongside it — **paste from there, not from here**, and run
> `node appstore/localizations/validate.mjs --all` before uploading. Reproduced below for review.

```text
A fifth era, a hidden layer, and a company that finally answers back.

• The Vault: eighteen classified dossiers whose conditions are secret. Each opens on something you did without being asked, and reveals itself a step at a time — a redaction block, then a whisper, then the exact terms, then the reward. Buy the intel if you're impatient; the deed is never for sale. What you learn carries into your next company.
• The Autonomy Era: a genuine fifth era past the IPO, with two new categories — Neural Band and Home Robot — and a new component tier on every line.
• Nemesis Duels: your arch-rival calls you out. Multi-week duels with escalating tiers, and a trophy when you take one.
• Mastery & Seasons: per-category grind bars with signature cosmetics, plus a monthly Challenge Season track of device colorways, HQ finishes and profile badges.
• Run the company, not just the product: crunch the team to rush a build, set standing reorder policies, work the sell window after launch, gamble on moonshot R&D with visible odds, promise a ship date at a keynote, draft an era mandate, and spend an engineering budget that makes every project a real choice.
• A world that lives: employees with names and lives of their own, rivals that fight each other and not just you, review outlets that remember your last device, regional events that name the rival surging there, and an industry ladder of named bosses to climb.
• See what you're climbing: a Company Roadmap of every era, category and endgame system ahead of you, one Goals ledger, a Help hub that explains every score, and a glossary.
• As calm as you like: Calm Mode sets how often the game interrupts you, and low-stakes moments now wait quietly in a Decision Inbox.
• A better HQ: a living 3D office with typing, chair swivels and glowing screens, 20 new furniture pieces and 8 room styles, a factory floor that actually runs, proper task chairs that always face their own monitor — plus Tidy Up for the office and Undo for the factory.
• Rebalanced throughout: every era now rewards a great launch and punishes a lazy one, a rough start is something you can recover from instead of a dead end, and more than one way to play survives to the end.

Faster loading and a long list of fixes.
```

**Previous release notes (v1.1.0)** — kept for reference; the v1.1.0 body has moved to §5d.

---

## 5b. Previous release notes (v1.0.2)

```text
Silicon just got a lot more alive.

• Rivals now have backstories — read their doctrine, and watch their fortunes rise, peak, and fade as their story arc unfolds.
• Every launch earns an authored verdict explaining exactly why it won or flopped.
• The Device Museum is reorganised into category shelves — click any device for its legacy note, front-and-back design, and full launch analytics.
• A living market: multi-week event chains with real choices, seasonal demand cycles by buyer segment, and regional shocks.
• New people decisions: mentor your team, fend off rival poaching offers, boost company morale, and take out loans to fund growth.
• Design trade-offs run deeper — named synergy archetypes, category-specific buyer tastes, and an Engineering Doctrine research fork that gives your products identity.
• Reach the #1 spot and your IPO win now closes with a "Five years later" epilogue.
• A big polish pass across the Design Lab, Company screen, and 3D office, plus a more tactile production-run slider.
```

---

## 5c. Previous release notes (v1.0 — first release)

```text
Welcome to Silicon. Design devices down to the chip, launch them into a living market, build your team and 3D HQ, research the next era, and race six rivals to #1. Premium, offline, no ads.
```

---

## 5d. Previous release notes (v1.1.0)

```text
The biggest Silicon update yet. Build a real production line, turn your rivals into enemies, take your company public, and run the whole industry.

BUILD YOUR FACTORY
• Factory Mode: lay conveyor belts, place and upgrade machines, and watch a real 3D production line run your builds. A well-wired floor builds faster, and each device wants the right machines — a phone needs a screen bonder, a laptop a mill. Decorate with props and painted walls, then expand the building as you grow.
• Side Orders: clients commission production runs on your line — meet the deadline, bank the fee, and keep the factory busy between your own launches.

FIGHT YOUR RIVALS
• Arch-Rivals: one rival becomes your nemesis, with a living heat meter and a head-to-head record that escalates every time you clash.
• Rival Strikes: when a rival launches into your category it's a decision, not a headline — duel their device against yours, then cut price, fire a counter-campaign, or hold the line.
• The Silicon Awards: every year the industry judges every launch across Device of the Year, Design and Value. Sweep the ceremony for a reputation and fan boost, or watch a rival take the stage.

PLAY THE MARKET
• Buy rival shares for a board seat and insider intel, take a controlling stake for a discounted hostile takeover, or acquire a rival outright to absorb its brand, fans and patents.
• Go public: IPO your company, then beat the street's quarterly earnings and buy back shares.

GO GLOBAL
• License new regions, each with its own taste and size, then weather regional events — booms to ride, tariffs to answer, rival surges to defend.

DEEPEN YOUR COMPANY
• Timed research: breakthroughs now develop over time on a live progress ring, and you can queue your next projects. Commit to research doctrines that give your products identity.
• Eureka breakthroughs: your lab has flashes of insight — bank a windfall or chase the prototype for a jackpot. Plus new AI-era projects and a Developer Keynote to keep research meaningful once the tree is bought out.
• A living team: senior staff earn permanent growth you choose — a second specialty, a new trait, or a mentor who lifts the whole team.
• A living fanbase with a mood and superfans who answer your community events, plus a brand-awareness meter that lifts every launch.
• Run your own OS platform — an App Store, a security console, and licensing deals with rivals.

PLUS
• A smoother start with more capital; deeper devices (tablets, monitors, AR glasses); a continuous design-to-launch flow with live in-production tracking and "start from" to iterate a franchise; living products you can restock and re-market; a premium liquid-glass redesign; a big accessibility pass; and dozens of fixes.
```

---

## 6. Pricing & availability

| Field | Value |
|---|---|
| Base price | **Free** |
| Availability | All countries / regions |
| Pre-orders | Optional |
| Educational discount | No |
| **Apple Small Business Program** | **Enroll** (15% cut while under $1M/yr) |

**In-App Purchases — Silicon Pro** (full setup: `SUBSCRIPTION_GUIDE.md`):

| Field | Value |
|---|---|
| Subscription group | `silicon_pro` — *Silicon Pro* |
| `com.wrexist.silicon.pro.yearly` | Auto-renewable · **$19.99/yr** · 7-day free trial |
| `com.wrexist.silicon.pro.monthly` | Auto-renewable · **$3.99/mo** · 7-day free trial |
| `com.wrexist.silicon.pro.lifetime` | Non-Consumable · **$29.99** · Family Sharing On |
| `com.wrexist.silicon.sandbox` | Legacy Non-Consumable · $2.99 · **keep live, no longer offered** |

---

## 7. Age rating answers (all "None" → 4+)

Cartoon/Fantasy Violence · Realistic Violence · Prolonged Graphic Violence · Profanity/Crude
Humor · Mature/Suggestive Themes · Horror/Fear · Medical Info · Alcohol/Tobacco/Drugs ·
Gambling and Contests · Sexual Content · Graphic Sexual Content · **Simulated Gambling: None**
· Unrestricted Web Access: No · **Contains Ads: No** → **Final rating: 4+**

> Note: trading fictional rival "shares" is a game mechanic with no real money and no random
> wagering — answer **Simulated Gambling: None**.

---

## 8. App Privacy ("Data Not Collected")

App Store Connect → **App Privacy** → "Do you collect data from this app?" → **No**.
The app has no backend, no analytics, no ad SDK, no login. All state lives in on-device
`localStorage`. Confirm "Data Not Collected" for every category.

**`PrivacyInfo.xcprivacy`** (add to the iOS target):

| Required-reason API | Reason |
|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` — store user's app settings (game save) |

No tracking, no other required-reason APIs, no third-party SDKs.

---

## 9. App Review notes (paste into App Review → Notes)

```text
Thanks for reviewing Silicon: Tech Tycoon.

TESTING
No account or login. Fully offline. On first launch, tap "Found Silicon"
to start a company; the coach tips can be skipped to reach the main loop.
The game is complete and winnable without any purchase.

[Include the next block ONLY if the Creative Mode IAP is attached:]
IN-APP PURCHASES (Silicon Pro subscription + Lifetime)
1. Open Settings (gear, top-right).
2. Scroll to "Creative Mode".
3. Tap a Silicon Pro plan and complete with a Sandbox Apple ID.
4. The Sandbox toggle appears immediately on success.
5. "Restore purchase" re-grants it on a fresh install.
Creative Mode is a no-limits sandbox (unlimited cash floor). It is NOT a
progression gate and unlocks no content withheld from the base game.

CONTACT: isacmolin@gmail.com
```

**Demo account:** none required. **Sign-in required:** No.

---

## 10. URLs (must be live before submitting)

| Field | Value |
|---|---|
| **Privacy Policy URL** (required) | `https://<your-host>/silicon/privacy.html` |
| **Support URL** (required) | `https://<your-host>/silicon/support.html` |
| Marketing URL (optional) | `https://<your-host>/silicon` |

Ready-made pages live at `public/privacy.html` and `public/support.html` — host them on
GitHub Pages or Netlify Drop (see WHAT_YOU_NEED_TO_DO.md Step 1) and paste the real URLs.

Minimum privacy policy text (already in `public/privacy.html`):
```text
Silicon: Tech Tycoon does not collect, transmit, or share any personal data.
All progress is stored locally on your device. No account, no server, no analytics.
No data leaves your device. Questions: isacmolin@gmail.com
```

---

## 11. Screenshots

Upload the committed set at `app-store-screenshots/store/` (10 frames, already in upload order);
`app-store-screenshots/README.md` has the regeneration commands.

**On the size.** The frames are **1284 × 2778**, which is Apple's **6.5"** display class — not 6.7",
which is what this doc used to call it. That size is accepted and ASC scales it down to the smaller
classes, so the set is submittable as-is. But 6.5" is the *fallback*: the primary requirement for an
iPhone app is the **6.9" class** (1320 × 2868, 1290 × 2796, or 1260 × 2736), and providing it means
every device scales from the largest source rather than up-rezzing a 6.5" one. Re-rendering at
1290 × 2796 is a one-line change to `SIZE` in `scripts/shots-refresh.mjs`.

Upload order — the first three are what most people ever see in search, so they lead with the
newest and most visually distinctive:

1. `01-vault.png` — The Vault, the redacted dossier board — **"Eighteen files you were never told about"**
2. `02-factory.png` — Factory Mode, the 3D line with a live order — **"Build the line"**
3. `03-design.png` — Design Lab, live 3D device render — **"Design every detail"**
4. `04-market.png` — Industry leaderboard — **"Race rivals to #1"**
5. `05-office.png` — Real-time 3D HQ — **"Garage to global empire"**
6. `06-awards.png` — The Silicon Awards ceremony — **"Win the industry"**
7. `07-strike.png` — Rival Strike duel — **"Answer every rival"**
8. `08-research.png` — Research ring + queue — **"Research on your terms"**
9. `09-global.png` — Regional licensing + standings — **"Take it global"**
10. `10-premium.png` — **"Premium. Complete. Yours."**

Lead with the Vault: it is the only frame that reads as a *promise* rather than a status readout,
and it is the 1.2.0 headline feature. `APP_STORE_FEATURING.md` assumes this exact order.

Caption text is already burned ON the marketing frame (large, legible), not just alt text — the
first two words of each caption matter most in the small search thumbnail.

**iPad:** none required — the app ships iPhone-only (`TARGETED_DEVICE_FAMILY = "1"`), so ASC never
asks for an iPad slot. `app-store-screenshots/ipad/` exists as press-kit material only, and renders
the older line-up that predates the Vault.

## 11b. ASO ranking levers (what actually moves the ranking, in priority order)

Metadata is only ~half of ASO — Apple ranks on relevance **and** conversion + velocity. In order of impact:

1. **App Name + Subtitle + Keywords** (this doc). Highest weight is the **name**, then **subtitle**, then
   the keyword field. Never waste a slot repeating a word across the three — they're searched together.
2. **Conversion rate** (installs ÷ impressions). Driven by the **icon**, the **first 1–2 screenshots**,
   and the title. Ship the new Factory Mode / rivalry hero shots (§11) and A/B them.
3. **In-App Events** (App Store Connect → Features → In-App Events). These get their own search + Today/
   Games surfaces and are a real 2024+ ranking/visibility lever. This release gives you three easy ones:
   - **"The Silicon Awards"** — an annual in-game ceremony → run as a recurring event card.
   - **"Launch season"** — themed challenge to ship a hit device.
   - **"Go global"** — event tied to the new regional-expansion + regional-events feature.
4. **Product Page Optimization (PPO)** — A/B test up to 3 icon/screenshot/subtitle variants natively in
   ASC. Use it for the subtitle + screenshot-order options above; keep the winner.
5. **Custom Product Pages** — make dedicated pages (different screenshots/promo text) for specific
   keyword themes ("factory tycoon", "business sim") and point paid/organic traffic at the best match.
6. **Ratings & reviews volume + recency** — prompt for a rating after a *win* moment (first hit launch /
   reaching #1), never mid-task. Higher star average + fresh reviews lift both rank and conversion.
7. **Update cadence** — a substantive update (like this 1.1.0) refreshes the "recency" signal; ship the
   new What's New and refresh at least one screenshot each version.
8. **Localization** — DONE: full metadata for all 39 ASC locales lives in
   `appstore/localizations/` (fastlane `deliver` layout, one folder per locale, validated by
   `appstore/localizations/validate.mjs --all`). See that folder's README for the keyword
   strategy (native-first fields, cross-storefront index exploitation, complementary
   en-US/GB/AU/CA keyword sets) and paste order.

**Category:** keep **Simulation** primary (that's where "tycoon/business sim" browsers live) and
**Strategy** secondary. Don't chase a less-competitive category at the cost of intent match.

---

## 12. Final pre-submit checklist

- [ ] **`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` both bumped** in
      `ios/App/App.xcodeproj/project.pbxproj`, and `version` in `package.json` matches
      `MARKETING_VERSION`. The build number must be **strictly higher than the last build uploaded
      on this train** — App Store Connect rejects a repeat, and a version-only bump is the easy
      mistake (1.2.0 was briefly staged on 1.1.0's build 3). Shipped so far: 1.0.3 → build 2,
      1.1.0 → build 3, 1.2.0 → build 4.
- [ ] Name, subtitle, promo text, keywords, description, what's-new pasted **from
      `appstore/localizations/`** (not from this file) — `node appstore/localizations/validate.mjs --all`
      prints ✓ for all 39 first
- [ ] Categories: Simulation (primary), Strategy (secondary)
- [ ] Price **Free**, all countries, Small Business Program enrolled
- [ ] Silicon Pro group + 3 products attached to the version and sandbox-tested
- [ ] Age rating completed → 4+
- [ ] App Privacy = "Data Not Collected"; `PrivacyInfo.xcprivacy` added
- [ ] Privacy + Support URLs live and pasted
- [ ] 10 screenshots (6.7") uploaded in the §11 order — `01-vault.png` first
- [ ] **App preview video transcoded and watched through.** `app-store-video/` ships the 1.2.0 cut as
      WebM only, and the committed `.mp4` is still the 1.1.0 cut. ASC accepts `.mov`, `.m4v` and
      `.mp4` — WebM is not among them, and the recording pipeline can only emit WebM, so a transcode
      is required either way. Do it per `app-store-video/README.md`, then watch it before uploading.
- [ ] Review notes pasted (with/without IAP block per your choice)
- [ ] IAP decision made per IAP_GUIDE.md (Option A: none attached / Option B: created + wired + attached)
- [ ] Build uploaded via Xcode/TestFlight and selected for the version
- [ ] Submit for Review
