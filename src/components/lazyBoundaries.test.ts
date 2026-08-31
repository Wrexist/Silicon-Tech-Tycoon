/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guard for the crash class found in the 2026-08 release-candidate audit: a CODE-SPLIT component
// mounted under <Suspense> with no <ErrorBoundary> above it.
//
// React.lazy re-throws its import rejection DURING RENDER. Suspense handles the pending state and
// nothing else — a rejected chunk is an error, and only a boundary catches an error. So a lazy mount
// without a boundary sends the throw to the nearest one above it, which in this app is the ROOT
// boundary in App.tsx: the entire game is replaced by the crash card because one chunk 404'd.
//
// That is not hypothetical on this app's two shipping targets. On web/PWA the service worker can hold
// a precache manifest naming hashed chunks that a newer deploy has already deleted; every one of those
// filenames then 404s until the SW updates. And the worst case was the interrupt overlays, whose
// `pendingX` lives in the SAVE: crash → reload → same card raised → same missing chunk → crash, a loop
// whose only exit from the crash screen was deleting the company.
//
// The rule enforced here is deliberately coarse — a module that creates lazy components must also
// declare a boundary — because the precise question ("is THIS mount inside a boundary?") needs a JSX
// parse, while the coarse one has no false negatives that matter: every lazy mount in this app is in
// the same module as its boundary. "A boundary" is either the shared <ErrorBoundary> or a local class
// with getDerivedStateFromError: the 3D scene deliberately uses its own tiny RobotBoundary /
// ModelBoundary, which swap a failed .glb for the parametric mesh rather than dropping the office.
// Read with node:fs for the same reason tokenRefs.test.ts does.

const SRC = dirname(dirname(fileURLToPath(import.meta.url))); // …/src

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.slice(SRC.length + 1).replace(/\\/g, "/");
const files = walk(SRC).map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));

/** `lazy(` as a call, not the word inside an identifier or a comment sentence. */
const LAZY = /(?:^|[^A-Za-z0-9_$.])lazy\s*\(/;
/** The shared boundary component, or a local class boundary of its own. */
const BOUNDED = /<ErrorBoundary|getDerivedStateFromError/;

describe("lazy-loaded components are bounded", () => {
  const lazyModules = files.filter((f) => LAZY.test(f.text));

  it("finds the known code-split mount points (the scan is not vacuous)", () => {
    // If a rename makes this list stale, that is the signal to re-check the renamed file by hand —
    // a scan that silently matches nothing would pass every assertion below for the wrong reason.
    expect(lazyModules.map((f) => f.path).sort()).toEqual([
      "App.tsx",
      "components/FactoryMode.tsx",
      "components/Interrupts.tsx",
      "garage3d/Garage3D.tsx",
      "garage3d/furniture3d.tsx",
      "screens/HQ.tsx",
    ]);
  });

  it.each([
    "App.tsx",
    "components/FactoryMode.tsx",
    "components/Interrupts.tsx",
    "garage3d/Garage3D.tsx",
    "garage3d/furniture3d.tsx",
    "screens/HQ.tsx",
  ])("%s bounds its lazy mounts", (path) => {
    const mod = lazyModules.find((f) => f.path === path);
    expect(mod, `${path} no longer creates lazy components`).toBeDefined();
    expect(mod!.text, `${path} mounts a lazy component with no boundary above it`).toMatch(BOUNDED);
  });

  it("every module with a <Suspense> mount also declares a boundary", () => {
    const unbounded = files
      .filter((f) => /<Suspense/.test(f.text) && !BOUNDED.test(f.text))
      .map((f) => f.path);
    expect(unbounded).toEqual([]);
  });
});

describe("boot cannot fail silently", () => {
  const main = files.find((f) => f.path === "main.tsx");

  it("main.tsx handles a rejected boot()", () => {
    expect(main).toBeDefined();
    // `void boot()` alone discards the rejection: the inline splash in index.html is never removed
    // and the player is left on a frozen loading screen with no message and no way out. The root
    // ErrorBoundary cannot cover this — it does not exist until React has mounted.
    expect(main!.text).not.toMatch(/void\s+boot\(\)\s*;/);
    expect(main!.text).toMatch(/boot\(\)\s*\.catch\(/);
  });

  it("the boot failure screen offers a reload", () => {
    expect(main!.text).toMatch(/location\.reload\(\)/);
  });
});
