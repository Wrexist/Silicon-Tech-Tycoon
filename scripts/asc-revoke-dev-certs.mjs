// Clear the Apple Developer "certificate cap" that fails the iOS TestFlight archive.
//
// WHY THIS EXISTS
// The TestFlight workflow archives with AUTOMATIC signing on an ephemeral CI runner, so Xcode mints a
// fresh "Apple Development" certificate every run. They pile up until the account hits Apple's cert cap
// and the archive fails with: "choose a certificate to revoke … reached the maximum number of
// certificates" / "no iOS App Development provisioning profiles". Those piled-up dev certs are dead
// weight (each run makes its own), so revoking the old ones frees the cap. This script lists and
// revokes DEVELOPMENT certificates via the App Store Connect API — it NEVER touches Distribution
// certs, and by default it's a DRY RUN that only prints what it would do.
//
// (The durable fix is manual signing with a single reused certificate; this is the safe stopgap that
// keeps the current automatic-signing pipeline working.)
//
// USAGE (needs the same App Store Connect API key the workflow uses — an Admin or Developer key):
//   APP_STORE_CONNECT_KEY_ID=XXXX \
//   APP_STORE_CONNECT_ISSUER_ID=uuid \
//   APP_STORE_CONNECT_API_KEY_PATH=/path/AuthKey_XXXX.p8 \
//     node scripts/asc-revoke-dev-certs.mjs            # dry run — lists stale dev certs
//     node scripts/asc-revoke-dev-certs.mjs --yes      # actually revoke them (keeps the newest 1)
//     node scripts/asc-revoke-dev-certs.mjs --yes --keep 2
//
// You can pass the key inline instead of a path with APP_STORE_CONNECT_API_KEY_BASE64 (base64 of the
// .p8) or --key <path>. Requires Node 18+ (global fetch + crypto ES256). Nothing here touches the app.
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID;
const ISSUER_ID = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEEP = Math.max(0, parseInt(val("--keep", "1"), 10) || 0);
const DO_REVOKE = has("--yes");

function loadKeyPem() {
  const path = val("--key", process.env.APP_STORE_CONNECT_API_KEY_PATH);
  if (path) return readFileSync(path, "utf8");
  const b64 = process.env.APP_STORE_CONNECT_API_KEY_BASE64;
  if (b64) {
    const s = b64.trim();
    return s.includes("BEGIN PRIVATE KEY") ? s : Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  return null;
}

const keyPem = loadKeyPem();
if (!KEY_ID || !ISSUER_ID || !keyPem) {
  console.error("Missing credentials. Set APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, and");
  console.error("APP_STORE_CONNECT_API_KEY_PATH (or _BASE64, or --key <path>). See the header of this file.");
  process.exit(1);
}

// ---- ES256 JWT for App Store Connect (20-min expiry) ----
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }));
  const signingInput = `${header}.${payload}`;
  // ieee-p1363 → the raw r||s signature ES256/JOSE requires (openssl's default DER form is NOT valid here).
  const sig = crypto.sign("sha256", Buffer.from(signingInput), { key: keyPem, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}

const API = "https://api.appstoreconnect.apple.com";
async function api(method, path) {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${makeJwt()}` } });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.errors?.map((e) => e.detail || e.title).join("; ") || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return body;
}

async function listCertificates() {
  const out = [];
  let path = "/v1/certificates?limit=200";
  while (path) {
    const page = await api("GET", path);
    out.push(...(page.data || []));
    const next = page.links?.next;
    path = next ? next.replace(API, "") : null;
  }
  return out;
}

const isDevelopment = (type) => typeof type === "string" && /DEVELOPMENT/.test(type) && !/DISTRIBUTION/.test(type);

(async () => {
  const certs = await listCertificates();
  const dev = certs
    .filter((c) => isDevelopment(c.attributes?.certificateType))
    .map((c) => ({
      id: c.id,
      type: c.attributes.certificateType,
      name: c.attributes.name || c.attributes.displayName || "(unnamed)",
      created: c.attributes.expirationDate || "",
    }))
    // Newest first (by expiration, a proxy for creation) so --keep preserves the freshest.
    .sort((a, b) => (b.created || "").localeCompare(a.created || ""));

  console.log(`Found ${certs.length} certificates total, ${dev.length} of them DEVELOPMENT.`);
  if (dev.length === 0) { console.log("Nothing to revoke — the cap isn't from dev certs."); return; }

  const keep = dev.slice(0, KEEP);
  const revoke = dev.slice(KEEP);
  if (keep.length) console.log(`Keeping newest ${keep.length}: ${keep.map((c) => c.name).join(", ")}`);
  if (revoke.length === 0) { console.log(`No dev certs beyond the newest ${KEEP} — nothing to do.`); return; }

  console.log(`\n${DO_REVOKE ? "Revoking" : "Would revoke"} ${revoke.length} DEVELOPMENT certificate(s):`);
  for (const c of revoke) console.log(`  • ${c.name}  [${c.type}]  ${c.id}`);

  if (!DO_REVOKE) {
    console.log("\nDry run — re-run with --yes to actually revoke. (Distribution certs are never touched.)");
    return;
  }
  let ok = 0;
  for (const c of revoke) {
    try { await api("DELETE", `/v1/certificates/${c.id}`); ok++; }
    catch (e) { console.error(`  ! failed to revoke ${c.name}: ${e.message}`); }
  }
  console.log(`\nRevoked ${ok}/${revoke.length}. Re-run the iOS TestFlight workflow — automatic signing can mint a fresh cert now.`);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
