import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// A deployed update swaps every hashed chunk while an open tab still holds the old names, so the
// next lazy screen it opens 404s. main.tsx recovers with a ONE-SHOT reload on `vite:preloadError`.
// These are source-invariant pins (the handler runs before React and has no seam to call directly):
// they exist so a future edit can't quietly drop the recovery or turn it into a reload loop.
const SRC = readFileSync(resolve(__dirname, "./main.tsx"), "utf8");

describe("stale-chunk recovery", () => {
  it("listens for vite:preloadError", () => {
    expect(SRC).toMatch(/addEventListener\(\s*["']vite:preloadError["']/);
  });

  it("reloads at most once, gated on a session flag", () => {
    const handler = SRC.slice(SRC.indexOf('"vite:preloadError"'));
    const body = handler.slice(0, handler.indexOf("\n  });"));
    expect(body).toContain("sessionStorage");
    expect(body).toMatch(/silicon\.chunkReload/);
    // the reload must be guarded — never an unconditional call
    expect(body).toMatch(/if\s*\(!alreadyTried\)\s*window\.location\.reload\(\)/);
    expect(body).not.toMatch(/^\s*window\.location\.reload\(\);\s*$/m);
  });

  it("does NOT reload when sessionStorage is unavailable (looping is worse than degrading)", () => {
    const handler = SRC.slice(SRC.indexOf('"vite:preloadError"'));
    const body = handler.slice(0, handler.indexOf("\n  });"));
    // the flag defaults to "already tried" so a throwing/blocked storage falls through quietly
    expect(body).toMatch(/let alreadyTried = true/);
  });
});
