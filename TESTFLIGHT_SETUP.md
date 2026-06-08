# Getting Silicon onto TestFlight — No Mac Required

You don't need a Mac. GitHub Actions provides one.
Everything below is done in a browser or on your Windows PC.

---

## Overview

| Step | Where | Time |
|------|-------|------|
| 1. Set 6 secrets in GitHub | Browser | 10 min |
| 2. Create app in App Store Connect | Browser | 10 min |
| 3. Run Match Setup workflow once | Browser (GitHub Actions) | 5 min |
| 4. Run TestFlight workflow | Browser (GitHub Actions) | ~15 min |

---

## Step 1 — Set the 6 secrets

Go to:
**github.com/Wrexist/silicon-tech-tycoon → Settings → Secrets and variables → Actions → New repository secret**

Add each one:

---

### `ASC_KEY_ID`
**Where:** appstoreconnect.apple.com → Users and Access → Integrations → Keys

The 10-character Key ID in the list. Looks like `AB12CD34EF`.

---

### `ASC_ISSUER_ID`
**Where:** Same page, shown at the very top. Looks like a UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

### `ASC_KEY_P8`
**Where:** The `.p8` file you downloaded when you created the API key.

On Windows: right-click the `.p8` file → Open with → Notepad. Copy everything, including the lines:
```
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

> If you've lost the file: go back to App Store Connect → Keys → click the red ✕ next to the old key to revoke it → create a new one and download the new `.p8`.

---

### `MATCH_GIT_URL`
**Value:** `git@github.com:Wrexist/ios-certificates.git`

Just paste that exactly.

---

### `MATCH_PASSWORD`
**Where:** This is the passphrase you chose when you first set up Fastlane Match for dynasty-manager. It's a password you know — same one dynasty-manager uses.

---

### `MATCH_SSH_PRIVATE_KEY`
This is the SSH private key that has read/write access to your ios-certificates repo. It's the same key dynasty-manager uses.

**Finding it on Windows:**
Open File Explorer → navigate to `C:\Users\YourName\.ssh\`
Look for a file without an extension (e.g. `id_rsa` or `id_ed25519` or a custom name like `match_key`).
Right-click → Open with → Notepad. Copy everything including:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

> **Can't find it?** You may have generated it on a different computer. In that case, create a new SSH key pair:
> 1. Open Git Bash on Windows (or any terminal)
> 2. Run: `ssh-keygen -t ed25519 -f match_key -N ""`
> 3. This creates `match_key` (private) and `match_key.pub` (public)
> 4. Copy `match_key.pub` content → github.com/Wrexist/ios-certificates → Settings → Deploy keys → Add deploy key → tick "Allow write access"
> 5. Copy `match_key` content → paste as this secret

---

## Step 2 — Create the app in App Store Connect

1. Go to **appstoreconnect.apple.com → My Apps → +**
2. Fill in:
   - **Platform:** iOS
   - **Name:** `Silicon: Tech Tycoon`
   - **Bundle ID:** `com.wrexist.silicon`
   - **SKU:** `SILICON-001`
3. Click Create

> If `com.wrexist.silicon` isn't in the dropdown: go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers → +** → App IDs → enter bundle ID `com.wrexist.silicon` → enable **In-App Purchases** → Save. Then come back and create the app.

---

## Step 3 — Run Match Setup (once, in browser)

This tells Fastlane Match to create a certificate + provisioning profile for `com.wrexist.silicon` and store it in your ios-certificates repo. It runs on GitHub's Mac — you just click a button.

1. Go to **github.com/Wrexist/silicon-tech-tycoon → Actions**
2. Click **Match Setup (run once)** in the left sidebar
3. Click **Run workflow → Run workflow**
4. Wait ~5 minutes. ✓ Green = ready to build.

> Only needs to run once. After this, the certificate lives in ios-certificates and every future build just downloads it.

---

## Step 4 — Run your first TestFlight build

1. Go to **Actions → iOS TestFlight**
2. Click **Run workflow → Run workflow**
3. Watch the logs. First run takes ~15 minutes (installing gems + pods).
4. When it goes green, your build appears in TestFlight within ~20 minutes.

To install on your phone: open the **TestFlight app** → your build appears there.

---

## After that — how to ship updates

**To push a new build:** just run the "iOS TestFlight" workflow again (click Run workflow).

**To bump the version number:**
Push a git tag and the release workflow auto-updates `package.json`:
```bash
git tag v1.0.1
git push origin v1.0.1
```
Then run the TestFlight workflow.

---

## Troubleshooting

**Match Setup fails with "No profiles found"**
→ The app might not exist in App Store Connect yet. Complete Step 2 first.

**"Authentication failed" or "Permission denied (publickey)"**
→ The `MATCH_SSH_PRIVATE_KEY` doesn't match the deploy key on ios-certificates.
Re-check: github.com/Wrexist/ios-certificates → Settings → Deploy keys — does the public key there match your private key?

**"Invalid API key" or 403 from App Store Connect**
→ Check `ASC_KEY_P8` — it must include the full `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines with no extra spaces.

**Build uploads but doesn't appear in TestFlight**
→ Normal — Apple takes up to 20 minutes to process. Check App Store Connect → TestFlight.

**"CURRENT_PROJECT_VERSION" sed fails**
→ The sed runs after `cap sync ios` so the file always exists. If it still fails, check the Actions log for the exact error.
