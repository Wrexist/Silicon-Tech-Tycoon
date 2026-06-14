# App Store launch kit

Everything you need to ship **Silicon: Tech Tycoon** to the App Store, in one folder.

| File | What it's for |
|---|---|
| `APP_STORE_METADATA.md` | Every listing field, copy-paste ready (name, keywords, description, what's-new, age rating, privacy, review notes, URLs, checklist). |
| `IAP_GUIDE.md` | The single Creative Mode IAP — create it, wire StoreKit, test it. Includes the "ship with or without the IAP" decision. |
| `SCREENSHOT_PROMPT.md` | A paste-ready prompt for Claude to turn raw captures into finished marketing screenshots, plus the recommended 5-image set + captions. |
| `screenshots/raw/` | High-res (1290×2796) raw captures of the best scenes — feed these to the screenshot prompt, or replace with real-device TestFlight captures. |
| `screenshots/final/` | (You generate this) the framed, captioned screenshots to upload. |

**Order of operations to launch:**
1. Decide IAP path (`IAP_GUIDE.md` → "ship with or without").
2. Host privacy + support pages, grab the URLs (`../WHAT_YOU_NEED_TO_DO.md` Step 1).
3. Fill the listing from `APP_STORE_METADATA.md`.
4. Generate screenshots with `SCREENSHOT_PROMPT.md`.
5. Build + upload via Xcode (`../BUILD_IOS.md`), attach build + (optional) IAP, submit.

Repo facts: bundle `com.wrexist.silicon` · base price $8.99 · IAP `com.wrexist.silicon.sandbox` $2.99.
