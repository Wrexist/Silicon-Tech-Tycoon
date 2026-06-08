#!/usr/bin/env bash
# Sets all GitHub Actions secrets for silicon-tech-tycoon in one shot.
# Run this on your Mac. Requires the GitHub CLI: brew install gh
# then: gh auth login
#
# Usage: bash setup-secrets.sh

set -e

REPO="Wrexist/silicon-tech-tycoon"

echo ""
echo "Setting GitHub Actions secrets for $REPO"
echo "You'll be prompted for each value. Ctrl-C to abort."
echo ""

ask() {
  local name="$1"
  local hint="$2"
  echo "──────────────────────────────────────────"
  echo "  $name"
  echo "  Where: $hint"
  echo ""
  # -s hides input (like a password prompt)
  read -r -s -p "  Paste value then press Enter: " value
  echo ""
  gh secret set "$name" --body "$value" --repo "$REPO"
  echo "  ✓ saved"
  echo ""
}

ask "ASC_KEY_ID" \
  "appstoreconnect.apple.com → Users & Access → Integrations → Keys → Key ID column (10 chars)"

ask "ASC_ISSUER_ID" \
  "Same page — Issuer ID shown at the top (UUID format)"

echo "──────────────────────────────────────────"
echo "  ASC_KEY_P8"
echo "  Where: open your saved .p8 file in any text editor, copy EVERYTHING"
echo "  including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----"
echo "  If you lost the file, create a new key on that same page."
echo ""
echo "  Paste the .p8 contents, then press Enter, then Ctrl-D:"
p8=$(cat)
gh secret set "ASC_KEY_P8" --body "$p8" --repo "$REPO"
echo "  ✓ saved"
echo ""

ask "MATCH_GIT_URL" \
  "https://github.com/Wrexist/ios-certificates.git  (just paste this)"

ask "MATCH_GIT_USER" \
  "Your GitHub username — Wrexist  (just paste that)"

ask "MATCH_GIT_TOKEN" \
  "github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → tick 'repo' → copy"

ask "MATCH_PASSWORD" \
  "The passphrase you chose when you first ran 'fastlane match' (same one dynasty-manager uses)"

ask "APPLE_ID" \
  "Your Apple ID email address (isacmolin@gmail.com)"

ask "APPLE_TEAM_ID" \
  "developer.apple.com → Account → Membership Details → Team ID (10 chars)"

ask "ITC_TEAM_ID" \
  "Usually the same as APPLE_TEAM_ID — paste the same value unless you have multiple teams"

echo "══════════════════════════════════════════"
echo "  All secrets saved to $REPO"
echo "  Go to github.com/$REPO/actions to trigger the first build."
echo ""
