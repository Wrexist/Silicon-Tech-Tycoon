/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paywallCopy, type ProFeature } from "./proGates.ts";

// Source-invariant guard against ADVERTISED-BUT-UNENFORCED gates — the drift that shipped once and
// was caught in review: `challengeArchive` was a `ProFeature` with paywall copy claiming the
// cross-run challenge archive was Pro, while `Challenges.tsx` rendered that archive to everyone and
// nothing in `src/` ever called the gate. A promise the code does not keep is a false purchase
// claim (Guideline 3.1.2 surface) whichever way you resolve it.
//
// The rule this pins, in both directions:
//   1. every member of `ProFeature` has a REAL enforcement call site in src/ — a
//      `openPaywall({ reason: "<feature>" … })` sitting behind a lock condition in the same file;
//   2. every member has its own paywall COPY entry (not the `onboarding` fallback), and no COPY
//      entry survives for a reason that no longer exists.
//
// Read with node:fs rather than import.meta.glob("?raw") for the same reason tokenRefs.test.ts
// does: under Vitest the transform pipeline can hand back transformed/empty text and the scan
// passes vacuously. The counts asserted at the bottom are the anti-vacuity latch.

const SRC = dirname(dirname(fileURLToPath(import.meta.url))); // …/src
const GATES = join(SRC, "state", "proGates.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const gatesSrc = readFileSync(GATES, "utf8");

/** The union, read from the source of truth — so adding a member here cannot skip this file. */
const FEATURES = (() => {
  const block = /export type ProFeature =([\s\S]*?);/.exec(gatesSrc);
  if (!block) throw new Error("could not find `export type ProFeature` in proGates.ts");
  return [...block[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1] as ProFeature);
})();

/** The keys actually present in the COPY table, read the same way. */
const COPY_KEYS = (() => {
  const block = /const COPY: Record<PaywallReason, PaywallCopy> = \{([\s\S]*?)\n\};/.exec(gatesSrc);
  if (!block) throw new Error("could not find the COPY table in proGates.ts");
  return [...block[1].matchAll(/^ {2}([A-Za-z0-9_]+): \{$/gm)].map((m) => m[1]);
})();

// Everything that could enforce a gate: the app's own source, minus the tests and minus the gate
// table itself (where every feature name obviously appears).
const SELF = fileURLToPath(import.meta.url);
const appFiles = walk(SRC)
  .filter((p) => !/\.test\.tsx?$/.test(p) && p !== GATES && p !== SELF)
  .map((p) => ({ path: p.slice(SRC.length + 1), text: readFileSync(p, "utf8") }));

/**
 * A file "enforces" a feature when all three are true of it:
 *   • it names the feature literally — either as the paywall reason (`reason: "vault"`) or as the
 *     argument to the gate itself (`isLocked("vault", pro)`); the Progress hub does the latter and
 *     then passes the same value through as the reason, so both spellings are real enforcement;
 *   • it evaluates a lock (`isLocked(` / `eraAdvanceLocked(` / `scenarioLocked(` / `!pro`);
 *   • it raises the one purchase surface (`openPaywall(`).
 */
const LOCK_CHECK = /isLocked\(|Locked\(|!\s*pro\b/;
function enforcers(feature: string): string[] {
  const named = new RegExp(`reason:\\s*"${feature}"|isLocked\\(\\s*"${feature}"`);
  return appFiles
    .filter((f) => named.test(f.text) && LOCK_CHECK.test(f.text) && f.text.includes("openPaywall("))
    .map((f) => f.path);
}

describe("every advertised Pro feature is actually enforced", () => {
  it.each(FEATURES)("%s has a real enforcement call site in src/", (feature) => {
    const sites = enforcers(feature);
    expect(
      sites,
      `"${feature}" is in ProFeature but nothing in src/ gates on it. Either wire the gate ` +
        `(openPaywall({ reason: "${feature}" }) behind an isLocked check) or delete the feature and ` +
        `its copy — an advertised lock the code never applies is a false purchase claim.`,
    ).not.toHaveLength(0);
  });

  it.each(FEATURES)("%s has its own paywall copy, not the generic fallback", (feature) => {
    expect(COPY_KEYS, `no COPY entry for the "${feature}" gate`).toContain(feature);
    const c = paywallCopy(feature);
    // `paywallCopy` falls back to `onboarding`, so a missing entry would otherwise read as "fine".
    expect(c, `"${feature}" falls through to the onboarding copy`).not.toEqual(paywallCopy("onboarding"));
    expect(c.title.trim().length).toBeGreaterThan(0);
    expect(c.body.trim().length).toBeGreaterThan(0);
    expect(c.eyebrow.trim().length).toBeGreaterThan(0);
  });

  it("keeps no orphan copy for a reason that no longer exists", () => {
    const valid = new Set<string>([...FEATURES, "onboarding", "upgradeYearly"]);
    for (const key of COPY_KEYS) {
      expect(valid.has(key), `COPY still sells "${key}", which is not a PaywallReason`).toBe(true);
    }
  });

  it("scanned real files and a real union — the guard above is not vacuous", () => {
    expect(appFiles.length).toBeGreaterThan(50);
    expect(appFiles.some((f) => f.text.includes("openPaywall("))).toBe(true);
    expect(FEATURES.length).toBeGreaterThanOrEqual(8);
    expect(FEATURES).toContain("timeMachine");
    // The archive is FREE by decision (MONETIZATION_CONTRACT.md) — it must never come back as a gate
    // without the enforcement this file demands.
    expect(FEATURES).not.toContain("challengeArchive");
  });
});
