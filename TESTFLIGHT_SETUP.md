# TestFlight via GitHub Actions — Setup Guide

The workflow at `.github/workflows/testflight.yml` builds the app and uploads
to TestFlight automatically whenever you push to `main`, or manually via the
"Run workflow" button in the Actions tab.

It uses **Fastlane** + **Fastlane Match** (your `ios-certificates` repo for
certificates) + **App Store Connect API key** (no 2FA issues).

---

## Step 1 — Create an App Store Connect API key (once)

1. Go to **appstoreconnect.apple.com** → Users and Access → **Integrations** → Keys
2. Click **+** → give it a name like "GitHub Actions" → Role: **App Manager**
3. Download the `.p8` file — **you can only download it once**
4. Note down:
   - **Key ID** (10-char code shown on the list, e.g. `AB12CD34EF`)
   - **Issuer ID** (UUID shown at the top of the Keys page)
   - The `.p8` file contents (open it in a text editor — it starts with `-----BEGIN PRIVATE KEY-----`)

---

## Step 2 — Make sure your ios-certificates repo has the right profile

If you already use Match for dynasty-manager, just add Silicon to it:

```bash
# On your Mac, in the Silicon-Tech-Tycoon folder:
bundle exec fastlane match appstore --app_identifier com.wrexist.silicon
```

This creates/uploads an App Store distribution certificate + provisioning profile
for `com.wrexist.silicon` into your `ios-certificates` repo.

If this is your first time using Match at all, run:
```bash
bundle exec fastlane match init    # sets up the Matchfile
bundle exec fastlane match appstore
```

---

## Step 3 — Add GitHub Actions secrets

Go to **github.com/Wrexist/silicon-tech-tycoon** → Settings → Secrets and variables
→ Actions → **New repository secret**. Add each one below:

| Secret name | Where to find the value |
|-------------|------------------------|
| `ASC_KEY_ID` | The 10-char Key ID from Step 1 |
| `ASC_ISSUER_ID` | The UUID Issuer ID from Step 1 |
| `ASC_KEY_P8` | The full contents of the `.p8` file (copy-paste everything including the `-----BEGIN...` and `-----END...` lines) |
| `MATCH_GIT_URL` | `https://github.com/Wrexist/ios-certificates.git` |
| `MATCH_GIT_USER` | `Wrexist` (your GitHub username) |
| `MATCH_GIT_TOKEN` | A GitHub Personal Access Token with `repo` scope — create at github.com/settings/tokens → "Generate new token (classic)" → tick `repo` |
| `MATCH_PASSWORD` | The passphrase you used when setting up Match (the one it asked for when you first ran `match appstore`) |
| `APPLE_ID` | Your Apple ID email (e.g. `isacmolin@gmail.com`) |
| `APPLE_TEAM_ID` | Your 10-char Apple Developer team ID — find it at developer.apple.com → Account → Membership Details |
| `ITC_TEAM_ID` | Your App Store Connect team ID — usually the same as APPLE_TEAM_ID; if you're unsure, use the same value |

---

## Step 4 — Trigger the first build

**Option A — Automatic:** Push any commit to the `main` branch. The workflow
starts immediately in the Actions tab.

**Option B — Manual:**
1. Go to **github.com/Wrexist/silicon-tech-tycoon** → Actions tab
2. Click **TestFlight** in the left sidebar
3. Click **Run workflow** → **Run workflow** (green button)

Watch the logs live. First run takes ~15 minutes (gem + pod install cache is cold).
Subsequent runs take ~8 minutes.

---

## What the workflow does (in order)

```
1.  Checkout code
2.  Install npm dependencies
3.  Build the web bundle (npm run build → dist/)
4.  Generate the ios/ Xcode project (npx cap add ios + npx cap sync ios)
5.  Copy your committed fastlane/ files into ios/App/
6.  Install CocoaPods (pod install)
7.  Generate the app icon from resources/icon.png
8.  Run: fastlane beta
    a.  Authenticate with App Store Connect API key
    b.  Pull certificates from ios-certificates repo (Match)
    c.  Set build number = GitHub run number (auto-increments)
    d.  Archive the app (xcodebuild)
    e.  Upload to TestFlight
9.  Save the .ipa as a build artifact (14-day retention)
```

---

## Troubleshooting

**"No profiles found for com.wrexist.silicon"**
→ Run `bundle exec fastlane match appstore` on your Mac first (Step 2).

**"Invalid API key"**
→ Double-check `ASC_KEY_P8` contains the full `.p8` file including the header/footer lines.

**"Authentication failed" for ios-certificates**
→ Your `MATCH_GIT_TOKEN` may have expired or lacks `repo` scope. Regenerate it at github.com/settings/tokens.

**"bundle exec: command not found"**
→ The Gemfile.lock is missing. Run `bundle install` locally once and commit the `Gemfile.lock`.

**Build succeeds but app not in TestFlight**
→ `skip_waiting_for_build_processing: true` means it uploads but doesn't wait. Check TestFlight in App Store Connect — the build appears within ~20 minutes of the upload.
