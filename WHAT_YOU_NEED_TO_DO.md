# Your Action Items — Submitting Silicon to the App Store

Everything in this repo is done. Below are the **only things that require you**,
in order. Estimated total time: **2–3 hours** on a Mac.

---

## Prerequisites (check once)

- [ ] Mac with **Xcode** installed (latest — free from the Mac App Store)
- [ ] **Apple Developer Program** membership — $99/year at developer.apple.com
- [ ] **Node 20+** installed (`node --version`)
- [ ] CocoaPods installed: `sudo gem install cocoapods`

---

## Step 1 — Host the privacy policy and support page (10 min)

Apple requires a **live, publicly accessible** privacy policy URL before you can submit.

Two ready-made HTML pages are in `public/privacy.html` and `public/support.html`.
You have several free options to host them:

### Option A — GitHub Pages (easiest, free)
1. Go to your repo on GitHub → **Settings** → **Pages**
2. Set source to `main` branch → `/docs` folder (or `/` with a `gh-pages` branch)
3. Copy `public/privacy.html` and `public/support.html` into whichever folder you chose
4. Commit and push. GitHub gives you a URL like `https://wrexist.github.io/silicon-tech-tycoon/`
5. Your URLs would be:
   - Privacy: `https://wrexist.github.io/silicon-tech-tycoon/privacy.html`
   - Support: `https://wrexist.github.io/silicon-tech-tycoon/support.html`

### Option B — Netlify Drop (30 seconds, free)
1. Go to **netlify.com/drop**
2. Drag the entire `public/` folder onto the page
3. Netlify gives you a URL instantly
4. Copy the privacy and support URLs

### Option C — Your own domain
If you already have `wrexist.com`, upload both `.html` files to your web host at
`/silicon/privacy.html` and `/silicon/support.html`.

**Once live, note the two URLs — you'll need them in Steps 4 and 7.**

---

## Step 2 — Create the app in App Store Connect (15 min)

1. Go to **appstoreconnect.apple.com** → **My Apps** → **+** → **New App**
2. Fill in:
   - **Platforms:** iOS
   - **Name:** `Silicon: Tech Tycoon`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.wrexist.silicon` ← select from dropdown (you'll register it in step 3)
   - **SKU:** `SILICON-TECH-TYCOON-001`
   - **User Access:** Full Access
3. Click **Create**

> If `com.wrexist.silicon` isn't in the dropdown yet, first register it:
> Go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers → +**
> Select "App IDs", then "App". Enter description "Silicon" and Bundle ID
> `com.wrexist.silicon`. Enable **In-App Purchases** capability. Save.

---

## Step 3 — Fill in the App Store listing (15 min)

All content is in `STORE_LISTING.md`. Copy each field into App Store Connect:

In App Store Connect → your app → **App Store** tab → **1.0 Prepare for Submission**:

| Field | Where to paste from STORE_LISTING.md |
|-------|--------------------------------------|
| Name | `Silicon: Tech Tycoon` |
| Subtitle | `Design, sell, run your empire` |
| Promotional Text | The 90-char sentence in the Promotional Text row |
| Description | The full block under "## Description" |
| Keywords | The 94-char keyword string |
| Support URL | Your live support page URL from Step 1 |
| Marketing URL | Optional (your site or leave blank) |
| Privacy Policy URL | Your live privacy policy URL from Step 1 |

**Age Rating:** Click "Edit" → answer every question as "None" → result is **4+**.

**Pricing:** Set to **$8.99** (Tier 9).

**Availability:** All countries.

---

## Step 4 — Create the Creative Mode in-app purchase (10 min)

In App Store Connect → your app → **In-App Purchases** tab → **+**:

| Field | Value |
|-------|-------|
| Type | Non-Consumable |
| Reference Name | `Creative Mode` |
| Product ID | `com.wrexist.silicon.sandbox` |

After creating it:
- Set price to **$2.99**
- Add Localization (English): Display Name = `Creative Mode`, Description = `Unlock unlimited Sandbox / Creative Mode`
- Upload a review screenshot (a screenshot of the Settings screen showing the "Creative Mode" row)
- Under **Review Information**: no additional notes needed

---

## Step 5 — Build the iOS project (30 min, one-time)

Open **Terminal** on your Mac:

```bash
# 1. Clone the repo (if not done)
git clone https://github.com/wrexist/silicon-tech-tycoon.git
cd silicon-tech-tycoon
git checkout claude/stoic-archimedes-lV0ht   # or merge to main first

# 2. Install dependencies
npm ci

# 3. Build the web bundle
npm run build

# 4. Add the iOS project (first time only)
npx cap add ios

# 5. Sync the web build into the iOS project
npx cap sync ios

# 6. Generate the app icon (requires the icon-source.png already in resources/)
npm run assets:icons
npx @capacitor/assets generate --ios

# 7. Open in Xcode
npx cap open ios
```

---

## Step 6 — Configure signing in Xcode (5 min)

In Xcode, with `App.xcworkspace` open:

1. Click the **App** target in the left panel
2. Go to **Signing & Capabilities** tab
3. Check **Automatically manage signing**
4. Select your **Team** from the dropdown
5. Confirm Bundle Identifier is `com.wrexist.silicon`
6. Click **+ Capability** → add **In-App Purchase**

Run on your iPhone or a Simulator (▶ button) to make sure it launches.

---

## Step 7 — Wire StoreKit for the IAP (30 min, optional for first TestFlight)

> **You can skip this for initial TestFlight testing** — the web build simulates the
> purchase. To ship to the App Store properly, complete this step before submission.

Open `src/state/iap.ts`. Search for `NATIVE INTEGRATION POINT` — there are 3 stubs.

**Install the plugin first:**
```bash
npm i @capacitor-community/in-app-purchases
npx cap sync ios
```

Then in `src/state/iap.ts`, replace each stub with real calls. The commented example code
in each stub shows exactly what to write. After editing:

```bash
npm run build && npx cap sync ios
```

**Test with a StoreKit Configuration File:**
In Xcode: **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration**
Click the **+** to create one. Add a Non-Consumable product with ID
`com.wrexist.silicon.sandbox` and price $2.99. This lets you test buy/restore in the
simulator without spending real money.

---

## Step 8 — Archive and upload to TestFlight (20 min)

In Xcode:

1. Select **Any iOS Device (arm64)** as the build target (not a simulator)
2. **Product → Archive**
3. When the Organizer opens, click **Distribute App**
4. Choose **App Store Connect → Upload**
5. Follow the prompts (Xcode handles signing automatically)

Back in App Store Connect → **TestFlight**:
- Your build appears within ~15 minutes
- Add yourself as an internal tester
- Install via TestFlight on your iPhone and do a final smoke test

---

## Step 9 — Declare App Privacy and submit (15 min)

In App Store Connect → your app → **App Privacy**:

1. Click **Get Started**
2. "Do you collect data from this app?" → **No**
3. Save

Back on the 1.0 submission page:
- Attach the IAP to the version: scroll to **In-App Purchases** → add Creative Mode
- Set **App Review Information** → Notes: paste the review notes block from `STORE_LISTING.md`
- Click **Submit for Review**

Apple typically reviews in **1–3 days**.

---

## Checklist summary

- [ ] `public/privacy.html` and `public/support.html` are live at real URLs
- [ ] App created in App Store Connect (`com.wrexist.silicon`)
- [ ] App Store listing fields filled in (from `STORE_LISTING.md`)
- [ ] `com.wrexist.silicon.sandbox` IAP created at $2.99
- [ ] `npm ci && npm run build && npx cap add ios && npx cap sync ios` run on Mac
- [ ] Signing configured in Xcode, build runs on device
- [ ] (Optional) StoreKit wired in `src/state/iap.ts` and tested in simulator
- [ ] App archived and uploaded to App Store Connect
- [ ] Tested on real iPhone via TestFlight
- [ ] App Privacy declared ("Data Not Collected")
- [ ] IAP attached to submission
- [ ] Review notes filled in
- [ ] Submitted for review

---

## That's it

If anything breaks in Xcode or you get a confusing error during archiving, email
me the error text and I can debug it. Every piece of code, every screenshot, all
metadata, and all icons are ready — the only things left are the ones only you can
do with your Apple account.
