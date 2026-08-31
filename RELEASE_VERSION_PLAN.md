# Release Version Plan — the version source of truth

**Repo:** `Wrexist/Silicon-Tech-Tycoon` · **Branch:** `claude/silicon-tech-tycoon-excellence-4twr18`
**Compiled:** 2026-08-31, from the repository itself plus a live read of the GitHub Actions run
history for `ios-testflight-capacitor.yml`.
**Builds on** `RELEASE_EVIDENCE.md` §10 blocker **H1** — this document resolves it.

Every value below is cited `file:line`. Nothing here is inferred from memory.

---

## 1. The one-line answer

> **The next TestFlight upload must carry a build number strictly greater than 70.**
> The repo's own `CURRENT_PROJECT_VERSION = 5` is **never** what ships — CI overrides it at archive
> time with the workflow run number. The run counter is currently at **70** and has **not** reset,
> so the next dispatch of `ios-testflight-capacitor.yml` produces **build 71**, which is valid.
> **No `build_number` override is required.** Leave that input blank.

And the trap, stated up front:

> **Do NOT "fix" the version collision by changing `FIRST_FREE_BUILD = 5`** in
> `src/state/pro.ts:394`. It is not a version number. It is the paid-era grandfathering line.
> See §7.

---

## 2. Current repository state — measured

| Value | Where it lives | Current value |
|---|---|---|
| Marketing version (web/npm) | `package.json:4` | `1.3.0` |
| Marketing version (npm lockfile mirror) | `package-lock.json:3` and `:9` | `1.3.0` |
| Marketing version (iOS, **Debug**) | `ios/App/App.xcodeproj/project.pbxproj:335` | `1.3.0` |
| Marketing version (iOS, **Release**) | `ios/App/App.xcodeproj/project.pbxproj:358` | `1.3.0` |
| Build number (iOS, **Debug**) | `ios/App/App.xcodeproj/project.pbxproj:327` | `5` |
| Build number (iOS, **Release**) | `ios/App/App.xcodeproj/project.pbxproj:350` | `5` |

Both `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` are set **identically in Debug and Release**,
and both live on the **`App` native target's** build configurations — `504EC3171FED79650016851F`
(Debug, `project.pbxproj:321-343`) and `504EC3181FED79650016851F` (Release,
`project.pbxproj:344-365`), listed under
`Build configuration list for PBXNativeTarget "App"` at `project.pbxproj:377`. The two
*project-level* configurations (`project.pbxproj:215-268` Debug, `:272-319` Release) carry **no**
version keys at all, so there is no second place to forget.

### How `Info.plist` references them

`ios/App/App/Info.plist` never hardcodes a version. It defers to the build settings:

```
21  <key>CFBundleShortVersionString</key>
22  <string>$(MARKETING_VERSION)</string>
23  <key>CFBundleVersion</key>
24  <string>$(CURRENT_PROJECT_VERSION)</string>
```

This is the correct wiring: whatever `xcodebuild` is given on the command line lands in the shipped
`Info.plist`. It also means **editing the plist can never change the version** — the pbxproj (or a
CI override) is the only lever.

### Capacitor config carries NO version

`capacitor.config.ts` sets `appId`, `appName`, `webDir`, colours and plugin options — and nothing
else. There is no `version` key anywhere in it. Capacitor does **not** propagate a version into the
native project, so `npx cap sync ios` cannot fix or break a version. Confirmed by reading the whole
file.

`app.json` (repo root) is a **dead Expo leftover** — it contains only a bundle identifier and an EAS
project id, no version. Nothing in the build reads it. (Also flagged as polish in
`RELEASE_EVIDENCE.md` §10.)

---

## 3. What the CI workflow actually does at archive time

File: `.github/workflows/ios-testflight-capacitor.yml`.

### Inputs (`workflow_dispatch`)

| Input | Line | Required | Meaning |
|---|---|---|---|
| `marketing_version` | `:29-32` | **yes** | The store-facing version, e.g. `1.3.1`. Typed by hand on every dispatch. |
| `build_number` | `:37-40` | no | **Leave blank normally.** Override only when the run counter has reset. |
| `submit_testflight` | `:41-45` | no, default `true` | Whether to push the exported IPA to TestFlight. |

### The marketing version path

1. **Validated** at `:86-96` — must match `^[0-9]+(\.[0-9]+){1,2}$` (digits and dots, 2 or 3
   components). A fat-fingered value fails in seconds instead of after a 40-minute build.
2. **Injected** at `:235` as `MARKETING_VERSION="$MARKETING_VERSION"` on the `xcodebuild … archive`
   command (`:225-237`).

**Consequence:** the `1.3.0` sitting at `project.pbxproj:335,358` is **overwritten** for every CI
archive. It is what a local Xcode build would use, and nothing more.

### The build number path

Step **"Resolve and check build number"**, `:114-139`:

```
118   BUILD_NUMBER="${BUILD_NUMBER_INPUT:-$GITHUB_RUN_NUMBER}"
```

- **Source:** `GITHUB_RUN_NUMBER` — the run counter of **this workflow file** — unless the
  `build_number` input is non-empty, in which case the input wins.
- **Shape check** `:119-122`: must be a whole number.
- **The `FIRST_FREE_BUILD` assertion** `:124-137`:
  ```
  125   FIRST_FREE_BUILD=$(grep -oE 'FIRST_FREE_BUILD = [0-9]+' src/state/pro.ts | grep -oE '[0-9]+$')
  126   if [ -z "$FIRST_FREE_BUILD" ]; then   # refuses to guess
  131   if [ "$BUILD_NUMBER" -lt "$FIRST_FREE_BUILD" ]; then   # hard fail
  ```
  It reads the constant **live out of `src/state/pro.ts`** rather than repeating it, so the two can
  never drift. It **fails the run** rather than clamping the number — because the correct next
  build number depends on what App Store Connect already holds, and only a human knows that
  (rationale in the comment block at `:99-113`).
- **Injected** at `:236` as `CURRENT_PROJECT_VERSION="$BUILD_NUMBER"` on the same `xcodebuild`
  archive command.

**Consequence:** the `5` at `project.pbxproj:327,350` is likewise **overwritten** on every CI
archive. A CI upload can never actually ship build 5 while the run counter is above 5.

### What the assertion protects against

`GITHUB_RUN_NUMBER` counts runs of **this workflow file by path**, and resets to 1 if the file is
renamed or deleted-and-recreated — which the workflow comment records as having already happened
once in this repo. If the counter reset and nothing checked it, CI would upload builds numbered
1–4, `isFoundingBuild()` would classify **every new downloader** as a paid-era owner, and Silicon
Pro would be granted free and permanently, with nothing in the app to notice. The assertion is the
only thing standing between a counter reset and giving the product away.

Note what the assertion does **not** do: it checks the build number against `FIRST_FREE_BUILD` (5),
**not** against what App Store Connect already holds (70). A run at build 6 would pass the
assertion and still be rejected by ASC. See §5.

### Other version-touching scripts

**There are none.** Verified:

- `grep -rl "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" scripts/ .github/` returns exactly one
  file: `.github/workflows/ios-testflight-capacitor.yml`.
- No `npm version`, no `postversion` hook, no version-stamping step in `package.json`'s `scripts`
  block. The 20 scripts there are dev/build/test/screenshot/sim helpers only.
- `.github/workflows/ci.yml` (`:38-45`) runs typecheck → `npm test` → build. It touches no version.
- `.github/workflows/ios-build-check.yml` is a compile guard. It touches no version.

---

## 4. Confirmed App Store state

| Fact | Evidence | Value |
|---|---|---|
| App Store version already published/submitted on this train | `appstore/REJECTION_3.1.2_EULA.md:3` | **1.3.0** |
| Highest build uploaded on that train | `appstore/REJECTION_3.1.2_EULA.md:3` — *"iOS App 1.3.0 — build 1.3.2 (70) · submitted Aug 16, 2026"* | **70** |
| Corroboration | `appstore/REJECTION_3.1.2_EULA.md:27` — *"**No new build is needed.** Build 70 is fine."* | 70 |
| Corroboration | `appstore/APP_STORE_METADATA.md:118` — *"what happened to 1.3.0 (build 70)"* | 70 |
| Live CI corroboration | `ios-testflight-capacitor.yml` run **#70**, `workflow_dispatch` on `main`, head commit *"v1.3.0: Monetization launch"*, **2026-08-16T10:17Z**, conclusion **success** | 70 |

The CI run history and the rejection document agree exactly: run number 70 on 2026-08-16 is the run
that produced build 70, and that is the build Apple rejected on 3.1.2 (metadata only — the binary
was never opened).

> **Read this carefully:** `REJECTION_3.1.2_EULA.md:3` records the build as **"1.3.2 (70)"** while
> the App Store *version record* is **1.3.0**. That is a real, already-shipped divergence: the
> binary's `CFBundleShortVersionString` was `1.3.2` (typed into the `marketing_version` input) while
> the ASC version it was attached to reads `1.3.0`. It is a live example of the gap in §6 — nothing
> forced those two to agree, and nothing in the repo would have caught it.

---

## 5. The collision, and the required next build

**The problem.** App Store Connect refuses an upload whose `CFBundleVersion` is less than or equal
to a build already uploaded for the same `CFBundleShortVersionString` train. Build **70** exists.
The repo says **5**.

**Why it is less dangerous than it looks.** The repo value is dead on the CI path (§3). The
collision only bites if someone archives locally in Xcode and uploads by hand, or if the run counter
has reset. Entitlements are unaffected either way: `FIRST_FREE_BUILD = 5` still grandfathers
correctly and `isFoundingBuild(71)` is correctly `false` (`src/state/pro.ts:397-400`).

**Requirement:** `CURRENT_PROJECT_VERSION > 70` on the uploaded binary.

### Would the CI run number currently produce > 70? — YES

This **is** determinable, and it was determined against the live workflow history rather than
guessed:

- `ios-testflight-capacitor.yml` (`workflow_id` 293324692) reports **`total_count: 70`**.
- The most recent run is **`run_number: 70`** (2026-08-16, success).
- Run numbers descend contiguously — 70, 69, 68 … 41 — with **no reset to 1** anywhere in the
  visible history.

`GITHUB_RUN_NUMBER` is the **next** run's ordinal, so:

> **The next dispatch of `ios-testflight-capacitor.yml` runs as #71 and stamps `CURRENT_PROJECT_VERSION = 71`.**
> 71 > 70 ✅ and 71 ≥ `FIRST_FREE_BUILD` (5) ✅ — the assertion passes and ASC accepts the number.

### Recommended path (do this)

1. Dispatch **iOS TestFlight** from the Actions tab.
2. `marketing_version`: **`1.3.1`** (or higher). It must not be a version already *released*; since
   1.3.0 is on the store, bump it. It must match `^[0-9]+(\.[0-9]+){1,2}$`.
3. `build_number`: **leave blank.** The run number (71) is correct and above 70.
4. `submit_testflight`: leave `true`.
5. Read the log line from `:139` before the archive starts — it prints the resolved number:
   `Shipping build 71 (FIRST_FREE_BUILD is 5, so this ships as free-era).`
   **If that line says anything ≤ 70, cancel the run** and re-dispatch with an explicit
   `build_number`.

### Fallback — if the counter has reset (log line shows a small number)

Re-dispatch with the `build_number` input filled in explicitly:

```
build_number: 71
```

(or any integer strictly greater than the highest build ASC shows for the target version train —
check ASC → the version → *Build* / TestFlight → *iOS Builds* to confirm 70 is still the ceiling.)
Do **not** touch `src/state/pro.ts` to make the assertion pass.

### If you archive locally in Xcode instead of via CI

CI's override does not exist on that path, so build 5 would be uploaded and rejected. Before a manual
archive, bump both configurations by hand:

- `ios/App/App.xcodeproj/project.pbxproj:327` — Debug `CURRENT_PROJECT_VERSION`
- `ios/App/App.xcodeproj/project.pbxproj:350` — Release `CURRENT_PROJECT_VERSION`

to `71` (or higher), and both `MARKETING_VERSION` lines (`:335`, `:358`) to the shipping version.
CI remains the recommended path.

---

## 6. The gap: nothing checks that the three values agree

`RELEASE_EVIDENCE.md` §6 records this as an unverified gap (**R4**). Confirmed and unchanged:

There are **three independently typed** carriers of the marketing version —

1. `package.json:4` (what the web app / PWA reports),
2. `project.pbxproj:335,358` (what a local Xcode build ships),
3. the `marketing_version` CI input (what a CI build actually ships)

— and **nothing reconciles them.** Verified: no test in `src/**/*.test.ts` reads `package.json` or
`project.pbxproj`; `ci.yml` has no version step; no script stamps a version. `APP_STORE_METADATA.md:433-437`
asks a human to keep them aligned on a checklist, which is documentation, not enforcement.

**The consequence is not theoretical** — §4 shows it already happened: a binary stamped `1.3.2`
went up against an ASC version record of `1.3.0`.

### Manual agreement check (run this before every dispatch)

```bash
cd /home/user/Silicon-Tech-Tycoon

# 1. What package.json claims
node -p "require('./package.json').version"

# 2. What the pbxproj claims (should print the SAME value twice — Debug and Release)
grep -n 'MARKETING_VERSION' ios/App/App.xcodeproj/project.pbxproj

# 3. What the pbxproj would ship as a build number (same value twice)
grep -n 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj

# 4. The entitlement line CI asserts against — must stay 5
grep -n 'FIRST_FREE_BUILD = ' src/state/pro.ts

# 5. Confirm Info.plist still defers rather than hardcoding
grep -n -A1 'CFBundleShortVersionString\|CFBundleVersion' ios/App/App/Info.plist
```

One-liner that fails loudly if package.json and the pbxproj disagree:

```bash
PKG=$(node -p "require('./package.json').version")
PBX=$(grep -oE 'MARKETING_VERSION = [0-9.]+' ios/App/App.xcodeproj/project.pbxproj \
      | grep -oE '[0-9.]+$' | sort -u)
[ "$(printf '%s' "$PBX" | wc -l)" -eq 0 ] && [ "$PKG" = "$PBX" ] \
  && echo "OK: both $PKG" \
  || echo "MISMATCH: package.json=$PKG pbxproj=[$PBX]"
```

Then, at dispatch time, type that same value into `marketing_version` — or deliberately type a
higher one and update `package.json` + both pbxproj lines to match afterwards, so the repo does not
drift behind the store again.

> **Suggested follow-up (not done here — this document changes no code):** add a Vitest that reads
> `package.json` and `project.pbxproj` and asserts (a) Debug and Release agree with each other, and
> (b) `MARKETING_VERSION` equals `package.json`'s `version`. That closes R4 permanently and would
> have caught the 1.3.2/1.3.0 divergence. It cannot check the CI input, so the workflow should
> additionally echo the resolved marketing version next to the resolved build number.

---

## 7. ⚠ THE TRAP — `FIRST_FREE_BUILD` is not a version number

`src/state/pro.ts:394`:

```ts
export const FIRST_FREE_BUILD = 5;
```

Its own doc comment (`src/state/pro.ts:387-393`) says exactly what it is:

> *"The FIRST build shipped as a free download. Anyone whose original download was an EARLIER build
> paid for the app up front and is granted Pro forever — a 'Founding Owner'. ⚠ Set this to the
> CFBundleVersion of the build that flips the App Store price to Free, and never lower it
> afterwards."*

And the predicate it feeds, `src/state/pro.ts:397-400`:

```ts
export function isFoundingBuild(originalBuild: number | undefined | null): boolean {
  if (typeof originalBuild !== "number" || !Number.isFinite(originalBuild)) return false;
  return originalBuild > 0 && originalBuild < FIRST_FREE_BUILD;
}
```

**Why the collision tempts you to touch it.** The CI step at `:131-136` is the only place a build
number is compared to anything, and its error text mentions build numbers. Reading the failure fast,
`FIRST_FREE_BUILD` looks like "the minimum build number" — a knob you could raise or lower to make
a number legal. **It is not.**

### What happens if you change it

| Change | Effect |
|---|---|
| **Raise it** (e.g. to `71` to "match" the next build) | Every device whose original download was build 1–70 — i.e. **every existing free-era downloader** — is reclassified as a paid-era owner and granted **Silicon Pro permanently, for free**. Irreversible in practice: `grantFounding` writes a durable record and never downgrades. This is the give-the-product-away failure the CI comment at `:99-113` exists to prevent. |
| **Lower it** (e.g. to `1`) | `isFoundingBuild` returns `false` for everyone. Legitimate paid-era buyers (builds 1–4) **silently lose the Pro they paid for**. |
| **Leave it at `5`** ✅ | Builds 1–4 = paid era → Founding Pro. Builds 5+ = free era → no free grant. `isFoundingBuild(71)` is correctly `false`. Correct today and correct forever. |

`src/state/pro.test.ts:282-284` pins the boundary behaviour and `:316` pins
`FIRST_FREE_BUILD ≥ 5`, so lowering it below 5 fails `npm test`. **Raising it does not fail any
test** — that is the dangerous direction, and there is no automated guard. The only guard is this
paragraph.

**Rule: `FIRST_FREE_BUILD` stays at `5` forever.** It changes only if the App Store price model
changes again, which it will not. Fix version collisions with the **build number**, never with this
constant.

---

## 8. Every file that controls versioning

| File | Line(s) | Controls | Ships? |
|---|---|---|---|
| `package.json` | `4` | npm/web version string | Web/PWA only. Not read by the iOS build. |
| `package-lock.json` | `3`, `9` | mirror of the above | No. Updated by npm automatically. |
| `ios/App/App.xcodeproj/project.pbxproj` | `327` (Debug), `350` (Release) | `CURRENT_PROJECT_VERSION` | **Only on a local Xcode archive.** CI overrides. |
| `ios/App/App.xcodeproj/project.pbxproj` | `335` (Debug), `358` (Release) | `MARKETING_VERSION` | **Only on a local Xcode archive.** CI overrides. |
| `ios/App/App/Info.plist` | `21-24` | `CFBundleShortVersionString` / `CFBundleVersion` → `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` | Yes — but it only *dereferences*, it sets nothing. |
| `.github/workflows/ios-testflight-capacitor.yml` | `29-32`, `37-40` | the two dispatch inputs | — |
| `.github/workflows/ios-testflight-capacitor.yml` | `114-139` | resolves build number; asserts vs `FIRST_FREE_BUILD` | — |
| `.github/workflows/ios-testflight-capacitor.yml` | `235-236` | **the values that actually ship** | **Yes — this is the real source of truth for a CI upload.** |
| `src/state/pro.ts` | `394` | `FIRST_FREE_BUILD` — entitlement boundary, **not** a version | Ships in the bundle. **Do not change.** |
| `capacitor.config.ts` | — | **no version key** | N/A |
| `app.json` | — | **no version key**; dead Expo leftover | N/A |

---

## 9. Validation commands (runnable in this repo, today)

```bash
cd /home/user/Silicon-Tech-Tycoon

# Repo-side version surfaces, all at once
node -p "require('./package.json').version"
grep -n 'MARKETING_VERSION\|CURRENT_PROJECT_VERSION\|TARGETED_DEVICE_FAMILY' \
  ios/App/App.xcodeproj/project.pbxproj
grep -n -A1 'CFBundleShortVersionString\|CFBundleVersion' ios/App/App/Info.plist

# The entitlement boundary CI asserts against (must print 5)
grep -n 'FIRST_FREE_BUILD = ' src/state/pro.ts

# Reproduce EXACTLY what CI's assertion reads (the same two greps, verbatim from the workflow)
grep -oE 'FIRST_FREE_BUILD = [0-9]+' src/state/pro.ts | grep -oE '[0-9]+$'

# Prove nothing else in the repo stamps a version
grep -rl "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" scripts/ .github/

# Confirm the store-side facts this document relies on
grep -n 'build 70\|1\.3\.2 (70)' appstore/REJECTION_3.1.2_EULA.md
grep -n '1\.3\.0 (build 70)' appstore/APP_STORE_METADATA.md

# Green suite before any upload (CI's TestFlight workflow does NOT run tests — see below)
npm test
npx tsc -b
npm run build
```

**Live check of the run counter** (needs GitHub access; the browser works fine):
open <https://github.com/Wrexist/Silicon-Tech-Tycoon/actions/workflows/ios-testflight-capacitor.yml>
and read the run number of the newest run. **The next run is that number + 1.** As of 2026-08-31 the
newest is **#70**, so the next is **#71**.

---

## 10. Pre-upload checklist

Tick in order. Anything unticked is a reason not to dispatch.

**Repo hygiene**
- [ ] `npm test` green — **the TestFlight workflow does not run tests** (`RELEASE_EVIDENCE.md` §1,
      risk **R1**); a dispatch from a red ref builds and uploads anyway.
- [ ] `npx tsc -b` exit 0.
- [ ] `npm run build` green.
- [ ] `grep -n 'FIRST_FREE_BUILD = ' src/state/pro.ts` prints **`5`**. If it prints anything else,
      **stop** and read §7.

**Version agreement (manual — nothing automates this; §6)**
- [ ] `package.json:4` version decided for this release (bump off `1.3.0` — it is already on the
      store).
- [ ] `project.pbxproj:335` and `:358` `MARKETING_VERSION` match `package.json:4`.
- [ ] `project.pbxproj:327` and `:350` `CURRENT_PROJECT_VERSION` are consistent Debug↔Release.
      (Their value is cosmetic on the CI path, but a stale `5` misleads the next reader and breaks a
      local archive.)
- [ ] The `marketing_version` you are about to type equals `package.json:4`.

**Build number**
- [ ] Confirmed in App Store Connect that **70** is still the highest build on the target version
      train.
- [ ] Newest run of `ios-testflight-capacitor.yml` is **#70** → next is **#71** → **> 70** ✅.
- [ ] `build_number` input left **blank**. (Fill it only if the counter reset — §5 fallback.)

**Dispatch and watch**
- [ ] Dispatched on the intended ref with `submit_testflight = true`.
- [ ] Step *"Resolve and check build number"* printed
      `Shipping build 71 (FIRST_FREE_BUILD is 5, so this ships as free-era).`
      **If the number is ≤ 70, cancel immediately** — §5 fallback.
- [ ] Step *"Validate marketing version"* printed the version you intended.
- [ ] Archive step shows `MARKETING_VERSION=<your version> CURRENT_PROJECT_VERSION=71`.
- [ ] Upload step succeeded (`altool --upload-app`) — this is where a duplicate build number would
      be rejected.

**After the upload**
- [ ] Build appears in ASC/TestFlight at the expected version **and** build number.
- [ ] Update `package.json:4` and both `MARKETING_VERSION` lines in the repo if the dispatched
      version was ahead of them, so the repo stops trailing the store (this is exactly how the
      1.3.2/1.3.0 divergence in §4 happened).

**Still open, tracked elsewhere — not version issues**
- [ ] iPad decision — see `DEVICE_SUPPORT_DECISION.md` (`RELEASE_EVIDENCE.md` blocker **H2**).
- [ ] App preview video is WebM (**H3**).
- [ ] `challengeArchive` gate declared but unenforced (**R3** — a 3.1.2 surface).
