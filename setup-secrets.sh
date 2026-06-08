#!/usr/bin/env bash
# Sets the 6 GitHub Actions secrets for silicon-tech-tycoon.
# These are the same secrets dynasty-manager uses — same Apple account,
# same ios-certificates repo, same SSH key.
#
# Requirements: brew install gh && gh auth login
# Usage:        bash setup-secrets.sh

set -e
REPO="Wrexist/silicon-tech-tycoon"

echo ""
echo "Setting secrets for $REPO"
echo "Same values as dynasty-manager — find them from the sources below."
echo ""

ask() {
  local name="$1"
  local hint="$2"
  echo "──────────────────────────────────────────────────────"
  echo "  $name"
  echo "  $hint"
  echo ""
  read -r -s -p "  Paste value, press Enter: " value
  echo ""
  gh secret set "$name" --body "$value" --repo "$REPO"
  echo "  ✓ saved"
  echo ""
}

ask "ASC_KEY_ID" \
  "appstoreconnect.apple.com → Users & Access → Integrations → Keys → Key ID column"

ask "ASC_ISSUER_ID" \
  "Same page — Issuer ID shown at the very top (UUID)"

echo "──────────────────────────────────────────────────────"
echo "  ASC_KEY_P8"
echo "  Open your .p8 file in TextEdit, copy everything including"
echo "  -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----"
echo "  (If lost, delete the old key and create a new one on that page.)"
echo ""
echo "  Paste the .p8 contents, then press Enter then Ctrl-D:"
p8=$(cat)
gh secret set "ASC_KEY_P8" --body "$p8" --repo "$REPO"
echo "  ✓ saved"
echo ""

ask "MATCH_GIT_URL" \
  "SSH URL of ios-certificates: git@github.com:Wrexist/ios-certificates.git"

ask "MATCH_PASSWORD" \
  "The passphrase you set when you first ran 'fastlane match' — same one dynasty-manager uses"

echo "──────────────────────────────────────────────────────"
echo "  MATCH_SSH_PRIVATE_KEY"
echo "  The SSH private key that has read access to ios-certificates."
echo "  Same key dynasty-manager uses for MATCH_SSH_PRIVATE_KEY."
echo "  Find it: cat ~/.ssh/your_match_key  (the private key, starts with -----BEGIN)"
echo "  OR: copy the value from dynasty-manager (Settings → Secrets → MATCH_SSH_PRIVATE_KEY"
echo "       — you can't see it there, but you can update it with gh secret set)"
echo ""
echo "  Paste the private key contents, then press Enter then Ctrl-D:"
sshkey=$(cat)
gh secret set "MATCH_SSH_PRIVATE_KEY" --body "$sshkey" --repo "$REPO"
echo "  ✓ saved"
echo ""

echo "══════════════════════════════════════════════════════"
echo "  All 6 secrets saved to $REPO"
echo ""
echo "  Next: go to GitHub Actions → iOS TestFlight → Run workflow"
echo ""
