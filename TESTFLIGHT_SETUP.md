# Getting Silicon onto TestFlight — No Mac, No Match Password

Everything is done in a browser. GitHub Actions provides the Mac.

---

## The plan

The old Match password is locked inside the ios-certificates repo.
You can't recover it — but you can **wipe it and start fresh with a
password you choose**. This takes about 20 minutes total and fixes
both dynasty-manager and Silicon at the same time.

---

## Step 1 — Choose a new Match password

Pick any password. Write it down somewhere safe (Notes app, password manager).
You'll use it twice in this guide.

Example: `Mango-Circuit-88` (just don't use this one)

---

## Step 2 — Clear the ios-certificates repo

This deletes the old encrypted certificates so Match can create fresh ones.

1. Go to **github.com/Wrexist/ios-certificates**
2. Open each folder (`certs/`, `profiles/`) and delete all files inside them
   - Click a file → click the trash icon → Commit changes
   - Repeat for every file inside those folders
3. Leave the repo itself — just empty the folders

> If the repo only has one or two files at the root, delete those too.
> Leave the repo existing — just empty it out.

---

## Step 3 — Set secrets in Silicon

Go to **github.com/Wrexist/silicon-tech-tycoon →
Settings → Secrets and variables → Actions → New repository secret**

Add these 6 secrets:

| Secret | Where to get it |
|--------|-----------------|
| `MATCH_PASSWORD` | The new password you chose in Step 1 |
| `MATCH_GIT_URL` | `git@github.com:Wrexist/ios-certificates.git` |
| `MATCH_SSH_PRIVATE_KEY` | See "Finding your SSH key" below |
| `ASC_KEY_ID` | appstoreconnect.apple.com → Users → Keys → Key ID column |
| `ASC_ISSUER_ID` | Same page, UUID shown at the top |
| `ASC_KEY_P8` | Open your `.p8` file in Notepad, copy everything including the `-----BEGIN...` lines |

### Finding your SSH key (Windows)

Open **File Explorer** → go to `C:\Users\YourName\.ssh\`

Look for a file with no extension — usually named `id_rsa`, `id_ed25519`,
or something like `match_key`. Open it in Notepad and copy everything.

**Can't find it?** Create a new one:
1. Open **Git Bash** (installed with Git for Windows)
2. Run: `ssh-keygen -t ed25519 -f match_key -N ""`
3. Two files appear: `match_key` (private) and `match_key.pub` (public)
4. Add the **public** key to ios-certificates:
   github.com/Wrexist/ios-certificates → Settings → Deploy keys →
   Add deploy key → paste contents of `match_key.pub` → tick **Allow write access** → Add key
5. Use the **private** key (`match_key`, opened in Notepad) as the secret

> No Git for Windows? Download it free from gitforwindows.org

---

## Step 4 — Update dynasty-manager's MATCH_PASSWORD

dynasty-manager uses the same ios-certificates repo. Now that you've reset
it with a new password, update the secret there too.

1. Go to **github.com/Wrexist/dynasty-manager →
   Settings → Secrets → Actions**
2. Click **MATCH_PASSWORD** → Update → paste your new password → Save

---

## Step 5 — Create the app in App Store Connect

1. Go to **appstoreconnect.apple.com → My Apps → +**
2. Fill in:
   - **Platform:** iOS
   - **Name:** `Silicon: Tech Tycoon`
   - **Bundle ID:** `com.wrexist.silicon`
   - **SKU:** `SILICON-001`
3. Click Create

> If `com.wrexist.silicon` isn't in the Bundle ID dropdown:
> Go to developer.apple.com → Certificates, IDs & Profiles →
> Identifiers → + → App IDs → Bundle ID: `com.wrexist.silicon` →
> enable In-App Purchases → Continue → Register.
> Then come back and create the app.

---

## Step 6 — Run Match Setup (browser, ~5 min)

This runs on GitHub's Mac and creates fresh certificates for both
apps in your ios-certificates repo.

1. Go to **github.com/Wrexist/silicon-tech-tycoon → Actions**
2. Click **Match Setup (run once)** in the left sidebar
3. Click **Run workflow → Run workflow**
4. Wait for the green checkmark (~5 min)

---

## Step 7 — Rebuild dynasty-manager once

dynasty-manager needs to pull the new certificates too.
Trigger its TestFlight workflow once (or push a commit to main).
It will detect the new certs automatically.

---

## Step 8 — Ship Silicon to TestFlight

1. Go to **Actions → iOS TestFlight**
2. Click **Run workflow → Run workflow**
3. ~15 minutes → green checkmark
4. Build appears in TestFlight on your phone within 20 minutes

---

## After this — normal workflow

Every time you want a new build:
**Actions → iOS TestFlight → Run workflow**

To bump the version number, push a git tag:
```
git tag v1.0.1
git push origin v1.0.1
```
Then trigger the TestFlight workflow.

---

## Troubleshooting

**"Encrypted data seems to be tampered"**
→ Some old encrypted files are still in ios-certificates. Go back and
delete all files from `certs/` and `profiles/` folders, then re-run Match Setup.

**"No certificate found" or signing error in TestFlight workflow**
→ Match Setup didn't run yet, or it failed. Check its logs and re-run it.

**"Permission denied (publickey)" in Match Setup**
→ The SSH key in `MATCH_SSH_PRIVATE_KEY` doesn't have write access to
ios-certificates. Check: github.com/Wrexist/ios-certificates → Settings →
Deploy keys — make sure "Allow write access" is ticked.

**dynasty-manager broke after Step 7**
→ Check that `MATCH_PASSWORD` was updated in dynasty-manager (Step 4).
If it was, trigger its build workflow once and it will re-sync the certs.
